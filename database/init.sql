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
    password_hash VARCHAR(255) NOT NULL,
    rol tipo_rol NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
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
    tesis INT NOT NULL DEFAULT 0 CHECK (tesis >= 0)
);

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
    componentes TEXT,          -- componentes de formación que apoya
    cursos_participa TEXT,     -- cursos en los que participa
    enlace_perfil VARCHAR(255),
    titulacion_maxima VARCHAR(100),
    linea_investigacion VARCHAR(150),
    vinculacion_tipo VARCHAR(50)
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

-- Cursos dictados y matrícula individual (base para los módulos 2 y 3)
CREATE TABLE cursos (
    id_curso SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    creditos INT NOT NULL CHECK (creditos > 0),
    componente VARCHAR(50) NOT NULL,
    id_modulo INT REFERENCES modulos_curriculares(id_modulo),
    id_cohorte INT REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    id_docente UUID REFERENCES usuarios(id_usuario)
);

CREATE TABLE cohorte_estudiantes (
    id_cohorte INT REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    id_estudiante UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    estado VARCHAR(20) NOT NULL DEFAULT 'matriculado'
        CHECK (estado IN ('inscrito', 'matriculado', 'egresado', 'graduado', 'retirado')),
    fecha_grado DATE,
    PRIMARY KEY (id_cohorte, id_estudiante)
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

CREATE TABLE rubricas_criterios (
    id_criterio SERIAL PRIMARY KEY,
    id_ra INT REFERENCES resultados_aprendizaje(id_ra) ON DELETE CASCADE,
    nombre_criterio VARCHAR(200) NOT NULL,
    peso_porcentaje DECIMAL(5,2) NOT NULL CHECK (peso_porcentaje > 0 AND peso_porcentaje <= 100),
    desc_nivel_alto TEXT NOT NULL,
    desc_nivel_medio TEXT NOT NULL,
    desc_nivel_basico TEXT NOT NULL,
    desc_nivel_insuficiente TEXT NOT NULL
);

-- Nivel de rúbrica (Alto 4.5–5.0, Medio 3.5–4.4, Básico 3.0–3.4, Insuficiente < 3.0)
CREATE TABLE evaluaciones_ra_estudiante (
    id_evaluacion_ra BIGSERIAL PRIMARY KEY,
    id_curso INT REFERENCES cursos(id_curso) ON DELETE CASCADE,
    id_estudiante UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_docente UUID REFERENCES usuarios(id_usuario),
    id_criterio INT REFERENCES rubricas_criterios(id_criterio),
    calificacion DECIMAL(3,2) CHECK (calificacion >= 0.00 AND calificacion <= 5.00),
    nivel tipo_nivel_logro,
    fecha_evaluacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unq_estudiante_criterio_curso UNIQUE(id_curso, id_estudiante, id_criterio)
);

-- =====================================================================
-- MÓDULO 3: EVALUACIÓN DOCENTE (ACUERDO 058 DE 2022)
-- =====================================================================
CREATE TABLE evaluacion_periodos (
    id_periodo SERIAL PRIMARY KEY,
    codigo_periodo VARCHAR(20) NOT NULL,
    fecha_apertura TIMESTAMP NOT NULL,
    fecha_cierre TIMESTAMP NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    publicado BOOLEAN DEFAULT FALSE
);

CREATE TABLE evaluacion_preguntas (
    id_pregunta SERIAL PRIMARY KEY,
    tipo_formulario tipo_formulario_eval NOT NULL,
    orden INT NOT NULL,
    texto TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    CONSTRAINT unq_pregunta_orden UNIQUE (tipo_formulario, orden)
);

CREATE TABLE evaluacion_respuestas (
    id_respuesta BIGSERIAL PRIMARY KEY,
    id_periodo INT REFERENCES evaluacion_periodos(id_periodo),
    id_docente_evaluado UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_evaluador UUID REFERENCES usuarios(id_usuario),
    tipo_formulario tipo_formulario_eval NOT NULL,
    id_curso INT REFERENCES cursos(id_curso),
    frecuencias_ma INT DEFAULT 0, -- Muy Adecuada (Peso 1.5)
    frecuencias_a INT DEFAULT 0, -- Adecuada (Peso 1.0)
    frecuencias_i INT DEFAULT 0, -- Inadecuada (Peso 1.0)
    frecuencias_mi INT DEFAULT 0, -- Muy Inadecuada (Peso 1.5)
    frecuencias_na INT DEFAULT 0, -- No Aplica / No Responde
    observaciones_sugerencias TEXT
);

CREATE TABLE evaluacion_resultados_docente (
    id_resultado SERIAL PRIMARY KEY,
    id_periodo INT REFERENCES evaluacion_periodos(id_periodo),
    id_docente UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    indicador_positivo_ip DECIMAL(6,2) NOT NULL,
    indicador_negativo_in DECIMAL(6,2) NOT NULL,
    porcentaje_ip DECIMAL(5,2) NOT NULL,
    categorizacion VARCHAR(30) NOT NULL,
    idst_d DECIMAL(5,2) NOT NULL,
    fecha_calculo TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
