import { Controller, Get, HttpException, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { AdminUsersService } from '@gitroom/nestjs-libraries/database/prisma/admin-users/admin-users.service';
import { AdminUsersListDto } from '@gitroom/nestjs-libraries/dtos/admin-users/admin.users.list.dto';

// The users of the platform for its super admin: find one, see their plan,
// channels, posts and errors
@ApiTags('Admin')
@Controller('/admin/users')
export class AdminUsersController {
  constructor(private _adminUsersService: AdminUsersService) {}

  private assertSuperAdmin(user: User) {
    if (!user?.isSuperAdmin) {
      throw new HttpException('Unauthorized', 400);
    }
  }

  @Get('/')
  async list(
    @GetUserFromRequest() user: User,
    @Query() query: AdminUsersListDto
  ) {
    this.assertSuperAdmin(user);
    return this._adminUsersService.list(query);
  }

  // the counts on top of the list, before /:id so it is not read as an id
  @Get('/summary')
  async summary(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._adminUsersService.summary();
  }

  @Get('/:id')
  async getUser(@GetUserFromRequest() user: User, @Param('id') id: string) {
    this.assertSuperAdmin(user);
    const found = await this._adminUsersService.getUser(id);
    if (!found) {
      throw new HttpException('User not found', 404);
    }
    return found;
  }
}
