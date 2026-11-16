// Evaluate the ENTIRE attempt history, never only the first matching outcome.
export function reconcileHistory(
  c: { runId: string; origin: string },
  input: {
    orgId: string;
    channelId: string;
    attemptId: string;
    segmentId: string;
    payloadHash: string;
  },
  events: any[]
) {
  const unknown = { terminal: false as const, outcome: 'UNKNOWN' as const };
  const rows = events.filter((event) => event.attemptId === input.attemptId);
  if (
    rows.some(
      (event) =>
        event.runId !== c.runId ||
        event.orgId !== input.orgId ||
        event.channelId !== input.channelId ||
        event.segmentId !== input.segmentId ||
        event.payloadHash !== input.payloadHash ||
        !['ACCEPT', 'DENY', 'RECONCILE'].includes(event.kind)
    )
  )
    return unknown;
  const outcomes = rows.filter((event) => event.kind !== 'RECONCILE');
  if (outcomes.length !== 1) return unknown; // duplicate/contradictory evidence retained
  const event = outcomes[0];
  if (event.kind === 'DENY' && event.receipt !== undefined) return unknown;
  if (event.kind === 'DENY')
    return { terminal: true as const, outcome: 'UNPUBLISHED' as const };
  const receipt = event.receipt;
  if (
    receipt?.id !== input.segmentId ||
    receipt.postId !== `qa-${c.runId}-${input.attemptId}` ||
    receipt.releaseURL !== `${c.origin}/qa-receipt/${input.attemptId}` ||
    receipt.status !== 'published'
  )
    return unknown;
  return { terminal: true as const, outcome: 'PUBLISHED' as const, receipt };
}
