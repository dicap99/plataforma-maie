# Plataforma Informática MaIE

Plataforma web de la Maestría en Ingeniería Electrónica (Universidad de Nariño) con tres módulos:
**Procesos Administrativos**, **Resultados de Aprendizaje** y **Evaluación Docente (Acuerdo 058 de 2022)**.
Requisitos: SRS IEEE 830 (Actividad 1). Diseño: Documento Técnico (Actividad 2).

## Estado

Los tres módulos están implementados. Para instalarla en un servidor institucional falta el endurecimiento de
despliegue (ver «Despliegue en producción»).

| Módulo | Estado |
|---|---|
| Autenticación, usuarios y RBAC | ✅ Coordinación, docente y estudiante (posgrado o pregrado); «Mi cuenta» para cambiar la contraseña |
| 1. Procesos Administrativos (RF-ADM-01 a 06) | ✅ Panel general con alertas; *Información académica* y *Presupuesto y finanzas* (gráficas y datos de consulta); *Gestión académica* como único lugar de edición: usuarios, materias, oferta por semestre y hojas del libro «Estadísticas MaIE»; importación del libro, plantilla, CSV y PDF de gastos (PSP-GEF-FR-03) |
| 2. Resultados de Aprendizaje (RF-RA-01 a 04) | ✅ Rúbricas RA1–RA7, apertura de la calificación por semestre, planilla del docente (nota por criterio, nivel y total ponderado), consolidado con filtros combinables, análisis del programa y exportación a Excel |
| 3. Evaluación Docente (RF-EVAL-01 a 05) | ✅ Formularios EE, EC y AE editables (Art. 8), quién evalúa a quién, habilitación por semestre (posgrado y pregrado), EE anónimo, %IP/%IN y categorías del Acuerdo (con el método del Excel de Coordinación como referencia), IDST-D, IDSC e IDST-P, resultados por docente, promoción y programa, Excel e informes PDF, consulta del docente tras la publicación |

## Stack

| Capa | Tecnología |
|---|---|
| BD | PostgreSQL 16 (`database/init.sql`, `database/seed.sql`, `database/migraciones/`) |
| API | Node.js 20 + Express 4, JWT (8 h), bcryptjs (costo 10), exceljs, csv-parse, pdfjs-dist (lectura de PDF), pdfkit (informes) |
| Web | React 18 + Vite 5, React Router 6, Tailwind v4 (sin preflight, tokens Material 3 del mockup) y CSS propio, Recharts; fuentes Inter / Plus Jakarta Sans e iconos Material Symbols |
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

Variables de entorno de la API (`backend/.env`): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `PORT` y
`EVAL_SECRETO` (clave de las huellas anónimas de la evaluación docente; fijarla una vez por instalación y no cambiarla
con un semestre de evaluación abierto).

### Bases existentes: migraciones

`init.sql` y `seed.sql` solo corren al crear el volumen de la BD. Para conservar los datos de una base existente, respalde
con `pg_dump` y aplique los scripts de `database/migraciones/` en orden de fecha, por ejemplo:

```bash
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U maie_admin -d maie_db < database/migraciones/2026-11-24_producto_estudiantes.sql
```

Excepción al orden alfabético: `2026-09-30_modulo2_ra.sql` va **antes** que `2026-09-30_clases.sql`. La alternativa es
recrear la base (`docker compose down -v && docker compose up -d db`) y volver a importar el libro «Estadísticas MaIE».

### Datos sintéticos

Promociones «Sintética I…V» con estudiantes, docentes, ofertas, notas de rúbrica, hojas del Módulo 1 y evaluaciones del
Módulo 3 (correos `@sintetico.maie.local`; misma semilla → mismos datos):

```bash
cd backend
npm run datos:sinteticos                  # borra los sintéticos anteriores y carga la semilla 2026
npm run datos:sinteticos -- --semilla 7   # otra semilla
npm run datos:sinteticos -- --limpiar     # solo borra los datos sintéticos (no toca los reales)
```

Los usuarios sintéticos usan la contraseña de `SINTETICO_PASSWORD` (por defecto `MaIE-Sintetico-2026`).

## Uso

**Gestión académica** (*Procesos administrativos*) es el único lugar donde se edita:

| Pestaña | Contenido |
|---|---|
| Usuarios | Información básica de cada cuenta, por rol: estudiantes de posgrado por promoción (con renglones «por registrar» hasta completar los matriculados que reporta el libro), estudiantes de pregrado (lista por semestre y materia con su plantilla de carga), docentes (externos y UDENAR) y Coordinación. La **ficha** de cada usuario es de consulta: materias por semestre (con las electivas), beneficios, producción académica; perfil y materias dictadas del docente |
| Materias | Materias del plan con código único, ligadas a un curso del plan y a los RA que evalúa |
| Asignación por semestre | Oferta de cada materia a una promoción en un semestre académico, con sus docentes y la matrícula |
| Datos del programa | Hojas del libro: **Académicas** (parámetros del programa, promociones, docentes, beneficios por estudiante y semestre, investigación y movilidad: artículos, ponencias, software, prototipos, tesis y pasantías) y **Financieras** (presupuesto, punto de equilibrio, pregrado, transferencias, contrataciones OPS con el detalle de cada contrato). Exportar a Excel e importar Excel/CSV/PDF |

*Información académica* y *Presupuesto y finanzas* son de consulta: abren en «Gráficas»; la vista «Datos» es de solo
lectura y su botón «Editar» lleva a la hoja correspondiente de Gestión académica. Las hojas que se calculan (cursos y
docentes por semestre, totales de beneficios, de producción y de contrataciones) se derivan de los registros detallados;
las promociones o periodos sin registros conservan el histórico del libro.

Carga inicial: *Gestión académica › Datos del programa › Importar Excel/CSV* con el libro «Estadísticas MaIE» tal como lo
maneja Coordinación. La plantilla oficial añade hojas que no están en el libro: «Asignación docente», «Beneficios por
estudiante», «Productos de investigación» y «Contratos OPS». El informe PDF de gastos de la Oficina de Presupuesto
(PSP-GEF-FR-03) se carga por la misma importación.

**Resultados de aprendizaje**: Coordinación abre la calificación del semestre (*Apertura de calificación*); cada docente
califica en *Mis cursos* con la rúbrica de cada RA; Coordinación consulta el *Consolidado académico*, el *Análisis del
programa* y la *Matriz de rúbricas*.

**Evaluación docente**: Coordinación edita las preguntas (*Formularios*: un solo formulario por tipo para todos los
semestres; una pregunta con respuestas no cambia de redacción, se desactiva y se agrega otra), habilita el semestre
(*Habilitación y seguimiento*: cronograma, inclusión del pregrado, exclusión de respuestas extremas), diligencia su EC,
cierra y publica. Los estudiantes diligencian el EE (anónimo) y los docentes su AE; cada docente consulta sus resultados
cuando el semestre se publica.

## Pruebas

```bash
cd backend
npm test                   # unitarias (sin BD): estadísticas, rúbricas RA, Acuerdo 058, categorización, anonimato, API, OpenAPI
npm run test:integracion   # contra PostgreSQL (docker compose up -d db); recrea maie_test (Módulo 1),
                           # maie_test_ra (Módulo 2) y maie_test_ed (Módulo 3), pobladas con datos sintéticos
```

Las pruebas que contrastan las fórmulas con los valores del libro «Estadísticas Evaluación Docente MaIE» leen
`backend/tests/fixtures/evaluacionDocenteExcel.json`, que contiene resultados reales y **no se versiona** (el repositorio
es público). Si falta, esas pruebas se omiten con un aviso.

## Estructura

```
database/        init.sql (esquema) · seed.sql (RA, estrategias, catálogo, rúbricas RA1–RA7, preguntas del Acuerdo 058,
                 parámetros, coordinador) · migraciones/ (cambios para bases existentes)
backend/src/
  app.js, server.js            # app Express / arranque (Swagger UI en /api/docs)
  docs/                        # especificación OpenAPI 3 (openapi.js, openapi.ra.js, openapi.evalDocente.js)
  config/                      # env, pool pg + withTransaction
  middlewares/                 # authenticate (JWT), authorize (RBAC), validate, upload, errorHandler
  shared/crud/                 # repositorio, servicio y router CRUD genéricos + tipos de campo y validación
  modules/
    auth/
    usuarios/                  # CRUD de cuentas, beneficios por semestre y ficha de detalle por rol
    admin/
      recursos/                # recursos.definicion.js: una definición por hoja del libro (tabla, llave, campos, RBAC, categoría)
      importaciones/           # lectores del libro, de la plantilla/CSV y del PDF de gastos; importación transaccional
      plantillas/              # plantilla .xlsx y exportación de datos
      reportes/                # estadisticas.js y alertas.js (funciones puras), reflejo.js (hojas calculadas)
      productos/               # estudiantes que participaron en cada producto de investigación
      docentes/ clases/ cursos/ matriculas/
    ra/
      rubrica.js               # reglas puras: niveles, total ponderado, distribución, validación
      propiedad.js             # regla «sus cursos» del docente
      resultados/ estrategias/ rubricas/ evaluaciones/ periodos/ reportes/ (+ analisis.js)
    evalDocente/
      acuerdo058.js            # fórmulas puras: %IP/%IN, categorías, IDST-D, IDSC, IDST-P, método del Excel (referencia)
      categorizacion.js        # quién evalúa a quién y con qué formulario (funciones puras)
      anonimato.js             # huella HMAC de las constancias del EE
      periodos/ pregrado/ preguntas/ respuestas/ resultados/ (consolidado.js, informes.js)
backend/scripts/
  sintetico/                   # generador con semilla y cargador de datos sintéticos
  poblarSintetico.js           # npm run datos:sinteticos
frontend/src/
  api/ context/ hooks/ routes/ layouts/ pages/ utils/ styles/ config/
  components/charts/           # ChartCard (con vista de tabla), GraficoBarras, GraficoLineas, leyenda interactiva, paleta
  features/admin/              # EstadisticasDashboard, DatosProgramaPage (Información académica), PresupuestoDashboard,
                               # GestionAcademicaPage, UsuariosPage + FichaUsuario, DatosDelPrograma, RecursoTabla,
                               # InvestigacionMovilidadPanel, ContratacionesOpsPanel, beneficios/, academico/, finanzas/
  features/ra/                 # ConsolidadoRAPage, AnalisisRAPage, MatrizRubricasPage, AperturaCalificacionPage,
                               # MisCursosPage, PlanillaRubricaPage (+ planilla/)
  features/evalDocente/        # HabilitacionEvaluacionPage, FormulariosEvaluacionPage, MisEvaluacionesPage (EE, EC, AE),
                               # ResultadosEvaluacionPage, MisResultadosEvaluacionPage, PregradoEvaluacionPage
```

Para agregar una hoja nueva al Módulo 1 basta con crear su tabla en `init.sql` (y su migración) y su definición en
`recursos.definicion.js`: la API, la validación, la plantilla, la importación, la documentación OpenAPI y la tabla del
frontend se generan de ella.

## API `/api/v1`

Documentación interactiva (Swagger UI): **http://localhost:5000/api/docs** — especificación OpenAPI 3 en
`/api/docs/openapi.json`. Obtenga un token con `POST /auth/login`, pulse **Authorize** y pruebe cada ruta.

| Recurso | Rutas | Rol |
|---|---|---|
| Auth | `POST /auth/login`, `GET /auth/me`, `PUT /auth/password` | Público / Todos |
| Usuarios | CRUD `/usuarios`; `GET /usuarios/campos-formacion`; `GET /usuarios/beneficios?id_cohorte=`, `PUT /usuarios/{id}/beneficios`; `GET /usuarios/{id}/ficha` | Coord |
| Hojas del libro | CRUD `/admin/{hoja}`: `cohortes`, `cohorte-semestres`, `docentes`, `beneficios`, `produccion`, `productos`, `pasantias`, `punto-equilibrio`, `presupuesto`, `pregrado`, `transferencias`, `contrataciones`, `contratos-ops`, `parametros`; `GET /admin/recursos` | Coord (Docente: lectura de las académicas) |
| Hojas calculadas | `GET /admin/academico/reflejo`, `GET /admin/finanzas/reflejo` | Coord (Docente: académicas) |
| Producción por estudiante | `GET/PUT /admin/productos/{id}/estudiantes` | Coord |
| Importación y plantilla | `POST /admin/importaciones` (`?simular=true`, `?recurso=` para CSV); `GET /admin/plantillas` (`?datos=true`) | Coord |
| Estadísticas | `GET /admin/reportes/estadisticas` (con `alertas`), `GET /admin/presupuesto/resumen` | Coord |
| Materias y ofertas | CRUD `/admin/clases`; `GET /admin/cursos/catalogo`; CRUD `/admin/cursos`; `PUT /admin/cursos/{id}/docentes`, `/{id}/estudiantes`; `POST /admin/cursos/{id}/estudiantes/cohorte`; `GET/PUT /admin/cohortes/{id}/estudiantes` | Coord (Docente: sus ofertas) |
| Perfil docente | `GET /admin/docentes/me/perfil`; `GET /admin/docentes/{id}/perfil`, `POST/DELETE /admin/docentes/{id}/cursos` | Docente (propio) / Coord |
| RA y rúbricas | `GET /ra/resultados`, `/ra/estrategias`, `/ra/rubricas`; `PUT /ra/rubricas/{idRa}` | Coord, Docente (edición: Coord) |
| Apertura RA | `GET /ra/periodos`; `PUT /ra/periodos/{periodo}` | Coord (Docente: lectura) |
| Calificación RA | `GET /ra/evaluaciones?curso=`; `POST /ra/evaluaciones` (lote; 409 con el semestre cerrado) | Docente del curso (Coord: lectura) |
| Reportes RA | `GET /ra/reportes`, `/ra/reportes/analisis`, `/ra/reportes/exportar` (filtros combinables) | Coord |
| Evaluación: habilitación | `GET /eval-docente/periodos`, `GET/PUT /eval-docente/periodos/{periodo}`, `POST /eval-docente/periodos/{periodo}/publicacion` | Coord |
| Evaluación: formularios | `GET /eval-docente/formularios/{tipo}`; `GET/POST /eval-docente/formularios/{tipo}/preguntas`, `PUT/DELETE /eval-docente/formularios/preguntas/{id}` | Todos (edición: Coord) |
| Evaluación: respuestas | `GET /eval-docente/categorizacion`, `/eval-docente/pendientes`; `POST /eval-docente/respuestas`; `GET /eval-docente/respuestas/propia` (EC y AE) | Según formulario |
| Evaluación: pregrado | `GET /eval-docente/pregrado`, `/pregrado/plantilla`; `POST /pregrado/importar` (`?simular`); `PUT/DELETE /pregrado/{idCurso}/{idEstudiante}` | Coord |
| Evaluación: resultados | `GET /eval-docente/resultados` (`?periodo&poblacion`), `/exportar`, `/informe.pdf`, `/docentes/{id}` (+ `/informe.pdf`); `GET /eval-docente/resultados/me` (+ `/informe.pdf`) | Coord / Docente (propios, publicados) |

Respuesta estándar: `{ "status": "success", "data": … }` o `{ "status": "error", "error": { "message", "details" } }`.
Errores de datos: `400` validación · `401` sin sesión · `403` rol · `404` no existe · `409` duplicado o registro relacionado.

## Despliegue en producción

El `docker-compose.yml` es de desarrollo. Antes de instalar la plataforma en el servidor institucional:

- Definir `JWT_SECRET` y `EVAL_SECRETO` propios (no usar los valores por defecto) y cambiar la contraseña de PostgreSQL.
- No publicar el puerto 5432 de la base de datos.
- Usar una composición de producción (compilación estática de la web detrás de nginx, `NODE_ENV=production`, sin nodemon)
  con HTTPS, y fijar `VITE_API_URL` y `CORS_ORIGIN` a la dirección del servidor.
- Cambiar la contraseña inicial de Coordinación en el primer ingreso.
