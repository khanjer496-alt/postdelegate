import { onboardingProgress } from './onboarding.steps';

const state = (steps: Partial<Record<'channel' | 'ai' | 'scheduled' | 'approver', boolean>>, dismissed = false) => ({
  dismissed,
  steps: { channel: false, ai: false, scheduled: false, approver: false, ...steps },
});

describe('v2 onboarding progress', () => {
  it('starts with connecting a channel', () => {
    const p = onboardingProgress(state({}));
    expect(p).toMatchObject({ visible: true, done: 0, percent: 0, next: 'channel' });
  });
  it('skips scheduling until a channel exists', () => {
    expect(onboardingProgress(state({ ai: true })).next).toBe('channel');
    expect(onboardingProgress(state({ channel: true, ai: true })).next).toBe('scheduled');
  });
  it('hides when everything is done or it was dismissed', () => {
    expect(onboardingProgress(state({ channel: true, ai: true, scheduled: true, approver: true })).visible).toBe(false);
    expect(onboardingProgress(state({}, true)).visible).toBe(false);
    expect(onboardingProgress(undefined).visible).toBe(false);
  });
  it('reports the percent done', () => {
    expect(onboardingProgress(state({ channel: true, approver: true })).percent).toBe(50);
  });
});
