import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

type CorsOriginCallback = (
  error: Error | null,
  allow?: boolean | string | RegExp | (string | RegExp)[],
) => void;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== 'development' && nodeEnv !== 'production') {
    throw new Error('Set NODE_ENV explicitly to "development" or "production".');
  }
  const isProduction = nodeEnv === 'production';
  const originValues = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (isProduction && originValues.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must contain the production HTTPS origin(s).');
  }
  if (isProduction) {
    const publicUrl = process.env.APP_PUBLIC_URL;
    if (!publicUrl || !isPublicHttpsUrl(publicUrl)) {
      throw new Error('APP_PUBLIC_URL must be the public HTTPS URL of the web app in production.');
    }
    if (!process.env.MAIL_FROM?.trim()) {
      throw new Error('MAIL_FROM must be configured in production.');
    }
  }
  if (originValues.some((origin) => !isValidOrigin(origin, isProduction))) {
    throw new Error(
      isProduction
        ? 'Production CORS_ALLOWED_ORIGINS must contain exact HTTPS origins without paths or wildcards.'
        : 'CORS_ALLOWED_ORIGINS must contain valid origins without paths or wildcards.',
    );
  }
  const allowedOrigins = new Set(
    originValues.length > 0
      ? originValues
      : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  );
  const trustedProxy = process.env.TRUST_PROXY?.trim();
  if (trustedProxy) {
    if (
      ['true', '1', '*', '0.0.0.0/0', '::/0'].includes(trustedProxy.toLowerCase()) ||
      trustedProxy.endsWith('/0')
    ) {
      throw new Error('TRUST_PROXY must identify only the actual proxy IP/CIDR, not trust every proxy.');
    }
    app.set('trust proxy', trustedProxy);
  }

  app.use(helmet());
  app.enableCors({
    origin: (origin: string | undefined, callback: CorsOriginCallback) => {
      const allowed =
        !origin ||
        allowedOrigins.has(origin) ||
        (!isProduction && isPrivateViteOrigin(origin));
      callback(null, allowed);
    },
    credentials: true,
  });
  app.enableCsrfProtection({ trustedOrigins: [...allowedOrigins] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  const host = process.env.API_HOST ?? (isProduction ? '127.0.0.1' : '0.0.0.0');
  await app.listen(process.env.API_PORT ?? 3000, host);
}

function isValidOrigin(value: string, production: boolean): boolean {
  try {
    const url = new URL(value);
    return (
      url.origin === value &&
      !url.username &&
      !url.password &&
      (production ? url.protocol === 'https:' : ['http:', 'https:'].includes(url.protocol))
    );
  } catch {
    return false;
  }
}

function isPublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

/** Permit Vite's HTTP origin on loopback or a private IPv4 network in dev. */
function isPrivateViteOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' || url.port !== '5173') return false;
    if (url.hostname === 'localhost') return true;

    const octets = url.hostname.split('.').map(Number);
    if (octets.length !== 4 || octets.some((part) => part < 0 || part > 255)) {
      return false;
    }

    const [first, second] = octets;
    return (
      first === 10 ||
      first === 127 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  } catch {
    return false;
  }
}

await bootstrap();
