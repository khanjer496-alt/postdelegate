import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import {
  commentsEnabled,
  CommentsService,
} from '@gitroom/nestjs-libraries/database/prisma/comments/comments.service';

class CommentReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2200)
  message: string;
}

class CommentHideDto {
  @IsBoolean()
  hidden: boolean;
}

class CommentRuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  keyword: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2200)
  reply: string;
}

class CommentRuleActiveDto {
  @IsBoolean()
  active: boolean;
}

// The comments view of a channel and its keyword auto-replies
// (PD_FF_COMMENTS). Every call is scoped to the caller's organization.
@ApiTags('Comments')
@Controller('/comments')
export class CommentsController {
  constructor(private _commentsService: CommentsService) {}

  private check() {
    if (!commentsEnabled()) {
      throw new NotFoundException();
    }
  }

  @Get('/channels')
  channels(@GetOrgFromRequest() org: Organization) {
    this.check();
    return this._commentsService.channels(org.id);
  }

  @Get('/:integration/posts')
  posts(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string
  ) {
    this.check();
    return this._commentsService.posts(org.id, integration);
  }

  @Get('/:integration/posts/:post')
  comments(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Param('post') post: string
  ) {
    this.check();
    return this._commentsService.comments(org.id, integration, post);
  }

  @Post('/:integration/comments/:comment/reply')
  reply(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Param('comment') comment: string,
    @Body() body: CommentReplyDto
  ) {
    this.check();
    return this._commentsService.reply(org.id, integration, comment, body.message);
  }

  @Put('/:integration/comments/:comment/hide')
  hide(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Param('comment') comment: string,
    @Body() body: CommentHideDto
  ) {
    this.check();
    return this._commentsService.hide(org.id, integration, comment, body.hidden);
  }

  @Delete('/:integration/comments/:comment')
  remove(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Param('comment') comment: string
  ) {
    this.check();
    return this._commentsService.remove(org.id, integration, comment);
  }

  @Post('/:integration/posts/:post/rules')
  createRule(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Param('post') post: string,
    @Body() body: CommentRuleDto
  ) {
    this.check();
    return this._commentsService.createRule(org.id, integration, post, body);
  }

  @Put('/rules/:id')
  setRuleActive(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: CommentRuleActiveDto
  ) {
    this.check();
    return this._commentsService.setRuleActive(org.id, id, body.active);
  }

  @Delete('/rules/:id')
  deleteRule(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    this.check();
    return this._commentsService.deleteRule(org.id, id);
  }
}
