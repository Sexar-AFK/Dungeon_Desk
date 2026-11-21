# API de campañas

La API guarda campañas en PostgreSQL mediante Prisma. Las rutas requieren una sesión autenticada salvo que se indique lo contrario. Los estados posibles son `ACTIVE`, `PAUSED`, `FINISHED` y `ARCHIVED`.

## Campañas

| Método   | Ruta                                              | Acción                                                                      |
| -------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| `GET`    | `/campaigns/dashboard`                           | Resúmenes de las campañas del usuario, con rol y contadores para el inicio. |
| `GET`    | `/campaigns`                                      | Lista campañas en las que participa el usuario; admite `status` y `search`. |
| `POST`   | `/campaigns`                                      | Crea una campaña y añade al creador como DM.                                |
| `GET`    | `/campaigns/:id`                                  | Consulta una campaña a la que pertenece el usuario.                         |
| `PATCH`  | `/campaigns/:id`                                  | Edita campaña (DM).                                                         |
| `PATCH`  | `/campaigns/:id/archive`                          | Archiva campaña (DM).                                                       |
| `DELETE` | `/campaigns/:id`                                  | Elimina permanentemente una campaña archivada; solo propietario y confirmación del nombre. |
| `PATCH`  | `/campaigns/:id/owner`                            | Transfiere propiedad a otro DM (propietario actual).                         |
| `POST`   | `/campaigns/:id/leave`                            | Permite que un miembro abandone la campaña; el propietario debe transferirla primero. |
| `GET`    | `/campaigns/:id/members`                          | Lista miembros de la campaña.                                               |
| `POST`   | `/campaigns/:id/invitations`                      | Crea una invitación de jugador y la envía por correo (DM).                  |
| `GET`    | `/campaigns/:id/invitations`                      | Lista invitaciones pendientes (DM).                                         |
| `POST`   | `/campaigns/:id/invitations/:invitationId/revoke` | Revoca una invitación pendiente (DM).                                       |
| `PATCH`  | `/campaigns/:id/members/:memberId`                | Cambia el rol a `DM` o `PLAYER` (propietario).                              |
| `DELETE` | `/campaigns/:id/members/:memberId`                | Elimina un miembro (DM; el propietario no se puede eliminar).               |

La creación y edición también admiten `initialLevel` (1–20), `themeColor`, `icon`, `tags` (hasta 8 etiquetas) y `playerCanViewDescription`. Los enums de color e icono se validan en el servidor. Las campañas son siempre accesibles solo para sus miembros; si `playerCanViewDescription` es falso, las respuestas de lista, detalle y dashboard ocultan la descripción a los jugadores. No se admiten campañas públicas en esta versión.

## Responder a una invitación

El enlace de correo dirige a la web (`/accept-invitation?token=…`). El usuario debe iniciar sesión con el mismo correo verificado al que se envió la invitación. La API no guarda el token en claro; los enlaces expiran en siete días y solo se pueden usar una vez.

| Método | Ruta                           | Cuerpo             |
| ------ | ------------------------------ | ------------------ |
| `POST` | `/campaign-invitations/accept` | `{ "token": "…" }` |
| `POST` | `/campaign-invitations/reject` | `{ "token": "…" }` |
| `GET`  | `/campaign-invitations/pending` | Lista invitaciones de la dirección verificada de la sesión, sin tokens. |
| `POST` | `/campaign-invitations/:invitationId/accept` | Acepta la invitación si coincide con el correo verificado. |
| `POST` | `/campaign-invitations/:invitationId/reject` | Rechaza la invitación si coincide con el correo verificado. |

El token se entrega por correo y no se incluye en la respuesta JSON. La creación devuelve `delivery: "smtp"` si el servidor SMTP aceptó el mensaje, o `delivery: "file"` si el mensaje se escribió como `.eml` en `apps/api/var/mail`. El modo `file` **no envía correo por Internet**; configura `SMTP_URL` y `MAIL_FROM` en `apps/api/.env` para activar entrega real, incluso durante desarrollo. Los archivos `.eml` contienen enlaces secretos y no deben compartirse públicamente.

## Roles y autorización

- El propietario de una campaña es DM inicial y no se puede eliminar ni degradar; puede transferir la propiedad a otro DM.
- Los DM pueden editar/archivar campañas, invitar jugadores, revocar invitaciones y retirar jugadores.
- Solo el propietario puede cambiar los roles y retirar a otros DM.
- Solo el propietario puede eliminar permanentemente una campaña, y solo después de archivarla y confirmar exactamente su nombre.
- El propietario no puede abandonar la campaña sin transferir primero la propiedad; otros miembros pueden salir y volver a ser invitados más adelante.
- Los jugadores pueden consultar las campañas y miembros de las que forman parte, pero no administrarlas.
- La autorización se valida en el backend. No se debe confiar en que la interfaz oculte acciones.
- Un usuario sin acceso recibe `404` al consultar una campaña para no revelar su existencia.

La validación de DTOs rechaza propiedades desconocidas y los datos inválidos responden con `400`. En producción configura orígenes HTTPS explícitos; no se habilita el acceso desde direcciones LAN.

`GET /campaigns/dashboard` devuelve solo campañas con membresía del usuario autenticado, ordenadas por modificación reciente. Cada elemento incluye `role` (`DM` o `PLAYER`), `playerCount` y `pendingInvitationCount`. El contador de invitaciones solo se expone para campañas no archivadas donde el usuario es DM; cuenta invitaciones no aceptadas, no revocadas y no expiradas. La bandeja de invitaciones entrantes verifica que la cuenta tenga correo confirmado y nunca expone el token almacenado como hash.

## Migraciones

La migración de membresías crea una membresía `DM` para cada propietario existente, conservando sus accesos.

```bash
pnpm --filter @dungeon-desk/api db:generate
pnpm --filter @dungeon-desk/api exec prisma migrate dev --name nombre_del_cambio
```
