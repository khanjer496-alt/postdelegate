import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { CommentsService } from '@gitroom/nestjs-libraries/database/prisma/comments/comments.service';

@Injectable()
@Activity()
export class CommentsActivity {
  constructor(private _commentsService: CommentsService) {}

  // one poll of a channel's keyword auto-replies, false when none is left
  @ActivityMethod()
  async runCommentRules(integrationId: string) {
    return this._commentsService.runRules(integrationId);
  }
}
