# Dungeon Desk

# Dungeon Desk — Informe de implementación de la Alpha 0.1

**Estado:** Implementada  
**Fecha:** 2026-11-19  
**Alcance:** prototipo responsive más gestión persistente de campañas para uso local.

## Resumen

La versión 0.1 pasó de un prototipo de interfaz a una primera versión vertical de campañas: la web consume la API NestJS y los datos se guardan en PostgreSQL mediante Prisma. El PC anfitrión sirve la interfaz y la API; los navegadores de la LAN se conectan usando la IP local de ese PC.

## Interfaz implementada

- Dashboard con resumen de campañas y estados vacíos cuando todavía no hay datos.
- Biblioteca de campañas con búsqueda y filtros por estado.
- Página de detalle con lectura desde el endpoint individual.
- Crear y editar campañas mediante un modal reutilizable, con validación y presentación de errores de la API.
- Archivar campañas con confirmación; el archivado conserva sus datos.
- Diseño responsive: sidebar en escritorio y navegación inferior en móvil.
- Interruptor de tema claro/oscuro. La primera visita respeta la preferencia del sistema y las elecciones manuales se guardan en el navegador.
- Estados de carga, errores, filtros sin resultados y primera campaña vacía.

## API y persistencia

NestJS expone estas operaciones:

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/campaigns` | Listar campañas; admite `status` y `search`. |
| `POST` | `/campaigns` | Crear campaña. |
| `GET` | `/campaigns/:id` | Consultar detalle. |
| `PATCH` | `/campaigns/:id` | Editar nombre, descripción, edición o estado. |
| `PATCH` | `/campaigns/:id/archive` | Archivar sin eliminación física. |

Se añadió el modelo `Campaign`, sus estados (`ACTIVE`, `PAUSED`, `FINISHED`, `ARCHIVED`), la migración inicial y un cliente Prisma 7 con adaptador PostgreSQL. La API valida DTOs, rechaza propiedades no permitidas y responde `404` si no encuentra la campaña.

El frontend usa TanStack Query para cargar datos, actualizar la caché tras crear/editar/archivar y mantener sincronizadas las vistas. La dirección de la API se forma con el mismo host que sirve la web y el puerto `3000`; `VITE_API_URL` permite sobrescribirla.

## Ejecución local

Desde la raíz del repositorio:

```bash
cp apps/api/.env.example apps/api/.env
pnpm install
pnpm db:up
pnpm --filter @dungeon-desk/api db:generate
pnpm --filter @dungeon-desk/api exec prisma migrate dev
pnpm dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- Desde otro dispositivo de la LAN, abre `http://IP-LOCAL-DEL-PC:5173`.

En desarrollo, CORS permite el origen de Vite en loopback o en una IPv4 privada. No abras puertos del router a Internet.

## Verificaciones realizadas

- `pnpm --recursive build`: compilación de web y API correcta.
- `pnpm --recursive lint`: sin errores.
- `pnpm --filter @dungeon-desk/api test`: pruebas unitarias aprobadas.
- Migración Prisma validada y aplicada en la base local.
- Comprobación HTTP de creación, lectura, actualización, archivado y rechazo de datos inválidos.
- Verificación de CORS desde el origen local de Vite y desde una IP privada de la LAN.

La prueba en una mesa real y la validación en los dispositivos finales siguen pendientes.

## Limitaciones y seguridad

- No hay autenticación, propietario de campañas ni membresías. Cualquier cliente con acceso a la API puede leer y cambiar campañas.
- La conexión es HTTP para desarrollo local; no es adecuada para redes públicas ni para acceso por Internet.
- No se han añadido respaldos automáticos ni recuperación de base de datos.
- Los módulos de personajes, sesiones y notas todavía no tienen persistencia.

Antes de habilitar uso multiusuario fuera de una LAN de confianza, el siguiente hito debe implementar usuarios, autenticación y autorización por campaña.

# ReadMe Main

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
