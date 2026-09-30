-- Migración: clases con identificador único (p. ej. «Robótica»); la oferta pasa a ser clase + semestre +
-- promoción, con docentes por periodo. Requiere la migración 2026-09-30_modulo2_ra.sql.
--   docker compose exec -T db psql -v ON_ERROR_STOP=1 -U maie_admin -d maie_db < database/migraciones/2026-09-30_clases.sql
-- Las ofertas existentes no se pueden convertir automáticamente: la migración exige que no haya ofertas.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clases') THEN
    RAISE EXCEPTION 'La base ya tiene la tabla clases';
  END IF;
  IF (SELECT COUNT(*) FROM cursos) > 0 THEN
    RAISE EXCEPTION 'Hay ofertas de curso registradas; revise antes de migrar';
  END IF;
END $$;

-- Clases: asignatura concreta con identificador único (p. ej. «Robótica»), ligada al único curso del
-- plan que cubre (y por él a los RA que evalúa). El código lo genera la plataforma (CE2-01, CB1-01…).
CREATE TABLE clases (
    id_clase SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    id_catalogo INT NOT NULL REFERENCES cursos_catalogo(id_catalogo),
    descripcion TEXT,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT unq_clase_catalogo UNIQUE (id_clase, id_catalogo)
);
CREATE UNIQUE INDEX unq_clase_nombre ON clases (LOWER(nombre));

ALTER TABLE cursos DROP CONSTRAINT unq_oferta;
ALTER TABLE cursos DROP CONSTRAINT cursos_id_catalogo_fkey;
ALTER TABLE cursos DROP COLUMN nombre;
ALTER TABLE cursos ADD COLUMN id_clase INT NOT NULL;
ALTER TABLE cursos ADD FOREIGN KEY (id_clase, id_catalogo) REFERENCES clases(id_clase, id_catalogo) ON UPDATE CASCADE;
ALTER TABLE cursos ADD CONSTRAINT unq_oferta UNIQUE (id_clase, id_cohorte, periodo, grupo);
-- Clases con su identificador (PEP, sección 3.3: cursos vigentes y los que se han ofertado en
-- profundización y electivas). Coordinación agrega nuevas clases desde la plataforma.
INSERT INTO clases (codigo, nombre, id_catalogo)
SELECT v.codigo, v.nombre, k.id_catalogo
FROM (VALUES
  ('CB1-01', 'Sistemas Lineales de Múltiples Variables', 'MaIE-CB1'),
  ('CB2-01', 'Optimización', 'MaIE-CB2'),
  ('CP1-01', 'Introducción a la Profundización', 'MaIE-CP1'),
  ('CP2-01', 'Control Inteligente', 'MaIE-CP2'),
  ('CP2-02', 'Comunicaciones Inalámbricas', 'MaIE-CP2'),
  ('CP2-03', 'Microrredes', 'MaIE-CP2'),
  ('CP3-01', 'Optimización Distribuida', 'MaIE-CP3'),
  ('CP3-02', 'Procesos Estocásticos', 'MaIE-CP3'),
  ('CP3-03', 'Smart Grids', 'MaIE-CP3'),
  ('CE1-01', 'Reinforcement Learning', 'MaIE-CE1'),
  ('CE1-02', 'Ingeniería de RF', 'MaIE-CE1'),
  ('CE1-03', 'Sistemas Fotovoltaicos con Machine Learning', 'MaIE-CE1'),
  ('CE2-01', 'Robótica', 'MaIE-CE2'),
  ('CE2-02', 'Aprendizaje Profundo', 'MaIE-CE2'),
  ('CE2-03', 'Teoría de Juegos', 'MaIE-CE2'),
  ('CI1-01', 'Formulación de Proyectos de Investigación', 'MaIE-CI1'),
  ('TESIS-I-01', 'Tesis I', 'MaIE-Tesis-I'),
  ('CI2-01', 'Redacción de Artículos Científicos', 'MaIE-CI2'),
  ('TESIS-II-01', 'Tesis II', 'MaIE-Tesis-II')
) AS v(codigo, nombre, curso)
JOIN cursos_catalogo k ON k.codigo = v.curso;

COMMIT;
