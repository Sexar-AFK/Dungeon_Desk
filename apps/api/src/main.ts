import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

type CorsOriginCallback = (
  error: Error | null,
  allow?: boolean | string | RegExp | (string | RegExp)[],
) => void;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = new Set(
    (
      process.env.CORS_ALLOWED_ORIGINS ??
      'http://localhost:5173,http://127.0.0.1:5173'
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  const allowPrivateLanOrigins = process.env.NODE_ENV !== 'production';

  app.enableCors({
    origin: (origin: string | undefined, callback: CorsOriginCallback) => {
      const allowed =
        !origin ||
        allowedOrigins.has(origin) ||
        (allowPrivateLanOrigins && isPrivateViteOrigin(origin));
      callback(null, allowed);
    },
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  await app.listen(process.env.API_PORT ?? 3000, '0.0.0.0');
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
