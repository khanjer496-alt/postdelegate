import { freePlanState } from './free.plan';

const limits = { workspaces: 1, channel: 3, posts_per_month: 20 };

describe('free plan banner state', () => {
  it('is hidden without the free plan', () => {
    expect(freePlanState(undefined)).toBeNull();
    expect(freePlanState({ limits: null })).toBeNull();
  });
  it('counts what is left', () => {
    expect(freePlanState({ limits, posts: 5, channels: 1 })).toMatchObject({ postsLeft: 15, tone: 'ok' });
    expect(freePlanState({ limits, posts: 16, channels: 1 })).toMatchObject({ postsLeft: 4, tone: 'low' });
    expect(freePlanState({ limits, posts: 25, channels: 3 })).toMatchObject({ postsLeft: 0, tone: 'limit' });
  });
});
