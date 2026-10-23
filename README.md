# Vehicle Tracker — API

API REST para registrar vehículos y llevar el control de sus entradas y salidas. Desarrollada con Node.js, Express 5 y TypeScript.

El frontend se encuentra en un repositorio aparte: **vehicle-tracker-web**.

## Tecnologías

- Node.js 24 + Express 5 + TypeScript
- Zod para validar las variables de entorno y las solicitudes
- PostgreSQL + Prisma 7 (se incorpora en la fase 2)
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
npm run dev               # http://localhost:3000/api/health
```

## Variables de entorno

| Variable       | Descripción                                                    | Valor por defecto       |
| -------------- | -------------------------------------------------------------- | ----------------------- |
| `NODE_ENV`     | `development`, `test` o `production`                           | `development`           |
| `PORT`         | Puerto HTTP                                                    | `3000`                  |
| `CORS_ORIGIN`  | Lista de orígenes del frontend permitidos, separados por comas | `http://localhost:5173` |
| `DATABASE_URL` | Cadena de conexión de PostgreSQL (fase 2)                      | —                       |

## Scripts

| Script                 | Descripción                         |
| ---------------------- | ----------------------------------- |
| `npm run dev`          | Inicia en modo watch (carga `.env`) |
| `npm run build`        | Compila TypeScript a `dist/`        |
| `npm start`            | Ejecuta el servidor compilado       |
| `npm test`             | Ejecuta las pruebas                 |
| `npm run lint`         | Analiza el código con oxlint        |
| `npm run typecheck`    | Ejecuta el compilador de TypeScript |
| `npm run format`       | Formatea con Prettier               |
| `npm run format:check` | Verifica el formato (usado en CI)   |

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
