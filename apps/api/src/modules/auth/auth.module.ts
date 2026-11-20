import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthenticationStore } from './authentication-store.service.js';
import {
  EmailVerificationMailer,
  PasswordResetMailer,
  PasswordResetMail,
  VerificationMail,
} from './auth-mails.js';
import { SessionAuthProvider } from './session-auth.provider.js';
import { EmailActionRateLimiter } from './email-action-rate-limiter.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthenticationStore,
    SessionAuthProvider,
    VerificationMail,
    PasswordResetMail,
    EmailVerificationMailer,
    PasswordResetMailer,
    EmailActionRateLimiter,
  ],
})
export class AuthModule {}
