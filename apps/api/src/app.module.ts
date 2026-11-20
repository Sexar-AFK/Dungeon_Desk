import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthenticationModule } from '@nestjs/authentication';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { FileMailTransport, MailModule, SmtpTransport } from '@nestjs/mail';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CampaignsModule } from './modules/campaigns/campaigns.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { RateLimitStorageModule } from './database/rate-limit-storage.module.js';
import { PostgresThrottlerStorage } from './database/postgres-throttler.storage.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthenticationModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const configuredOrigins = config.get<string>('CORS_ALLOWED_ORIGINS');
        const trustedOrigins = configuredOrigins
          ? configuredOrigins
              .split(',')
              .map((origin) => origin.trim())
              .filter(Boolean)
          : ['http://localhost:5173', 'http://127.0.0.1:5173'];

        return {
          session: {
            absoluteTtl: '14d',
            idleTtl: '3d',
            cookie: { secure: config.get('NODE_ENV') === 'production' },
            trustedOrigins,
          },
          emailVerification: {
            url: `${(config.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:5173').replace(/\/$/, '')}/verify-email`,
          },
          passwordReset: {
            url: `${(config.get<string>('APP_PUBLIC_URL') ?? 'http://localhost:5173').replace(/\/$/, '')}/reset-password`,
          },
        };
      },
    }),
    MailModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const production = config.get('NODE_ENV') === 'production';
        const smtpUrl = config.get<string>('SMTP_URL')?.trim();
        const mailFrom = config.get<string>('MAIL_FROM')?.trim();
        if (production && !smtpUrl) {
          throw new Error(
            'SMTP_URL is required in production for account verification and recovery.',
          );
        }
        if (smtpUrl && (!mailFrom || /@example\.com\b/i.test(mailFrom))) {
          throw new Error(
            'Set MAIL_FROM to a real sender address accepted by the SMTP provider when SMTP_URL is configured.',
          );
        }
        return {
          // SMTP is optional in development, but when configured it must really send.
          transport: smtpUrl
            ? new SmtpTransport({ url: smtpUrl })
            : new FileMailTransport({
                directory: config.get('MAIL_DIRECTORY') ?? 'var/mail',
              }),
          from: mailFrom ?? 'Dungeon Desk <noreply@example.com>',
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [RateLimitStorageModule],
      inject: [PostgresThrottlerStorage],
      useFactory: (storage: PostgresThrottlerStorage) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        storage,
      }),
    }),
    DatabaseModule,
    RateLimitStorageModule,
    AuthModule,
    CampaignsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
