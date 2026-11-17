import { ServiceUnavailableException } from '@nestjs/common';

export class McpDispatchUnconfirmed extends ServiceUnavailableException {
  readonly code = 'DISPATCH_UNCONFIRMED';
  constructor(readonly rootId: string, readonly generation: number, readonly savedPostIds: string[] = [rootId]) {
    super({ code: 'DISPATCH_UNCONFIRMED', savedPostIds, generation, message: `DISPATCH_UNCONFIRMED: saved post IDs ${savedPostIds.join(', ')}. The generation workflow is not confirmed. Do not recreate; inspect dispatch status or retry reconciliation.` });
  }
}
