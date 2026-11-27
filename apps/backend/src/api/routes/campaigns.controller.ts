import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { CampaignsService } from '@gitroom/nestjs-libraries/database/prisma/campaigns/campaigns.service';

class CampaignsQueryDto {
  @Type(() => Number)
  @IsIn([7, 30, 90, 365])
  days: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  tags?: boolean;
}

// Campaign dashboards built from post tags (PD_FF_CAMPAIGNS); read only
@ApiTags('Campaigns')
@Controller('/campaigns')
export class CampaignsController {
  constructor(private _campaignsService: CampaignsService) {}

  @Get('/')
  list(@GetOrgFromRequest() org: Organization, @Query() query: CampaignsQueryDto) {
    return this._campaignsService.list(org.id, query.days, !!query.tags);
  }

  @Get('/:id')
  async detail(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Query() query: CampaignsQueryDto
  ) {
    const result = await this._campaignsService.detail(org.id, id, query.days);
    if (!result) {
      throw new NotFoundException('Campaign not found');
    }
    return result;
  }
}
