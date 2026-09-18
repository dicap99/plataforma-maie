# Plataforma Informática MaIE

Plataforma web de la Maestría en Ingeniería Electrónica (Universidad de Nariño) con tres módulos:
**Procesos Administrativos**, **Resultados de Aprendizaje** y **Evaluación Docente (Acuerdo 058)**.
Requisitos: SRS IEEE 830 (Actividad 1). Diseño: Documento Técnico (Actividad 2).

## Estado

| Módulo | Estado |
|---|---|
| Autenticación, usuarios y RBAC | ✅ Implementado |
| 1. Procesos Administrativos (RF-ADM-01 a 06) | ✅ Implementado: datos por hoja, importación Excel/CSV, plantilla/exportación, estadísticas y tableros |
| 1. Reporte oficial de presupuesto (PDF PSP-GEF-FR-04) | 🟡 Tablas creadas (`presupuesto_ingresos*`); lector de PDF pendiente |
| 2. Resultados de Aprendizaje | ⬜ Esqueleto (responde `501`) |
| 3. Evaluación Docente | ⬜ Esqueleto (responde `501`); categorización del Acuerdo 058 implementada |

## Stack

| Capa | Tecnología |
|---|---|
| BD | PostgreSQL 16 (`database/init.sql`, `database/seed.sql`) |
| API | Node.js 20 + Express 4, JWT (8 h), bcryptjs (costo 10), exceljs, csv-parse |
| Web | React 18 + Vite 5, React Router 6, CSS propio responsive, Tailwind v4 (sin preflight) + Recharts para figuras |
| Infra | Docker Compose (`db`, `backend`, `frontend`) |

## Ejecución

Todo en contenedores:

```bash
docker compose up --build        # BD :5432 · API :5000 · Web :80
```

Desarrollo (BD en Docker; API y web locales con recarga automática):

```bash
docker compose up -d db
cd backend  && cp .env.example .env && npm install && npm run dev   # http://localhost:5000
cd frontend && npm install && npm run dev                           # http://localhost:5173
```

Usuario inicial (seed): `coordinacion.maie@udenar.edu.co` / `CambiarMaIE2026`. **Cambiar tras el primer ingreso.**

Carga inicial de datos: *Datos del programa › Importar Excel/CSV* con el libro «Estadísticas MaIE» tal como lo maneja Coordinación.

## Pruebas

```bash
cd backend
npm test                   # unitarias (sin BD): estadísticas, validación, API
npm run test:integracion   # contra PostgreSQL (docker compose up -d db); recrea la base maie_test
```

## Estructura

```
database/        init.sql (esquema) · seed.sql (RA, estrategias, módulos, parámetros, coordinador)
backend/src/
  app.js, server.js            # app Express / arranque
  config/                      # env, pool pg + withTransaction
  middlewares/                 # authenticate (JWT), authorize (RBAC), validate, upload, errorHandler (mapea errores de PostgreSQL)
  shared/crud/                 # repositorio, servicio y router CRUD genéricos + tipos de campo y validación
  modules/
    auth/ usuarios/
    admin/
      recursos/                # recursos.definicion.js: una definición por hoja del Excel (tabla, llave, campos, RBAC)
      importaciones/           # lector del libro «Estadísticas MaIE», lector de plantilla/CSV, importación transaccional
      plantillas/              # plantilla .xlsx y exportación de datos
      reportes/                # estadisticas.js (fórmulas puras) + /reportes/estadisticas, /presupuesto/resumen
      docentes/                # perfil propio del docente (/docentes/me/perfil)
    ra/ evalDocente/           # esqueleto de los módulos 2 y 3
frontend/src/
  api/ context/ hooks/ routes/ layouts/ pages/ utils/ styles/
  components/charts/           # ChartCard (con vista de tabla), GraficoBarras, GraficoLineas, StatTile, paleta validada
  features/admin/              # EstadisticasDashboard, DatosProgramaPage (RecursoTabla/RecursoFormulario),
                               # CsvUploaderModal, PresupuestoDashboard, UsuariosPage, PerfilDocentePage
```

Para agregar una hoja nueva al Módulo 1 basta con crear su tabla en `init.sql` y su definición en
`recursos.definicion.js`: la API, la validación, la plantilla, la importación y la tabla del frontend se generan de ella.

## API `/api/v1`

| Recurso | Rutas | Rol |
|---|---|---|
| Auth | `POST /auth/login`, `GET /auth/me`, `PUT /auth/password` | Público / Todos |
| Usuarios | CRUD `/usuarios` (vincula el perfil docente con `id_docente`) | Coord |
| Metadatos | `GET /admin/recursos` (hojas visibles para el rol) | Coord, Docente |
| Promociones | CRUD `/admin/cohortes` | Coord (Docente: lectura) |
| Cursos y docentes | CRUD `/admin/cohorte-semestres/:id_cohorte/:semestre` | Coord (Docente: lectura) |
| Docentes | CRUD `/admin/docentes`; `GET/PUT /admin/docentes/me/perfil` | Coord (Docente: lectura) / Docente propio |
| Beneficios, producción, pasantías | CRUD `/admin/beneficios`, `/admin/produccion`, `/admin/pasantias` (llave `id_cohorte`) | Coord (Docente: lectura) |
| Financiero | CRUD `/admin/punto-equilibrio`, `/admin/presupuesto`, `/admin/pregrado`, `/admin/transferencias`, `/admin/contrataciones` | Coord |
| Parámetros | CRUD `/admin/parametros` (SMMLV, % de distribución, créditos) | Coord |
| Importación | `POST /admin/importaciones` (multipart `archivo`; `?simular=true`; `?recurso=` para CSV) | Coord |
| Plantilla / exportación | `GET /admin/plantillas` (`?datos=true` incluye los datos actuales) | Coord |
| Estadísticas | `GET /admin/reportes/estadisticas`, `GET /admin/presupuesto/resumen` | Coord |
| RA | `GET /ra/resultados`, `/ra/estrategias`, `/ra/rubricas`; `/ra/evaluaciones`; `/ra/reportes` | Docente, Coord (pendiente) |
| Evaluación docente | `/eval-docente/periodos`, `/formularios/:tipo`, `/respuestas`, `/resultados` | según tipo (pendiente) |

Respuesta estándar: `{ "status": "success", "data": … }` o `{ "status": "error", "error": { "message", "details" } }`.
Errores de datos: `400` validación · `401` sin sesión · `403` rol · `404` no existe · `409` duplicado o registro relacionado.
