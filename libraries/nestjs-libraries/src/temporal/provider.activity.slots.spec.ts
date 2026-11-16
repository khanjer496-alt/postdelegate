import { ProviderActivitySlots, providerActivityOptions } from './provider.activity.slots';
const ctx = (queue: string) => ({ slotType: 'activity' as const, taskQueue: queue, workerIdentity: queue, workerBuildId: 'owned', isSticky: false });
describe('provider activity slot ownership', () => {
  it('keeps a second queue blocked until SDK releases the first permit', async () => {
    const pool = new ProviderActivitySlots(1), signal = new AbortController().signal;
    const first = await pool.reserveSlot(ctx('legacy'), signal); let secondEntered = false;
    const second = pool.reserveSlot(ctx('v114'), signal).then(permit => { secondEntered = true; return permit; });
    await Promise.resolve(); expect(secondEntered).toBe(false); expect(pool.pendingFor('v114')).toBe(1);
    expect(pool.tryReserveSlot(ctx('eager'))).toBeNull();
    pool.markSlotUsed({ permit: first, slotInfo: { type: 'activity', activityType: 'postSocial' } });
    expect(pool.reserved).toBe(1);
    pool.releaseSlot({ permit: first }); const next = await second;
    expect(secondEntered).toBe(true); expect(pool.reserved).toBe(1); pool.releaseSlot({ permit: next }); expect(pool.reserved).toBe(0);
  });
  it('uses FIFO across queues and removes cancelled reservations without releasing active work', async () => {
    const pool = new ProviderActivitySlots(1), abort = new AbortController();
    const first = await pool.reserveSlot(ctx('legacy'), new AbortController().signal);
    const cancelled = pool.reserveSlot(ctx('cancel'), abort.signal); const refusal = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    const order: string[] = [];
    const second = pool.reserveSlot(ctx('v114'), new AbortController().signal).then(p => { order.push('v114'); return p; });
    const third = pool.reserveSlot(ctx('legacy'), new AbortController().signal).then(p => { order.push('legacy'); return p; });
    abort.abort(); await refusal; expect(pool.pendingFor('cancel')).toBe(0); expect(pool.reserved).toBe(1);
    pool.releaseSlot({ permit: first }); const next = await second; expect(order).toEqual(['v114']);
    pool.releaseSlot({ permit: next }); const last = await third; expect(order).toEqual(['v114', 'legacy']); pool.releaseSlot({ permit: last });
  });
  it('rejects an already-aborted request and ignores duplicate or foreign release', async () => {
    const pool = new ProviderActivitySlots(1), abort = new AbortController(); abort.abort();
    await expect(pool.reserveSlot(ctx('legacy'), abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
    const first = pool.tryReserveSlot(ctx('legacy'))!; pool.releaseSlot({ permit: {} }); expect(pool.reserved).toBe(1);
    pool.releaseSlot({ permit: structuredClone(first) }); expect(pool.reserved).toBe(0);
    const second = pool.tryReserveSlot(ctx('v114'))!; pool.releaseSlot({ permit: first }); expect(pool.reserved).toBe(1); pool.releaseSlot({ permit: second });
  });
  it('does not allocate one provider from another provider pool', () => {
    const a = providerActivityOptions('a', 1, 1).tuner as any, b = providerActivityOptions('b', 1, 1).tuner as any;
    expect(a.activityTaskSlotSupplier.tryReserveSlot(ctx('a'))).toBeTruthy();
    expect(b.activityTaskSlotSupplier.tryReserveSlot(ctx('b'))).toBeTruthy();
  });
  it.each([0, -1, 1.5, NaN, Infinity])('refuses invalid capacity/divider %s before worker startup', value => {
    expect(() => new ProviderActivitySlots(value)).toThrow();
    expect(() => providerActivityOptions('provider', 4, value)).toThrow();
  });
});
