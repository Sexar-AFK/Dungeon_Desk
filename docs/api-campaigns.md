# API de campañas — primera versión

La API de campañas guarda datos en PostgreSQL mediante Prisma. Los estados posibles son `ACTIVE`, `PAUSED`, `FINISHED` y `ARCHIVED`.

| Método  | Ruta                     | Acción                                                              |
| ------- | ------------------------ | ------------------------------------------------------------------- |
| `GET`   | `/campaigns`             | Lista campañas; admite `status` y `search` como filtros opcionales. |
| `POST`  | `/campaigns`             | Crea una campaña.                                                   |
| `GET`   | `/campaigns/:id`         | Devuelve una campaña o `404`.                                       |
| `PATCH` | `/campaigns/:id`         | Actualiza título, descripción, edición o estado.                    |
| `PATCH` | `/campaigns/:id/archive` | Archiva la campaña sin borrar sus datos.                            |

Ejemplo de creación:

```json
{
  "title": "La caída de Elturel",
  "description": "Una ciudad perdida. Una promesa que aún arde.",
  "edition": "D&D 5e · 2014"
}
```

La validación de DTOs rechaza propiedades desconocidas y los datos inválidos responden con `400`. Las campañas todavía no tienen propietario ni autenticación; por eso esta API solo debe usarse en la red local de desarrollo. Se añadirá autorización por membresía antes de habilitar acceso multiusuario real.

En desarrollo, CORS permite Vite en `localhost` y en direcciones IPv4 privadas con puerto `5173`, para poder usar la web desde otro dispositivo de la LAN. En producción, configura explícitamente `CORS_ALLOWED_ORIGINS`; no se habilita la excepción de LAN.

Para crear/aplicar migraciones durante el desarrollo:

```bash
pnpm --filter @dungeon-desk/api db:generate
pnpm --filter @dungeon-desk/api exec prisma migrate dev --name nombre_del_cambio
```
