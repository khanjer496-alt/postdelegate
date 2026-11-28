import {
  continueAsNew,
  isCancellation,
  proxyActivities,
  sleep,
} from '@temporalio/workflow';
import type { OwnerDigestActivity } from '@gitroom/orchestrator/activities/owner.digest.activity';

const { sendOwnerDigestV1 } = proxyActivities<OwnerDigestActivity>({
  taskQueue: 'main',
  startToCloseTimeout: '30 minutes',
  retry: {
    initialInterval: '1 minute',
    backoffCoefficient: 2,
    maximumInterval: '10 minutes',
    maximumAttempts: 3,
  },
});

const DAY = 24 * 60 * 60 * 1000;
// 05:00 UTC, the start of the owner's day (09:00 in Dubai)
const SEND_AT = 5 * 60 * 60 * 1000;

// Once a day: the trials digest to OWNER_ALERT_EMAILS. The activity does
// nothing without recipients, an email provider or a trial to report. A
// failed run waits for the next day.
export async function ownerDigestWorkflowV1(): Promise<void> {
  const sinceSendTime = (((Date.now() - SEND_AT) % DAY) + DAY) % DAY;
  await sleep(DAY - sinceSendTime);
  try {
    await sendOwnerDigestV1();
  } catch (error) {
    if (isCancellation(error)) throw error;
  }
  return continueAsNew<typeof ownerDigestWorkflowV1>();
}
