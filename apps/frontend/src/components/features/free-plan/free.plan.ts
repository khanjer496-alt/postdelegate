// Free plan (PD_FF_FREE_PLAN): the usage line of the banner
export interface FreePlanUsage {
  limits: { workspaces: number; channel: number; posts_per_month: number } | null;
  posts?: number;
  channels?: number;
}

export const freePlanState = (usage?: FreePlanUsage | null) => {
  if (!usage?.limits) {
    return null;
  }
  const posts = usage.posts || 0;
  const channels = usage.channels || 0;
  const postsLeft = Math.max(0, usage.limits.posts_per_month - posts);
  return {
    posts,
    channels,
    postsLeft,
    postsLimit: usage.limits.posts_per_month,
    channelsLimit: usage.limits.channel,
    // the banner turns amber near the end and red at the limit
    tone:
      postsLeft === 0 || channels > usage.limits.channel
        ? ('limit' as const)
        : postsLeft <= Math.ceil(usage.limits.posts_per_month * 0.2)
        ? ('low' as const)
        : ('ok' as const),
  };
};
