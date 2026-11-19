# Dungeon Desk

Aplicación web para organizar una campaña de D&D. Durante el MVP, el PC anfitrión ejecutará la aplicación y PostgreSQL; los dispositivos de la mesa accederán desde la red local.

## Requisitos

- Node.js 20.19+ (recomendado: versión LTS compatible).
- pnpm 12.
- Docker Engine con el plugin Docker Compose para la base de datos local.

## Inicio de desarrollo

1. Copiar `apps/api/.env.example` a `apps/api/.env`.
2. Instalar dependencias: `pnpm install`.
3. Iniciar PostgreSQL: `pnpm db:up`.
4. Iniciar web y API: `pnpm dev`.

La interfaz estará en `http://localhost:5173` y la API en `http://localhost:3000`.
Para probar desde otro dispositivo de la LAN, se configurará Vite para escuchar en la interfaz de red y se usará la IP local del PC anfitrión. No se deben abrir puertos del router a Internet.

## Estructura

```text
apps/
  api/                 API NestJS
  web/                 Interfaz React + Vite
packages/
  shared/              Tipos/utilidades compartidos (cuando se necesiten)
docs/                  Documentación técnica
```
