-- =====================================================================
-- PLATAFORMA MaIE — ESQUEMA DE BASE DE DATOS (PostgreSQL 16)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- crypt()/gen_salt('bf') para el usuario semilla

CREATE TYPE tipo_rol AS ENUM ('coordinador', 'docente', 'estudiante');
CREATE TYPE tipo_formulario_eval AS ENUM ('EE', 'EC', 'AE'); -- Estudiante, Coordinador, Autoevaluación
CREATE TYPE tipo_nivel_logro AS ENUM ('Alto', 'Medio', 'Basico', 'Insuficiente');
CREATE TYPE tipo_afiliacion AS ENUM ('UDENAR', 'EXTERNO');

-- Periodo académico con formato '2024-A' / '2024-B'
CREATE DOMAIN periodo_academico AS VARCHAR(6) CHECK (VALUE ~ '^[0-9]{4}-[AB]$');

-- TABLA: USUARIOS (Control RBAC)
CREATE TABLE usuarios (
    id_usuario UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identificacion VARCHAR(20) UNIQUE NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    telefono VARCHAR(30), -- contacto; lo registra Coordinación
    password_hash VARCHAR(255) NOT NULL,
    rol tipo_rol NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE, -- credenciales temporales por cambiar
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- MÓDULO 1: PROCESOS ADMINISTRATIVOS
-- Modelo agregado por promoción / periodo (fuente: "Estadísticas MaIE" y reportes de la Oficina de Presupuesto)
-- =====================================================================

-- Parámetros del programa (SMMLV, porcentajes de distribución, créditos por semestre…)
CREATE TABLE parametros_programa (
    clave VARCHAR(60) PRIMARY KEY,
    valor NUMERIC(16,4) NOT NULL,
    descripcion TEXT
);

-- Promociones / cohortes (RF-ADM-01) — hoja "Promociones y Estudiantes"
-- Los aprobados de un semestre aún no cursado quedan en NULL.
CREATE TABLE cohortes (
    id_cohorte SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL, -- 'I', 'II', 'III'…
    periodo_inicio periodo_academico NOT NULL,
    periodo_fin periodo_academico NOT NULL,
    anio_inicio INT GENERATED ALWAYS AS (CAST(SUBSTRING(periodo_inicio FROM 1 FOR 4) AS INT)) STORED,
    anio_fin INT GENERATED ALWAYS AS (CAST(SUBSTRING(periodo_fin FROM 1 FOR 4) AS INT)) STORED,
    inscritos INT NOT NULL DEFAULT 0 CHECK (inscritos >= 0),
    matriculados INT NOT NULL DEFAULT 0 CHECK (matriculados >= 0),
    aprobados_sem1 INT CHECK (aprobados_sem1 >= 0),
    aprobados_sem2 INT CHECK (aprobados_sem2 >= 0),
    aprobados_sem3 INT CHECK (aprobados_sem3 >= 0),
    egresados INT CHECK (egresados >= 0), -- aprobaron el IV semestre
    graduados INT NOT NULL DEFAULT 0 CHECK (graduados >= 0),
    CONSTRAINT chk_periodos_cohorte CHECK (periodo_fin >= periodo_inicio)
);

-- Punto de equilibrio financiero por promoción
CREATE TABLE cohorte_punto_equilibrio (
    id_cohorte INT PRIMARY KEY REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    estudiantes_equilibrio INT NOT NULL CHECK (estudiantes_equilibrio >= 0),
    valor_matricula_smmlv NUMERIC(6,2) NOT NULL CHECK (valor_matricula_smmlv >= 0),
    ingresos_proyectados NUMERIC(16,2) NOT NULL CHECK (ingresos_proyectados >= 0)
);

-- Cursos y docentes invitados por semestre de cada promoción — hoja "Cursos y Docentes"
CREATE TABLE cohorte_semestres (
    id_cohorte INT REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    semestre SMALLINT CHECK (semestre BETWEEN 1 AND 4),
    n_cursos INT NOT NULL DEFAULT 0 CHECK (n_cursos >= 0),
    docentes_udenar INT NOT NULL DEFAULT 0 CHECK (docentes_udenar >= 0),
    docentes_externos INT NOT NULL DEFAULT 0 CHECK (docentes_externos >= 0),
    PRIMARY KEY (id_cohorte, semestre)
);

-- Consolidado presupuestal por promoción a una fecha de corte (RF-ADM-03) — hoja "Presupuesto"
-- La distribución del saldo (Central/VIIS/Fondo/Unidad) se calcula con parametros_programa si no se registra.
CREATE TABLE presupuesto_cohorte (
    id_presupuesto SERIAL PRIMARY KEY,
    id_cohorte INT NOT NULL REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    fecha_corte DATE NOT NULL,
    ingresos NUMERIC(16,2) NOT NULL DEFAULT 0,
    gastos_comprometidos NUMERIC(16,2) NOT NULL DEFAULT 0,
    saldo_comprometido NUMERIC(16,2) GENERATED ALWAYS AS (ingresos - gastos_comprometidos) STORED,
    saldo_certificado NUMERIC(16,2),
    transferencia_central NUMERIC(16,2),
    transferencia_viis NUMERIC(16,2),
    fondo_investigaciones NUMERIC(16,2),
    unidad_academica NUMERIC(16,2),
    observaciones TEXT,
    CONSTRAINT unq_presupuesto_cohorte_corte UNIQUE (id_cohorte, fecha_corte)
);

-- Reporte oficial "Presupuesto de Ingresos - Recursos Administrados" (PSP-GEF-FR-04), mensual por promoción
CREATE TABLE presupuesto_ingresos (
    id_reporte SERIAL PRIMARY KEY,
    id_cohorte INT NOT NULL REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    anio INT NOT NULL,
    mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    fecha_impresion TIMESTAMP,
    archivo_origen VARCHAR(255),
    CONSTRAINT unq_presupuesto_ingresos_mes UNIQUE (id_cohorte, anio, mes)
);

CREATE TABLE presupuesto_ingresos_rubros (
    id_reporte INT REFERENCES presupuesto_ingresos(id_reporte) ON DELETE CASCADE,
    codigo VARCHAR(50) NOT NULL,
    detalle VARCHAR(255) NOT NULL,
    tipo CHAR(1) NOT NULL CHECK (tipo IN ('G', 'D')), -- G: agrupador, D: detalle
    inicial NUMERIC(16,2) NOT NULL DEFAULT 0,
    anterior NUMERIC(16,2) NOT NULL DEFAULT 0,
    modificacion_mes NUMERIC(16,2) NOT NULL DEFAULT 0,
    definitiva NUMERIC(16,2) NOT NULL DEFAULT 0,
    recaudo_mes NUMERIC(16,2) NOT NULL DEFAULT 0,
    recaudo_acumulado NUMERIC(16,2) NOT NULL DEFAULT 0,
    saldo_por_recaudar NUMERIC(16,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (id_reporte, codigo)
);

-- Transferencias de la Vicerrectoría Académica por periodo — hoja "Transferencias ViceAcad"
CREATE TABLE transferencias_periodo (
    periodo periodo_academico PRIMARY KEY,
    promociones VARCHAR(60), -- promociones cubiertas, p. ej. 'I, II, III, IV, V'
    n_docentes INT NOT NULL DEFAULT 0 CHECK (n_docentes >= 0),
    valor NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (valor >= 0)
);

-- Contrataciones por OPS por periodo — hoja "Contrataciones"
CREATE TABLE contrataciones_periodo (
    periodo periodo_academico PRIMARY KEY,
    promociones VARCHAR(60),
    n_ops INT NOT NULL DEFAULT 0 CHECK (n_ops >= 0),
    valor NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (valor >= 0)
);

-- Contratos OPS con nombres — hoja "Contratos OPS". Los periodos con contratos registrados calculan
-- contrataciones_periodo (reflejo.js); los demás conservan el histórico.
CREATE TABLE contratos_ops (
    id_contrato SERIAL PRIMARY KEY,
    periodo periodo_academico NOT NULL,
    id_cohorte INT REFERENCES cohortes(id_cohorte) ON DELETE SET NULL, -- opcional: puede servir a varias
    contratista VARCHAR(200) NOT NULL,
    objeto TEXT NOT NULL,                                               -- curso o actividad contratada
    numero_contrato VARCHAR(50),
    fecha_inicio DATE,
    fecha_fin DATE,
    valor NUMERIC(16,2) NOT NULL CHECK (valor >= 0),
    CONSTRAINT unq_contrato_ops UNIQUE (periodo, contratista, objeto),
    CONSTRAINT chk_fechas_contrato_ops CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

-- Estudiantes de pregrado en cursos de la maestría — hoja "Estudiantes Pregrado"
CREATE TABLE pregrado_periodo (
    id_cohorte INT REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    periodo periodo_academico,
    estudiantes INT NOT NULL DEFAULT 0 CHECK (estudiantes >= 0),
    inscripciones INT NOT NULL DEFAULT 0 CHECK (inscripciones >= 0),
    ingreso NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (ingreso >= 0),
    PRIMARY KEY (id_cohorte, periodo)
);

-- Beneficios otorgados por promoción — hoja "Beneficios"
CREATE TABLE cohorte_beneficios (
    id_cohorte INT PRIMARY KEY REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    becas_100 INT NOT NULL DEFAULT 0 CHECK (becas_100 >= 0),
    becas_hora_catedra INT NOT NULL DEFAULT 0 CHECK (becas_hora_catedra >= 0),
    becas_sintraunicol INT NOT NULL DEFAULT 0 CHECK (becas_sintraunicol >= 0),
    asistentes_investigacion INT NOT NULL DEFAULT 0 CHECK (asistentes_investigacion >= 0),
    ayudantes_docencia INT NOT NULL DEFAULT 0 CHECK (ayudantes_docencia >= 0)
);

-- Producción científica por promoción (RF-ADM-04) — hoja "Producción Científica"
CREATE TABLE cohorte_produccion (
    id_cohorte INT PRIMARY KEY REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    articulos INT NOT NULL DEFAULT 0 CHECK (articulos >= 0),
    ponencias INT NOT NULL DEFAULT 0 CHECK (ponencias >= 0),
    software INT NOT NULL DEFAULT 0 CHECK (software >= 0),
    prototipos INT NOT NULL DEFAULT 0 CHECK (prototipos >= 0),
    tesis INT NOT NULL DEFAULT 0 CHECK (tesis >= 0),
    detalles TEXT
);

-- Producción científica por producto (RF-ADM-04) — hoja "Productos de investigación". Las promociones con
-- productos registrados calculan de aquí los conteos de cohorte_produccion (que queda como histórico).
CREATE TABLE productos_investigacion (
    id_producto SERIAL PRIMARY KEY,
    id_cohorte INT NOT NULL REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Artículo', 'Ponencia', 'Software', 'Prototipo', 'Tesis')),
    cita TEXT NOT NULL,
    anio SMALLINT CHECK (anio BETWEEN 1990 AND 2100),
    estudiantes TEXT,          -- participantes (texto: también de promociones sin cuentas en la plataforma)
    enlace VARCHAR(255),
    CONSTRAINT unq_producto UNIQUE (id_cohorte, tipo, cita)
);

-- Estudiantes registrados que participaron en cada producto (ficha del estudiante en Gestión académica ›
-- Usuarios). El texto `estudiantes` se conserva para los productos de promociones sin cuentas.
CREATE TABLE producto_estudiantes (
    id_producto INT NOT NULL REFERENCES productos_investigacion(id_producto) ON DELETE CASCADE,
    id_estudiante UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    PRIMARY KEY (id_producto, id_estudiante)
);
CREATE INDEX idx_producto_estudiantes_estudiante ON producto_estudiantes (id_estudiante);

-- Pasantías / estancias por promoción (RF-ADM-04) — hoja "Pasantías"
CREATE TABLE cohorte_pasantias (
    id_cohorte INT PRIMARY KEY REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    nacionales INT NOT NULL DEFAULT 0 CHECK (nacionales >= 0),
    internacionales INT NOT NULL DEFAULT 0 CHECK (internacionales >= 0)
);

-- Perfil histórico del docente (RF-ADM-06) — hoja "Docentes UDENAR-EXTERNOS"
-- La cuenta de usuario es opcional: un docente externo puede existir sin acceso al sistema.
CREATE TABLE docentes_perfil (
    id_docente UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_usuario UUID UNIQUE REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    nombre_completo VARCHAR(200) UNIQUE NOT NULL,
    formacion_profesional TEXT,
    campo_formacion VARCHAR(200),
    afiliacion tipo_afiliacion NOT NULL,
    departamento VARCHAR(150), -- departamento o unidad académica
    universidad VARCHAR(150),  -- institución de afiliación (externos)
    componentes TEXT,          -- obsoleto: los componentes salen de los cursos asignados (curso_docentes)
    cursos_participa TEXT,     -- obsoleto: texto histórico del libro; los cursos salen de curso_docentes
    enlace_perfil VARCHAR(255),
    titulacion_maxima VARCHAR(100), -- obsoleto: la titulación va en formacion_profesional (decisión del 2026-11-09)
    linea_investigacion VARCHAR(150),
    vinculacion_tipo VARCHAR(50),
    grupo_investigacion VARCHAR(150)
);

CREATE TABLE docentes_formacion (
    id_formacion SERIAL PRIMARY KEY,
    id_docente UUID REFERENCES docentes_perfil(id_docente) ON DELETE CASCADE,
    nivel VARCHAR(50) NOT NULL, -- Pregrado, Especialización, Maestría, Doctorado, Posdoctorado
    titulo VARCHAR(200) NOT NULL,
    institucion VARCHAR(200) NOT NULL,
    anio_grado INT
);

-- Componentes de formación / módulos curriculares (RF-RA-04 "por módulo curricular")
CREATE TABLE modulos_curriculares (
    id_modulo SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL, -- Básico, Profundización, Electivo, Investigativo
    descripcion TEXT
);

-- Catálogo de cursos del plan de estudios (Tablas 3 y 4 del documento RA MaIE / PEP)
CREATE TABLE cursos_catalogo (
    id_catalogo SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL, -- 'MaIE-CB1' … 'MaIE-Tesis-II'
    nombre VARCHAR(150) NOT NULL,
    id_modulo INT NOT NULL REFERENCES modulos_curriculares(id_modulo),
    semestre SMALLINT NOT NULL CHECK (semestre BETWEEN 1 AND 4),
    orden SMALLINT UNIQUE NOT NULL
);

-- Clases: asignatura concreta con identificador único (p. ej. «Robótica»), ligada al único curso del
-- plan que cubre (y por él a los RA que evalúa). El código lo genera la plataforma (CE2-01, CB1-01…).
CREATE TABLE clases (
    id_clase SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    id_catalogo INT NOT NULL REFERENCES cursos_catalogo(id_catalogo),
    descripcion TEXT,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT unq_clase_catalogo UNIQUE (id_clase, id_catalogo)
);
CREATE UNIQUE INDEX unq_clase_nombre ON clases (LOWER(nombre));

-- Oferta: una clase dictada a una promoción en un semestre académico, con sus docentes (que cambian
-- por periodo). id_catalogo se guarda por comodidad y la FK compuesta lo mantiene igual al de la clase.
CREATE TABLE cursos (
    id_curso SERIAL PRIMARY KEY,
    id_clase INT NOT NULL,
    id_catalogo INT NOT NULL,
    id_cohorte INT NOT NULL REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    periodo periodo_academico NOT NULL,
    grupo SMALLINT NOT NULL DEFAULT 1 CHECK (grupo > 0),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_clase, id_catalogo) REFERENCES clases(id_clase, id_catalogo) ON UPDATE CASCADE,
    CONSTRAINT unq_oferta UNIQUE (id_clase, id_cohorte, periodo, grupo)
);

-- Una oferta puede tener varios docentes (p. ej. cursos compartidos con invitados externos).
-- Referencia el perfil docente, que puede existir sin cuenta; el acceso se resuelve con docentes_perfil.id_usuario.
CREATE TABLE curso_docentes (
    id_curso INT REFERENCES cursos(id_curso) ON DELETE CASCADE,
    id_docente UUID REFERENCES docentes_perfil(id_docente) ON DELETE CASCADE,
    PRIMARY KEY (id_curso, id_docente)
);

CREATE TABLE cohorte_estudiantes (
    id_cohorte INT REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    id_estudiante UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    estado VARCHAR(20) NOT NULL DEFAULT 'matriculado'
        CHECK (estado IN ('inscrito', 'matriculado', 'egresado', 'graduado', 'retirado')),
    fecha_grado DATE,
    -- Beca del estudiante en su promoción (columnas de la hoja «Beneficios»); NULL = sin beca
    beca VARCHAR(20) CHECK (beca IN ('100', 'hora_catedra', 'sintraunicol')),
    PRIMARY KEY (id_cohorte, id_estudiante)
);

-- Beneficios del estudiante en cada semestre de su promoción (beca, asistencia de investigación o
-- ayudantía de docencia). Si un estudiante no tiene filas, cuenta la beca de cohorte_estudiantes.
CREATE TABLE estudiante_beneficios (
    id_cohorte INT NOT NULL,
    id_estudiante UUID NOT NULL,
    semestre SMALLINT NOT NULL CHECK (semestre BETWEEN 1 AND 4),
    tipo VARCHAR(30) NOT NULL
        CHECK (tipo IN ('100', 'hora_catedra', 'sintraunicol', 'asistente_investigacion', 'ayudante_docencia')),
    PRIMARY KEY (id_cohorte, id_estudiante, semestre, tipo),
    FOREIGN KEY (id_cohorte, id_estudiante) REFERENCES cohorte_estudiantes(id_cohorte, id_estudiante) ON DELETE CASCADE
);

CREATE TABLE curso_estudiantes (
    id_curso INT REFERENCES cursos(id_curso) ON DELETE CASCADE,
    id_estudiante UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    PRIMARY KEY (id_curso, id_estudiante)
);

-- =====================================================================
-- MÓDULO 2: RESULTADOS DE APRENDIZAJE (RA1 - RA7)
-- =====================================================================
CREATE TABLE resultados_aprendizaje (
    id_ra SERIAL PRIMARY KEY,
    codigo VARCHAR(10) UNIQUE NOT NULL, -- 'RA1' a 'RA7'
    descripcion TEXT NOT NULL
);

CREATE TABLE estrategias_evaluacion (
    id_estrategia SERIAL PRIMARY KEY,
    codigo VARCHAR(10) UNIQUE NOT NULL, -- 'E1' a 'E6'
    descripcion TEXT NOT NULL
);

CREATE TABLE ra_estrategias (
    id_ra INT REFERENCES resultados_aprendizaje(id_ra) ON DELETE CASCADE,
    id_estrategia INT REFERENCES estrategias_evaluacion(id_estrategia) ON DELETE CASCADE,
    PRIMARY KEY (id_ra, id_estrategia)
);

-- RA que evalúa cada curso del catálogo y nivel de dominio esperado (Tabla 3)
CREATE TABLE catalogo_ra (
    id_catalogo INT REFERENCES cursos_catalogo(id_catalogo) ON DELETE CASCADE,
    id_ra INT REFERENCES resultados_aprendizaje(id_ra) ON DELETE CASCADE,
    nivel_dominio VARCHAR(25) NOT NULL
        CHECK (nivel_dominio IN ('Intermedio', 'Avanzado', 'Intermedio y avanzado')),
    PRIMARY KEY (id_catalogo, id_ra)
);

-- Estrategias sugeridas para evaluar cada RA en cada curso (Tabla 4)
CREATE TABLE catalogo_ra_estrategias (
    id_catalogo INT,
    id_ra INT,
    id_estrategia INT REFERENCES estrategias_evaluacion(id_estrategia) ON DELETE CASCADE,
    PRIMARY KEY (id_catalogo, id_ra, id_estrategia),
    FOREIGN KEY (id_catalogo, id_ra) REFERENCES catalogo_ra(id_catalogo, id_ra) ON DELETE CASCADE
);

-- Criterios de la rúbrica de cada RA (Tablas 5 a 11). Los pesos de un RA suman 100
-- (lo garantiza el servicio, que reemplaza la rúbrica completa en una transacción).
CREATE TABLE rubricas_criterios (
    id_criterio SERIAL PRIMARY KEY,
    id_ra INT NOT NULL REFERENCES resultados_aprendizaje(id_ra) ON DELETE CASCADE,
    orden SMALLINT NOT NULL CHECK (orden > 0),
    nombre_criterio VARCHAR(200) NOT NULL,
    peso_porcentaje DECIMAL(5,2) NOT NULL CHECK (peso_porcentaje > 0 AND peso_porcentaje <= 100),
    desc_nivel_alto TEXT NOT NULL,
    desc_nivel_medio TEXT NOT NULL,
    desc_nivel_basico TEXT NOT NULL,
    desc_nivel_insuficiente TEXT NOT NULL,
    CONSTRAINT unq_criterio_orden UNIQUE (id_ra, orden)
);

-- Nota del estudiante (0–5) en cada criterio, dentro de una oferta de curso.
-- Nivel de rúbrica (Alto 4.5–5.0, Medio 3.5–4.4, Básico 3.0–3.4, Insuficiente < 3.0); lo asigna
-- el servicio con modules/ra/rubrica.js. La FK compuesta impide calificar a quien no está inscrito
-- y desmatricular a quien ya tiene notas.
CREATE TABLE evaluaciones_ra_estudiante (
    id_evaluacion_ra BIGSERIAL PRIMARY KEY,
    id_curso INT NOT NULL,
    id_estudiante UUID NOT NULL,
    id_criterio INT NOT NULL REFERENCES rubricas_criterios(id_criterio) ON DELETE RESTRICT,
    id_docente UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    calificacion DECIMAL(3,2) NOT NULL CHECK (calificacion >= 0.00 AND calificacion <= 5.00),
    nivel tipo_nivel_logro NOT NULL,
    fecha_evaluacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP,
    FOREIGN KEY (id_curso, id_estudiante)
        REFERENCES curso_estudiantes(id_curso, id_estudiante) ON DELETE RESTRICT,
    CONSTRAINT unq_estudiante_criterio_curso UNIQUE (id_curso, id_estudiante, id_criterio)
);

CREATE INDEX idx_eval_ra_estudiante ON evaluaciones_ra_estudiante (id_estudiante);

-- Apertura de la calificación de rúbricas por semestre académico. Cada curso se evalúa al final
-- de su semestre; Coordinación abre y cierra la calificación. Un semestre sin fila está cerrado.
CREATE TABLE periodos_calificacion_ra (
    periodo periodo_academico PRIMARY KEY,
    abierto BOOLEAN NOT NULL DEFAULT FALSE,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_por UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

-- Total ponderado por (oferta, estudiante, RA). Solo suma: la clasificación en niveles y la
-- regla de completitud (calificados = criterios) se aplican en modules/ra/rubrica.js.
CREATE VIEW v_ra_resultados AS
SELECT e.id_curso,
       e.id_estudiante,
       rc.id_ra,
       ROUND(SUM(e.calificacion * rc.peso_porcentaje) / 100, 2) AS total,
       COUNT(*)::int AS calificados,
       (SELECT COUNT(*)::int FROM rubricas_criterios x WHERE x.id_ra = rc.id_ra) AS criterios
FROM evaluaciones_ra_estudiante e
JOIN rubricas_criterios rc USING (id_criterio)
GROUP BY e.id_curso, e.id_estudiante, rc.id_ra;

-- =====================================================================
-- MÓDULO 3: EVALUACIÓN DOCENTE (ACUERDO 058 DE 2022)
-- La evaluación no se vincula a materias (decisión del 17-oct-2026): la unidad evaluada es el docente
-- en una promoción y un semestre académico, como en «Estadísticas Evaluación Docente MaIE.xlsx». Las
-- ofertas (cursos + curso_docentes) solo sirven para saber qué estudiantes evalúan a qué docente.
-- Reglas de quién evalúa a quién: backend/src/modules/evalDocente/categorizacion.js.
-- Fórmulas (%IP, %IN, categorías, IDST-D, IDSC): backend/src/modules/evalDocente/acuerdo058.js.
-- =====================================================================
CREATE TYPE tipo_valoracion_058 AS ENUM ('MA', 'A', 'I', 'MI', 'NA'); -- Art. 1: NA = No aplica / No responde

-- Habilitación por semestre académico (dentro del Módulo 3, separada de la apertura de rúbricas del
-- Módulo 2). Un semestre sin fila no está habilitado. Las fechas son el cronograma que Coordinación
-- informa (Art. 10); si están, las respuestas solo se reciben entre ellas.
CREATE TABLE evaluacion_periodos (
    periodo periodo_academico PRIMARY KEY,
    habilitada BOOLEAN NOT NULL DEFAULT FALSE,
    incluye_pregrado BOOLEAN NOT NULL DEFAULT FALSE,   -- también evalúan los estudiantes de pregrado
    fecha_apertura DATE,
    fecha_cierre DATE,
    -- Parágrafo 2 del Art. 12: excluir respuestas extremas (todo MA o todo MI) si la unidad tiene más de
    -- 10 respuestas. Opción de Coordinación, no automática.
    excluir_extremas BOOLEAN NOT NULL DEFAULT FALSE,
    publicado BOOLEAN NOT NULL DEFAULT FALSE,           -- RF-EVAL-05: el docente ve sus resultados
    publicado_en TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_por UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    CONSTRAINT chk_fechas_evaluacion CHECK (fecha_cierre IS NULL OR fecha_apertura IS NULL OR fecha_cierre >= fecha_apertura),
    CONSTRAINT chk_publicada_cerrada CHECK (NOT (publicado AND habilitada))
);

-- Instrumentos de los Art. 4 (EE), 5 (EC) y 6 (AE). `caracteristica` 0 = «Autoevaluación del estudiante»
-- (preguntas 0.1–0.4 del EE): evalúa al estudiante, se recoge pero no entra en los indicadores del docente.
CREATE TABLE evaluacion_preguntas (
    id_pregunta SERIAL PRIMARY KEY,
    tipo_formulario tipo_formulario_eval NOT NULL,
    caracteristica SMALLINT NOT NULL CHECK (caracteristica BETWEEN 0 AND 9),
    nombre_caracteristica VARCHAR(120) NOT NULL,
    codigo VARCHAR(10) NOT NULL,          -- numeración del Acuerdo: '1.1', '0.3'…
    orden SMALLINT NOT NULL,
    texto TEXT NOT NULL,
    escala TEXT,                          -- rangos MA/A/I/MI propios de la pregunta (solo 0.x)
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT unq_pregunta_codigo UNIQUE (tipo_formulario, codigo),
    CONSTRAINT unq_pregunta_orden UNIQUE (tipo_formulario, orden)
);

-- Estudiantes de pregrado que toman cursos de la maestría (lista por semestre, promoción y curso: la
-- oferta ya fija los tres). Van aparte de curso_estudiantes para no entrar en las rúbricas de RA.
CREATE TABLE curso_estudiantes_pregrado (
    id_curso INT REFERENCES cursos(id_curso) ON DELETE CASCADE,
    id_estudiante UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    programa VARCHAR(150),                -- programa de pregrado de origen
    estado VARCHAR(20) NOT NULL DEFAULT 'inscrito' CHECK (estado IN ('inscrito', 'retirado')),
    PRIMARY KEY (id_curso, id_estudiante)
);

-- Respuestas. Las del EE son ANÓNIMAS: no guardan evaluador, ni fecha, ni un identificador ordenable
-- (UUID aleatorio), solo la unidad evaluada y la población (posgrado/pregrado). Las de EC y AE sí guardan
-- quién respondió (Coordinación y el propio docente) y se pueden corregir mientras el semestre está abierto.
CREATE TABLE evaluacion_respuestas (
    id_respuesta UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    periodo periodo_academico NOT NULL REFERENCES evaluacion_periodos(periodo) ON DELETE RESTRICT,
    tipo_formulario tipo_formulario_eval NOT NULL,
    id_docente UUID NOT NULL REFERENCES docentes_perfil(id_docente) ON DELETE RESTRICT, -- conserva el histórico
    id_cohorte INT NOT NULL REFERENCES cohortes(id_cohorte) ON DELETE RESTRICT,
    poblacion VARCHAR(10) CHECK (poblacion IN ('posgrado', 'pregrado')),
    id_evaluador UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    comentario TEXT,                      -- Art. 7: opiniones, sugerencias y recomendaciones
    actualizado_en TIMESTAMP,             -- solo EC y AE
    CONSTRAINT chk_anonimato_ee CHECK (
        (tipo_formulario = 'EE' AND id_evaluador IS NULL AND actualizado_en IS NULL AND poblacion IS NOT NULL)
        OR (tipo_formulario <> 'EE' AND poblacion IS NULL))
);
-- Una EC y una AE por unidad evaluada y semestre.
CREATE UNIQUE INDEX unq_respuesta_ec_ae ON evaluacion_respuestas (periodo, tipo_formulario, id_docente, id_cohorte)
    WHERE tipo_formulario <> 'EE';
CREATE INDEX idx_respuestas_periodo ON evaluacion_respuestas (periodo, tipo_formulario);

CREATE TABLE evaluacion_respuesta_items (
    id_respuesta UUID REFERENCES evaluacion_respuestas(id_respuesta) ON DELETE CASCADE,
    id_pregunta INT REFERENCES evaluacion_preguntas(id_pregunta) ON DELETE RESTRICT,
    valor tipo_valoracion_058 NOT NULL,
    PRIMARY KEY (id_respuesta, id_pregunta)
);

-- Constancia de que un estudiante ya evaluó a un docente en el semestre: solo impide responder dos veces
-- y alimenta el avance. No guarda al estudiante ni al docente, sino una HUELLA = HMAC-SHA256(EVAL_SECRETO,
-- 'periodo|id_estudiante|id_docente') (modules/evalDocente/anonimato.js): sin la clave del servidor no
-- revela quién evaluó a quién. Al cerrar o publicar el semestre, las respuestas EE se reescriben en orden
-- aleatorio (barajarEE) para que tampoco compartan transacción ni orden físico con su constancia.
CREATE TABLE evaluacion_constancias (
    periodo periodo_academico NOT NULL REFERENCES evaluacion_periodos(periodo) ON DELETE RESTRICT,
    huella CHAR(64) NOT NULL CHECK (huella ~ '^[0-9a-f]{64}$'),
    PRIMARY KEY (periodo, huella)
);
