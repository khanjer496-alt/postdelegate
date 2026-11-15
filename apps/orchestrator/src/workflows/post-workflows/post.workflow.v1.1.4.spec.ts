const activity = {
  mcpThreadPlan: jest.fn(),
  mcpPublishSegment: jest.fn(),
  updatePost: jest.fn(),
  mcpFailSegment: jest.fn(),
};
jest.mock('@temporalio/workflow', () => ({
  proxyActivities: () => activity,
  sleep: jest.fn(async () => undefined),
}));
import { postWorkflowV114 } from './post.workflow.v1.1.4';

describe('tracked MCP workflow', () => {
  const input = {
    organizationId: 'o',
    postId: 'root',
    taskQueue: 'fixture',
    generation: 2,
    revisionHash: 'hash',
  };
  beforeEach(() => {
    jest.clearAllMocks();
    activity.mcpThreadPlan.mockResolvedValue({
      publishAt: 0,
      segments: [
        { id: 'root', delay: 0 },
        { id: 'child', delay: 0 },
      ],
    });
    activity.updatePost.mockResolvedValue(undefined);
    activity.mcpFailSegment.mockResolvedValue({});
  });
  it('carries the same durable generation/revision through each segment and keeps predecessor receipts', async () => {
    activity.mcpPublishSegment.mockImplementation(
      async (_org, _root, segment) => [
        {
          postId: `remote-${segment}`,
          releaseURL: `https://fixture/${segment}`,
        },
      ]
    );
    await postWorkflowV114(input);
    expect(activity.mcpThreadPlan).toHaveBeenCalledWith('o', 'root', 2, 'hash');
    expect(activity.mcpPublishSegment).toHaveBeenNthCalledWith(
      2,
      'o',
      'root',
      'child',
      2,
      'hash',
      'remote-root',
      'remote-root'
    );
    expect(activity.updatePost).toHaveBeenCalledTimes(2);
  });
  it('unknown publication outcome never loops into another provider call', async () => {
    activity.mcpPublishSegment.mockRejectedValue(new Error('OUTCOME_UNKNOWN'));
    await postWorkflowV114(input);
    expect(activity.mcpPublishSegment).toHaveBeenCalledTimes(1);
    expect(activity.updatePost).not.toHaveBeenCalled();
    expect(activity.mcpFailSegment).toHaveBeenCalledWith('o', 'root', 'root', 2, 'hash');
  });
  it('receipt-persistence failure after admission never resends or continues the thread', async () => {
    activity.mcpPublishSegment.mockResolvedValue([
      { postId: 'published', releaseURL: 'https://fixture/published' },
    ]);
    activity.updatePost.mockRejectedValue(new Error('storage unavailable'));
    await postWorkflowV114(input);
    expect(activity.mcpPublishSegment).toHaveBeenCalledTimes(1);
  });
});
