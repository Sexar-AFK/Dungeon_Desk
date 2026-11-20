# Dungeon Desk

# Dungeon Desk — Informe de actualización de la ALPHA 0.2

**Estado:** Completada y validada localmente
**Fecha:** 2026-11-20
**Alcance:** cuentas, sesiones, verificación de correo, recuperación de contraseña y autorización por propietario; preparación de seguridad para uso local/LAN.

## Resumen

La versión 0.2 añade autenticación y separación de campañas por usuario sobre la base de campañas de la versión anterior. El propietario inicial se configura de forma explícita; las campañas existentes se conservaron y asignaron a esa cuenta al aplicar las migraciones.

La versión está comprobada en el entorno local. **No significa que el sistema esté listo para exponerse a Internet.**

## Funcionalidad implementada

- Registro e inicio/cierre de sesión desde la web.
- Sesiones persistentes en PostgreSQL; la cookie es `HttpOnly`, `SameSite=Lax` y usa `Secure` en producción.
- Verificación de correo antes de permitir el inicio de sesión. Los enlaces son de un solo uso y se almacenan en base de datos mediante hashes.
- Recuperación de contraseña con enlace de un solo uso; al cambiarla se revocan las sesiones anteriores.
- Contraseñas protegidas con scrypt mediante `@nestjs/authentication`.
- Campañas asociadas obligatoriamente a un propietario. Listado, detalle, edición y archivado quedan limitados a las campañas del usuario autenticado.
- Protección CSRF, Helmet, orígenes confiables explícitos y límites de solicitudes compartidos mediante PostgreSQL, incluidos límites por correo para acciones de envío.
- Scripts para crear al propietario inicial y para backups cifrados/restauración.

## API de autenticación

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/auth/config` | Indica si el registro está habilitado. |
| `POST` | `/auth/sign-up` | Solicitar registro y verificación de correo. |
| `POST` | `/auth/sign-in` | Iniciar sesión; solo acepta cuentas verificadas. |
| `POST` | `/auth/sign-out` | Cerrar la sesión actual. |
| `GET` | `/auth/me` | Consultar la sesión actual. |
| `POST` | `/auth/email/verify` | Confirmar un enlace de verificación. |
| `POST` | `/auth/email/verification` | Solicitar otro enlace de verificación sin revelar si existe la cuenta. |
| `POST` | `/auth/password/forgot` | Solicitar recuperación sin revelar si existe la cuenta. |
| `POST` | `/auth/password/reset` | Restablecer contraseña con un token válido. |

## Migraciones y cuenta inicial

Se aplicaron las migraciones de propiedad de campañas, usuarios/sesiones, verificación de correo, tokens de recuperación y contadores de rate limiting. Las campañas previas permanecen en la base de datos y se asignaron al propietario inicial.

El propietario se activa con `INITIAL_OWNER_EMAIL` y `INITIAL_OWNER_PASSWORD` en `apps/api/.env` y el comando:

```bash
pnpm --filter @dungeon-desk/api db:setup-owner
```

El comando solo puede activar una vez la cuenta reservada y guarda la contraseña como hash. Tras ejecutarlo, se debe quitar `INITIAL_OWNER_PASSWORD` del `.env`.

## Verificaciones realizadas

- Prisma: esquema validado y migraciones aplicadas en la base local.
- API: build y lint correctos; 8 pruebas unitarias aprobadas.
- Web: build de producción correcto.
- Prueba integrada local: verificación de correo y rechazo de reutilizar el token, inicio/cierre de sesión, protección CSRF, aislamiento entre dos usuarios, recuperación de contraseña y revocación de sesiones anteriores.
- Las cuentas, campañas y correos temporales de esa prueba se eliminaron al terminar.
- Se comprobó el inicio/cierre de sesión desde `http://localhost:5173` después de añadir los orígenes locales por defecto a la configuración de sesión.

## Límites y preparación para un despliegue futuro

- En desarrollo, el correo se escribe como archivos `.eml` en `apps/api/var/mail`; esos archivos contienen enlaces secretos y no deben compartirse.
- El registro público se habilita explícitamente con `ALLOW_PUBLIC_SIGNUP=true`; en producción requiere además SMTP y `APP_PUBLIC_URL` HTTPS.
- Los scripts de backup cifrado/restauración están añadidos, pero no se ejecutaron ni se probó una restauración. Tampoco se configuró su programación automática.
- HTTPS, dominio, reverse proxy, firewall, TLS de PostgreSQL, monitorización y revisión externa siguen pendientes para cualquier exposición pública.
- Personajes, membresías/invitaciones, notas y sesiones de juego todavía no están implementados.

**Resultado:** la 0.2 queda completada para desarrollo y validación local. Mantén el servicio en una red de confianza; no lo expongas a Internet hasta completar la configuración y revisión de despliegue.

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
