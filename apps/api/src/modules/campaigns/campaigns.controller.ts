import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CampaignsService } from './campaigns.service.js';
import { CreateCampaignDto } from './dto/create-campaign.dto.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { DeleteCampaignDto } from './dto/delete-campaign.dto.js';
import { ListCampaignsQueryDto } from './dto/list-campaigns-query.dto.js';
import { TransferCampaignOwnershipDto } from './dto/transfer-campaign-ownership.dto.js';
import { UpdateCampaignMemberDto } from './dto/update-campaign-member.dto.js';
import { UpdateCampaignDto } from './dto/update-campaign.dto.js';

/** HTTP endpoints for the first campaign-management slice. */
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  create(
    @Body() input: CreateCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.create(input, user.id);
  }

  @Get()
  findAll(
    @Query() query: ListCampaignsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.findAll(query, user.id);
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.findDashboard(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() input: UpdateCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.update(id, input, user.id);
  }

  /** Archive rather than hard-delete so campaign data can be recovered later. */
  @Patch(':id/archive')
  archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.archive(id, user.id);
  }

  @Delete(':id')
  delete(
    @Param('id') id: string,
    @Body() input: DeleteCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.deleteCampaign(id, input.confirmation, user.id);
  }

  @Patch(':id/owner')
  transferOwnership(
    @Param('id') id: string,
    @Body() input: TransferCampaignOwnershipDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.transferOwnership(id, input.targetUserId, user.id);
  }

  @Post(':id/leave')
  leave(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.leaveCampaign(id, user.id);
  }

  @Get(':id/members')
  listMembers(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.listMembers(id, user.id);
  }

  @Post(':id/invitations')
  @Throttle({
    default: { limit: 10, ttl: 60 * 60_000, blockDuration: 60 * 60_000 },
  })
  invite(
    @Param('id') id: string,
    @Body() input: CreateInvitationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.invite(id, input, user.id);
  }

  @Get(':id/invitations')
  listInvitations(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.listInvitations(id, user.id);
  }

  @Post(':id/invitations/:invitationId/revoke')
  revokeInvitation(
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.revokeInvitation(id, invitationId, user.id);
  }

  @Patch(':id/members/:memberId')
  updateMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() input: UpdateCampaignMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.updateMemberRole(
      id,
      memberId,
      input.role,
      user.id,
    );
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.removeMember(id, memberId, user.id);
  }
}
