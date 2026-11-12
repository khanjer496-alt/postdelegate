import { scopeMcpTools } from './mcp.scopes';
import { runWithContext } from './async.storage';

describe('MCP scope execution boundary', () => {
  const execute = jest.fn(async () => 'ok');
  const tools = scopeMcpTools({
    integrationList: { execute }, deletePostTool: { execute },
    ask_postdelegate: { execute }, futureTool: { execute },
  });
  beforeEach(() => execute.mockClear());
  it.each(['deletePostTool', 'ask_postdelegate', 'futureTool'])('denies read-only token invoking %s before execution', async name => {
    await expect(runWithContext({ requestId: 'r', auth: {}, scopes: ['mcp:read'] },
      () => tools[name].execute())).rejects.toThrow('mcp:write required');
    expect(execute).not.toHaveBeenCalled();
  });
  it('requires read scope for reads', async () => {
    await expect(runWithContext({ requestId: 'r', auth: {}, scopes: ['mcp:write'] },
      () => tools.integrationList.execute())).rejects.toThrow('mcp:read required');
  });
  it('requires both grants for the agent which can read and write', async () => {
    await expect(runWithContext({ requestId: 'r', auth: {}, scopes: ['mcp:write'] },
      () => tools.ask_postdelegate.execute())).rejects.toThrow('mcp:read required');
    expect(execute).not.toHaveBeenCalled();
  });
  it('allows the matching grant and rejects absent context', async () => {
    await expect(runWithContext({ requestId: 'r', auth: {}, scopes: ['mcp:write'] },
      () => tools.deletePostTool.execute())).resolves.toBe('ok');
    await expect(tools.integrationList.execute()).rejects.toThrow('insufficient_scope');
  });
});
