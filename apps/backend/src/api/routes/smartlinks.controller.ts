import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import {
  smartLinksEnabled,
  SmartLinksService,
} from '@gitroom/nestjs-libraries/database/prisma/smartlinks/smartlinks.service';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';

class SmartLinksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 30, 90])
  days?: number;
}

class SmartLinkPageDto {
  @IsString()
  @MaxLength(60)
  slug: string;

  @IsString()
  @MaxLength(80)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  accentColor?: string | null;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

class SmartLinkItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class SmartLinkOrderDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids: string[];
}

// The workspace's link-in-bio page (PD_FF_SMARTLINKS). Reading needs a
// member; changing the public page needs an admin.
@ApiTags('SmartLinks')
@Controller('/smartlinks')
export class SmartLinksController {
  constructor(private _smartLinksService: SmartLinksService) {}

  private check() {
    if (!smartLinksEnabled()) {
      throw new NotFoundException();
    }
  }

  @Get('/')
  get(@GetOrgFromRequest() org: Organization, @Query() query: SmartLinksQueryDto) {
    this.check();
    return this._smartLinksService.get(org.id, query.days || 30);
  }

  @Put('/')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  savePage(@GetOrgFromRequest() org: Organization, @Body() body: SmartLinkPageDto) {
    this.check();
    return this._smartLinksService.savePage(org.id, body);
  }

  @Post('/items')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  addItem(@GetOrgFromRequest() org: Organization, @Body() body: SmartLinkItemDto) {
    this.check();
    return this._smartLinksService.addItem(org.id, body);
  }

  @Put('/items/order')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  reorder(@GetOrgFromRequest() org: Organization, @Body() body: SmartLinkOrderDto) {
    this.check();
    return this._smartLinksService.reorder(org.id, body.ids);
  }

  @Put('/items/:id')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  updateItem(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: SmartLinkItemDto
  ) {
    this.check();
    return this._smartLinksService.updateItem(org.id, id, body);
  }

  @Delete('/items/:id')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  deleteItem(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    this.check();
    return this._smartLinksService.deleteItem(org.id, id);
  }
}
