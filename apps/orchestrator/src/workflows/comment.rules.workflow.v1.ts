import { continueAsNew, proxyActivities, sleep } from '@temporalio/workflow';
import { CommentsActivity } from '@gitroom/orchestrator/activities/comments.activity';

const { runCommentRules } = proxyActivities<CommentsActivity>({
  startToCloseTimeout: '2 minute',
  taskQueue: 'main',
  retry: {
    maximumAttempts: 1,
  },
});

// Keyword auto-replies of one channel (PD_FF_COMMENTS). Polls the rule posts'
// comments every 10 seconds until fastUntil (2 hours after a rule was saved),
// then every minute, and ends when the channel has no active rule left.
// Saving a rule starts it again with a new fastUntil.
export async function commentRulesWorkflowV1({
  integrationId,
  fastUntil,
}: {
  integrationId: string;
  fastUntil: number;
}) {
  for (let loops = 0; loops < 300; loops++) {
    let active = true;
    try {
      active = await runCommentRules(integrationId);
    } catch (err) {}
    if (!active) {
      return;
    }
    await sleep(Date.now() < fastUntil ? 10000 : 60000);
  }

  // keep the history small
  return await continueAsNew<typeof commentRulesWorkflowV1>({
    integrationId,
    fastUntil,
  });
}
