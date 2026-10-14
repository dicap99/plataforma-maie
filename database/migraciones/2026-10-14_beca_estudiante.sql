-- Migración: beca del estudiante en su promoción (registro de usuarios en Gestión académica).
--   docker compose exec -T db psql -v ON_ERROR_STOP=1 -U maie_admin -d maie_db < database/migraciones/2026-10-14_beca_estudiante.sql
ALTER TABLE cohorte_estudiantes
    ADD COLUMN IF NOT EXISTS beca VARCHAR(20) CHECK (beca IN ('100', 'hora_catedra', 'sintraunicol'));
COMMENT ON COLUMN cohorte_estudiantes.beca IS 'Beca del estudiante en su promoción (hoja «Beneficios»); NULL = sin beca';
