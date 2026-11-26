import { proxyActivities, sleep } from '@temporalio/workflow';
import type { PostActivity } from '../../activities/post.activity';

const { mcpThreadPlan, mcpFailSegment } =
  proxyActivities<PostActivity>({
    startToCloseTimeout: '30 minute',
    retry: { maximumAttempts: 1 },
  });

/** New MCP jobs use durable admission/receipt state, never heartbeat inference. */
export async function postWorkflowV114({
  organizationId,
  postId,
  taskQueue,
  generation,
  revisionHash,
}: {
  organizationId: string;
  postId: string;
  taskQueue: string;
  generation: number;
  revisionHash: string;
}) {
  const plan = await mcpThreadPlan(
    organizationId,
    postId,
    generation,
    revisionHash
  );
  await sleep(Math.max(0, plan.publishAt - Date.now()));
  const { mcpPublishSegment: publish } = proxyActivities<PostActivity>({
    taskQueue,
    startToCloseTimeout: '30 minute',
    retry: { maximumAttempts: 1 },
  });
  let parent: string | undefined;
  let previous: string | undefined;
  for (const item of plan.segments) {
    try {
      if (item.delay) await sleep(item.delay * 60000);
      const [receipt] = await publish(
        organizationId,
        postId,
        item.id,
        generation,
        revisionHash,
        parent,
        previous
      );
      parent ||= receipt.postId;
      previous = receipt.postId;
      // The segment activity commits receipt + PUBLISHED state atomically.

    } catch (err) {
      // the failure goes with the segment, like changeState in the older
      // workflows, so its provider message stays readable on the post
      await mcpFailSegment(organizationId, postId, item.id, generation, revisionHash, err);
      return;
    }
  }
}
