# Plataforma Informática MaIE

Plataforma web de la Maestría en Ingeniería Electrónica (Universidad de Nariño) con tres módulos:
**Procesos Administrativos**, **Resultados de Aprendizaje** y **Evaluación Docente (Acuerdo 058)**.
Requisitos: SRS IEEE 830 (Actividad 1). Diseño: Documento Técnico (Actividad 2).

## Estado

| Módulo | Estado |
|---|---|
| Autenticación, usuarios y RBAC | ✅ Implementado |
| 1. Procesos Administrativos (RF-ADM-01 a 06) | ✅ Implementado: panel general del coordinador, hojas separadas en *Información académica* y *Presupuesto y finanzas*, importación Excel/CSV, plantilla/exportación, detalle de producción científica |
| 1. Reporte oficial de presupuesto (PDF PSP-GEF-FR-04) | 🟡 Tablas creadas (`presupuesto_ingresos*`); lector de PDF pendiente |
| 2. Resultados de Aprendizaje (RF-RA-01 a 04) | ✅ Implementado: catálogo y ofertas de curso, matrícula, rúbricas RA1–RA7, calificación por criterio, reportes por nivel y exportación |
| 3. Evaluación Docente | ⬜ Esqueleto (responde `501`); categorización del Acuerdo 058 implementada |

## Stack

| Capa | Tecnología |
|---|---|
| BD | PostgreSQL 16 (`database/init.sql`, `database/seed.sql`) |
| API | Node.js 20 + Express 4, JWT (8 h), bcryptjs (costo 10), exceljs, csv-parse |
| Web | React 18 + Vite 5, React Router 6, CSS propio responsive, Tailwind v4 (sin preflight, tokens Material 3 del mockup) + Recharts; fuentes Inter / Plus Jakarta Sans e iconos Material Symbols |
| Docs API | OpenAPI 3 + Swagger UI (`swagger-ui-express`) |
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

> **Cambios de esquema:** no hay migraciones; `init.sql` y `seed.sql` solo corren al crear el volumen de la BD.
> Para conservar los datos de una base existente aplique los scripts de `database/migraciones/` (respalde antes con
> `pg_dump`), p. ej. `docker compose exec -T db psql -v ON_ERROR_STOP=1 -U maie_admin -d maie_db < database/migraciones/2026-09-30_modulo2_ra.sql`
> y luego `2026-09-30_clases.sql` (en orden de fecha).
> La alternativa es recrear la base (`docker compose down -v && docker compose up -d db`) y reimportar el libro del Módulo 1.

Datos sintéticos del Módulo 2 (promociones «Sintética I…V», docentes y estudiantes con correos `@sintetico.maie.local`,
ofertas y notas de rúbrica; misma semilla → mismos datos):

```bash
cd backend
npm run datos:sinteticos                  # borra los sintéticos anteriores y carga la semilla 2026
npm run datos:sinteticos -- --semilla 7   # otra semilla
npm run datos:sinteticos -- --limpiar     # solo borra los datos sintéticos (no toca los reales)
```

Los usuarios sintéticos usan la contraseña de `SINTETICO_PASSWORD` (por defecto `MaIE-Sintetico-2026`).

Carga inicial de datos: *Procesos administrativos › Información académica › Importar Excel/CSV* con el libro «Estadísticas MaIE»
tal como lo maneja Coordinación. Las hojas financieras se consultan y editan en *Presupuesto y finanzas*.

> **Bases existentes:** la columna `cohorte_produccion.detalles` es nueva. Si la base se creó antes, aplique
> `ALTER TABLE cohorte_produccion ADD COLUMN IF NOT EXISTS detalles TEXT;` o recree el volumen de `db`.

## Pruebas

```bash
cd backend
npm test                   # unitarias (sin BD): estadísticas, rúbricas RA, generador sintético, API, OpenAPI
npm run test:integracion   # contra PostgreSQL (docker compose up -d db); recrea maie_test (Módulo 1)
                           # y maie_test_ra (Módulo 2, poblada con datos sintéticos y verificada contra un cálculo independiente)
```

## Estructura

```
database/        init.sql (esquema) · seed.sql (RA, estrategias, catálogo de cursos, rúbricas RA1–RA7, parámetros, coordinador)
backend/src/
  app.js, server.js            # app Express / arranque (Swagger UI en /api/docs)
  docs/openapi.js              # especificación OpenAPI 3 (rutas del Módulo 1 generadas desde recursos.definicion.js)
  config/                      # env, pool pg + withTransaction
  middlewares/                 # authenticate (JWT), authorize (RBAC), validate, upload, errorHandler (mapea errores de PostgreSQL)
  shared/crud/                 # repositorio, servicio y router CRUD genéricos + tipos de campo y validación
  modules/
    auth/ usuarios/
    admin/
      recursos/                # recursos.definicion.js: una definición por hoja del Excel (tabla, llave, campos, RBAC, categoría)
      importaciones/           # lector del libro «Estadísticas MaIE», lector de plantilla/CSV, importación transaccional
      plantillas/              # plantilla .xlsx y exportación de datos
      reportes/                # estadisticas.js (fórmulas puras) + /reportes/estadisticas, /presupuesto/resumen
      docentes/                # perfil propio del docente (/docentes/me/perfil)
      cursos/ matriculas/      # catálogo del plan, ofertas por promoción, docentes y matrícula
    ra/
      rubrica.js               # reglas puras: niveles, total ponderado, distribución, validación
      propiedad.js             # regla «sus cursos» del docente
      resultados/ estrategias/ rubricas/ evaluaciones/ reportes/
    evalDocente/               # esqueleto del módulo 3
backend/scripts/
  sintetico/                   # generador con semilla y cargador de datos sintéticos
  poblarSintetico.js           # npm run datos:sinteticos
frontend/src/
  api/ context/ hooks/ routes/ layouts/ pages/ utils/ styles/
  styles/index.css             # punto de entrada único: CSS propio en la capa base + tokens de Tailwind (tailwind.css)
  components/common/Icono.jsx  # glifo de Material Symbols
  components/charts/           # ChartCard (con vista de tabla), GraficoBarras, GraficoLineas, StatTile, paleta validada
  features/admin/              # EstadisticasDashboard (panel general), DatosProgramaPage (hojas académicas),
                               # PresupuestoDashboard (resumen + hojas financieras), RecursoTabla/RecursoFormulario,
                               # CsvUploaderModal, UsuariosPage, PerfilDocentePage
  features/ra/                 # ConsolidadoRAPage, MatrizRubricasPage, OfertasCursoPage, MisCursosPage,
                               # PlanillaRubricaPage (+ planilla/: evaluación por estudiante y resumen general)
  features/admin/panel/        # BannerPrograma, FranjaAviso, TarjetaKpi, TarjetaLateral, LineasInvestigacion
```

Para agregar una hoja nueva al Módulo 1 basta con crear su tabla en `init.sql` y su definición en
`recursos.definicion.js`: la API, la validación, la plantilla, la importación, la documentación OpenAPI y la tabla del
frontend se generan de ella. Su `categoria` (`academico` o `financiero`) decide en qué pantalla aparece.

## API `/api/v1`

Documentación interactiva (Swagger UI): **http://localhost:5000/api/docs** — especificación OpenAPI 3 en
`/api/docs/openapi.json`. Obtenga un token con `POST /auth/login`, pulse **Authorize** y pruebe cada ruta.
Las rutas de las hojas del Módulo 1 se generan desde `recursos.definicion.js` (`src/docs/openapi.js`).

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
| Clases | CRUD `/admin/clases` (código generado, nombre único, un curso del plan) | Coord (Docente: lectura) |
| Catálogo y ofertas | `GET /admin/cursos/catalogo`; CRUD `/admin/cursos` (clase + semestre + promoción; `?clase&docente&periodo`); `PUT /admin/cursos/:id/docentes`, `/:id/estudiantes`; `POST /:id/estudiantes/cohorte` | Coord (Docente: sus ofertas) |
| Estudiantes por promoción | `GET/PUT /admin/cohortes/:id/estudiantes` | Coord |
| RA y rúbricas | `GET /ra/resultados`, `/ra/estrategias`, `/ra/rubricas`; `PUT /ra/rubricas/:idRa` (pesos = 100 %) | Coord, Docente (edición: Coord) |
| Apertura por semestre | `GET /ra/periodos`; `PUT /ra/periodos/:periodo { abierto }` (un semestre sin estado está cerrado) | Coord (Docente: lectura) |
| Calificación | `GET /ra/evaluaciones?curso=`; `POST /ra/evaluaciones` (lote; `null` borra; 409 con el semestre cerrado) | Docente del curso (Coord: lectura) |
| Reportes RA | `GET /ra/reportes?agrupar=&cohorte&periodo&modulo&catalogo&curso&clase&docente&ra&estudiante`, `/ra/reportes/exportar` | Coord |
| Evaluación docente | `/eval-docente/periodos`, `/formularios/:tipo`, `/respuestas`, `/resultados` | según tipo (pendiente) |

Respuesta estándar: `{ "status": "success", "data": … }` o `{ "status": "error", "error": { "message", "details" } }`.
Errores de datos: `400` validación · `401` sin sesión · `403` rol · `404` no existe · `409` duplicado o registro relacionado.
