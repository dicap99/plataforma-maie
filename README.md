# Plataforma Informática MaIE

Plataforma web de la Maestría en Ingeniería Electrónica (Universidad de Nariño) con tres módulos:
**Procesos Administrativos**, **Resultados de Aprendizaje** y **Evaluación Docente (Acuerdo 058)**.
Requisitos: SRS IEEE 830 (Actividad 1). Diseño: Documento Técnico (Actividad 2).

Estado: **esqueleto**. Las rutas, el RBAC, el esquema de BD y los componentes están definidos; los servicios responden `501 No implementado` hasta la Actividad 3.

## Stack

| Capa | Tecnología |
|---|---|
| BD | PostgreSQL 16 (`database/init.sql`, `database/seed.sql`) |
| API | Node.js 20 + Express 4, JWT (8 h), bcryptjs (costo 10) |
| Web | React 18 + Vite 5, React Router 6, CSS propio responsive, Tailwind v4 (sin preflight) + Recharts para figuras |
| Infra | Docker Compose (`db`, `backend`, `frontend`) |

## Ejecución

```bash
docker compose up --build        # BD :5432 · API :5000 · Web :80
```

Local, sin Docker para la API/web (requiere una BD PostgreSQL):

```bash
cd backend  && cp .env.example .env && npm install && npm run dev   # :5000
cd frontend && npm install && npm run dev                           # :5173
cd backend  && npm test                                             # jest + supertest
```

Usuario inicial (seed): `coordinacion.maie@udenar.edu.co` / `CambiarMaIE2026`. **Cambiar tras el primer ingreso.**

## Estructura

```
backend/src/
  app.js, server.js            # app Express / arranque
  config/                      # env, pool pg
  middlewares/                 # authenticate (JWT), authorize (RBAC), validate, upload, errorHandler
  utils/                       # ApiError, apiResponse (DTO {status,data}), pendiente, requestContext
  routes/index.js              # /api/v1
  modules/<modulo>/<recurso>/  # <recurso>.routes|controller|service|repository.js
    auth/ usuarios/
    admin/       cohortes cursos presupuesto finanzas investigacion docentes importaciones plantillas reportes
    ra/          resultados estrategias rubricas evaluaciones reportes
    evalDocente/ periodos formularios respuestas resultados  + acuerdo058.js (reglas puras)
frontend/src/
  api/ context/ routes/ layouts/ pages/ components/ styles/
  features/auth|admin|ra|evalDocente/   # LoginForm, CsvUploaderModal, PresupuestoDashboard, RubricaGridEvaluador,
                                         # HistogramaRAChart, FormularioAcuerdo058, DocenteResultadoView
```

## API `/api/v1`

| Recurso | Rutas | Rol |
|---|---|---|
| Auth | `POST /auth/login`, `GET /auth/me` | Público / Todos |
| Usuarios | CRUD `/usuarios` | Coord |
| Cohortes, cursos | CRUD `/admin/cohortes`, `/admin/cursos` | Coord (Docente: lectura) |
| Presupuesto | CRUD `/admin/presupuesto`, `GET /admin/presupuesto/resumen` | Coord |
| Finanzas | `/admin/transferencias`, `/admin/contratos-ops` | Coord |
| Investigación | `/admin/investigacion/productos`, `/admin/investigacion/pasantias` | Coord |
| Perfil docente | `/admin/docentes/me/perfil`, `/admin/docentes/:id/perfil` | Docente propio / Coord |
| Importación | `POST /admin/importaciones?tipo=` (multipart `archivo`), `GET /admin/plantillas/:tipo` | Coord |
| Reportes adm. | `GET /admin/reportes/estadisticas` | Coord |
| RA | `GET /ra/resultados`, `/ra/estrategias`, `/ra/rubricas` | Docente, Coord |
| Calificaciones RA | `GET/POST /ra/evaluaciones`, `PUT /ra/evaluaciones/:id` | Docente (Coord: auditoría) |
| Reportes RA | `GET /ra/reportes?nivel=estudiante\|curso\|modulo\|cohorte\|programa` | Coord |
| Periodos | CRUD `/eval-docente/periodos`, `GET /activo`, `POST /:id/publicar`, `GET /:id/indicadores` | Coord |
| Formularios | `GET /eval-docente/formularios/:tipo` (EE/EC/AE) | Todos (según tipo) |
| Respuestas | `POST /eval-docente/respuestas` | EE→Estudiante, AE→Docente, EC→Coord |
| Resultados | `GET /eval-docente/resultados/me`, `/:docenteId`, `/:docenteId/informe.pdf` | Docente propio / Coord |

Respuesta estándar: `{ "status": "success", "data": … }` o `{ "status": "error", "error": { "message": … } }`.
