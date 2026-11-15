import { AgentCredentialService } from '@gitroom/nestjs-libraries/chat/agent-credential.service';
import { CreateAgentCredentialDto } from '@gitroom/nestjs-libraries/dtos/settings/agent.credential.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Header,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { Organization, User } from '@prisma/client';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { AddTeamMemberDto } from '@gitroom/nestjs-libraries/dtos/settings/add.team.member.dto';
import { AdminAddTeamMemberDto } from '@gitroom/nestjs-libraries/dtos/settings/admin.add.team.member.dto';
import { ChangeTeamMemberRoleDto } from '@gitroom/nestjs-libraries/dtos/settings/change.team.member.role.dto';
import { ShortlinkPreferenceDto } from '@gitroom/nestjs-libraries/dtos/settings/shortlink-preference.dto';
import { ApiTags } from '@nestjs/swagger';
import { AuthorizationActions, Sections } from '@gitroom/backend/services/auth/permissions/permission.exception.class';

@ApiTags('Settings')
@Controller('/settings')
export class SettingsController {
  constructor(
    private _organizationService: OrganizationService,
    private _agentCredentials: AgentCredentialService
  ) {}

  @Get('/agent-credentials')
  @Header('Cache-Control', 'no-store')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  listAgentCredentials(@GetOrgFromRequest() org: Organization) {
    return this._agentCredentials.list(org.id);
  }

  @Post('/agent-credentials')
  @Header('Cache-Control', 'no-store')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  createAgentCredential(@GetOrgFromRequest() org: Organization, @Body() body: CreateAgentCredentialDto) {
    return this._agentCredentials.create(org.id, body);
  }

  @Delete('/agent-credentials/:id')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  revokeAgentCredential(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._agentCredentials.revoke(org.id, id);
  }

  @Get('/team')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  async getTeam(@GetOrgFromRequest() org: Organization) {
    return this._organizationService.getTeam(org.id);
  }

  @Post('/team')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  async inviteTeamMember(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: AddTeamMemberDto
  ) {
    return this._organizationService.inviteTeamMember(org, user, body);
  }

  @Post('/team/add')
  async addTeamMember(
    @GetUserFromRequest() user: User,
    @GetOrgFromRequest() org: Organization,
    @Body() body: AdminAddTeamMemberDto
  ) {
    if (!user.isSuperAdmin) {
      throw new HttpException('Unauthorized', 400);
    }

    return this._organizationService.addTeamMemberByEmail(org, body);
  }

  @Delete('/team/:id')
  @CheckPolicies(
    [AuthorizationActions.Create, Sections.TEAM_MEMBERS],
    [AuthorizationActions.Create, Sections.ADMIN]
  )
  deleteTeamMember(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Param('id') id: string
  ) {
    return this._organizationService.deleteTeamMember(org, id, user.id);
  }

  // Super Admin only (checked in the service), within this workspace
  @Put('/team/:id/role')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  changeTeamMemberRole(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: ChangeTeamMemberRoleDto
  ) {
    return this._organizationService.changeTeamMemberRole(org, id, body);
  }

  @Get('/shortlink')
  async getShortlinkPreference(@GetOrgFromRequest() org: Organization) {
    return this._organizationService.getShortlinkPreference(org.id);
  }

  @Post('/shortlink')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async updateShortlinkPreference(
    @GetOrgFromRequest() org: Organization,
    @Body() body: ShortlinkPreferenceDto
  ) {
    return this._organizationService.updateShortlinkPreference(
      org.id,
      body.shortlink
    );
  }
}
