# Vehicle Tracker — API

API REST para registrar vehículos y llevar el control de sus entradas y salidas. Desarrollada con Node.js, Express 5 y TypeScript.

El frontend se encuentra en un repositorio aparte: **[vehicle-tracker-web-PPF](https://github.com/Jorge-Peralta/vehicle-tracker-web-PPF)**.

## Demo en línea

| Recurso                       | URL                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Documentación (Swagger UI)    | [vehicle-tracker-api-ppf.onrender.com/api/docs](https://vehicle-tracker-api-ppf.onrender.com/api/docs) |
| Verificación de estado        | [/api/health](https://vehicle-tracker-api-ppf.onrender.com/api/health)                                 |
| Aplicación web que la consume | [vehicle-tracker-web-ppf.vercel.app](https://vehicle-tracker-web-ppf.vercel.app)                       |

Desplegada en Render (plan gratuito) con la base de datos en Neon. El servidor se suspende tras unos minutos sin uso, por lo que **la primera solicitud puede tardar entre 30 y 60 segundos** mientras se reactiva.

## Requisitos

- Node.js 24 o superior
- Docker (para la base de datos PostgreSQL local)

## Instalación y configuración:

```bash
npm install
cp .env.example .env      # ajuste los valores si es necesario
docker compose up -d      # inicia PostgreSQL en localhost:5432
npm run db:migrate        # aplica las migraciones a la base de datos de desarrollo
npm run db:seed           # vehículos, conductores y movimientos de ejemplo (única forma de crear conductores)
npm run dev               # http://localhost:3000/api/health
```

## Tecnologías

- Node.js 24 + Express 5 + TypeScript
- Zod para validar las variables de entorno y las solicitudes
- PostgreSQL + Prisma 7 (con el adaptador `@prisma/adapter-pg`)
- OpenAPI 3.1 generado desde los esquemas Zod (`@asteasolutions/zod-to-openapi`) + Swagger UI
- Vitest + Supertest
- oxlint + Prettier

## Documentación de la API

Con el servidor en marcha:

- **Swagger UI:** http://localhost:3000/api/docs
- **Especificación OpenAPI (JSON):** http://localhost:3000/api/docs.json

La especificación se genera a partir de los mismos esquemas Zod que validan las solicitudes, por lo que la documentación y la validación no pueden desincronizarse. El frontend genera sus tipos a partir de `/api/docs.json`.

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
- **Driver** (conductor): `fullName` e `identityNumber`, el Número de Identidad hondureño (13 dígitos, guardado sin guiones y único). Los conductores solo se crean con los datos de ejemplo (`npm run db:seed`); registrar un movimiento nunca crea uno.
- **Movement** (movimiento): vehículo, conductor, tipo (`ENTRY`/`EXIT`, entrada/salida), `occurredAt` (en UTC, `timestamptz`) y kilometraje.

Las tablas y columnas usan `snake_case` en PostgreSQL (`@@map`/`@map`), mientras que el código TypeScript usa `camelCase`.

## Formato de errores

Todos los errores comparten la misma estructura JSON:

```json
{
  "message": "Los datos enviados no son válidos",
  "errors": { "plate": ["La placa debe tener 3 letras y 4 dígitos, por ejemplo HAA 1234"] }
}
```

`errors` solo aparece en los errores de validación.

## Endpoints

| Método | Ruta                           | Descripción                                                                                                                                                                     |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/health`                  | Verificación de estado                                                                                                                                                          |
| GET    | `/api/vehicles`                | Lista los vehículos activos. Parámetros: `search` (marca, modelo o placa), `includeInactive=true`                                                                               |
| GET    | `/api/vehicles/:id`            | Obtiene un vehículo con su estado actual (`INSIDE`/`OUTSIDE`) y su último kilometraje                                                                                           |
| POST   | `/api/vehicles`                | Crea un vehículo (`201`). Si la placa pertenece a un vehículo eliminado, lo reactiva (`200`)                                                                                    |
| PUT    | `/api/vehicles/:id`            | Actualiza un vehículo activo                                                                                                                                                    |
| DELETE | `/api/vehicles/:id`            | Elimina un vehículo. Responde `{ "result": "deleted" }` o `{ "result": "deactivated" }`                                                                                         |
| GET    | `/api/movements`               | Lista entradas y salidas, de la más reciente a la más antigua. Filtros: `from`, `to` (`YYYY-MM-DD`), `vehicleId`, `driverId`, `type`; paginación: `page`, `pageSize` (máx. 100) |
| POST   | `/api/movements`               | Registra una entrada o salida (`201`)                                                                                                                                           |
| GET    | `/api/movements/daily-summary` | Entradas y salidas por día (hora de Honduras), un elemento por día incluidos los días sin movimientos. `from` y `to` obligatorios (`YYYY-MM-DD`), máximo 31 días                |
| GET    | `/api/drivers`                 | Lista los conductores en orden alfabético, con su `identityNumber`. Parámetro: `search` (nombre o Número de Identidad, con o sin guiones)                                       |

Las listas paginadas responden `{ data, total, page, pageSize }`.

Ejemplo de registro de movimiento:

```json
{
  "vehicleId": 1,
  "driverId": 1,
  "type": "ENTRY",
  "occurredAt": "2026-03-10T08:30:00-06:00",
  "mileage": 15230
}
```

### Reglas de vehículos

- **Placa:** formato hondureño, tres letras y cuatro dígitos (`HAA 1234` o `HAA1234`). Se guarda en mayúsculas y sin espacios. El patrón está en `PLATE_PATTERN` (`src/modules/vehicles/vehicle.schemas.ts`).
- **Campos:** `brand`, `model` y `plate` son obligatorios; `year` es opcional (entero, desde 1900 hasta el próximo año).
- **Eliminación:** si el vehículo no tiene movimientos se elimina definitivamente (`deleted`); si los tiene, se desactiva (`deactivated`) para conservar el historial. Los vehículos desactivados no aparecen en los listados por defecto y no se pueden editar.
- **Placa duplicada:** responde `409` si otro vehículo activo ya usa la placa.

### Reglas de movimientos

- **Alternancia:** el primer movimiento de un vehículo puede ser de cualquier tipo; después, no se permiten dos entradas ni dos salidas seguidas (`409`).
- **Fecha:** no puede estar en el futuro (`400`) y debe ser posterior al último movimiento del vehículo (`409`). Se envía en ISO 8601 con zona horaria y se guarda en UTC.
- **Kilometraje:** entero mayor o igual a 0 y no menor que el último kilometraje registrado del vehículo (`409`).
- **Conductor:** se envía el `driverId` de un conductor existente; si no existe responde `404`. Registrar un movimiento nunca crea conductores.
- **Vehículos desactivados:** no admiten nuevos movimientos (`404`), pero su historial sigue apareciendo en el listado.
- **Concurrencia:** el registro se hace en una transacción que bloquea la fila del vehículo (`SELECT … FOR UPDATE`), así dos solicitudes simultáneas no pueden registrar, por ejemplo, dos entradas seguidas.
- **Filtros de fecha:** `from` y `to` son días completos en hora de Honduras (UTC-6, sin horario de verano), ambos inclusive.
