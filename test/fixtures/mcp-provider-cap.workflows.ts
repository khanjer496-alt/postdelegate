// Native acceptance driver only; never imported by the production workflow index.
import { proxyActivities } from '@temporalio/workflow';
import type { Integration, Post } from '@prisma/client';
export { postWorkflowV114 } from '../../apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.4';

// Calls the existing legacy activity/signature and bookkeeping, not a mock SDK call.
export async function legacyProviderCapFixture(input: { queue: string; integration: Integration; post: Post }) {
  const legacy = proxyActivities<{
    postSocial(integration: Integration, posts: Post[]): Promise<Array<{ postId: string; releaseURL: string }>>;
    updatePost(id: string, postId: string, releaseURL: string): Promise<void>;
  }>({ taskQueue: input.queue, startToCloseTimeout: '30 seconds', retry: { maximumAttempts: 1 } });
  const [receipt] = await legacy.postSocial(input.integration, [input.post]);
  await legacy.updatePost(input.post.id, receipt.postId, receipt.releaseURL);
  return receipt;
}
