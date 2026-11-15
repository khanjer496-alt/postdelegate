import { AsyncLocalStorage } from 'async_hooks';

// Server-owned request admission, never populated from a tool argument.
export const agentAdmissionContext = new AsyncLocalStorage<{
  orgId: string;
  owner: string;
  persistedIds: string[];
}>();
