import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// The one-question surveys and their choices. "skipped" closes a question
// without an answer, so it is never shown again.
export const FEEDBACK_CHOICES = {
  use_case: [
    'own_brand',
    'clients',
    'ai_assistant',
    'team',
    'analytics',
    'other',
  ],
  stopped: [
    'missing_network',
    'too_expensive',
    'could_not_connect',
    'no_time',
    'other_tool',
    'other',
  ],
} as const;

export type FeedbackKind = keyof typeof FEEDBACK_CHOICES;

export const FEEDBACK_KINDS = Object.keys(FEEDBACK_CHOICES) as FeedbackKind[];

export const FEEDBACK_SKIPPED = 'skipped';

export class FeedbackAnswerDto {
  @IsIn(FEEDBACK_KINDS)
  kind: FeedbackKind;

  // checked against the kind's own choices by the service
  @IsString()
  @IsIn([
    ...new Set([
      ...FEEDBACK_CHOICES.use_case,
      ...FEEDBACK_CHOICES.stopped,
      FEEDBACK_SKIPPED,
    ]),
  ])
  choice: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  text?: string;
}
