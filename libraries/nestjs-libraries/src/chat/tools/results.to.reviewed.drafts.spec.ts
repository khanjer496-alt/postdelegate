import {
  RESULTS_TO_REVIEWED_DRAFTS,
  ResultsToReviewedDraftsTool,
} from './results.to.reviewed.drafts.tool';

describe('results to reviewed drafts discoverable instructions', () => {
  it.each([
    'real post IDs',
    'sparse history',
    'no usable history',
    'createPostForReviewTool',
    'IN_REVIEW',
    'never recreate',
    'does not prove causal growth',
  ])('covers %s without fabricating evidence', (phrase) => {
    expect(RESULTS_TO_REVIEWED_DRAFTS.join(' ')).toContain(phrase);
  });
  it('is a read-only instruction tool, with no analytics or mutation dependencies', async () => {
    const tool: any = new ResultsToReviewedDraftsTool().run();
    const result = await tool.execute({}, {});
    expect(result.output).toEqual(RESULTS_TO_REVIEWED_DRAFTS);
    expect(tool.mcp.annotations.readOnlyHint).toBe(true);
  });
});
