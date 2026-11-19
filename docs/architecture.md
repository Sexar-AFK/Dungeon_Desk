# Arquitectura inicial

- `apps/web`: cliente React + TypeScript + Vite.
- `apps/api`: API REST en NestJS.
- `packages/shared`: espacio para contratos realmente compartidos entre web y API.
- PostgreSQL: persistencia local durante el MVP, accesible únicamente desde el PC anfitrión.

La API será responsable de validar autenticación, pertenencia a campañas y permisos. El navegador no se conectará directamente a PostgreSQL. En el MVP no se expondrá ningún puerto del router a Internet.
