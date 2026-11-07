import {
  continueAsNew,
  isCancellation,
  proxyActivities,
  sleep,
} from '@temporalio/workflow';
import type { SearchConsoleForwardActivity } from '@gitroom/orchestrator/activities/search.console.forward.activity';

const { forwardSearchConsoleV1 } =
  proxyActivities<SearchConsoleForwardActivity>({
    taskQueue: 'main',
    startToCloseTimeout: '10 minutes',
    retry: {
      initialInterval: '1 minute',
      backoffCoefficient: 2,
      maximumInterval: '10 minutes',
      maximumAttempts: 3,
    },
  });

// Once a day: sends the Search Console rows of the last days to
// SEARCH_CONSOLE_FORWARD_URL. Ends when that URL or Search Console is not
// set. The activity logs a failure instead of throwing, so a failed run waits
// for the next day, which sends the same days again
export async function searchConsoleForwardWorkflowV1(): Promise<void> {
  try {
    const result = await forwardSearchConsoleV1({});
    if (!result.enabled) return;
  } catch (error) {
    if (isCancellation(error)) throw error;
  }
  await sleep('24 hours');
  return continueAsNew<typeof searchConsoleForwardWorkflowV1>();
}
