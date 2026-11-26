jest.mock('./posts.service', () => ({ PostsService: class {} }));
import { McpDispatchRecoveryService } from './mcp.dispatch.recovery.service';

describe('bounded durable dispatch recovery', () => {
  it('does not overlap polls and continues after a failed batch', async () => {
    let release!: () => void;
    const posts = { recoverPendingMcpDispatches: jest.fn().mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; })).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(undefined) };
    const service = new McpDispatchRecoveryService(posts as any);
    const first = service.tick();
    await service.tick();
    expect(posts.recoverPendingMcpDispatches).toHaveBeenCalledTimes(1);
    release(); await first;
    const warning = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
    await service.tick();
    await service.tick();
    expect(posts.recoverPendingMcpDispatches).toHaveBeenCalledTimes(3);
    expect(posts.recoverPendingMcpDispatches).toHaveBeenLastCalledWith(16);
    expect(warning).toHaveBeenCalledWith('MCP dispatch reconciliation is temporarily unavailable.');
  });
  it('honors an isolated maintenance stop and clears its owned timer', async () => {
    jest.useFakeTimers();
    const previous = process.env.MCP_V114_DISPATCH_RECOVERY_DISABLED;
    const posts = { recoverPendingMcpDispatches: jest.fn().mockResolvedValue({}) };
    const service = new McpDispatchRecoveryService(posts as any);
    try {
      process.env.MCP_V114_DISPATCH_RECOVERY_DISABLED = 'true';
      service.onModuleInit();
      expect(posts.recoverPendingMcpDispatches).not.toHaveBeenCalled();
      process.env.MCP_V114_DISPATCH_RECOVERY_DISABLED = 'false';
      service.onModuleInit();
      expect(posts.recoverPendingMcpDispatches).toHaveBeenCalledTimes(1);
      service.onModuleDestroy();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      if (previous === undefined) delete process.env.MCP_V114_DISPATCH_RECOVERY_DISABLED;
      else process.env.MCP_V114_DISPATCH_RECOVERY_DISABLED = previous;
      jest.useRealTimers();
    }
  });
});
