import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization, User } from '@prisma/client';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { FeedbackService } from '@gitroom/nestjs-libraries/database/prisma/feedback/feedback.service';
import { FeedbackAnswerDto } from '@gitroom/nestjs-libraries/dtos/feedback/feedback.answer.dto';

@ApiTags('Feedback')
@Controller('/feedback')
export class FeedbackController {
  constructor(private _feedbackService: FeedbackService) {}

  // the one-question survey to show now, if any
  @Get('/')
  getPending(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() organization: Organization
  ) {
    return this._feedbackService.pending(user, organization.id);
  }

  @Post('/')
  answer(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() organization: Organization,
    @Body() body: FeedbackAnswerDto
  ) {
    return this._feedbackService.answer(user, organization.id, body);
  }
}
