-- Migración: beneficios de cada estudiante por semestre de su promoción (reunión de avances del 20-oct-2026).
--   docker compose exec -T db psql -v ON_ERROR_STOP=1 -U maie_admin -d maie_db < database/migraciones/2026-10-26_beneficios_estudiante.sql
-- cohorte_estudiantes.beca se conserva: resume la beca de la promoción y sirve para los estudiantes sin semestres registrados.
CREATE TABLE IF NOT EXISTS estudiante_beneficios (
    id_cohorte INT NOT NULL,
    id_estudiante UUID NOT NULL,
    semestre SMALLINT NOT NULL CHECK (semestre BETWEEN 1 AND 4),
    tipo VARCHAR(30) NOT NULL
        CHECK (tipo IN ('100', 'hora_catedra', 'sintraunicol', 'asistente_investigacion', 'ayudante_docencia')),
    PRIMARY KEY (id_cohorte, id_estudiante, semestre, tipo),
    FOREIGN KEY (id_cohorte, id_estudiante) REFERENCES cohorte_estudiantes(id_cohorte, id_estudiante) ON DELETE CASCADE
);
COMMENT ON TABLE estudiante_beneficios IS 'Beca, asistencia de investigación o ayudantía de docencia del estudiante en cada semestre (hoja «Beneficios»)';
