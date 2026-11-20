import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { html, Mailer, type Mailable } from '@nestjs/mail';

type InvitationMailData = {
  campaignTitle: string;
  inviterEmail: string;
  url: string;
};

export type MailDelivery = 'smtp' | 'file';

@Injectable()
class CampaignInvitationMail implements Mailable<InvitationMailData> {
  render({ campaignTitle, inviterEmail, url }: InvitationMailData) {
    return {
      subject: `Invitación a ${campaignTitle} — Dungeon Desk`,
      html: html`<p>
          ${inviterEmail} te invita a participar en la campaña
          <strong>${campaignTitle}</strong>.
        </p>
        <p><a href="${url}">Aceptar invitación</a></p>
        <p>
          El enlace caduca en siete días. Si no esperabas esta invitación,
          puedes ignorar este mensaje.
        </p>`,
    };
  }
}

@Injectable()
export class CampaignInvitationMailer {
  constructor(
    private readonly mailer: Mailer,
    private readonly config: ConfigService,
  ) {}

  async send(
    email: string,
    campaignTitle: string,
    inviterEmail: string,
    token: string,
  ): Promise<MailDelivery> {
    const baseUrl = (
      this.config.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:5173'
    ).replace(/\/$/, '');
    const url = new URL('/accept-invitation', baseUrl);
    url.searchParams.set('token', token);

    await this.mailer.send(CampaignInvitationMail, {
      to: email,
      data: { campaignTitle, inviterEmail, url: url.toString() },
    });
    return this.config.get<string>('SMTP_URL')?.trim() ? 'smtp' : 'file';
  }
}
