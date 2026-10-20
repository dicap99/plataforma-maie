-- Migración: el docente es un usuario y sus cursos alimentan «Cursos y docentes por semestre».
--   docker compose exec -T db psql -v ON_ERROR_STOP=1 -U maie_admin -d maie_db < database/migraciones/2026-10-20_docentes_usuarios.sql
-- 1) curso_docentes referencia el perfil docente (no la cuenta), para que un docente cuente aunque
--    aún no tenga usuario. 2) Marca de contraseña temporal en usuarios.
BEGIN;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN usuarios.debe_cambiar_password IS 'Cuenta con credenciales temporales: el usuario debe cambiarlas al entrar';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'curso_docentes_id_docente_fkey' AND confrelid = 'usuarios'::regclass
  ) THEN
    -- Los docentes asignados que aún no tienen perfil reciben uno (afiliación por defecto UDENAR).
    INSERT INTO docentes_perfil (id_usuario, nombre_completo, afiliacion)
    SELECT DISTINCT u.id_usuario, u.nombres || ' ' || u.apellidos, 'UDENAR'::tipo_afiliacion
    FROM curso_docentes cd JOIN usuarios u ON u.id_usuario = cd.id_docente
    WHERE NOT EXISTS (SELECT 1 FROM docentes_perfil d WHERE d.id_usuario = u.id_usuario)
    ON CONFLICT (nombre_completo) DO NOTHING;

    ALTER TABLE curso_docentes DROP CONSTRAINT curso_docentes_id_docente_fkey;
    UPDATE curso_docentes cd SET id_docente = d.id_docente
    FROM docentes_perfil d WHERE d.id_usuario = cd.id_docente;
    DELETE FROM curso_docentes cd WHERE NOT EXISTS (SELECT 1 FROM docentes_perfil d WHERE d.id_docente = cd.id_docente);
    ALTER TABLE curso_docentes ADD CONSTRAINT curso_docentes_id_docente_fkey
      FOREIGN KEY (id_docente) REFERENCES docentes_perfil(id_docente) ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON COLUMN docentes_perfil.componentes IS 'Obsoleto: los componentes se calculan de los cursos asignados (curso_docentes)';
COMMENT ON COLUMN docentes_perfil.cursos_participa IS 'Obsoleto: texto histórico del libro; los cursos salen de curso_docentes';

COMMIT;
