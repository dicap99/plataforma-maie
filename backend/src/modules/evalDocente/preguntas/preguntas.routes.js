// «Formularios» de la evaluación docente (Acuerdo 058, Art. 8: el Comité Curricular puede modificar las
// características y variables). Un solo formulario por tipo (EE, EC, AE) para todos los semestres; los cambios
// aplican a las evaluaciones que se diligencien desde ese momento. Para no alterar lo ya respondido:
//  - una pregunta sin respuestas se edita y se elimina libremente;
//  - una pregunta con respuestas no cambia de redacción, característica ni escala: se desactiva y se crea otra;
//  - los resultados de cada semestre se calculan con las preguntas respondidas en él (preguntasDelPeriodo).
const { Router } = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const validate = require('../../../middlewares/validate');
const ApiError = require('../../../utils/ApiError');
const { ROLES } = require('../../../utils/roles');
const db = require('../../../config/db');
const { responder } = require('../controlador');

const router = Router();
const filas = async (sql, params, cliente = db) => (await cliente.query(sql, params)).rows;
const TIPOS = ['EE', 'EC', 'AE'];

const listar = async (tipo) => filas(`
  SELECT q.id_pregunta, q.tipo_formulario, q.caracteristica, q.nombre_caracteristica, q.codigo, q.orden, q.texto, q.escala, q.activa,
         (SELECT COUNT(*)::int FROM evaluacion_respuesta_items i WHERE i.id_pregunta = q.id_pregunta) AS respuestas
  FROM evaluacion_preguntas q WHERE q.tipo_formulario = $1 ORDER BY q.orden`, [tipo]);

const obtener = async (id, cliente = db) => {
  const [q] = await filas(`SELECT q.*, (SELECT COUNT(*)::int FROM evaluacion_respuesta_items i WHERE i.id_pregunta = q.id_pregunta) AS respuestas
                           FROM evaluacion_preguntas q WHERE q.id_pregunta = $1`, [id], cliente);
  if (!q) throw ApiError.notFound('Pregunta no encontrada');
  return q;
};

const soloCoord = [authenticate, authorize(ROLES.COORDINADOR)];
const tipo = param('tipo').isIn(TIPOS).withMessage(`Formulario: ${TIPOS.join(', ')}`);
const id = param('id').isInt({ min: 1 }).withMessage('Pregunta inválida').toInt();
const texto = (campo, opcional = false) => {
  const v = body(campo);
  return (opcional ? v.optional() : v).isString().trim().isLength({ min: 3, max: 500 }).withMessage('La pregunta debe tener entre 3 y 500 caracteres');
};

// GET /eval-docente/formularios/:tipo/preguntas — todas (activas e inactivas) con su número de respuestas
router.get('/:tipo/preguntas', ...soloCoord, tipo, validate, responder(({ params }) => listar(params.tipo)));

// POST /eval-docente/formularios/:tipo/preguntas — { caracteristica, nombre_caracteristica?, texto, escala? }
// Se agrega al final de su característica; el código (p. ej. «3.7») se genera.
router.post('/:tipo/preguntas', ...soloCoord, tipo,
  body('caracteristica').isInt({ min: 0, max: 9 }).withMessage('Característica entre 0 y 9').toInt(),
  body('nombre_caracteristica').optional({ values: 'falsy' }).isString().trim().isLength({ min: 3, max: 120 }).withMessage('Nombre de la característica entre 3 y 120 caracteres'),
  texto('texto'), body('escala').optional({ values: 'null' }).isString().trim().isLength({ max: 300 }), validate,
  responder(async ({ params, body: b }) => db.withTransaction(async (cliente) => {
    const misma = await filas('SELECT nombre_caracteristica, codigo, orden FROM evaluacion_preguntas WHERE tipo_formulario = $1 AND caracteristica = $2 ORDER BY orden',
      [params.tipo, b.caracteristica], cliente);
    const nombre = misma[0]?.nombre_caracteristica ?? b.nombre_caracteristica;
    if (!nombre) throw ApiError.badRequest('Indique el nombre de la característica nueva');
    const usados = misma.map((m) => Number(String(m.codigo).split('.')[1]) || 0);
    const codigo = `${b.caracteristica}.${(usados.length ? Math.max(...usados) : 0) + 1}`;
    // Orden: tras la última pregunta de la característica (o antes de la primera de una característica mayor).
    const [{ despues }] = await filas(`SELECT COALESCE(
        (SELECT MAX(orden) FROM evaluacion_preguntas WHERE tipo_formulario = $1 AND caracteristica = $2),
        (SELECT MAX(orden) FROM evaluacion_preguntas WHERE tipo_formulario = $1 AND caracteristica < $2), 0) AS despues`,
    [params.tipo, b.caracteristica], cliente);
    // Corre las siguientes en dos pasos (la unicidad de `orden` no es diferible).
    await cliente.query('UPDATE evaluacion_preguntas SET orden = orden + 1000 WHERE tipo_formulario = $1 AND orden > $2', [params.tipo, despues]);
    await cliente.query('UPDATE evaluacion_preguntas SET orden = orden - 999 WHERE tipo_formulario = $1 AND orden > $2', [params.tipo, despues + 1000]);
    const [q] = await filas(`INSERT INTO evaluacion_preguntas (tipo_formulario, caracteristica, nombre_caracteristica, codigo, orden, texto, escala)
                             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_pregunta`,
    [params.tipo, b.caracteristica, nombre, codigo, despues + 1, b.texto, b.escala || null], cliente);
    return obtener(q.id_pregunta, cliente);
  }), 201));

// PUT /eval-docente/formularios/preguntas/:id — { texto?, escala?, activa? }
router.put('/preguntas/:id', ...soloCoord, id, texto('texto', true),
  body('escala').optional({ values: 'null' }).isString().trim().isLength({ max: 300 }),
  body('activa').optional().isBoolean().withMessage('activa debe ser true o false'), validate,
  responder(async ({ params, body: b }) => {
    const q = await obtener(params.id);
    const cambiaContenido = (b.texto !== undefined && b.texto !== q.texto) || (b.escala !== undefined && (b.escala || null) !== q.escala);
    if (cambiaContenido && q.respuestas > 0) {
      throw ApiError.conflict('La pregunta ya tiene respuestas: no se cambia su redacción. Desactívela y agregue una nueva.');
    }
    await db.query(`UPDATE evaluacion_preguntas SET texto = COALESCE($2, texto), escala = CASE WHEN $3::boolean THEN $4 ELSE escala END,
                    activa = COALESCE($5, activa) WHERE id_pregunta = $1`,
    [params.id, b.texto ?? null, b.escala !== undefined, b.escala || null, b.activa ?? null]);
    return obtener(params.id);
  }));

// DELETE /eval-docente/formularios/preguntas/:id — solo si no tiene respuestas
router.delete('/preguntas/:id', ...soloCoord, id, validate, responder(async ({ params }) => {
  const q = await obtener(params.id);
  if (q.respuestas > 0) throw ApiError.conflict('La pregunta tiene respuestas: desactívela en lugar de eliminarla');
  await db.query('DELETE FROM evaluacion_preguntas WHERE id_pregunta = $1', [params.id]);
  return { eliminada: true };
}));

module.exports = router;
