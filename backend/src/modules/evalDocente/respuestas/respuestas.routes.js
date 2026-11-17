const { Router } = require('express');
const { body, param, query } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const validate = require('../../../middlewares/validate');
const { FORMULARIOS } = require('../categorizacion');
const controller = require('./respuestas.controller');

const router = Router();
const PERIODO = /^[0-9]{4}-[AB]$/;

// Montado en /api/v1/eval-docente. El rol se valida en el servicio con categorizacion.autorizar():
// estudiante → EE, Coordinación → EC, el propio docente → AE (matriz de acceso del Documento Técnico).
router.get('/formularios/:tipo', authenticate,
  param('tipo').isIn(FORMULARIOS).withMessage('Formulario EE, EC o AE'), validate, controller.formulario);
router.get('/categorizacion', authenticate, controller.categorizacion);
router.get('/pendientes', authenticate, controller.pendientes);
router.post(
  '/respuestas',
  authenticate,
  body('periodo').matches(PERIODO).withMessage('Semestre con formato AAAA-A o AAAA-B'),
  body('tipo').isIn(FORMULARIOS).withMessage('Formulario EE, EC o AE'),
  body('id_docente').isUUID().withMessage('Docente inválido'),
  body('id_cohorte').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Promoción inválida').toInt(),
  body('comentario').optional({ values: 'null' }).isString().withMessage('El comentario debe ser texto'),
  validate,
  controller.registrar,
);
router.get(
  '/respuestas/propia',
  authenticate,
  query('periodo').matches(PERIODO).withMessage('Semestre con formato AAAA-A o AAAA-B'),
  query('tipo').isIn(['EC', 'AE']).withMessage('Solo EC o AE (el EE es anónimo)'),
  query('id_docente').isUUID().withMessage('Docente inválido'),
  query('id_cohorte').isInt({ min: 1 }).withMessage('Promoción inválida').toInt(),
  validate,
  controller.propia,
);

module.exports = router;
