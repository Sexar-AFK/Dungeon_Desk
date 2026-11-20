# Dungeon Desk

# Dungeon Desk — Informe de actualización de la ALPHA 0.3

**Estado:** Funcionalidad implementada y validada localmente
**Alcance:** membresías de campaña, roles DM/jugador e invitaciones por correo.

## Resumen

La versión 0.3 permite que varios usuarios participen en una campaña. El propietario es DM inicial; puede invitar jugadores, administrar miembros y asignar roles. La API aplica los permisos por campaña y el frontend ofrece las acciones disponibles según el rol.

## Cambios implementados

- Membresías con roles `DM` y `PLAYER`; las campañas existentes conservan el acceso de sus propietarios como DM.
- Invitaciones por correo con enlaces de un solo uso, expiración de siete días, aceptación, rechazo y revocación.
- Listado y retirada de miembros, cambio de roles y autorización en backend para las operaciones de campaña.
- Interfaz web para consultar miembros, invitar, revocar invitaciones, administrar roles y aceptar o rechazar invitaciones.
- La respuesta de invitación indica si el mensaje fue aceptado por SMTP o guardado localmente como `.eml`.

## Verificaciones

- Migración aplicada y verificada en PostgreSQL local.
- API: build y lint correctos; 14 pruebas unitarias y 3 pruebas e2e aprobadas.
- Web: build de producción correcto.
- Flujos de membresía e invitación comprobados localmente; se limpiaron los datos temporales.

## Configuración de correo pendiente

En el entorno actual no hay `SMTP_URL` ni `MAIL_FROM` configurados. Por defecto, los mensajes se guardan en `apps/api/var/mail` y **no se envían por Internet**. Para habilitar la entrega real, configura credenciales SMTP y un remitente aceptado por el proveedor en `apps/api/.env`, y reinicia la API. Si los jugadores acceden desde la LAN, configura también `APP_PUBLIC_URL` con una dirección alcanzable por ellos. No guardes ni compartas las credenciales en el repositorio.

---

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
