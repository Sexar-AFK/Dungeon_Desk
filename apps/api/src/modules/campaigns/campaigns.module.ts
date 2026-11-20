import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller.js';
import { CampaignInvitationsController } from './campaign-invitations.controller.js';
import { CampaignInvitationMailer } from './campaign-invitation-mail.js';
import { CampaignsService } from './campaigns.service.js';

@Module({
  controllers: [CampaignsController, CampaignInvitationsController],
  providers: [CampaignsService, CampaignInvitationMailer],
})
export class CampaignsModule {}
