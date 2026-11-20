import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  EmailVerificationHandler,
  PasswordResetHandler,
  type EmailVerificationLink,
  type PasswordResetLink,
} from '@nestjs/authentication';
import { html, Mailer, type Mailable } from '@nestjs/mail';
import { PrismaService } from '../../database/prisma.service.js';

type LinkData = { url: string };

@Injectable()
export class VerificationMail implements Mailable<LinkData> {
  render({ url }: LinkData) {
    return {
      subject: 'Confirma tu correo de Dungeon Desk',
      html: html`<p>Confirma que controlas esta dirección de correo.</p>
        <p><a href="${url}">Confirmar correo</a></p>
        <p>Si no creaste esta cuenta, puedes ignorar este mensaje.</p>`,
    };
  }
}

@Injectable()
export class PasswordResetMail implements Mailable<LinkData> {
  render({ url }: LinkData) {
    return {
      subject: 'Restablece tu contraseña de Dungeon Desk',
      html: html`<p>Se solicitó un cambio de contraseña para tu cuenta.</p>
        <p><a href="${url}">Elegir una contraseña nueva</a></p>
        <p>El enlace caduca en una hora. Si no fuiste tú, ignora este mensaje.</p>`,
    };
  }
}

@Injectable()
export class EmailVerificationMailer extends EmailVerificationHandler {
  constructor(
    private readonly mailer: Mailer,
    private readonly prisma: PrismaService,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler('emailVerification', this);
  }

  async send(link: EmailVerificationLink): Promise<void> {
    await this.mailer.send(VerificationMail, {
      to: link.email,
      data: { url: link.url },
    });
  }

  async markVerified(userId: string, email: string): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId, email },
      data: { emailVerified: true },
    });
    return result.count === 1;
  }
}

@Injectable()
export class PasswordResetMailer extends PasswordResetHandler {
  constructor(
    private readonly mailer: Mailer,
    private readonly prisma: PrismaService,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerHandler('passwordReset', this);
  }

  findUser(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });
  }

  async send(link: PasswordResetLink): Promise<void> {
    await this.mailer.send(PasswordResetMail, {
      to: link.email,
      data: { url: link.url },
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
