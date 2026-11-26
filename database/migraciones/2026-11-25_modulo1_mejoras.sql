-- Migración Módulo 1 (mejoras asesoría 2026-11-25):
-- 1. Código externo (OCARA) en clases
-- 2. Detalle en beneficios (proyecto de investigación / cursos de ayudantía)
-- 3. Pasantías detalladas con soporte documental
-- 4. Matrícula financiera por estudiante (posgrado y pregrado)

BEGIN;

ALTER TABLE clases
    ADD COLUMN IF NOT EXISTS codigo_externo VARCHAR(50);

ALTER TABLE estudiante_beneficios
    ADD COLUMN IF NOT EXISTS detalle TEXT;

CREATE TABLE IF NOT EXISTS pasantias_detalle (
    id_pasantia SERIAL PRIMARY KEY,
    id_cohorte INT NOT NULL REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Nacional', 'Internacional')),
    estudiante VARCHAR(200) NOT NULL,
    institucion VARCHAR(200) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    tiene_soporte BOOLEAN NOT NULL DEFAULT FALSE,
    soporte_detalle VARCHAR(200),
    CONSTRAINT unq_pasantia_detalle UNIQUE (id_cohorte, tipo, estudiante, institucion, fecha_inicio),
    CONSTRAINT chk_fechas_pasantia CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE IF NOT EXISTS matriculas_financieras (
    id_matricula_fin SERIAL PRIMARY KEY,
    id_estudiante UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    poblacion VARCHAR(10) NOT NULL CHECK (poblacion IN ('posgrado', 'pregrado')),
    id_cohorte INT REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    periodo periodo_academico NOT NULL,
    pagado BOOLEAN NOT NULL DEFAULT TRUE,
    valor_pagado NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (valor_pagado >= 0),
    fecha_pago DATE,
    referencia VARCHAR(80),
    observaciones TEXT,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unq_matricula_fin UNIQUE NULLS NOT DISTINCT (id_estudiante, poblacion, periodo, id_cohorte)
);

CREATE INDEX IF NOT EXISTS idx_matriculas_fin_periodo ON matriculas_financieras (periodo, poblacion, id_cohorte);

COMMIT;
