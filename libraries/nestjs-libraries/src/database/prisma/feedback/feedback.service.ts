import { HttpException, Injectable } from '@nestjs/common';
import { FeedbackRepository } from '@gitroom/nestjs-libraries/database/prisma/feedback/feedback.repository';
import { OwnerAlertsService } from '@gitroom/nestjs-libraries/database/prisma/owner-alerts/owner.alerts.service';
import {
  FEEDBACK_CHOICES,
  FEEDBACK_SKIPPED,
  FeedbackAnswerDto,
  FeedbackKind,
} from '@gitroom/nestjs-libraries/dtos/feedback/feedback.answer.dto';

// the sign-up question is for people who just signed up
export const USE_CASE_QUESTION_DAYS = 7;

@Injectable()
export class FeedbackService {
  constructor(
    private _feedbackRepository: FeedbackRepository,
    private _ownerAlertsService: OwnerAlertsService
  ) {}

  // The one question to show this person in this workspace now, if any. What
  // stopped a trial or a plan comes first; each is asked once, an answer or a
  // skip closes it
  async pending(
    user: { id: string; createdAt: Date },
    organizationId: string,
    now = new Date()
  ): Promise<{ question: FeedbackKind | null }> {
    const role = await this._feedbackRepository.getRole(
      organizationId,
      user.id
    );
    if (!role) {
      return { question: null };
    }
    const answered = (
      await this._feedbackRepository.getAnswerKinds(organizationId, user.id)
    ).map((answer) => answer.kind);

    if (
      !answered.includes('stopped') &&
      (await this._feedbackRepository.getEnded(organizationId)) &&
      !(await this._feedbackRepository.getPlan(organizationId))
    ) {
      return { question: 'stopped' };
    }

    if (
      !answered.includes('use_case') &&
      role.role === 'SUPERADMIN' &&
      now.getTime() - new Date(user.createdAt).getTime() <
        USE_CASE_QUESTION_DAYS * 24 * 60 * 60 * 1000
    ) {
      return { question: 'use_case' };
    }

    return { question: null };
  }

  async answer(
    user: { id: string; createdAt: Date },
    organizationId: string,
    body: FeedbackAnswerDto
  ) {
    const choices: readonly string[] = FEEDBACK_CHOICES[body.kind];
    if (body.choice !== FEEDBACK_SKIPPED && !choices.includes(body.choice)) {
      throw new HttpException('Unknown answer', 400);
    }
    // only the question this person is being asked can be answered
    if ((await this.pending(user, organizationId)).question !== body.kind) {
      throw new HttpException('This question is not open', 400);
    }
    const userId = user.id;
    // a note only goes with "other" or a choice, never with a skip
    const text =
      body.choice === FEEDBACK_SKIPPED ? '' : (body.text || '').trim();
    const saved = await this._feedbackRepository.saveAnswer({
      organizationId,
      userId,
      kind: body.kind,
      choice: body.choice,
      text,
    });
    if (saved && body.choice !== FEEDBACK_SKIPPED) {
      this._ownerAlertsService
        .feedbackAnswered(organizationId, body.kind, body.choice, text)
        .catch(() => {});
    }
    return { ok: true };
  }
}
