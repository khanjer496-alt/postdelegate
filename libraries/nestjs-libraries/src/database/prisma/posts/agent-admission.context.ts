import { ConflictException } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

// Server-owned request admission, never populated from a tool argument.
export const agentAdmissionContext = new AsyncLocalStorage<{
  orgId: string;
  owner: string;
  persistedIds: string[];
}>();

// A recovered request is not a benign lost-update result: old Publisher review
// work must throw before touching the publication fence or post state.
export class AgentSaveRecovered extends ConflictException {
  constructor() { super('This save was recovered. Its remaining changes were stopped. Refresh before retrying.'); }
}
