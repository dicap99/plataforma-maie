-- Migración: registro interno de contratos OPS con nombres (asesoría del 20-oct-2026: «todos los registros
-- internos van con nombres; las gráficas, solo cifras»). Los periodos con contratos registrados calculan
-- la hoja «Contrataciones» (cantidad y valor); los demás conservan el histórico de contrataciones_periodo.
--   docker compose exec -T db psql -v ON_ERROR_STOP=1 -U maie_admin -d maie_db < database/migraciones/2026-11-09_contratos_ops.sql
CREATE TABLE IF NOT EXISTS contratos_ops (
    id_contrato SERIAL PRIMARY KEY,
    periodo periodo_academico NOT NULL,
    id_cohorte INT REFERENCES cohortes(id_cohorte) ON DELETE SET NULL,
    contratista VARCHAR(200) NOT NULL,
    objeto TEXT NOT NULL,
    numero_contrato VARCHAR(50),
    fecha_inicio DATE,
    fecha_fin DATE,
    valor NUMERIC(16,2) NOT NULL CHECK (valor >= 0),
    CONSTRAINT unq_contrato_ops UNIQUE (periodo, contratista, objeto),
    CONSTRAINT chk_fechas_contrato_ops CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);
COMMENT ON TABLE contratos_ops IS 'Contratos OPS del programa con contratista, objeto y valor (hoja «Contratos OPS»)';
COMMENT ON COLUMN contratos_ops.objeto IS 'Curso o actividad contratada';
COMMENT ON COLUMN contratos_ops.id_cohorte IS 'Promoción atendida (opcional: un contrato puede servir a varias)';
