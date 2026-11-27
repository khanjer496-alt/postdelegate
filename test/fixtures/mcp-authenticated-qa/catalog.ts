import 'reflect-metadata';
import { IsIn } from 'class-validator';
import { createHash } from 'crypto';
import { QaManifest, AccessRef, assertChannel } from './guard';

export class QaFixtureSettings {
  @IsIn(['fixture']) __type!: string;
}
export function installCatalog(c: QaManifest, a: AccessRef) {
  const call = async (path: string, value: unknown) => {
    const response = await fetch(c.sinkOrigin + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${a.sinkToken}`,
      },
      body: JSON.stringify({ runId: c.runId, ...(value as any) }),
    });
    if (!response.ok)
      throw new Error('Internal fixture transport rejected dispatch.');
    return response.json();
  };
  class FixtureProvider {
    identifier = 'fixture';
    name = 'QA fixture';
    editor = 'normal';
    dto = QaFixtureSettings;
    maxConcurrentJob = 1;
    analyticsAvailable = false;
    plugsAvailable = false;
    isBetweenSteps = false;
    convertToJPEG = false;
    toolTip = 'Contained QA transport only';
    maxLength() {
      return 1000;
    }
    stripLinks() {
      return false;
    }
    async checkValidity(media: any[][], settings: any) {
      if (settings?.__type !== 'fixture') return 'Choose fixture settings.';
      if (
        media.flat().some((m) => {
          try {
            const u = new URL(m.path || m.url);
            return u.origin !== c.origin || !u.pathname.startsWith('/uploads/');
          } catch {
            return true;
          }
        })
      )
        return 'Only same-run owned QA media is supported.';
      return true;
    }
    async generateAuthUrl() {
      throw new Error('Fixture channels are seeded; OAuth is denied.');
    }
    async authenticate() {
      throw new Error('Fixture OAuth is denied.');
    }
    async refreshToken() {
      throw new Error('Fixture credential refresh is denied.');
    }
    async analytics() {
      throw new Error('Fixture live analytics is unavailable.');
    }
    private async publish(
      id: string,
      token: string,
      posts: any[],
      integration: any,
      parent?: string,
      previous?: string
    ) {
      assertChannel(c, integration.organizationId, integration.id);
      if (
        integration.providerIdentifier !== 'fixture' ||
        id !== integration.id ||
        integration.internalId !== integration.id ||
        token !== `qa:${c.runId}:${integration.id}` ||
        posts.length !== 1 ||
        !posts[0].id ||
        !posts[0].clientReference?.attemptId
      )
        throw new Error('Unbound fixture publication denied.');
      const hash = createHash('sha256')
        .update(JSON.stringify(posts))
        .digest('hex');
      const receipt = await call('/publish', {
        orgId: integration.organizationId,
        channelId: integration.id,
        attemptId: posts[0].clientReference.attemptId,
        segmentId: posts[0].id,
        payloadHash: hash,
        parent,
        previous,
      });
      return [receipt];
    }
    post(id: string, token: string, posts: any[], integration: any) {
      return this.publish(id, token, posts, integration);
    }
    comment(
      id: string,
      parent: string,
      previous: string,
      token: string,
      posts: any[],
      integration: any
    ) {
      return this.publish(id, token, posts, integration, parent, previous);
    }
    reconcileMcpAttempt(
      integration: any,
      attempt: { attemptId: string; segmentId: string; payloadHash: string }
    ) {
      assertChannel(c, integration.organizationId, integration.id);
      if (integration.providerIdentifier !== 'fixture')
        throw new Error('Real-provider reconciliation denied.');
      return call('/reconcile', {
        orgId: integration.organizationId,
        channelId: integration.id,
        ...attempt,
      });
    }
  }
  const provider = Object.freeze(new FixtureProvider());
  const socialIntegrationList = Object.freeze([provider]);
  class IntegrationManager {
    static readonly qaIdentity = `${c.runId}:${c.sourceSha}`;
    getSocialIntegration(identifier: string) {
      if (identifier !== 'fixture') throw new Error('Unknown provider denied.');
      return provider;
    }
    getAllowedSocialsIntegrations() {
      return ['fixture'];
    }
    async getAllIntegrations(orgId: string) {
      if (!c.tenants.some((t) => t.orgId === orgId))
        throw new Error('Unknown tenant catalog denied.');
      return {
        social: [
          {
            name: provider.name,
            identifier: 'fixture',
            editor: 'normal',
            analyticsAvailable: false,
            isExternal: false,
            isOwnApp: false,
            isWeb3: false,
            isChromeExtension: false,
          },
        ],
        article: [],
      };
    }
    isHiddenProvider(id: string) {
      this.getSocialIntegration(id);
      return false;
    }
    isHiddenFor(id: string, orgId: string) {
      this.getSocialIntegration(id);
      if (!c.tenants.some((t) => t.orgId === orgId))
        throw new Error('Unknown tenant denied.');
      return false;
    }
    getMigrationTarget(id: string) {
      this.getSocialIntegration(id);
      return undefined;
    }
    getMigrationSources(id: string) {
      this.getSocialIntegration(id);
      return [];
    }
    getAuthorizationGrantGroup(group: string) {
      if (group !== 'fixture') throw new Error('Unknown grant group denied.');
      return [provider];
    }
    getAllTools() {
      return { fixture: [] };
    }
    getAllRulesDescription() {
      return {
        fixture:
          'QA fixture: at most 1000 characters; no external network or OAuth.',
      };
    }
    getAllPlugs() {
      return [];
    }
    getInternalPlugs(id: string) {
      this.getSocialIntegration(id);
      return { internalPlugs: [] };
    }
    isDashboardCallable(candidate: unknown, _method: string) {
      if (candidate !== provider)
        throw new Error('Provider identity mismatch.');
      return false;
    }
  }
  Reflect.defineMetadata(
    'custom:rules:description',
    'QA fixture: at most 1000 characters.',
    FixtureProvider
  );
  const replace = (name: string, exports: unknown) => {
    const filename = require.resolve(name);
    if (require.cache[filename])
      throw new Error(
        'Fixture catalog must install before application imports.'
      );
    require.cache[filename] = {
      id: filename,
      filename,
      loaded: true,
      exports,
    } as any;
  };
  replace('@gitroom/nestjs-libraries/integrations/integration.manager', {
    IntegrationManager,
    socialIntegrationList,
  });
  // DTO discriminator and class-validator metadata must use the SAME catalog.
  replace(
    '@gitroom/nestjs-libraries/dtos/posts/providers-settings/all.providers.settings',
    {
      EmptySettings: QaFixtureSettings,
      allProviders: () => [{ name: 'fixture', value: QaFixtureSettings }],
    }
  );
  return { IntegrationManager, socialIntegrationList, provider };
}
