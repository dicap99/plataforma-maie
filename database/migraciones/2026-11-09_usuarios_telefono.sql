-- Migración: teléfono de contacto del usuario, gestionado por Coordinación (asesoría del 20-oct-2026).
--   docker compose exec -T db psql -v ON_ERROR_STOP=1 -U maie_admin -d maie_db < database/migraciones/2026-11-09_usuarios_telefono.sql
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(30);
COMMENT ON COLUMN usuarios.telefono IS 'Teléfono de contacto; lo registra Coordinación';
