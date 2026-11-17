-- Migración 2026-11-16: Módulo 3 (Evaluación Docente, Acuerdo 058 de 2022).
-- Reemplaza el esqueleto del Módulo 3 (tablas evaluacion_* sin uso) por el modelo definitivo:
-- habilitación por semestre, instrumentos EE/EC/AE, estudiantes de pregrado por oferta, respuestas
-- anónimas del EE con constancia separada, y EC/AE nominales.
-- Uso (con respaldo previo):  psql -v ON_ERROR_STOP=1 -d <bd> -f 2026-11-16_modulo3_evaluacion_docente.sql
BEGIN;

-- El esqueleto anterior no tenía datos; si los tuviera, se aborta para no perderlos.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM evaluacion_respuestas) + (SELECT COUNT(*) FROM evaluacion_resultados_docente)
     + (SELECT COUNT(*) FROM evaluacion_periodos) > 0 THEN
    RAISE EXCEPTION 'Las tablas evaluacion_* del esqueleto tienen datos: revise antes de migrar';
  END IF;
END $$;

DROP TABLE IF EXISTS evaluacion_resultados_docente;
DROP TABLE IF EXISTS evaluacion_respuestas;
DROP TABLE IF EXISTS evaluacion_preguntas;
DROP TABLE IF EXISTS evaluacion_periodos;

CREATE TYPE tipo_valoracion_058 AS ENUM ('MA', 'A', 'I', 'MI', 'NA'); -- Art. 1: NA = No aplica / No responde

-- Habilitación por semestre académico (dentro del Módulo 3, separada de la apertura de rúbricas del
-- Módulo 2). Un semestre sin fila no está habilitado. Las fechas son el cronograma que Coordinación
-- informa (Art. 10); si están, las respuestas solo se reciben entre ellas.
CREATE TABLE evaluacion_periodos (
    periodo periodo_academico PRIMARY KEY,
    habilitada BOOLEAN NOT NULL DEFAULT FALSE,
    incluye_pregrado BOOLEAN NOT NULL DEFAULT FALSE,   -- también evalúan los estudiantes de pregrado
    fecha_apertura DATE,
    fecha_cierre DATE,
    -- Parágrafo 2 del Art. 12: excluir respuestas extremas (todo MA o todo MI) si la unidad tiene más de
    -- 10 respuestas. Opción de Coordinación, no automática.
    excluir_extremas BOOLEAN NOT NULL DEFAULT FALSE,
    publicado BOOLEAN NOT NULL DEFAULT FALSE,           -- RF-EVAL-05: el docente ve sus resultados
    publicado_en TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_por UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    CONSTRAINT chk_fechas_evaluacion CHECK (fecha_cierre IS NULL OR fecha_apertura IS NULL OR fecha_cierre >= fecha_apertura),
    CONSTRAINT chk_publicada_cerrada CHECK (NOT (publicado AND habilitada))
);

-- Instrumentos de los Art. 4 (EE), 5 (EC) y 6 (AE). `caracteristica` 0 = «Autoevaluación del estudiante»
-- (preguntas 0.1–0.4 del EE): evalúa al estudiante, se recoge pero no entra en los indicadores del docente.
CREATE TABLE evaluacion_preguntas (
    id_pregunta SERIAL PRIMARY KEY,
    tipo_formulario tipo_formulario_eval NOT NULL,
    caracteristica SMALLINT NOT NULL CHECK (caracteristica BETWEEN 0 AND 9),
    nombre_caracteristica VARCHAR(120) NOT NULL,
    codigo VARCHAR(10) NOT NULL,          -- numeración del Acuerdo: '1.1', '0.3'…
    orden SMALLINT NOT NULL,
    texto TEXT NOT NULL,
    escala TEXT,                          -- rangos MA/A/I/MI propios de la pregunta (solo 0.x)
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT unq_pregunta_codigo UNIQUE (tipo_formulario, codigo),
    CONSTRAINT unq_pregunta_orden UNIQUE (tipo_formulario, orden)
);

-- Estudiantes de pregrado que toman cursos de la maestría (lista por semestre, promoción y curso: la
-- oferta ya fija los tres). Van aparte de curso_estudiantes para no entrar en las rúbricas de RA.
CREATE TABLE curso_estudiantes_pregrado (
    id_curso INT REFERENCES cursos(id_curso) ON DELETE CASCADE,
    id_estudiante UUID REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    programa VARCHAR(150),                -- programa de pregrado de origen
    estado VARCHAR(20) NOT NULL DEFAULT 'inscrito' CHECK (estado IN ('inscrito', 'retirado')),
    PRIMARY KEY (id_curso, id_estudiante)
);

-- Respuestas. Las del EE son ANÓNIMAS: no guardan evaluador, ni fecha, ni un identificador ordenable
-- (UUID aleatorio), solo la unidad evaluada y la población (posgrado/pregrado). Las de EC y AE sí guardan
-- quién respondió (Coordinación y el propio docente) y se pueden corregir mientras el semestre está abierto.
CREATE TABLE evaluacion_respuestas (
    id_respuesta UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    periodo periodo_academico NOT NULL REFERENCES evaluacion_periodos(periodo) ON DELETE RESTRICT,
    tipo_formulario tipo_formulario_eval NOT NULL,
    id_docente UUID NOT NULL REFERENCES docentes_perfil(id_docente) ON DELETE RESTRICT, -- conserva el histórico
    id_cohorte INT NOT NULL REFERENCES cohortes(id_cohorte) ON DELETE RESTRICT,
    poblacion VARCHAR(10) CHECK (poblacion IN ('posgrado', 'pregrado')),
    id_evaluador UUID REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    comentario TEXT,                      -- Art. 7: opiniones, sugerencias y recomendaciones
    actualizado_en TIMESTAMP,             -- solo EC y AE
    CONSTRAINT chk_anonimato_ee CHECK (
        (tipo_formulario = 'EE' AND id_evaluador IS NULL AND actualizado_en IS NULL AND poblacion IS NOT NULL)
        OR (tipo_formulario <> 'EE' AND poblacion IS NULL))
);
-- Una EC y una AE por unidad evaluada y semestre.
CREATE UNIQUE INDEX unq_respuesta_ec_ae ON evaluacion_respuestas (periodo, tipo_formulario, id_docente, id_cohorte)
    WHERE tipo_formulario <> 'EE';
CREATE INDEX idx_respuestas_periodo ON evaluacion_respuestas (periodo, tipo_formulario);

CREATE TABLE evaluacion_respuesta_items (
    id_respuesta UUID REFERENCES evaluacion_respuestas(id_respuesta) ON DELETE CASCADE,
    id_pregunta INT REFERENCES evaluacion_preguntas(id_pregunta) ON DELETE RESTRICT,
    valor tipo_valoracion_058 NOT NULL,
    PRIMARY KEY (id_respuesta, id_pregunta)
);

-- Constancia de que un estudiante ya evaluó a un docente en el semestre: solo impide responder dos veces
-- y alimenta el avance. No guarda al estudiante ni al docente, sino una HUELLA = HMAC-SHA256(EVAL_SECRETO,
-- 'periodo|id_estudiante|id_docente') (modules/evalDocente/anonimato.js): sin la clave del servidor no
-- revela quién evaluó a quién. Al cerrar o publicar el semestre, las respuestas EE se reescriben en orden
-- aleatorio (barajarEE) para que tampoco compartan transacción ni orden físico con su constancia.
CREATE TABLE evaluacion_constancias (
    periodo periodo_academico NOT NULL REFERENCES evaluacion_periodos(periodo) ON DELETE RESTRICT,
    huella CHAR(64) NOT NULL CHECK (huella ~ '^[0-9a-f]{64}$'),
    PRIMARY KEY (periodo, huella)
);

-- Módulo 3: instrumentos del Acuerdo 058 de 2022 (Art. 4 EE, Art. 5 EC, Art. 6 AE), con su numeración.
INSERT INTO evaluacion_preguntas (tipo_formulario, caracteristica, nombre_caracteristica, codigo, orden, texto, escala) VALUES
('EE', 0, 'Autoevaluación del estudiante', '0.1', 1, 'Dedico tiempo de trabajo independiente al curso.', 'MA: 12–10 h/semana; A: 9–6 h/semana; I: 5–3 h/semana; MI: 2 h/semana o menos'),
('EE', 0, 'Autoevaluación del estudiante', '0.2', 2, 'Poseo conocimiento necesario al iniciar el curso.', 'MA: suficiente; A: aceptable; I: insuficiente; MI: nulo'),
('EE', 0, 'Autoevaluación del estudiante', '0.3', 3, 'He asistido a clases presenciales y/o virtuales.', 'MA: 100–90 %; A: 89–60 %; I: 59–40 %; MI: 39 % o menos'),
('EE', 0, 'Autoevaluación del estudiante', '0.4', 4, 'He cumplido con los compromisos del curso.', 'MA: 100–90 %; A: 89–70 %; I: 69–40 %; MI: 39 % o menos'),
('EE', 1, 'Cumplimiento del docente', '1.1', 5, 'Presenta oportunamente el plan de trabajo o contenido programático del curso.', NULL),
('EE', 1, 'Cumplimiento del docente', '1.2', 6, 'Cumple con el plan de trabajo o temáticas propuestas en el curso.', NULL),
('EE', 1, 'Cumplimiento del docente', '1.3', 7, 'Cumple con el horario de clase.', NULL),
('EE', 1, 'Cumplimiento del docente', '1.4', 8, 'Atiende las consultas extraclase.', NULL),
('EE', 2, 'Conocimientos del docente', '2.1', 9, 'Desarrolla con claridad los contenidos o temáticas del curso.', NULL),
('EE', 2, 'Conocimientos del docente', '2.2', 10, 'Contextualiza las temáticas y actividades del curso en el área de la Ingeniería Electrónica y sus líneas de investigación.', NULL),
('EE', 2, 'Conocimientos del docente', '2.3', 11, 'Brinda recursos bibliográficos pertinentes con las temáticas del curso.', NULL),
('EE', 2, 'Conocimientos del docente', '2.4', 12, 'Socializa aportes propios en su campo de experiencia y línea de investigación.', NULL),
('EE', 3, 'Aporte a la investigación del docente', '3.1', 13, 'Identifica problemas de investigación en contextos locales, nacionales e internacionales.', NULL),
('EE', 3, 'Aporte a la investigación del docente', '3.2', 14, 'Incentiva la construcción de nuevos saberes y opiniones alrededor de las temáticas del curso.', NULL),
('EE', 3, 'Aporte a la investigación del docente', '3.3', 15, 'Promueve el desarrollo de habilidades comunicativas orales y escritas (en español e inglés).', NULL),
('EE', 3, 'Aporte a la investigación del docente', '3.4', 16, 'Estimula el análisis crítico de diversas fuentes de información e investigación científicas.', NULL),
('EE', 3, 'Aporte a la investigación del docente', '3.5', 17, 'Fomenta el trabajo colaborativo y en grupos.', NULL),
('EE', 3, 'Aporte a la investigación del docente', '3.6', 18, 'Conjuga el análisis de problemas académicos e investigativos con el concurso de diferentes disciplinas.', NULL),
('EE', 4, 'Metodología del docente', '4.1', 19, 'Utiliza eficientemente los recursos didácticos y tecnológicos disponibles, en concordancia con la naturaleza del curso.', NULL),
('EE', 4, 'Metodología del docente', '4.2', 20, 'Aplica estrategias didácticas, en concordancia con la naturaleza del curso, para facilitar la apropiación de conocimiento.', NULL),
('EE', 4, 'Metodología del docente', '4.3', 21, 'Incentiva con respeto la participación de los estudiantes en las actividades del curso.', NULL),
('EE', 4, 'Metodología del docente', '4.4', 22, 'Promueve el desarrollo de valores democráticos acordes con la misión y visión de la Universidad de Nariño y el programa.', NULL),
('EE', 5, 'Evaluación realizada a los estudiantes', '5.1', 23, 'Respeta los acuerdos sobre los tipos de evaluación concertados con los estudiantes.', NULL),
('EE', 5, 'Evaluación realizada a los estudiantes', '5.2', 24, 'Cumple con las fechas programadas para la realización de las evaluaciones.', NULL),
('EE', 5, 'Evaluación realizada a los estudiantes', '5.3', 25, 'Realiza evaluaciones coherentes con las temáticas y actividades del curso.', NULL),
('EE', 5, 'Evaluación realizada a los estudiantes', '5.4', 26, 'Hace recomendaciones formativas y oportunas a los estudiantes a partir de los resultados de las evaluaciones.', NULL),
('EE', 5, 'Evaluación realizada a los estudiantes', '5.5', 27, 'Resuelve oportunamente reclamos de los estudiantes sobre las evaluaciones.', NULL),
('EE', 6, 'Contribución al clima organizacional', '6.1', 28, 'Trata a los estudiantes con respeto y equidad.', NULL),
('EE', 6, 'Contribución al clima organizacional', '6.2', 29, 'Asume un comportamiento acorde con su posición como docente e investigador.', NULL),
('EE', 6, 'Contribución al clima organizacional', '6.3', 30, 'Respeta las posiciones teóricas, conceptuales y metodológicas diferentes a la suya.', NULL),
('EC', 1, 'Relaciones interpersonales', '1.1', 1, 'Trata a sus homólogos con dignidad y respeto.', NULL),
('EC', 1, 'Relaciones interpersonales', '1.2', 2, 'Asume un comportamiento ético acorde con su labor como docente e investigador.', NULL),
('EC', 1, 'Relaciones interpersonales', '1.3', 3, 'Tiene disposición al diálogo y comunicación.', NULL),
('EC', 1, 'Relaciones interpersonales', '1.4', 4, 'Comparte de manera generosa sus conocimientos.', NULL),
('EC', 1, 'Relaciones interpersonales', '1.5', 5, 'Cumple oportunamente con los requisitos administrativos e informes que se le exigen desde el programa.', NULL),
('EC', 2, 'Reconocimiento académico e investigativo', '2.1', 6, 'Posee autoridad académica en su área de experiencia y línea de investigación.', NULL),
('EC', 2, 'Reconocimiento académico e investigativo', '2.2', 7, 'Presenta una suficiente producción científica en su área de experiencia y línea de investigación.', NULL),
('EC', 2, 'Reconocimiento académico e investigativo', '2.3', 8, 'Participa en comunidades o agrupaciones que fomentan la academia y la investigación científica.', NULL),
('EC', 2, 'Reconocimiento académico e investigativo', '2.4', 9, 'Asume con responsabilidad los compromisos académicos e investigativos que se dinamizan desde el programa.', NULL),
('EC', 2, 'Reconocimiento académico e investigativo', '2.5', 10, 'Hace propuestas académicas e investigativas para el programa desde su área de experiencia y línea de investigación.', NULL),
('AE', 1, 'Cumplimiento', '1.1', 1, 'Concierto oportunamente el plan de trabajo del curso.', NULL),
('AE', 1, 'Cumplimiento', '1.2', 2, 'Cumplo oportunamente con las actividades académicas concertadas con los estudiantes del curso.', NULL),
('AE', 1, 'Cumplimiento', '1.3', 3, 'Atiendo oportunamente a los estudiantes en consultas extraclase.', NULL),
('AE', 2, 'Conocimientos', '2.1', 4, 'Desarrollo con claridad las temáticas y actividades del curso.', NULL),
('AE', 2, 'Conocimientos', '2.2', 5, 'Contextualizo las temáticas y actividades del curso en el área de la Ingeniería Electrónica y sus líneas de investigación.', NULL),
('AE', 2, 'Conocimientos', '2.3', 6, 'Socializo aportes propios en mi campo de experiencia y línea de investigación.', NULL),
('AE', 3, 'Aporte a la investigación', '3.1', 7, 'Aporto a la identificación de problemas de investigación en contextos locales, nacionales e internacionales.', NULL),
('AE', 3, 'Aporte a la investigación', '3.2', 8, 'Incentivo la construcción de nuevos saberes y opiniones alrededor de las temáticas del curso.', NULL),
('AE', 3, 'Aporte a la investigación', '3.3', 9, 'Facilito el desarrollo de habilidades comunicativas orales y escritas (en español e inglés).', NULL),
('AE', 3, 'Aporte a la investigación', '3.4', 10, 'Promuevo el análisis crítico de diversas fuentes de información e investigación científicas.', NULL),
('AE', 3, 'Aporte a la investigación', '3.5', 11, 'Fomento el trabajo colaborativo y en grupos.', NULL),
('AE', 3, 'Aporte a la investigación', '3.6', 12, 'Conjugo el análisis de problemas académicos e investigativos con el concurso de diferentes disciplinas.', NULL),
('AE', 4, 'Metodología', '4.1', 13, 'Utilizo eficientemente los recursos didácticos y tecnológicos disponibles, en concordancia con la naturaleza del curso.', NULL),
('AE', 4, 'Metodología', '4.2', 14, 'Aplico estrategias didácticas, en concordancia con la naturaleza del curso, para facilitar la apropiación de conocimiento.', NULL),
('AE', 4, 'Metodología', '4.3', 15, 'Promuevo con respeto la participación de los estudiantes en las actividades del curso.', NULL),
('AE', 4, 'Metodología', '4.4', 16, 'Promuevo el desarrollo de valores democráticos acordes con la misión y visión de la Universidad de Nariño y el programa.', NULL),
('AE', 5, 'Evaluación aplicada a los estudiantes', '5.1', 17, 'Respeto los acuerdos sobre los tipos de evaluación concertados con los estudiantes.', NULL),
('AE', 5, 'Evaluación aplicada a los estudiantes', '5.2', 18, 'Cumplo con las fechas programadas para la realización de las evaluaciones.', NULL),
('AE', 5, 'Evaluación aplicada a los estudiantes', '5.3', 19, 'Realizo evaluaciones coherentes con las temáticas y actividades del curso.', NULL),
('AE', 5, 'Evaluación aplicada a los estudiantes', '5.4', 20, 'Hago recomendaciones formativas y oportunas a los estudiantes a partir de los resultados de las evaluaciones.', NULL),
('AE', 5, 'Evaluación aplicada a los estudiantes', '5.5', 21, 'Resuelvo oportunamente reclamos de los estudiantes sobre las evaluaciones.', NULL),
('AE', 6, 'Contribución al clima organizacional', '6.1', 22, 'Trato a los estudiantes con respeto y equidad.', NULL),
('AE', 6, 'Contribución al clima organizacional', '6.2', 23, 'Asumo un comportamiento ético acorde con mi labor como docente e investigador.', NULL),
('AE', 6, 'Contribución al clima organizacional', '6.3', 24, 'Respeto las posiciones teóricas, conceptuales y metodológicas diferentes a la mía.', NULL);

COMMIT;
