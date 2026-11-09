-- Migración: departamento, universidad y grupo de investigación del docente (asesoría del 20-oct-2026: del docente
-- externo se registra al menos el departamento y la universidad; del UDENAR, su departamento).
--   docker compose exec -T db psql -v ON_ERROR_STOP=1 -U maie_admin -d maie_db < database/migraciones/2026-11-09_docentes_afiliacion.sql
ALTER TABLE docentes_perfil ADD COLUMN IF NOT EXISTS departamento VARCHAR(150);
ALTER TABLE docentes_perfil ADD COLUMN IF NOT EXISTS universidad VARCHAR(150);
-- Grupo de investigación (PEP, Tabla 23 «Identificación de los docentes»).
ALTER TABLE docentes_perfil ADD COLUMN IF NOT EXISTS grupo_investigacion VARCHAR(150);
COMMENT ON COLUMN docentes_perfil.grupo_investigacion IS 'Grupo de investigación al que pertenece el docente';
COMMENT ON COLUMN docentes_perfil.departamento IS 'Departamento o unidad académica a la que pertenece el docente';
COMMENT ON COLUMN docentes_perfil.universidad IS 'Universidad o institución de afiliación (docentes externos)';
