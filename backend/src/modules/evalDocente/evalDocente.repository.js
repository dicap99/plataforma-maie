// Acceso a datos compartido del Módulo 3 (Evaluación Docente, Acuerdo 058).
// Tablas: evaluacion_periodos, evaluacion_preguntas, evaluacion_respuestas(_items), evaluacion_constancias,
// curso_estudiantes_pregrado; y del Módulo 1: cursos, curso_docentes, curso_estudiantes, cohortes.
const db = require('../../config/db');

const q = (cliente) => cliente ?? db;

// ---- Habilitación por semestre ----------------------------------------------------------------
const COLUMNAS_PERIODO = `periodo, habilitada, incluye_pregrado, fecha_apertura, fecha_cierre, excluir_extremas,
  publicado, publicado_en, actualizado_en`;

const periodo = async (p, cliente) =>
  (await q(cliente).query(`SELECT ${COLUMNAS_PERIODO} FROM evaluacion_periodos WHERE periodo = $1`, [p])).rows[0] ?? null;

const periodos = async () => (await db.query(`SELECT ${COLUMNAS_PERIODO} FROM evaluacion_periodos ORDER BY periodo DESC`)).rows;

// Semestres con ofertas o con habilitación registrada.
const semestresConOfertas = async () =>
  (await db.query(`SELECT periodo FROM cursos UNION SELECT periodo FROM evaluacion_periodos ORDER BY periodo DESC`)).rows.map((r) => r.periodo);

const guardarPeriodo = async (p, datos, idUsuario) => {
  const campos = ['habilitada', 'incluye_pregrado', 'fecha_apertura', 'fecha_cierre', 'excluir_extremas', 'publicado']
    .filter((c) => datos[c] !== undefined);
  const valores = campos.map((c) => datos[c]);
  const insertar = campos.length ? `, ${campos.join(', ')}` : '';
  const marcadores = campos.map((_, i) => `, $${i + 3}`).join('');
  const actualizar = campos.map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  const publicadoEn = datos.publicado === undefined ? '' : `, publicado_en = CASE WHEN EXCLUDED.publicado THEN CURRENT_TIMESTAMP END`;
  return (await db.query(
    `INSERT INTO evaluacion_periodos (periodo, actualizado_por${insertar}) VALUES ($1, $2${marcadores})
     ON CONFLICT (periodo) DO UPDATE SET actualizado_en = CURRENT_TIMESTAMP, actualizado_por = EXCLUDED.actualizado_por
       ${actualizar ? `, ${actualizar}` : ''}${publicadoEn}
     RETURNING ${COLUMNAS_PERIODO}`,
    [p, idUsuario, ...valores],
  )).rows[0];
};

// ---- Asignación docente–curso del semestre (Módulo 1) ------------------------------------------
// Ofertas del semestre con sus docentes: [{ id_curso, id_cohorte, cohorte, cohorte_inicio, clase, docentes }]
const ofertas = async (p) =>
  (await db.query(`
    SELECT c.id_curso, c.id_cohorte, h.nombre AS cohorte, h.periodo_inicio AS cohorte_inicio, cl.nombre AS clase,
           COALESCE(json_agg(json_build_object('id_docente', d.id_docente, 'id_usuario', d.id_usuario,
             'nombre', d.nombre_completo, 'afiliacion', d.afiliacion) ORDER BY d.nombre_completo)
             FILTER (WHERE d.id_docente IS NOT NULL), '[]') AS docentes
    FROM cursos c
    JOIN cohortes h ON h.id_cohorte = c.id_cohorte
    JOIN clases cl ON cl.id_clase = c.id_clase
    LEFT JOIN curso_docentes cd ON cd.id_curso = c.id_curso
    LEFT JOIN docentes_perfil d ON d.id_docente = cd.id_docente
    WHERE c.periodo = $1
    GROUP BY c.id_curso, h.nombre, h.periodo_inicio, cl.nombre
    ORDER BY h.periodo_inicio, cl.nombre`, [p])).rows;

// Inscripciones de posgrado del semestre con el estado del estudiante en su promoción.
const inscripcionesPosgrado = async (p, idEstudiante = null) =>
  (await db.query(`
    SELECT ce.id_curso, ce.id_estudiante, u.activo, he.id_cohorte AS id_cohorte_estudiante, he.estado AS estado_promocion
    FROM curso_estudiantes ce
    JOIN cursos c ON c.id_curso = ce.id_curso
    JOIN usuarios u ON u.id_usuario = ce.id_estudiante
    LEFT JOIN LATERAL (SELECT x.id_cohorte, x.estado FROM cohorte_estudiantes x JOIN cohortes k USING (id_cohorte)
                       WHERE x.id_estudiante = ce.id_estudiante ORDER BY k.periodo_inicio DESC LIMIT 1) he ON TRUE
    WHERE c.periodo = $1 AND ($2::uuid IS NULL OR ce.id_estudiante = $2)`, [p, idEstudiante])).rows;

const inscripcionesPregrado = async (p, idEstudiante = null) =>
  (await db.query(`
    SELECT cp.id_curso, cp.id_estudiante, cp.estado, u.activo
    FROM curso_estudiantes_pregrado cp
    JOIN cursos c ON c.id_curso = cp.id_curso
    JOIN usuarios u ON u.id_usuario = cp.id_estudiante
    WHERE c.periodo = $1 AND ($2::uuid IS NULL OR cp.id_estudiante = $2)`, [p, idEstudiante])).rows;

// Perfil docente vinculado a una cuenta (o null).
const docentePropio = async (idUsuario) =>
  (await db.query('SELECT id_docente FROM docentes_perfil WHERE id_usuario = $1', [idUsuario])).rows[0]?.id_docente ?? null;

// ---- Instrumentos -----------------------------------------------------------------------------
const preguntas = async (tipo = null) =>
  (await db.query(`
    SELECT id_pregunta, tipo_formulario, caracteristica, nombre_caracteristica, codigo, orden, texto, escala
    FROM evaluacion_preguntas WHERE activa AND ($1::tipo_formulario_eval IS NULL OR tipo_formulario = $1)
    ORDER BY tipo_formulario, orden`, [tipo])).rows;

// ---- Respuestas -------------------------------------------------------------------------------
// Respuestas con sus valoraciones ({ id_pregunta: valor }). Nunca devuelve el evaluador del EE (no existe).
const respuestas = async ({ periodo: p = null, idDocente = null, tipos = null } = {}) =>
  (await db.query(`
    SELECT r.periodo, r.tipo_formulario, r.id_docente, r.id_cohorte, r.poblacion, r.comentario,
           COALESCE(json_object_agg(i.id_pregunta, i.valor) FILTER (WHERE i.id_pregunta IS NOT NULL), '{}') AS items
    FROM evaluacion_respuestas r
    LEFT JOIN evaluacion_respuesta_items i ON i.id_respuesta = r.id_respuesta
    WHERE ($1::varchar IS NULL OR r.periodo = $1) AND ($2::uuid IS NULL OR r.id_docente = $2)
      AND ($3::text[] IS NULL OR r.tipo_formulario::text = ANY($3))
    GROUP BY r.id_respuesta
    ORDER BY r.periodo, r.tipo_formulario, r.id_docente, r.id_cohorte, md5(r.id_respuesta::text)`, [p, idDocente, tipos])).rows;

// Datos de docentes y promociones que aparecen en respuestas (para unidades sin oferta vigente).
const unidadesConRespuestas = async ({ periodo: p = null, idDocente = null } = {}) =>
  (await db.query(`
    SELECT DISTINCT r.periodo, r.id_docente, d.nombre_completo AS docente, d.afiliacion, d.id_usuario AS id_usuario_docente,
           r.id_cohorte, h.nombre AS cohorte, h.periodo_inicio AS cohorte_inicio
    FROM evaluacion_respuestas r
    JOIN docentes_perfil d ON d.id_docente = r.id_docente
    JOIN cohortes h ON h.id_cohorte = r.id_cohorte
    WHERE ($1::varchar IS NULL OR r.periodo = $1) AND ($2::uuid IS NULL OR r.id_docente = $2)`, [p, idDocente])).rows;

// Cuáles de las huellas dadas ya tienen constancia en el semestre (anonimato.js).
const constanciasDe = async (p, huellas) =>
  new Set((await db.query('SELECT huella FROM evaluacion_constancias WHERE periodo = $1 AND huella = ANY($2::text[])', [p, huellas]))
    .rows.map((r) => r.huella));

// EC y AE ya diligenciadas en el semestre: Set de `${tipo}|${id_docente}|${id_cohorte}`.
const ecAeHechas = async (p) =>
  new Set((await db.query(`SELECT tipo_formulario, id_docente, id_cohorte FROM evaluacion_respuestas
                           WHERE periodo = $1 AND tipo_formulario <> 'EE'`, [p]))
    .rows.map((r) => `${r.tipo_formulario}|${r.id_docente}|${r.id_cohorte}`));

// Avance del semestre: EE recibidas por unidad (desde las respuestas) y el conjunto de huellas de las
// constancias; el servicio calcula la huella de cada asignación para saber quién está al día.
const avance = async (p) => {
  const [ee, constancias] = await Promise.all([
    db.query(`SELECT id_docente, id_cohorte, poblacion, COUNT(*)::int AS n FROM evaluacion_respuestas
              WHERE periodo = $1 AND tipo_formulario = 'EE' GROUP BY 1, 2, 3`, [p]),
    db.query('SELECT huella FROM evaluacion_constancias WHERE periodo = $1', [p]),
  ]);
  return { ee: ee.rows, constancias: new Set(constancias.rows.map((r) => r.huella)) };
};

// Guarda un EE anónimo: constancia (impide repetir) y respuesta sin evaluador, en la misma transacción.
const guardarEE = (p, { huella, idDocente, idCohorte, poblacion, comentario, items }) =>
  db.withTransaction(async (cliente) => {
    await cliente.query('INSERT INTO evaluacion_constancias (periodo, huella) VALUES ($1, $2)', [p, huella]);
    const { rows: [r] } = await cliente.query(
      `INSERT INTO evaluacion_respuestas (periodo, tipo_formulario, id_docente, id_cohorte, poblacion, comentario)
       VALUES ($1, 'EE', $2, $3, $4, $5) RETURNING id_respuesta`, [p, idDocente, idCohorte, poblacion, comentario],
    );
    await insertarItems(cliente, r.id_respuesta, items);
  });

// Reescribe las respuestas EE del semestre en orden aleatorio y con identificadores nuevos, en UNA
// transacción: todas quedan con la misma transacción (xmin) y sin el orden físico de llegada, así que ya
// no se pueden emparejar con su constancia. Se llama al cerrar y al publicar. Luego intenta un VACUUM
// para retirar las filas viejas (si falla, lo hará el autovacuum).
const barajarEE = async (p) => {
  const n = await db.withTransaction(async (cliente) => {
    await cliente.query(`CREATE TEMP TABLE _ee_map ON COMMIT DROP AS
      SELECT id_respuesta AS viejo, uuid_generate_v4() AS nuevo, random() AS azar
      FROM evaluacion_respuestas WHERE periodo = $1 AND tipo_formulario = 'EE'`, [p]);
    await cliente.query(`CREATE TEMP TABLE _ee_resp ON COMMIT DROP AS
      SELECT m.nuevo, m.azar, r.periodo, r.tipo_formulario, r.id_docente, r.id_cohorte, r.poblacion, r.comentario
      FROM evaluacion_respuestas r JOIN _ee_map m ON m.viejo = r.id_respuesta`);
    await cliente.query(`CREATE TEMP TABLE _ee_items ON COMMIT DROP AS
      SELECT m.nuevo, m.azar, i.id_pregunta, i.valor
      FROM evaluacion_respuesta_items i JOIN _ee_map m ON m.viejo = i.id_respuesta`);
    const { rowCount } = await cliente.query(`DELETE FROM evaluacion_respuestas WHERE periodo = $1 AND tipo_formulario = 'EE'`, [p]);
    await cliente.query(`INSERT INTO evaluacion_respuestas (id_respuesta, periodo, tipo_formulario, id_docente, id_cohorte, poblacion, comentario)
      SELECT nuevo, periodo, tipo_formulario, id_docente, id_cohorte, poblacion, comentario FROM _ee_resp ORDER BY azar`);
    await cliente.query(`INSERT INTO evaluacion_respuesta_items (id_respuesta, id_pregunta, valor)
      SELECT nuevo, id_pregunta, valor FROM _ee_items ORDER BY azar, id_pregunta`);
    return rowCount;
  });
  if (n) {
    try {
      await db.query('VACUUM evaluacion_respuestas, evaluacion_respuesta_items');
    } catch { /* sin permisos o en uso: el autovacuum retira las filas viejas */ }
  }
  return n;
};

// Guarda (o reemplaza) la EC o la AE de una unidad.
const guardarNominal = (p, tipo, { idEvaluador, idDocente, idCohorte, comentario, items }) =>
  db.withTransaction(async (cliente) => {
    const { rows: [r] } = await cliente.query(
      `INSERT INTO evaluacion_respuestas (periodo, tipo_formulario, id_docente, id_cohorte, id_evaluador, comentario, actualizado_en)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (periodo, tipo_formulario, id_docente, id_cohorte) WHERE tipo_formulario <> 'EE'
       DO UPDATE SET id_evaluador = EXCLUDED.id_evaluador, comentario = EXCLUDED.comentario, actualizado_en = CURRENT_TIMESTAMP
       RETURNING id_respuesta`, [p, tipo, idDocente, idCohorte, idEvaluador, comentario],
    );
    await cliente.query('DELETE FROM evaluacion_respuesta_items WHERE id_respuesta = $1', [r.id_respuesta]);
    await insertarItems(cliente, r.id_respuesta, items);
  });

const insertarItems = (cliente, idRespuesta, items) => {
  const ids = Object.keys(items).map(Number);
  return cliente.query(
    `INSERT INTO evaluacion_respuesta_items (id_respuesta, id_pregunta, valor)
     SELECT $1, x.id, x.valor::tipo_valoracion_058 FROM unnest($2::int[], $3::text[]) AS x(id, valor)`,
    [idRespuesta, ids, ids.map((id) => items[id])],
  );
};

// EC o AE guardada de una unidad (para corregirla mientras el semestre está abierto).
const nominal = async (p, tipo, idDocente, idCohorte) =>
  (await db.query(`
    SELECT r.comentario, r.actualizado_en, COALESCE(json_object_agg(i.id_pregunta, i.valor) FILTER (WHERE i.id_pregunta IS NOT NULL), '{}') AS items
    FROM evaluacion_respuestas r LEFT JOIN evaluacion_respuesta_items i ON i.id_respuesta = r.id_respuesta
    WHERE r.periodo = $1 AND r.tipo_formulario = $2 AND r.id_docente = $3 AND r.id_cohorte = $4
    GROUP BY r.id_respuesta`, [p, tipo, idDocente, idCohorte])).rows[0] ?? null;

const tieneRespuestas = async (p) =>
  (await db.query('SELECT EXISTS (SELECT 1 FROM evaluacion_respuestas WHERE periodo = $1) AS x', [p])).rows[0].x;

const perfilDocente = async (idDocente) =>
  (await db.query('SELECT id_docente, nombre_completo AS docente, afiliacion FROM docentes_perfil WHERE id_docente = $1', [idDocente])).rows[0] ?? null;

module.exports = {
  periodo, periodos, semestresConOfertas, guardarPeriodo,
  ofertas, inscripcionesPosgrado, inscripcionesPregrado, docentePropio,
  preguntas, respuestas, unidadesConRespuestas, constanciasDe, ecAeHechas, avance,
  guardarEE, barajarEE, guardarNominal, nominal, tieneRespuestas, perfilDocente,
};
