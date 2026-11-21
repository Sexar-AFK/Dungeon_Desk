import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CampaignsService } from './campaigns.service.js';
import { InvitationTokenDto } from './dto/invitation-token.dto.js';

@Controller('campaign-invitations')
export class CampaignInvitationsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get('pending')
  pending(@CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.listPendingInvitations(user.id);
  }

  @Post(':invitationId/accept')
  @HttpCode(200)
  acceptById(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.respondToInvitationById(
      invitationId,
      user.id,
      true,
    );
  }

  @Post(':invitationId/reject')
  @HttpCode(200)
  rejectById(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.respondToInvitationById(
      invitationId,
      user.id,
      false,
    );
  }

  @Post('accept')
  @HttpCode(200)
  accept(
    @Body() input: InvitationTokenDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.respondToInvitation(
      input.token,
      user.id,
      true,
    );
  }

  @Post('reject')
  @HttpCode(200)
  reject(
    @Body() input: InvitationTokenDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.respondToInvitation(
      input.token,
      user.id,
      false,
    );
  }
}
