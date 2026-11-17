import { randomUUID } from 'crypto';
import type {
  ActivitySlotInfo, CustomSlotSupplier, SlotMarkUsedContext, SlotPermit,
  SlotReleaseContext, SlotReserveContext, WorkerOptions,
} from '@temporalio/worker';

type Reservation = {
  queue: string; signal: AbortSignal; state: 'pending' | 'granted' | 'used' | 'released';
  id?: string; grant: (permit: SlotPermit) => void; cancel: () => void;
};
type Grant = { state: 'granted' | 'used'; reservation?: Reservation };

/** One process allocation shared by both Workers; never release by TTL/age. */
export class ProviderActivitySlots implements CustomSlotSupplier<ActivitySlotInfo> {
  readonly type = 'custom' as const;
  private readonly issued = new Map<string, Grant>();
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
  private detach(reservation: Reservation) { reservation.signal.removeEventListener('abort', reservation.cancel); }
  private issue(reservation?: Reservation): SlotPermit {
    const id = randomUUID();
    this.issued.set(id, { state: 'granted', reservation });
    if (reservation) { reservation.id = id; reservation.state = 'granted'; }
    return { id };
  }
  tryReserveSlot(_ctx: SlotReserveContext): SlotPermit | null {
    if (this.waiting.length || this.issued.size >= this.capacity) return null;
    return this.issue(); // Synchronous eager path has no asynchronous abort signal.
  }
  reserveSlot(ctx: SlotReserveContext, signal: AbortSignal): Promise<SlotPermit> {
    if (signal.aborted) return Promise.reject(this.cancelled(signal));
    return new Promise((resolve, reject) => {
      const reservation: Reservation = {
        queue: ctx.taskQueue, signal, state: 'pending', grant: resolve,
        cancel: () => {
          if (reservation.state === 'pending') {
            const index = this.waiting.indexOf(reservation);
            if (index >= 0) this.waiting.splice(index, 1);
            reservation.state = 'released'; this.detach(reservation);
            reject(this.cancelled(signal)); this.drain(); return;
          }
          const grant = reservation.id ? this.issued.get(reservation.id) : undefined;
          if (reservation.state !== 'granted' || grant?.state !== 'granted' || grant.reservation !== reservation) return;
          // SDK1.15 aborts when its native reservation future is dropped before
          // consuming the JS result. Keep this handler THROUGH that handoff.
          this.issued.delete(reservation.id!); reservation.state = 'released';
          this.detach(reservation); this.drain();
        },
      };
      signal.addEventListener('abort', reservation.cancel, { once: true });
      if (signal.aborted) { reservation.cancel(); return; }
      if (!this.waiting.length && this.issued.size < this.capacity) reservation.grant(this.issue(reservation));
      else this.waiting.push(reservation);
    });
  }
  markSlotUsed(ctx: SlotMarkUsedContext<ActivitySlotInfo>) {
    const id = (ctx.permit as { id?: unknown })?.id;
    const grant = typeof id === 'string' ? this.issued.get(id) : undefined;
    if (!grant) return;
    grant.state = 'used';
    if (grant.reservation) {
      grant.reservation.state = 'used'; this.detach(grant.reservation);
      grant.reservation = undefined;
    }
  }
  releaseSlot(ctx: SlotReleaseContext<ActivitySlotInfo>) {
    const id = (ctx.permit as { id?: unknown })?.id;
    const grant = typeof id === 'string' ? this.issued.get(id) : undefined;
    if (!grant || typeof id !== 'string') return;
    this.issued.delete(id);
    if (grant.reservation) { grant.reservation.state = 'released'; this.detach(grant.reservation); }
    this.drain();
  }
  private drain() {
    while (this.waiting.length && this.issued.size < this.capacity) {
      const reservation = this.waiting[0];
      if (reservation.signal.aborted) { reservation.cancel(); continue; }
      this.waiting.shift(); reservation.grant(this.issue(reservation));
    }
  }
}

/** Called ONCE per finite provider/process and reused by legacy + V114 Workers. */
export const providerActivityOptions = (provider: string, maximum: number | undefined, divider: number) => {
  if (!Number.isSafeInteger(divider) || divider < 1) throw new Error('WORKER_CONCURRENCY_DIVIDER must be a positive integer.');
  if (maximum == null) return { maxConcurrentActivityTaskExecutions: 1000000 } satisfies Partial<WorkerOptions>;
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
  } satisfies Partial<WorkerOptions>;
};
