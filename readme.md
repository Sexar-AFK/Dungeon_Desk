# Dungeon Desk

# Dungeon Desk — Informe de actualización de la ALPHA 0.4

**Estado:** Funcionalidad implementada y validada localmente; revisión visual manual pendiente  \
**Fecha:** 2026-11-20  \
**Alcance:** dashboards por rol, configuración y administración de campañas, invitaciones entrantes y permisos.

## Resumen

La versión 0.4 ofrece espacios diferenciados para Dungeon Masters y jugadores, incluidos usuarios que tienen ambos roles en campañas distintas. También integra la configuración y administración de campañas que anteriormente se había planeado para la v0.5.

La plataforma continúa siendo de desarrollo local/LAN. La implementación no implica que esté preparada para exponerse a Internet.

## Funcionalidad implementada

- Dashboard combinado por roles: campañas que dirige el usuario y campañas donde participa como jugador.
- Resumen para DM con campañas activas, cantidad de jugadores e invitaciones pendientes.
- Bandeja de invitaciones entrantes para cuentas con correo verificado; se conserva el flujo de aceptación por enlace de correo.
- Navegación filtrada por rol y por estado, búsqueda por texto/etiquetas y ordenamiento por actualización, nombre o nivel inicial.
- Ajustes de campaña: nombre, descripción, sistema/edición, nivel inicial, estado, etiquetas, color e icono.
- Preferencia de visibilidad para la descripción: puede ocultarse a jugadores; el resto de los datos sigue limitado a miembros de la campaña.
- Administración de miembros: invitaciones, revocación, roles, expulsión y posibilidad de reincorporarse mediante una nueva invitación.
- Transferencia de propiedad a otro DM, salida de miembros y eliminación permanente protegida.
- Las campañas solo se pueden eliminar si están archivadas y el propietario confirma el nombre exacto. El propietario debe transferir la campaña antes de abandonarla.
- La API aplica las reglas de autorización; ocultar acciones en la interfaz no se considera un control de seguridad.

## API de campañas

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/campaigns/dashboard` | Resumen de campañas del usuario con rol y contadores. |
| `GET` | `/campaigns` | Listar campañas a las que pertenece el usuario. |
| `POST` | `/campaigns` | Crear campaña y establecer al creador como DM. |
| `PATCH` | `/campaigns/:id` | Actualizar detalles y preferencias (DM). |
| `PATCH` | `/campaigns/:id/archive` | Archivar campaña (DM). |
| `DELETE` | `/campaigns/:id` | Eliminar campaña archivada; requiere propietario y confirmación. |
| `PATCH` | `/campaigns/:id/owner` | Transferir propiedad a otro DM. |
| `POST` | `/campaigns/:id/leave` | Abandonar una campaña (no disponible para el propietario). |
| `GET` | `/campaigns/:id/members` | Listar miembros de una campaña. |
| `GET` | `/campaign-invitations/pending` | Listar invitaciones entrantes para el correo verificado. |
| `POST` | `/campaign-invitations/:invitationId/accept` | Aceptar invitación desde la bandeja. |
| `POST` | `/campaign-invitations/:invitationId/reject` | Rechazar invitación desde la bandeja. |

Las invitaciones se validan en el backend contra el correo verificado de la sesión. La bandeja no expone tokens; la base de datos conserva hashes de los tokens de enlace.

## Migración de datos

Se añadió la migración `20261122100000_campaign_settings`, que agrega nivel inicial, icono, color, etiquetas y preferencia de visibilidad. Los valores por defecto preservan el comportamiento de campañas existentes. La migración se aplicó a la base local `dungeon_desk` y Prisma reporta el esquema actualizado.

## Verificaciones realizadas

- Prisma: esquema validado y migración aplicada en PostgreSQL local.
- API: compilación y lint correctos; 27 pruebas unitarias aprobadas.
- Web: compilación de producción y lint correctos.
- `git diff --check`: sin errores de espacios o formato.
- La revisión visual manual de los recorridos responsive en escritorio y móvil sigue pendiente.

El entorno emite una advertencia porque usa Node.js 26, mientras que el proyecto declara Node.js `>=24 <25`.

## Configuración local y límites

- En desarrollo, los mensajes de verificación e invitación se guardan como `.eml` en `apps/api/var/mail`; no se envían por Internet sin configurar SMTP.
- Para probar el registro de la segunda cuenta, `ALLOW_PUBLIC_SIGNUP` está habilitado en el `.env` local. Se recomienda deshabilitarlo cuando termine la prueba.
- La configuración local de LAN usa el origen exacto de Vite en `CORS_ALLOWED_ORIGINS` y una URL alcanzable desde los dispositivos en `APP_PUBLIC_URL`.
- Las sesiones de juego y los personajes siguen siendo hitos posteriores; la actividad reciente depende de módulos posteriores.
- No se deben abrir puertos del router a Internet. Antes de un despliegue público hacen falta HTTPS, revisión de seguridad y configuración de correo/operación de producción.

**Resultado:** las capacidades de la v0.4 están implementadas y validadas automáticamente. El cierre del hito queda sujeto a la revisión visual manual indicada arriba.

# ReadMe Main

Aplicación web para organizar una campaña de D&D. Durante el MVP, el PC anfitrión ejecutará la aplicación y PostgreSQL; los dispositivos de la mesa accederán desde la red local.

## Requisitos

- Node.js 24.x (el rango indicado en `package.json` es `>=24 <25`).
- pnpm 12.
- Docker Engine con el plugin Docker Compose para la base de datos local.

## Inicio de desarrollo

1. Copiar `apps/api/.env.example` a `apps/api/.env` y mantener `NODE_ENV=development` para el uso local.
2. Instalar dependencias: `pnpm install`.
3. Iniciar PostgreSQL: `pnpm db:up`.
4. Aplicar migraciones y generar Prisma: `pnpm --filter @dungeon-desk/api db:migrate` y `pnpm --filter @dungeon-desk/api db:generate`.
5. Configurar `INITIAL_OWNER_EMAIL` e `INITIAL_OWNER_PASSWORD` en `apps/api/.env` (mínimo 12 caracteres) y ejecutar `pnpm --filter @dungeon-desk/api db:setup-owner`.
6. Iniciar web y API: `pnpm dev`.

La migración asigna las campañas existentes a una cuenta inicial de configuración. El comando `db:setup-owner` activa esa cuenta con el correo indicado y almacena la contraseña como hash scrypt; solo funciona una vez y no sobrescribe una cuenta configurada.

Después de configurar el propietario, elimina `INITIAL_OWNER_PASSWORD` de `.env`; no es necesaria para arrancar la aplicación.

La API ofrece registro e inicio/cierre de sesión (`POST /auth/sign-up`, `/auth/sign-in`, `/auth/sign-out`), verificación (`POST /auth/email/verify`) y recuperación (`POST /auth/password/forgot`, `/auth/password/reset`). El acceso se limita a correos verificados; las campañas se filtran por el propietario autenticado. Para usar la app desde la LAN, añade el origen exacto de Vite (por ejemplo `http://192.168.1.20:5173`) a `CORS_ALLOWED_ORIGINS` en `apps/api/.env`; se utiliza también para protección CSRF.

En desarrollo, el correo se guarda como archivos `.eml` dentro de `apps/api/var/mail` (contienen enlaces secretos; no los publiques). El registro solo está activo si `ALLOW_PUBLIC_SIGNUP=true`. En producción SMTP y `APP_PUBLIC_URL` HTTPS son obligatorios; el registro queda cerrado salvo que se habilite explícitamente, y las cuentas no pueden iniciar sesión antes de verificar el correo.

La interfaz estará en `http://localhost:5173` y la API en `http://localhost:3000`.
Para probar desde otro dispositivo de la LAN, se configurará Vite para escuchar en la interfaz de red y se usará la IP local del PC anfitrión. No se deben abrir puertos del router a Internet.

## Preparación futura para un servidor público

Esto es una lista de requisitos de despliegue, **no una autorización para exponer la versión actual**:

1. Terminar TLS en un reverse proxy mantenido, redirigir HTTP a HTTPS y configurar HSTS allí.
2. Definir `NODE_ENV=production`, `APP_PUBLIC_URL` y `CORS_ALLOWED_ORIGINS` con únicamente orígenes HTTPS exactos; configurar `SMTP_URL` y un `MAIL_FROM` del dominio verificado. La cookie de sesión se fuerza a `Secure`; deja `ALLOW_PUBLIC_SIGNUP` desactivado hasta validar correo y entrega.
3. Dejar la API en `127.0.0.1` (valor por defecto en producción) y permitir acceso externo solo a través del proxy/firewall. Si el proxy está en otra IP/contenedor, configurar `API_HOST` y `TRUST_PROXY` con la IP/CIDR concreta; nunca confiar en cualquier proxy.
4. Usar PostgreSQL con TLS, credenciales de mínimo privilegio y secretos fuera del repositorio. El limitador compartido usa PostgreSQL; aplica índices/migraciones y monitoriza la carga del contador.
5. Programa `pnpm db:backup` con `BACKUP_AGE_RECIPIENT` en un destino protegido. Restaura periódicamente en una base de staging con `BACKUP_AGE_IDENTITY` y `CONFIRM_RESTORE_DB`; la restauración reemplaza objetos de la base destino.
6. Configura monitorización/alertas y realiza revisión de dependencias, pruebas de sesión/CSRF/permisos y una revisión de seguridad antes de habilitar registro o abrir tráfico.

El backup requiere `pg_dump` y `age` instalados. Ejecuta `pnpm db:backup` con `BACKUP_AGE_RECIPIENT` configurado; genera archivos `.dump.age` cifrados y excluidos de Git. La llave privada de `age` debe guardarse fuera del servidor de aplicación; conserva la llave pública `BACKUP_AGE_RECIPIENT` para cifrar. La restauración requiere `pg_restore`, `BACKUP_AGE_IDENTITY` y `CONFIRM_RESTORE_DB` igual al nombre exacto de la base destino. Ejemplo: `pnpm --filter @dungeon-desk/api db:restore -- backups/dungeon-desk-FECHA.dump.age`. Hazlo primero en staging: reemplaza los objetos de esa base en una sola transacción.

## Estructura

```text
apps/
  api/                 API NestJS
  web/                 Interfaz React + Vite
packages/
  shared/              Tipos/utilidades compartidos (cuando se necesiten)
docs/                  Documentación técnica
```
