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
  it('reclaims a fast grant cancelled before native consumption, idempotently', async () => {
    const pool = new ProviderActivitySlots(1), abort = new AbortController();
    const abandoned = pool.reserveSlot(ctx('legacy'), abort.signal);
    expect(pool.reserved).toBe(1); abort.abort();
    expect(pool.reserved).toBe(0); const old = await abandoned;
    const active = pool.tryReserveSlot(ctx('v114'))!;
    abort.abort(); pool.releaseSlot({ permit: old });
    expect(pool.reserved).toBe(1); pool.releaseSlot({ permit: active });
  });
  it('reclaims a queued grant cancelled in the grant-to-native handoff', async () => {
    const pool = new ProviderActivitySlots(1), abort = new AbortController();
    const first = pool.tryReserveSlot(ctx('legacy'))!;
    const queued = pool.reserveSlot(ctx('v114'), abort.signal);
    pool.releaseSlot({ permit: first }); expect(pool.reserved).toBe(1);
    abort.abort(); expect(pool.reserved).toBe(0);
    pool.releaseSlot({ permit: await queued }); expect(pool.reserved).toBe(0);
    expect(pool.tryReserveSlot(ctx('survivor'))).toBeTruthy();
  });
  it('abort after mark-used cannot free active capacity or grant an overlap', async () => {
    const pool = new ProviderActivitySlots(1), abort = new AbortController();
    const used = await pool.reserveSlot(ctx('legacy'), abort.signal);
    pool.markSlotUsed({ permit: used, slotInfo: { type: 'activity', activityType: 'postSocial' } });
    abort.abort(); expect(pool.reserved).toBe(1); expect(pool.tryReserveSlot(ctx('v114'))).toBeNull();
    pool.releaseSlot({ permit: used }); expect(pool.reserved).toBe(0);
  });
  it('does not allocate one provider from another provider pool', () => {
    const a = providerActivityOptions('a', 1, 1).tuner as any, b = providerActivityOptions('b', 1, 1).tuner as any;
    expect(a.activityTaskSlotSupplier.tryReserveSlot(ctx('a'))).toBeTruthy();
    expect(b.activityTaskSlotSupplier.tryReserveSlot(ctx('b'))).toBeTruthy();
  });
  it.each([0, -1, 1.5, NaN, Infinity])('refuses invalid capacity %s before worker startup', value => {
    expect(() => new ProviderActivitySlots(value)).toThrow();
  });
  const capacityOf = (maximum: number, divider: number) =>
    (providerActivityOptions('provider', maximum, divider).tuner as any).activityTaskSlotSupplier.capacity;
  it('never gives a provider share below one, like before the shared pool', () => {
    // Reddit allows 1 at a time: with 2 servers each still gets 1
    expect(capacityOf(1, 2)).toBe(1);
    expect(capacityOf(4, 2)).toBe(2);
    expect(capacityOf(5, 2)).toBe(2);
  });
  it.each([NaN, 0, -1, Infinity])('counts a divider that is not a usable number (%s) as 1', value => {
    expect(capacityOf(4, value)).toBe(4);
  });
});
