import { randomUUID } from 'crypto';
import type {
  ActivitySlotInfo, CustomSlotSupplier, SlotMarkUsedContext, SlotPermit,
  SlotReleaseContext, SlotReserveContext, WorkerOptions,
} from '@temporalio/worker';

type Reservation = { queue: string; signal: AbortSignal; grant: (permit: SlotPermit) => void; cancel: () => void };

/** One process allocation, shared by both provider queue Workers. No TTL/stealing. */
export class ProviderActivitySlots implements CustomSlotSupplier<ActivitySlotInfo> {
  readonly type = 'custom' as const;
  private readonly issued = new Set<string>();
  private readonly waiting: Reservation[] = [];
  constructor(readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('Positive provider slot capacity required.');
  }
  pendingFor(queue: string) { return this.waiting.filter(waiter => waiter.queue === queue).length; }
  get reserved() { return this.issued.size; }
  private cancelled(signal: AbortSignal) {
    if (signal.reason instanceof Error && signal.reason.name === 'AbortError') return signal.reason;
    const error = new Error('Provider slot reservation cancelled.'); error.name = 'AbortError'; return error;
  }
  private issue(): SlotPermit {
    const id = randomUUID(); this.issued.add(id); return { id };
  }
  tryReserveSlot(_ctx: SlotReserveContext): SlotPermit | null {
    if (this.waiting.length || this.issued.size >= this.capacity) return null;
    return this.issue();
  }
  reserveSlot(ctx: SlotReserveContext, signal: AbortSignal): Promise<SlotPermit> {
    if (signal.aborted) return Promise.reject(this.cancelled(signal));
    const available = this.tryReserveSlot(ctx);
    if (available) return Promise.resolve(available);
    return new Promise((resolve, reject) => {
      const waiter: Reservation = {
        queue: ctx.taskQueue, signal,
        grant: (permit: SlotPermit) => { signal.removeEventListener('abort', waiter.cancel); resolve(permit); },
        cancel: () => {
          const index = this.waiting.indexOf(waiter);
          if (index < 0) return;
          this.waiting.splice(index, 1); signal.removeEventListener('abort', waiter.cancel);
          reject(this.cancelled(signal)); this.drain();
        },
      };
      this.waiting.push(waiter); signal.addEventListener('abort', waiter.cancel, { once: true });
      if (signal.aborted) waiter.cancel();
    });
  }
  markSlotUsed(_ctx: SlotMarkUsedContext<ActivitySlotInfo>) {} // Reservation already consumes capacity.
  releaseSlot(ctx: SlotReleaseContext<ActivitySlotInfo>) {
    const id = (ctx.permit as { id?: unknown })?.id;
    if (typeof id !== 'string' || !this.issued.delete(id)) return; // Duplicate/foreign release never creates capacity.
    this.drain();
  }
  private drain() {
    while (this.waiting.length && this.issued.size < this.capacity) {
      const waiter = this.waiting[0];
      if (waiter.signal.aborted) { waiter.cancel(); continue; }
      this.waiting.shift(); waiter.grant(this.issue());
    }
  }
}

/** Called ONCE per finite provider/process and reused by legacy + V114 Workers. */
export const providerActivityOptions = (provider: string, maximum: number | undefined, divider: number): Partial<WorkerOptions> => {
  if (!Number.isSafeInteger(divider) || divider < 1) throw new Error('WORKER_CONCURRENCY_DIVIDER must be a positive integer.');
  if (maximum == null) return { maxConcurrentActivityTaskExecutions: 1000000 };
  if (!Number.isSafeInteger(maximum) || maximum < 1) throw new Error('Provider concurrency cap must be a positive integer.');
  const capacity = Math.floor(maximum / divider);
  if (capacity < 1) throw new Error(`Provider ${provider} has no safe worker share; pin it to one eligible compatible process via EXCLUDE_QUEUE and its verified divider.`);
  const fixed = (numSlots = 100) => ({ type: 'fixed-size' as const, numSlots });
  return {
    activityTaskPollerBehavior: { type: 'simple-maximum', maximum: 1 },
    tuner: {
      workflowTaskSlotSupplier: fixed(40), activityTaskSlotSupplier: new ProviderActivitySlots(capacity),
      localActivityTaskSlotSupplier: fixed(), nexusTaskSlotSupplier: fixed(),
    },
  };
};
