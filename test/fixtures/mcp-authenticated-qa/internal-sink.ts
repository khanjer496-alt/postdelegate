import { createServer } from 'http';
import { existsSync } from 'fs';
import { openProtectedJournal } from './protected-store';
import { reconcileHistory } from './receipt-history';
import { loadRun, access, assertChannel, readProtected } from './guard';

async function main() {
  const c = loadRun(),
    a = access(c);
  const journal = openProtectedJournal(`${c.protectedRoot}/transport.ndjson`);
  const events = () =>
    journal.read().map((event) => {
      if (event.runId !== c.runId) throw new Error('Cross-run journal denied.');
      return event;
    });
  const record = (event: any) => journal.append(event);
  const server = createServer(async (req, res) => {
    const respond = (status: number, body: unknown) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(body));
    };
    try {
      if (
        req.method !== 'POST' ||
        req.headers.authorization !== `Bearer ${a.sinkToken}` ||
        !['/publish', '/reconcile', '/mail'].includes(req.url || '')
      )
        return respond(403, { error: 'Denied' });
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 32768) throw new Error('Oversize');
      }
      const input = JSON.parse(body);
      if (input.runId !== c.runId) throw new Error('Wrong run');
      if (req.url === '/mail') {
        if (!a.accounts.some((account) => account.email === input.to))
          throw new Error('Unknown recipient');
        record({
          kind: 'MAIL',
          runId: c.runId,
          userId: a.accounts.find((account) => account.email === input.to)!
            .userId,
        });
        return respond(200, { recorded: true }); // no subject/body/secret capture
      }
      assertChannel(c, input.orgId, input.channelId);
      if (
        !/^[a-f0-9]{64}$/.test(input.payloadHash) ||
        !/^[a-zA-Z0-9_-]{5,100}$/.test(input.attemptId) ||
        !/^[a-zA-Z0-9_-]{5,100}$/.test(input.segmentId)
      )
        throw new Error('Unbound attempt');
      const identity = {
        runId: c.runId,
        orgId: input.orgId,
        channelId: input.channelId,
        attemptId: input.attemptId,
        segmentId: input.segmentId,
        payloadHash: input.payloadHash,
        ...(input.parent ? { parent: input.parent } : {}),
        ...(input.previous ? { previous: input.previous } : {}),
      };
      if (req.url === '/reconcile') {
        const outcome = reconcileHistory(c, input, events());
        record({ kind: 'RECONCILE', ...identity });
        return respond(200, outcome);
      }
      for (const id of [input.parent, input.previous].filter(Boolean))
        if (
          !events().some(
            (e) =>
              e.kind === 'ACCEPT' &&
              e.orgId === input.orgId &&
              e.channelId === input.channelId &&
              e.receipt?.postId === id
          )
        )
          throw new Error('Unknown predecessor');
      if (
        events().some(
          (event) =>
            event.attemptId === input.attemptId &&
            ['ACCEPT', 'DENY', 'DUPLICATE_CALL'].includes(event.kind)
        )
      ) {
        record({ kind: 'DUPLICATE_CALL', ...identity });
        return respond(409, {
          error: 'Repeated fixture dispatch denied; inspect complete history.',
        });
      }
      const rulesFile = `${c.protectedRoot}/outcomes.json`;
      const rules = existsSync(rulesFile)
        ? readProtected<Record<string, string>>(rulesFile)
        : {};
      const kind = rules[input.segmentId] === 'UNPUBLISHED' ? 'DENY' : 'ACCEPT';
      if (rules[input.segmentId] && kind !== 'DENY')
        throw new Error('Unknown fixture outcome');
      const receipt = {
        id: input.segmentId,
        postId: `qa-${c.runId}-${input.attemptId}`,
        releaseURL: `${c.origin}/qa-receipt/${input.attemptId}`,
        status: 'published',
      };
      // Every repeated call is explicit duplicate evidence, never silent dedup or a new acceptance.
      record({ kind, ...identity, ...(kind === 'ACCEPT' ? { receipt } : {}) });
      return respond(
        kind === 'ACCEPT' ? 200 : 409,
        kind === 'ACCEPT' ? receipt : { error: 'Confirmed fixture rejection' }
      );
    } catch {
      return respond(400, { error: 'Fixture input denied' });
    }
  });
  server.once('close', () => journal.close());
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(7081, '0.0.0.0', resolve);
  });
  process.stdout.write(
    JSON.stringify({ ready: 'internal-fixture-sink', runId: c.runId }) + '\n'
  );
}
if (require.main === module)
  void main().catch(() => {
    process.stderr.write('QA internal sink refused startup.\n');
    process.exitCode = 1;
  });
