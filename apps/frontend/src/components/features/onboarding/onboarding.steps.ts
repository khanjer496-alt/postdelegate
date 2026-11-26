// The four steps of the v2 onboarding card (PD_FF_ONBOARDING_V2)
export type OnboardingStepId = 'channel' | 'ai' | 'scheduled' | 'approver';

export interface OnboardingState {
  dismissed: boolean;
  steps: Record<OnboardingStepId, boolean>;
}

export const ONBOARDING_ORDER: OnboardingStepId[] = [
  'channel',
  'ai',
  'scheduled',
  'approver',
];

// progress, the step to do next (a step that needs a channel waits for it),
// and whether the card shows at all
export interface OnboardingProgress {
  visible: boolean;
  done: number;
  total: number;
  percent: number;
  next: OnboardingStepId | null;
  blocked: (id: OnboardingStepId) => boolean;
}

export const onboardingProgress = (
  state?: OnboardingState | null
): OnboardingProgress => {
  if (!state) {
    return { visible: false, done: 0, total: 4, percent: 0, next: null, blocked: () => false };
  }
  const done = ONBOARDING_ORDER.filter((id) => state.steps[id]).length;
  const blocked = (id: OnboardingStepId) =>
    id === 'scheduled' && !state.steps.channel;
  const next =
    ONBOARDING_ORDER.find((id) => !state.steps[id] && !blocked(id)) || null;
  return {
    visible: !state.dismissed && done < ONBOARDING_ORDER.length,
    done,
    total: ONBOARDING_ORDER.length,
    percent: Math.round((done / ONBOARDING_ORDER.length) * 100),
    next,
    blocked,
  };
};
