-- Migración: producción científica por producto (reunión de avances del 20-oct-2026).
--   docker compose exec -T db psql -v ON_ERROR_STOP=1 -U maie_admin -d maie_db < database/migraciones/2026-10-26_productos_investigacion.sql
-- cohorte_produccion se conserva como histórico: las promociones con productos registrados calculan sus conteos de aquí.
CREATE TABLE IF NOT EXISTS productos_investigacion (
    id_producto SERIAL PRIMARY KEY,
    id_cohorte INT NOT NULL REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Artículo', 'Ponencia', 'Software', 'Prototipo', 'Tesis')),
    cita TEXT NOT NULL,
    anio SMALLINT CHECK (anio BETWEEN 1990 AND 2100),
    estudiantes TEXT,
    enlace VARCHAR(255),
    CONSTRAINT unq_producto UNIQUE (id_cohorte, tipo, cita)
);
COMMENT ON TABLE productos_investigacion IS 'Productos de investigación de cada promoción con su cita (hoja «Productos de investigación»)';
COMMENT ON COLUMN productos_investigacion.estudiantes IS 'Estudiantes de la promoción que participan (texto: también los de promociones sin cuentas en la plataforma)';
