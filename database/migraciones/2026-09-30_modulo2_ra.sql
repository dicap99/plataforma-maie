-- Migración: Módulo 2 (Resultados de Aprendizaje) sobre una base creada con el esquema anterior.
-- Para bases existentes (docker volume ya inicializado); una base nueva ya lo trae desde init.sql/seed.sql.
--   docker compose exec -T db psql -v ON_ERROR_STOP=1 -U maie_admin -d maie_db < database/migraciones/2026-09-30_modulo2_ra.sql
-- Conserva los datos del Módulo 1. Solo recrea las tablas de cursos y RA, que deben estar vacías.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cursos_catalogo') THEN
    RAISE EXCEPTION 'La base ya tiene el esquema del Módulo 2';
  END IF;
  IF (SELECT COUNT(*) FROM cursos) + (SELECT COUNT(*) FROM curso_estudiantes)
     + (SELECT COUNT(*) FROM evaluaciones_ra_estudiante) + (SELECT COUNT(*) FROM rubricas_criterios)
     + (SELECT COUNT(*) FROM evaluacion_respuestas WHERE id_curso IS NOT NULL) > 0 THEN
    RAISE EXCEPTION 'Hay datos en las tablas de cursos o RA; revise antes de migrar';
  END IF;
END $$;

-- Módulo 1: detalle de productos de la producción científica
ALTER TABLE cohorte_produccion ADD COLUMN IF NOT EXISTS detalles TEXT;

-- Tablas de cursos y RA del esquema anterior (vacías). CASCADE quita la FK de evaluacion_respuestas.
DROP TABLE evaluaciones_ra_estudiante;
DROP TABLE rubricas_criterios;
DROP TABLE curso_estudiantes;
DROP TABLE cursos CASCADE;

-- Catálogo de cursos del plan de estudios (Tablas 3 y 4 del documento RA MaIE / PEP)
CREATE TABLE cursos_catalogo (
    id_catalogo SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL, -- 'MaIE-CB1' … 'MaIE-Tesis-II'
    nombre VARCHAR(150) NOT NULL,
    id_modulo INT NOT NULL REFERENCES modulos_curriculares(id_modulo),
    semestre SMALLINT NOT NULL CHECK (semestre BETWEEN 1 AND 4),
    orden SMALLINT UNIQUE NOT NULL
);

-- Oferta de un curso del catálogo a una promoción en un periodo (base para los módulos 2 y 3)
CREATE TABLE cursos (
    id_curso SERIAL PRIMARY KEY,
    id_catalogo INT NOT NULL REFERENCES cursos_catalogo(id_catalogo),
    id_cohorte INT NOT NULL REFERENCES cohortes(id_cohorte) ON DELETE CASCADE,
    periodo periodo_academico NOT NULL,
    nombre VARCHAR(150), -- nombre propio de la oferta, p. ej. electivas: 'Aprendizaje Profundo'
    grupo SMALLINT NOT NULL DEFAULT 1 CHECK (grupo > 0),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unq_oferta UNIQUE (id_catalogo, id_cohorte, periodo, grupo)
);

-- Una oferta puede tener varios docentes (p. ej. cursos compartidos con invitados externos)
CREATE TABLE curso_docentes (
    id_curso INT REFERENCES cursos(id_curso) ON DELETE CASCADE,
    id_docente UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    PRIMARY KEY (id_curso, id_docente)
);

CREATE TABLE curso_estudiantes (
    id_curso INT REFERENCES cursos(id_curso) ON DELETE CASCADE,
    id_estudiante UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    PRIMARY KEY (id_curso, id_estudiante)
);

-- RA que evalúa cada curso del catálogo y nivel de dominio esperado (Tabla 3)
CREATE TABLE catalogo_ra (
    id_catalogo INT REFERENCES cursos_catalogo(id_catalogo) ON DELETE CASCADE,
    id_ra INT REFERENCES resultados_aprendizaje(id_ra) ON DELETE CASCADE,
    nivel_dominio VARCHAR(25) NOT NULL
        CHECK (nivel_dominio IN ('Intermedio', 'Avanzado', 'Intermedio y avanzado')),
    PRIMARY KEY (id_catalogo, id_ra)
);

-- Estrategias sugeridas para evaluar cada RA en cada curso (Tabla 4)
CREATE TABLE catalogo_ra_estrategias (
    id_catalogo INT,
    id_ra INT,
    id_estrategia INT REFERENCES estrategias_evaluacion(id_estrategia) ON DELETE CASCADE,
    PRIMARY KEY (id_catalogo, id_ra, id_estrategia),
    FOREIGN KEY (id_catalogo, id_ra) REFERENCES catalogo_ra(id_catalogo, id_ra) ON DELETE CASCADE
);

-- Criterios de la rúbrica de cada RA (Tablas 5 a 11). Los pesos de un RA suman 100
-- (lo garantiza el servicio, que reemplaza la rúbrica completa en una transacción).
CREATE TABLE rubricas_criterios (
    id_criterio SERIAL PRIMARY KEY,
    id_ra INT NOT NULL REFERENCES resultados_aprendizaje(id_ra) ON DELETE CASCADE,
    orden SMALLINT NOT NULL CHECK (orden > 0),
    nombre_criterio VARCHAR(200) NOT NULL,
    peso_porcentaje DECIMAL(5,2) NOT NULL CHECK (peso_porcentaje > 0 AND peso_porcentaje <= 100),
    desc_nivel_alto TEXT NOT NULL,
    desc_nivel_medio TEXT NOT NULL,
    desc_nivel_basico TEXT NOT NULL,
    desc_nivel_insuficiente TEXT NOT NULL,
    CONSTRAINT unq_criterio_orden UNIQUE (id_ra, orden)
);

-- Nota del estudiante (0–5) en cada criterio, dentro de una oferta de curso.
-- Nivel de rúbrica (Alto 4.5–5.0, Medio 3.5–4.4, Básico 3.0–3.4, Insuficiente < 3.0); lo asigna
-- el servicio con modules/ra/rubrica.js. La FK compuesta impide calificar a quien no está inscrito
-- y desmatricular a quien ya tiene notas.
CREATE TABLE evaluaciones_ra_estudiante (
    id_evaluacion_ra BIGSERIAL PRIMARY KEY,
    id_curso INT NOT NULL,
    id_estudiante UUID NOT NULL,
    id_criterio INT NOT NULL REFERENCES rubricas_criterios(id_criterio) ON DELETE RESTRICT,
    id_docente UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    calificacion DECIMAL(3,2) NOT NULL CHECK (calificacion >= 0.00 AND calificacion <= 5.00),
    nivel tipo_nivel_logro NOT NULL,
    fecha_evaluacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP,
    FOREIGN KEY (id_curso, id_estudiante)
        REFERENCES curso_estudiantes(id_curso, id_estudiante) ON DELETE RESTRICT,
    CONSTRAINT unq_estudiante_criterio_curso UNIQUE (id_curso, id_estudiante, id_criterio)
);

CREATE INDEX idx_eval_ra_estudiante ON evaluaciones_ra_estudiante (id_estudiante);

-- Apertura de la calificación de rúbricas por semestre académico. Cada curso se evalúa al final
-- de su semestre; Coordinación abre y cierra la calificación. Un semestre sin fila está cerrado.
CREATE TABLE periodos_calificacion_ra (
    periodo periodo_academico PRIMARY KEY,
    abierto BOOLEAN NOT NULL DEFAULT FALSE,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_por UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

-- Total ponderado por (oferta, estudiante, RA). Solo suma: la clasificación en niveles y la
-- regla de completitud (calificados = criterios) se aplican en modules/ra/rubrica.js.
CREATE VIEW v_ra_resultados AS
SELECT e.id_curso,
       e.id_estudiante,
       rc.id_ra,
       ROUND(SUM(e.calificacion * rc.peso_porcentaje) / 100, 2) AS total,
       COUNT(*)::int AS calificados,
       (SELECT COUNT(*)::int FROM rubricas_criterios x WHERE x.id_ra = rc.id_ra) AS criterios
FROM evaluaciones_ra_estudiante e
JOIN rubricas_criterios rc USING (id_criterio)
GROUP BY e.id_curso, e.id_estudiante, rc.id_ra;

ALTER TABLE evaluacion_respuestas
    ADD CONSTRAINT evaluacion_respuestas_id_curso_fkey FOREIGN KEY (id_curso) REFERENCES cursos(id_curso);

-- Datos del Módulo 2 (idénticos a seed.sql)
-- Catálogo de cursos del plan de estudios (PEP, sección 3.3; Tablas 3 y 4 del documento RA).
-- El nombre es el vigente según el PEP; cada oferta puede tener un nombre propio (electivas).
INSERT INTO cursos_catalogo (codigo, nombre, id_modulo, semestre, orden)
SELECT c.codigo, c.nombre, m.id_modulo, c.semestre, c.orden
FROM (VALUES
  ('MaIE-CB1',      'Sistemas Lineales de Múltiples Variables',  'Básico',         1, 1),
  ('MaIE-CB2',      'Optimización',                              'Básico',         1, 2),
  ('MaIE-CP1',      'Introducción a la Profundización',          'Profundización', 1, 3),
  ('MaIE-CP2',      'Profundización II',                         'Profundización', 2, 4),
  ('MaIE-CP3',      'Profundización III',                        'Profundización', 2, 5),
  ('MaIE-CE1',      'Electiva I',                                'Electivo',       2, 6),
  ('MaIE-CE2',      'Electiva II',                               'Electivo',       3, 7),
  ('MaIE-CI1',      'Formulación de Proyectos de Investigación', 'Investigativo',  3, 8),
  ('MaIE-Tesis-I',  'Tesis I',                                   'Investigativo',  3, 9),
  ('MaIE-CI2',      'Redacción de Artículos Científicos',        'Investigativo',  4, 10),
  ('MaIE-Tesis-II', 'Tesis II',                                  'Investigativo',  4, 11)
) AS c(codigo, nombre, modulo, semestre, orden)
JOIN modulos_curriculares m ON m.nombre = c.modulo;

-- Estrategias de evaluación sugeridas por RA (Tabla 4)
INSERT INTO ra_estrategias (id_ra, id_estrategia)
SELECT r.id_ra, e.id_estrategia
FROM (VALUES
  ('RA1','E1'), ('RA2','E1'), ('RA2','E2'), ('RA3','E3'), ('RA4','E1'), ('RA4','E2'),
  ('RA5','E3'), ('RA5','E4'), ('RA5','E5'), ('RA5','E6'), ('RA6','E6'), ('RA7','E6')
) AS v(ra, est)
JOIN resultados_aprendizaje r ON r.codigo = v.ra
JOIN estrategias_evaluacion e ON e.codigo = v.est;

-- RA evaluado en cada curso y nivel de dominio esperado (Tabla 3; momentos de la Tabla 4).
-- RA6 y RA7: la Tabla 3 los ubica en Tesis II y la Tabla 4 en MaIE-CI2; se toman ambos cursos.
INSERT INTO catalogo_ra (id_catalogo, id_ra, nivel_dominio)
SELECT c.id_catalogo, r.id_ra, v.nivel
FROM (VALUES
  ('MaIE-CB1','RA1','Intermedio y avanzado'), ('MaIE-CB2','RA1','Intermedio y avanzado'),
  ('MaIE-CE1','RA2','Intermedio y avanzado'), ('MaIE-CE2','RA2','Intermedio y avanzado'),
  ('MaIE-CP1','RA3','Intermedio y avanzado'), ('MaIE-CI1','RA3','Intermedio y avanzado'),
  ('MaIE-CP2','RA4','Avanzado'),              ('MaIE-CP3','RA4','Avanzado'),
  ('MaIE-CI1','RA5','Intermedio y avanzado'), ('MaIE-CI2','RA5','Intermedio y avanzado'),
  ('MaIE-Tesis-I','RA5','Avanzado'),          ('MaIE-Tesis-II','RA5','Avanzado'),
  ('MaIE-CI2','RA6','Avanzado'),              ('MaIE-Tesis-II','RA6','Avanzado'),
  ('MaIE-CI2','RA7','Avanzado'),              ('MaIE-Tesis-II','RA7','Avanzado')
) AS v(curso, ra, nivel)
JOIN cursos_catalogo c ON c.codigo = v.curso
JOIN resultados_aprendizaje r ON r.codigo = v.ra;

-- En cada curso, el RA se evalúa con las estrategias sugeridas para ese RA
INSERT INTO catalogo_ra_estrategias (id_catalogo, id_ra, id_estrategia)
SELECT cr.id_catalogo, cr.id_ra, re.id_estrategia
FROM catalogo_ra cr
JOIN ra_estrategias re ON re.id_ra = cr.id_ra;

-- Rúbricas institucionales de RA1 a RA7 (Tablas 5 a 11), copiadas textualmente del documento
INSERT INTO rubricas_criterios (id_ra, orden, nombre_criterio, peso_porcentaje,
  desc_nivel_alto, desc_nivel_medio, desc_nivel_basico, desc_nivel_insuficiente) VALUES
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA1'), 1, 'Formulación del problema de ingeniería electrónica aplicando teoría de sistemas lineales u optimización', 25,
 'Identifica y formula correctamente problemas complejos, con pertinencia y claridad técnica.',
 'Formula problemas relevantes, con algunas imprecisiones técnicas.',
 'Formula problemas con limitaciones conceptuales importantes.',
 'No logra formular adecuadamente un problema o lo hace sin base teórica.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA1'), 2, 'Aplicación de conceptos de sistemas lineales u optimización a la solución del problema', 30,
 'Emplea rigurosamente modelos matemáticos y técnicas adecuadas con una clara relación al problema planteado.',
 'Aplica modelos adecuados, aunque con limitaciones en su interpretación o justificación.',
 'Aplica algunos conceptos, pero con errores o sin coherencia con el problema.',
 'Aplica modelos incorrectos o no fundamenta su aplicación.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA1'), 3, 'Análisis e interpretación de resultados obtenidos en la solución del problema', 25,
 'Analiza críticamente los resultados, interpreta su validez y limita en contexto de la ingeniería electrónica.',
 'Interpreta los resultados con cierta profundidad, pero sin análisis crítico completo.',
 'Presenta interpretación limitada o superficial de los resultados.',
 'No interpreta los resultados o lo hace incorrectamente.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA1'), 4, 'Presentación escrita y/o oral del proceso y solución del problema', 20,
 'Comunicación clara, estructurada y técnicamente precisa, con uso adecuado de lenguaje especializado y herramientas gráficas o simbólicas.',
 'Presentación clara, pero con debilidades menores en estructura o lenguaje técnico.',
 'Presentación poco estructurada o con uso impreciso del lenguaje técnico.',
 'Presentación deficiente o incomprensible.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA2'), 1, 'Selección y justificación de métodos y herramientas avanzadas', 25,
 'Selecciona con criterio sólido y justifica claramente métodos y herramientas de vanguardia pertinentes al problema.',
 'Selecciona herramientas adecuadas, con justificación parcial o incompleta.',
 'Selecciona herramientas con fundamentos débiles o no pertinentes.',
 'No selecciona herramientas adecuadas o no justifica su uso.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA2'), 2, 'Aplicación efectiva de métodos y herramientas en la solución del problema', 30,
 'Aplica de manera precisa y eficiente los métodos y herramientas, evidenciando dominio técnico y contextual.',
 'Aplica los métodos de forma funcional, aunque con limitaciones técnicas menores.',
 'Aplica métodos con errores o sin lograr resolver el problema adecuadamente.',
 'No aplica los métodos correctamente o fracasa en su ejecución.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA2'), 3, 'Integración de conocimientos de otras disciplinas en el proceso de solución', 25,
 'Integra de forma efectiva y pertinente conocimientos interdisciplinares, enriqueciendo la solución propuesta.',
 'Integra algunos elementos interdisciplinarios con pertinencia parcial.',
 'Integra pocos elementos de otras disciplinas con relevancia limitada.',
 'No integra conocimientos de otras disciplinas o lo hace sin coherencia.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA2'), 4, 'Comunicación del proceso de análisis y solución del problema', 20,
 'Presenta el proceso con claridad, rigor técnico y coherencia lógica, utilizando un lenguaje profesional adecuado.',
 'Comunica el proceso de manera comprensible, aunque con leves debilidades en estructura o lenguaje técnico.',
 'Presentación con estructura poco clara o lenguaje técnico insuficiente.',
 'Presentación deficiente o sin coherencia argumentativa.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA3'), 1, 'Identificación de una problemática de investigación relevante para la sociedad', 30,
 'Identifica con claridad y precisión una problemática pertinente, con sustento en evidencias sociales y tecnológicas actuales.',
 'Identifica una problemática relevante, aunque con sustento parcial o limitado.',
 'Identifica una problemática poco clara o con pertinencia limitada.',
 'No logra identificar una problemática o la identificada carece de relevancia.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA3'), 2, 'Análisis de la problemática en el contexto de las líneas de investigación', 30,
 'Analiza la problemática con profundidad, articulándola adecuadamente con las líneas de investigación de la ingeniería electrónica.',
 'Analiza la problemática con conexión parcial a las líneas de investigación.',
 'Análisis limitado o superficial, con escasa articulación disciplinar.',
 'No realiza análisis o lo hace sin relación con las líneas de investigación.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA3'), 3, 'Pertinencia y relevancia social de la problemática analizada', 20,
 'Demuestra la importancia social de la problemática y su impacto potencial, contextualizando su análisis con datos o estudios actuales.',
 'Muestra cierta relación con necesidades sociales, aunque sin profundización completa.',
 'Relaciona superficialmente la problemática con aspectos sociales.',
 'No demuestra pertinencia social en el análisis.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA3'), 4, 'Presentación y argumentación del análisis', 20,
 'Presenta el análisis de forma clara, estructurada y con argumentos sólidos y pertinentes.',
 'Presentación clara con algunos argumentos débiles o sin soporte suficiente.',
 'Presentación poco estructurada o con argumentos limitados.',
 'Presentación desorganizada o sin argumentación clara.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA4'), 1, 'Definición precisa del problema complejo y su contexto', 25,
 'Delimita claramente el problema, considerando sus dinámicas particulares y contexto interdisciplinar.',
 'Delimita el problema con claridad parcial o con limitaciones contextuales.',
 'Delimita el problema de forma superficial o poco clara.',
 'No logra delimitar el problema o lo presenta sin claridad.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA4'), 2, 'Uso adecuado de conocimientos y técnicas avanzadas', 25,
 'Aplica conocimientos y técnicas avanzadas pertinentes con dominio técnico y rigor metodológico.',
 'Aplica técnicas con algunos aciertos, pero sin consistencia total.',
 'Aplica técnicas con limitaciones técnicas o conceptuales importantes.',
 'No aplica correctamente las técnicas o evidencia desconocimiento.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA4'), 3, 'Articulación de la solución con líneas de investigación', 25,
 'Integra de manera efectiva los enfoques de investigación pertinentes desde la ingeniería electrónica y otras disciplinas.',
 'Incluye elementos investigativos relevantes, aunque con articulación parcial.',
 'Poca conexión con las líneas de investigación, con aportes limitados.',
 'No articula la solución con líneas de investigación pertinentes.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA4'), 4, 'Impacto y contribución de la solución al desarrollo investigativo', 25,
 'La solución propuesta tiene alto potencial de impacto y genera nuevo conocimiento o aplicaciones significativas.',
 'La solución tiene impacto limitado, pero evidencia un enfoque investigativo claro.',
 'Impacto poco claro o contribución investigativa débil.',
 'La solución carece de impacto investigativo o no está fundamentada.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA5'), 1, 'Identificación y formulación de la problemática regional o social', 25,
 'Formula una problemática clara, relevante y contextualizada con evidencia del entorno regional o social.',
 'Formula una problemática relevante, con contextualización parcial.',
 'La problemática es poco clara o escasamente contextualizada.',
 'La formulación es confusa o no guarda relación con el entorno.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA5'), 2, 'Estructuración coherente del proyecto de investigación', 25,
 'El proyecto está bien estructurado, con coherencia entre problema, objetivos, metodología y resultados esperados.',
 'El proyecto está estructurado, aunque con algunos vacíos o desconexiones entre sus partes.',
 'Estructura débil o con problemas importantes de coherencia.',
 'El proyecto carece de estructura o es inconsistente.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA5'), 3, 'Gestión del proyecto (viabilidad, recursos, articulación institucional)', 25,
 'Presenta una estrategia clara de gestión, incluyendo aspectos logísticos, financieros y de articulación institucional.',
 'Plantea una estrategia viable con algunos elementos faltantes o poco claros.',
 'Gestión poco detallada o poco viable.',
 'No presenta una estrategia de gestión clara o es inviable.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA5'), 4, 'Impacto potencial en el desarrollo humano, social, científico o tecnológico', 25,
 'La solución propuesta tiene alto potencial transformador y promueve el desarrollo regional y disciplinar.',
 'La solución muestra impacto limitado, pero pertinente para su contexto.',
 'El impacto es poco claro o solo marginal.',
 'No se evidencia impacto relevante en el desarrollo.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA6'), 1, 'Reconocimiento de principios éticos y profesionales en la investigación', 25,
 'Identifica claramente los principios éticos y profesionales aplicables y demuestra comprensión crítica de ellos.',
 'Reconoce los principios básicos, con comprensión general del contexto ético.',
 'Reconocimiento parcial o limitado de los principios éticos y profesionales.',
 'Desconoce o malinterpreta principios éticos fundamentales.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA6'), 2, 'Aplicación de principios éticos en el desarrollo del proyecto o investigación', 25,
 'Aplica rigurosamente los principios éticos en todas las fases del trabajo investigativo.',
 'Aplica los principios éticos de manera general, aunque con omisiones menores.',
 'Aplicación limitada o poco sistemática de la ética en el proceso investigativo.',
 'No aplica los principios éticos o incurre en prácticas cuestionables.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA6'), 3, 'Compromiso con la generación de nuevo conocimiento pertinente y responsable', 25,
 'Muestra compromiso con la producción de conocimiento útil y respetuoso del entorno social y científico.',
 'El compromiso es evidente, aunque con limitaciones en su argumentación o justificación.',
 'Compromiso parcial o poco evidente en el desarrollo del trabajo.',
 'No evidencia compromiso con la generación responsable de conocimiento.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA6'), 4, 'Proyección social del trabajo investigativo hacia la región', 25,
 'Articula de manera clara el impacto social y regional de la investigación, con argumentos sólidos.',
 'Presenta la proyección social con coherencia parcial o limitada al contexto regional.',
 'Proyección poco clara o poco relevante para el entorno regional.',
 'No se evidencia intención de proyección social o regional.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA7'), 1, 'Selección y justificación de métodos y herramientas avanzadas', 25,
 'Selecciona y justifica con solidez métodos y herramientas pertinentes, mostrando conocimiento actualizado.',
 'Selecciona herramientas adecuadas con justificación parcial o limitada.',
 'La selección es poco fundamentada o presenta errores conceptuales.',
 'No selecciona herramientas pertinentes o no presenta justificación.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA7'), 2, 'Aplicación efectiva de los métodos y herramientas seleccionadas', 30,
 'Aplica con precisión y dominio técnico los métodos, demostrando capacidad de resolución y análisis.',
 'Aplica los métodos de forma funcional, con algunas debilidades técnicas.',
 'Aplicación parcial, con errores o sin relación clara con el problema.',
 'No aplica correctamente los métodos o hay incoherencias graves.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA7'), 3, 'Integración de conocimientos interdisciplinarios en la solución del problema', 25,
 'Integra de forma pertinente conocimientos de otras disciplinas que enriquecen la comprensión del problema.',
 'Integra algunos elementos externos, aunque sin una articulación completa.',
 'La integración es limitada o no aporta significativamente a la solución.',
 'No se evidencian aportes interdisciplinarios en la solución.'),
((SELECT id_ra FROM resultados_aprendizaje WHERE codigo = 'RA7'), 4, 'Análisis de resultados y validación de la solución propuesta', 20,
 'Analiza los resultados con solidez técnica y fundamentación lógica, validando su efectividad en el contexto del problema.',
 'Analiza los resultados de forma general, aunque con algunas imprecisiones en la validación.',
 'Análisis limitado o débilmente fundamentado.',
 'No realiza análisis o los resultados no están justificados.');

INSERT INTO parametros_programa (clave, valor, descripcion) VALUES
('meta_ra_satisfactorio_pct', 70, '% mínimo de estudiantes en nivel Alto o Medio para que un RA se considere cumplido')
ON CONFLICT (clave) DO NOTHING;

COMMIT;
