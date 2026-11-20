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

En desarrollo, el correo se escribe en `apps/api/var/mail` por defecto, no se entrega por Internet. Para enviar correo real, configura `SMTP_URL` y un `MAIL_FROM` aceptado por el proveedor SMTP en `apps/api/.env`, y reinicia la API. Si invitas desde la LAN, configura `APP_PUBLIC_URL` con la dirección web alcanzable por el jugador; esa URL se incluye en el enlace de invitación.

## Endpoints iniciales

Consulta [`docs/api-campaigns.md`](../../docs/api-campaigns.md) para campañas, membresías, invitaciones, filtros y autorización.

## Seguridad en esta etapa

Las campañas, membresías y operaciones de invitación requieren autenticación y verifican los permisos en backend. Aun así, el servicio no está listo para exponerse a Internet: completa la preparación de despliegue y la revisión de seguridad descritas en el README principal.

## Verificación

```bash
pnpm --filter @dungeon-desk/api build
pnpm --filter @dungeon-desk/api lint
pnpm --filter @dungeon-desk/api test
```
