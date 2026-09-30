const { Router } = require('express');
const { body, query } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const validate = require('../../../middlewares/validate');
const { ROLES } = require('../../../utils/roles');
const controller = require('./evaluaciones.controller');

const { COORDINADOR, DOCENTE } = ROLES;
const router = Router();

// Nota 0–5 con máximo dos decimales, o null para borrar la celda.
const notaValida = (v) =>
  v === null || (typeof v === 'number' && v >= 0 && v <= 5 && Math.abs(v * 100 - Math.round(v * 100)) < 1e-9);

// Montado en /api/v1/ra/evaluaciones
router.get('/', authenticate, authorize(COORDINADOR, DOCENTE),
  query('curso').isInt({ min: 1 }).withMessage('Indique el curso (?curso=)').toInt(), validate, controller.listar);
router.post(
  '/',
  authenticate,
  authorize(DOCENTE), // solo el docente del curso califica (asesoría: «esto sí lo hace el profesor»)
  body('id_curso').isInt({ min: 1 }).withMessage('Curso inválido').toInt(),
  body('calificaciones').isArray({ min: 1, max: 5000 }).withMessage('calificaciones debe ser una lista no vacía'),
  body('calificaciones.*.id_estudiante').isUUID().withMessage('Estudiante inválido'),
  body('calificaciones.*.id_criterio').isInt({ min: 1 }).withMessage('Criterio inválido').toInt(),
  body('calificaciones.*.calificacion').custom(notaValida)
    .withMessage('La calificación debe ser un número entre 0 y 5 con máximo dos decimales, o null'),
  validate,
  controller.registrarLote,
);

module.exports = router;
