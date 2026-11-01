import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization, User } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { userActor } from '@gitroom/nestjs-libraries/database/prisma/approvals/approval.policy.service';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { PostsBulkVideosService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.bulk.videos.service';
import { BulkVideoPostsDto } from '@gitroom/nestjs-libraries/dtos/posts/bulk.videos.dto';
import { PermissionsService } from '@gitroom/backend/services/auth/permissions/permissions.service';

// Bulk scheduling of uploaded videos: one post a video, spread over the time
// slots of the channels, every post checked like one made in the composer
@ApiTags('Posts')
@Controller('/posts-bulk-videos')
export class PostsBulkVideosController {
  constructor(
    private _bulkVideosService: PostsBulkVideosService,
    private _permissionsService: PermissionsService
  ) {}

  @Get('/channels')
  channels(@GetOrgFromRequest() org: Organization) {
    return this._bulkVideosService.channels(org.id);
  }

  @Post('/preview')
  async preview(
    @GetOrgFromRequest() org: Organization,
    @Body() body: BulkVideoPostsDto
  ) {
    const remaining = await this._permissionsService.remainingPostsThisMonth(
      org.id,
      org.createdAt
    );
    return this._bulkVideosService.preview(org.id, body, remaining);
  }

  @Post('/')
  @CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
  async create(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: BulkVideoPostsDto
  ) {
    // the policy above checks the plan once, this creates many posts
    const remaining = await this._permissionsService.remainingPostsThisMonth(
      org.id,
      org.createdAt
    );
    return this._bulkVideosService.create(
      org.id,
      body,
      remaining,
      userActor(user, org as any)
    );
  }
}
