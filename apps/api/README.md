# Dungeon Desk API

API REST construida con NestJS 12, Prisma 7 y PostgreSQL. El módulo inicial gestiona campañas.

## Desarrollo local

Desde la raíz del monorepo:

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up
pnpm --filter @dungeon-desk/api db:generate
pnpm --filter @dungeon-desk/api exec prisma migrate dev --name init_campaigns
pnpm dev:api
```

La API escucha en el puerto `3000`. Configura `apps/api/.env` a partir de `.env.example` si la conexión local difiere. La base de datos de Compose solo publica su puerto en `localhost`.

## Endpoints iniciales

Consulta [`docs/api-campaigns.md`](../../docs/api-campaigns.md) para rutas, filtros, DTOs y ejemplos.

## Seguridad en esta etapa

Los endpoints de campaña **todavía no requieren autenticación ni tienen propietario**. Mantén el servicio en una red de confianza y no lo expongas a Internet. Se añadirá autenticación y autorización por membresía antes de permitir campañas multiusuario reales.

## Verificación

```bash
pnpm --filter @dungeon-desk/api build
pnpm --filter @dungeon-desk/api lint
pnpm --filter @dungeon-desk/api test
```
