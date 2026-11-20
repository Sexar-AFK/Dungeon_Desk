import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Post,
  BadRequestException,
} from '@nestjs/common';
import {
  CurrentUser,
  EmailVerificationService,
  PasswordResetService,
  Public,
  SignInService,
} from '@nestjs/authentication';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedUser } from './authenticated-user.js';
import {
  CredentialsDto,
  EmailDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { EmailActionRateLimiter } from './email-action-rate-limiter.service.js';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly signInService: SignInService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly emailActionRateLimiter: EmailActionRateLimiter,
  ) {}

  @Public()
  @Get('config')
  getConfig() {
    return {
      registrationEnabled: process.env.ALLOW_PUBLIC_SIGNUP === 'true',
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 15 * 60_000 } })
  @Post('sign-up')
  @HttpCode(202)
  async signUp(@Body() body: CredentialsDto) {
    if (process.env.ALLOW_PUBLIC_SIGNUP !== 'true') {
      throw new ForbiddenException('Public registration is disabled.');
    }
    const user = await this.authService.register(body.email, body.password);
    if (user && (await this.emailActionRateLimiter.allow('verification', user.email))) {
      void this.emailVerificationService.send(user).catch((error: unknown) => {
        this.logger.error('Could not send an email verification link', error);
      });
    }
    return {
      message: 'If this address can be registered, a verification email will be sent.',
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 15 * 60_000 } })
  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body() body: CredentialsDto) {
    const user = await this.authService.verifyCredentials(
      body.email,
      body.password,
    );
    await this.signInService.signIn(user.id, { method: 'password' });
    return user;
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000, blockDuration: 10 * 60_000 } })
  @Post('email/verify')
  @HttpCode(200)
  async verifyEmail(@Body() body: VerifyEmailDto) {
    const verified = await this.emailVerificationService.verify(body.token);
    if (!verified) throw new BadRequestException('Invalid or expired link.');
    return { emailVerified: true };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000, blockDuration: 60 * 60_000 } })
  @Post('email/verification')
  @HttpCode(202)
  requestVerification(@Body() body: EmailDto) {
    setImmediate(() => {
      void this.authService
        .findUnverifiedUser(body.email)
        .then(async (user) => {
          if (
            user &&
            (await this.emailActionRateLimiter.allow('verification', user.email))
          ) {
            await this.emailVerificationService.send(user);
          }
        })
        .catch((error: unknown) => {
          this.logger.error('Could not process an email verification request', error);
        });
    });
    return {
      message: 'If this address has an unverified account, a verification email will be sent.',
    };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000, blockDuration: 60 * 60_000 } })
  @Post('password/forgot')
  @HttpCode(202)
  forgotPassword(@Body() body: EmailDto) {
    void this.emailActionRateLimiter
      .allow('password-reset', body.email)
      .then((allowed) => {
        if (allowed) this.passwordResetService.request(body.email);
      })
      .catch((error: unknown) => {
        this.logger.error(
          'Could not process a password reset request',
          error instanceof Error ? error.stack : String(error),
        );
      });
    return { message: 'If this address has an account, password reset instructions will be sent.' };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 10 * 60_000 } })
  @Post('password/reset')
  @HttpCode(200)
  async resetPassword(@Body() body: ResetPasswordDto) {
    const result = await this.passwordResetService.reset(
      body.token,
      body.password,
    );
    if (!result) throw new BadRequestException('Invalid or expired link.');
    return { passwordReset: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post('sign-out')
  @HttpCode(204)
  async signOut(): Promise<void> {
    await this.signInService.signOut();
  }
}
