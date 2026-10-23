# Vehicle Tracker — API

API REST para registrar vehículos y llevar el control de sus entradas y salidas. Desarrollada con Node.js, Express 5 y TypeScript.

El frontend se encuentra en un repositorio aparte: **vehicle-tracker-web**.

## Tecnologías

- Node.js 24 + Express 5 + TypeScript
- Zod para validar las variables de entorno y las solicitudes
- PostgreSQL + Prisma 7 (con el adaptador `@prisma/adapter-pg`)
- Vitest + Supertest
- oxlint + Prettier

## Requisitos

- Node.js 24 o superior
- Docker (para la base de datos PostgreSQL local)

## Puesta en marcha

```bash
npm install
cp .env.example .env      # ajuste los valores si es necesario
docker compose up -d      # inicia PostgreSQL en localhost:5432
npm run db:migrate        # aplica las migraciones a la base de datos de desarrollo
npm run db:seed           # opcional: vehículos, conductores y movimientos de ejemplo
npm run dev               # http://localhost:3000/api/health
```

`npm install` también genera el cliente de Prisma (`src/generated/prisma`, no se versiona).

Docker Compose crea dos bases de datos al iniciarse por primera vez: `vehicle_tracker` (desarrollo) y `vehicle_tracker_test` (usada por `npm test`). Si su volumen se creó antes de este cambio, ejecute `docker compose down -v` una vez para recrearlo.

> `npm run db:seed` **borra todos los datos** antes de insertar los ejemplos. Ejecútelo únicamente contra una base de datos de desarrollo.

## Variables de entorno

| Variable       | Descripción                                                                       | Valor por defecto       |
| -------------- | --------------------------------------------------------------------------------- | ----------------------- |
| `NODE_ENV`     | `development`, `test` o `production`                                              | `development`           |
| `PORT`         | Puerto HTTP                                                                       | `3000`                  |
| `CORS_ORIGIN`  | Lista de orígenes del frontend permitidos, separados por comas                    | `http://localhost:5173` |
| `DATABASE_URL` | Cadena de conexión de PostgreSQL usada en ejecución (con pooling en Neon)         | —                       |
| `DIRECT_URL`   | Conexión directa para las migraciones (Neon); si no se define, usa `DATABASE_URL` | —                       |

## Scripts

| Script                 | Descripción                                       |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Inicia en modo watch (carga `.env`)               |
| `npm run build`        | Compila TypeScript a `dist/`                      |
| `npm start`            | Ejecuta el servidor compilado                     |
| `npm test`             | Ejecuta las pruebas                               |
| `npm run lint`         | Analiza el código con oxlint                      |
| `npm run typecheck`    | Ejecuta el compilador de TypeScript               |
| `npm run format`       | Formatea con Prettier                             |
| `npm run format:check` | Verifica el formato (usado en CI)                 |
| `npm run db:migrate`   | Crea y aplica migraciones (desarrollo)            |
| `npm run db:deploy`    | Aplica las migraciones pendientes (CI/producción) |
| `npm run db:seed`      | Borra los datos e inserta los ejemplos            |
| `npm run db:reset`     | Elimina la base, vuelve a migrar y carga ejemplos |
| `npm run db:studio`    | Abre Prisma Studio                                |

## Modelo de datos

- **Vehicle** (vehículo): marca, modelo, placa (única, guardada en mayúsculas y sin espacios), año opcional e `isActive` para la eliminación lógica.
- **Driver** (conductor): `fullName` tal como se escribió, más un `normalizedName` único para que "Ana López" y "ana lópez" se consideren el mismo conductor.
- **Movement** (movimiento): vehículo, conductor, tipo (`ENTRY`/`EXIT`, entrada/salida), `occurredAt` (en UTC, `timestamptz`) y kilometraje.

Las tablas y columnas usan `snake_case` en PostgreSQL (`@@map`/`@map`), mientras que el código TypeScript usa `camelCase`.

## Formato de errores

Todos los errores comparten la misma estructura JSON:

```json
{ "message": "Validation failed", "errors": { "plate": ["Invalid format"] } }
```

`errors` solo aparece en los errores de validación.

## Endpoints

| Método | Ruta          | Descripción            |
| ------ | ------------- | ---------------------- |
| GET    | `/api/health` | Verificación de estado |

Se irán agregando más endpoints a medida que avance el proyecto.
