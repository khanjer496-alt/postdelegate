import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { ORG_API_KEY_LABEL } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository';
import { AI_CREDENTIAL_LABEL } from '@gitroom/nestjs-libraries/database/prisma/ai-credentials/ai.credential.repository';
import { OAUTH_SECRET_LABELS } from '@gitroom/nestjs-libraries/database/prisma/oauth/oauth.service';
import { SecretBackfillService } from '@gitroom/nestjs-libraries/database/prisma/secrets/secret.backfill.service';
import {
  SecretCrypto,
  SecretCryptoError,
} from '@gitroom/nestjs-libraries/database/prisma/secrets/secret.crypto';

const KEY = Buffer.alloc(32, 23).toString('base64');

// Stands in for SecretBackfillRepository: holds rows per table and applies the
// same compare-and-swap the real updateMany does, so "the row changed under us"
// is real behaviour here rather than a mocked branch.
const repositoryFake = (tables: Record<string, any[]> = {}) => {
  const rows = tables;
  const repository = {
    page: jest.fn(
      async (table: string, _columns: string[], take: number, cursor?: string) =>
        (rows[table] ?? [])
          .filter((row) => !cursor || row.id > cursor)
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .slice(0, take)
          .map((row) => ({ ...row }))
    ),
    replace: jest.fn(
      async (
        table: string,
        id: string,
        previous: Record<string, unknown>,
        next: Record<string, unknown>
      ) => {
        const row = (rows[table] ?? []).find((candidate) => candidate.id === id);
        if (!row) return { count: 0 };
        const stillThere = Object.entries(previous).every(
          ([column, value]) => row[column] === value
        );
        if (!stillThere) return { count: 0 };
        Object.assign(row, next);
        return { count: 1 };
      }
    ),
  };
  return { rows, repository };
};

describe('SecretBackfillService', () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
    delete process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS;
    process.env.JWT_SECRET = 'unit-test-secret';
    SecretCrypto.reset();
  });

  afterAll(() => {
    process.env = { ...env };
    SecretCrypto.reset();
  });

  it('refuses to run with no key configured', async () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    SecretCrypto.reset();
    const { repository } = repositoryFake();

    await expect(
      new SecretBackfillService(repository as any).run()
    ).rejects.toThrow(SecretCryptoError);
  });

  describe('organizations', () => {
    // The pre-migration row holds the key itself. The backfill must hash and
    // encrypt THAT value, not the id hiding inside it.
    const legacyKey = AuthService.fixedEncryption('discarded-random-id');

    it('hashes and encrypts the key the customer holds', async () => {
      const { repository, rows } = repositoryFake({
        organization: [
          { id: 'org-1', apiKey: legacyKey, apiKeyHash: null },
        ],
      });

      const report = await new SecretBackfillService(repository as any).run({
        only: 'org',
      });

      const row = rows.organization[0];
      expect(row.apiKeyHash).toBe(
        SecretCrypto.hash(legacyKey, ORG_API_KEY_LABEL)
      );
      expect(SecretCrypto.decrypt(row.apiKey, ORG_API_KEY_LABEL)).toBe(
        legacyKey
      );
      expect(report.organization.updated).toBe(1);
    });

    it('is idempotent: a second run changes nothing', async () => {
      const { repository, rows } = repositoryFake({
        organization: [{ id: 'org-1', apiKey: legacyKey, apiKeyHash: null }],
      });
      const service = new SecretBackfillService(repository as any);

      await service.run({ only: 'org' });
      const afterFirst = { ...rows.organization[0] };
      const second = await service.run({ only: 'org' });

      expect(rows.organization[0]).toEqual(afterFirst);
      expect(second.organization.updated).toBe(0);
      expect(second.organization.unchanged).toBe(1);
    });

    it('writes nothing in a dry run but reports what it would write', async () => {
      const { repository, rows } = repositoryFake({
        organization: [{ id: 'org-1', apiKey: legacyKey, apiKeyHash: null }],
      });

      const report = await new SecretBackfillService(repository as any).run({
        only: 'org',
        dryRun: true,
      });

      expect(rows.organization[0].apiKeyHash).toBe(null);
      expect(rows.organization[0].apiKey).toBe(legacyKey);
      expect(report.organization.updated).toBe(1);
      expect(report.organization.dryRun).toBe(true);
      expect(repository.replace).not.toHaveBeenCalled();
    });

    it('skips a row that changed while the batch was in flight', async () => {
      const { repository, rows } = repositoryFake({
        organization: [{ id: 'org-1', apiKey: legacyKey, apiKeyHash: null }],
      });
      repository.page = jest.fn(async () => {
        // the row the backfill reads is already stale
        rows.organization[0].apiKey = AuthService.fixedEncryption('rotated');
        return [{ id: 'org-1', apiKey: legacyKey, apiKeyHash: null }];
      }) as any;

      const report = await new SecretBackfillService(repository as any).run({
        only: 'org',
      });

      expect(report.organization.skippedChanged).toBe(1);
      expect(report.organization.updated).toBe(0);
    });

    it('pages through more rows than one batch', async () => {
      const organization = Array.from({ length: 5 }, (_, i) => ({
        id: `org-${i}`,
        apiKey: AuthService.fixedEncryption(`id-${i}`),
        apiKeyHash: null,
      }));
      const { repository, rows } = repositoryFake({ organization });

      const report = await new SecretBackfillService(repository as any).run({
        only: 'org',
        batchSize: 2,
      });

      expect(report.organization.scanned).toBe(5);
      expect(report.organization.updated).toBe(5);
      expect(rows.organization.every((row) => !!row.apiKeyHash)).toBe(true);
    });
  });

  describe('verification and failures', () => {
    it('leaves a row it cannot read alone and counts it unreadable', async () => {
      const { repository, rows } = repositoryFake({
        aiCredential: [{ id: 'ai-1', apiKey: 'not-hex-and-not-encrypted!!' }],
      });

      const report = await new SecretBackfillService(repository as any).run({
        only: 'credentials',
      });

      expect(rows.aiCredential[0].apiKey).toBe('not-hex-and-not-encrypted!!');
      expect(report.aiCredential.unreadable).toBe(1);
      expect(report.aiCredential.updated).toBe(0);
    });

    it('converts an AI key and reads it back as the original', async () => {
      const { repository, rows } = repositoryFake({
        aiCredential: [
          { id: 'ai-1', apiKey: AuthService.fixedEncryption('sk-proj-key') },
        ],
      });

      await new SecretBackfillService(repository as any).run({
        only: 'credentials',
      });

      expect(rows.aiCredential[0].apiKey.startsWith('enc:v1:')).toBe(true);
      expect(
        SecretCrypto.decrypt(rows.aiCredential[0].apiKey, AI_CREDENTIAL_LABEL)
      ).toBe('sk-proj-key');
    });
  });

  describe('oauth', () => {
    it('replaces a legacy access token with its hash', async () => {
      const token = 'pos_live';
      const { repository, rows } = repositoryFake({
        oAuthAuthorization: [
          { id: 'auth-1', accessToken: AuthService.fixedEncryption(token) },
        ],
      });

      await new SecretBackfillService(repository as any).run({
        only: 'oauth',
      });

      expect(rows.oAuthAuthorization[0].accessToken).toBe(
        SecretCrypto.hash(token, OAUTH_SECRET_LABELS.accessToken)
      );
    });

    it('leaves a row whose token is already hashed', async () => {
      const hashed = SecretCrypto.hash('pos_live', OAUTH_SECRET_LABELS.accessToken);
      const { repository, rows } = repositoryFake({
        oAuthAuthorization: [{ id: 'auth-1', accessToken: hashed }],
      });

      const report = await new SecretBackfillService(repository as any).run({
        only: 'oauth',
      });

      expect(rows.oAuthAuthorization[0].accessToken).toBe(hashed);
      expect(report.oAuthAuthorization.unchanged).toBe(1);
    });
  });

  it('reports every table it touched when no filter is given', async () => {
    const { repository } = repositoryFake();
    const report = await new SecretBackfillService(repository as any).run();

    expect(Object.keys(report).sort()).toEqual(
      [
        'aiCredential',
        'integration',
        'oAuthApp',
        'oAuthAuthorization',
        'oAuthSelfHostedAuthorization',
        'organization',
        'thirdParty',
      ].sort()
    );
  });
});
