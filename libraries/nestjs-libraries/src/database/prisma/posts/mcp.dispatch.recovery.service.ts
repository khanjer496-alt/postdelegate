import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PostsService } from './posts.service';

/** Durable dispatch reconciliation, not a content recurrence or publication retry. */
@Injectable()
export class McpDispatchRecoveryService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private readonly logger = new Logger(McpDispatchRecoveryService.name);
  constructor(private readonly posts: PostsService) {}

  onModuleInit() {
    if (process.env.MCP_V114_DISPATCH_RECOVERY_DISABLED === 'true') return;
    this.timer = setInterval(() => void this.tick(), 30000);
    this.timer.unref();
    void this.tick();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try { await this.posts.recoverPendingMcpDispatches(16); }
    catch { this.logger.warn('MCP dispatch reconciliation is temporarily unavailable.'); }
    finally { this.busy = false; }
  }
}
