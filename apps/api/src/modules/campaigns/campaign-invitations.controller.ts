import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CampaignsService } from './campaigns.service.js';
import { InvitationTokenDto } from './dto/invitation-token.dto.js';

@Controller('campaign-invitations')
export class CampaignInvitationsController {
  constructor(private readonly campaignsService: CampaignsService) {}

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
