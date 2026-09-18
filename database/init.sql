-- EXTENSIÓN Y TIPOS ENUM DE SEGURIDAD Y EVALUACIÓN
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE tipo_rol AS ENUM ('coordinador', 'docente', 'estudiante');
CREATE TYPE tipo_formulario_eval AS ENUM ('EE', 'EC', 'AE'); -- Estudiante, Coordinador, Autoevaluación

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

-- TABLA: PERFIL HISTÓRICO DOCENTE (RF-ADM-06)
CREATE TABLE docentes_perfil (
    id_docente UUID PRIMARY KEY REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    titulacion_maxima VARCHAR(100) NOT NULL,
    linea_investigacion VARCHAR(150),
    enlace_cvlac_orcid VARCHAR(255),
    vinculacion_tipo VARCHAR(50)
);

-- TABLAS MÓDULO 1: PROCESOS ADMINISTRATIVOS
CREATE TABLE cohortes (
    id_cohorte SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    anio_inicio INT NOT NULL,
    anio_fin INT NOT NULL,
    inscritos INT DEFAULT 0,
    matriculados INT DEFAULT 0,
    graduados INT DEFAULT 0,
    egresados INT DEFAULT 0
);

CREATE TABLE cursos (
    id_curso SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    creditos INT NOT NULL CHECK (creditos > 0),
    componente VARCHAR(50) NOT NULL,
    id_cohorte INT REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    id_docente UUID REFERENCES usuarios(id_usuario)
);

CREATE TABLE presupuesto_items (
    id_presupuesto SERIAL PRIMARY KEY,
    id_cohorte INT REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    fecha_corte DATE NOT NULL,
    rubro_concepto VARCHAR(200) NOT NULL,
    monto_asignado DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    monto_comprometido DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    monto_ejecutado DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    observaciones TEXT
);

-- TABLAS MÓDULO 2: RESULTADOS DE APRENDIZAJE (RA1 - RA7)
CREATE TABLE resultados_aprendizaje (
    id_ra SERIAL PRIMARY KEY,
    codigo VARCHAR(10) UNIQUE NOT NULL, -- 'RA1' a 'RA7'
    descripcion TEXT NOT NULL
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

CREATE TABLE evaluaciones_ra_estudiante (
    id_evaluacion_ra BIGSERIAL PRIMARY KEY,
    id_curso INT REFERENCES cursos(id_curso) ON DELETE CASCADE,
    id_estudiante UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_docente UUID REFERENCES usuarios(id_usuario),
    id_criterio INT REFERENCES rubricas_criterios(id_criterio),
    calificacion DECIMAL(3,2) CHECK (calificacion >= 0.00 AND calificacion <= 5.00),
    fecha_evaluacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unq_estudiante_criterio_curso UNIQUE(id_curso, id_estudiante, id_criterio)
);

-- TABLAS MÓDULO 3: EVALUACIÓN DOCENTE (ACUERDO 058 DE 2022)
CREATE TABLE evaluacion_periodos (
    id_periodo SERIAL PRIMARY KEY,
    codigo_periodo VARCHAR(20) NOT NULL,
    fecha_apertura TIMESTAMP NOT NULL,
    fecha_cierre TIMESTAMP NOT NULL,
    activo BOOLEAN DEFAULT TRUE
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

-- =====================================================================
-- EXTENSIONES DEL ESQUEMA (requisitos del SRS no cubiertos arriba)
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- crypt()/gen_salt('bf') para el usuario semilla

CREATE TYPE tipo_nivel_logro AS ENUM ('Alto', 'Medio', 'Basico', 'Insuficiente');
CREATE TYPE tipo_producto AS ENUM ('articulo', 'ponencia', 'tesis', 'software', 'libro', 'patente', 'otro');

-- MÓDULO 1: componentes de formación / módulos curriculares (RF-RA-04 "por módulo curricular")
CREATE TABLE modulos_curriculares (
    id_modulo SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL, -- Básico, Profundización, Electivo, Investigativo
    descripcion TEXT
);

ALTER TABLE cursos ADD COLUMN id_modulo INT REFERENCES modulos_curriculares(id_modulo);

-- MÓDULO 1: matrícula de estudiantes (RF-ADM-01)
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

-- MÓDULO 1: gestión financiera — transferencias y contratos OPS (RF-ADM-03)
CREATE TABLE transferencias (
    id_transferencia SERIAL PRIMARY KEY,
    id_cohorte INT REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    concepto VARCHAR(200) NOT NULL,
    dependencia_destino VARCHAR(150),
    monto DECIMAL(14,2) NOT NULL CHECK (monto >= 0),
    observaciones TEXT
);

CREATE TABLE contratos_ops (
    id_contrato SERIAL PRIMARY KEY,
    id_cohorte INT REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    id_docente UUID REFERENCES usuarios(id_usuario),
    numero_contrato VARCHAR(50),
    objeto TEXT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    valor DECIMAL(14,2) NOT NULL CHECK (valor >= 0),
    observaciones TEXT
);

-- MÓDULO 1: investigación (RF-ADM-04)
CREATE TABLE productos_investigacion (
    id_producto SERIAL PRIMARY KEY,
    tipo tipo_producto NOT NULL,
    titulo VARCHAR(300) NOT NULL,
    anio INT NOT NULL,
    id_estudiante UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    id_cohorte INT REFERENCES cohortes(id_cohorte) ON DELETE SET NULL,
    medio_publicacion VARCHAR(200),
    enlace_doi VARCHAR(255),
    observaciones TEXT
);

CREATE TABLE pasantias_estancias (
    id_pasantia SERIAL PRIMARY KEY,
    id_estudiante UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    institucion VARCHAR(200) NOT NULL,
    pais VARCHAR(100),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    objetivo TEXT
);

-- MÓDULO 1: formación académica del docente (RF-ADM-06)
CREATE TABLE docentes_formacion (
    id_formacion SERIAL PRIMARY KEY,
    id_docente UUID REFERENCES docentes_perfil(id_docente) ON DELETE CASCADE,
    nivel VARCHAR(50) NOT NULL, -- Pregrado, Especialización, Maestría, Doctorado, Posdoctorado
    titulo VARCHAR(200) NOT NULL,
    institucion VARCHAR(200) NOT NULL,
    anio_grado INT
);

-- MÓDULO 2: estrategias de evaluación E1–E6 y su relación con los RA (RF-RA-01)
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

-- Nivel de rúbrica seleccionado por el docente (Alto 4.5–5.0, Medio 3.5–4.4, Básico 3.0–3.4, Insuficiente < 3.0)
ALTER TABLE evaluaciones_ra_estudiante ADD COLUMN nivel tipo_nivel_logro;

-- MÓDULO 3: preguntas de los formularios EE/EC/AE (RF-EVAL-01) y publicación de resultados (RF-EVAL-05)
CREATE TABLE evaluacion_preguntas (
    id_pregunta SERIAL PRIMARY KEY,
    tipo_formulario tipo_formulario_eval NOT NULL,
    orden INT NOT NULL,
    texto TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    CONSTRAINT unq_pregunta_orden UNIQUE (tipo_formulario, orden)
);

ALTER TABLE evaluacion_periodos ADD COLUMN publicado BOOLEAN DEFAULT FALSE;
