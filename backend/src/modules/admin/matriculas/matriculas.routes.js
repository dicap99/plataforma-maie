const { Router } = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const validate = require('../../../middlewares/validate');
const { ROLES } = require('../../../utils/roles');
const controller = require('./matriculas.controller');

const ESTADOS = ['inscrito', 'matriculado', 'egresado', 'graduado', 'retirado'];
const router = Router();

const soloCoord = [authenticate, authorize(ROLES.COORDINADOR)];
const idValido = [param('id').isInt({ min: 1 }).withMessage('Identificador de promoción inválido').toInt(), validate];

// Montado en /api/v1/admin/cohortes (antes del CRUD genérico de la hoja «Promociones»)
router.get('/:id/estudiantes', ...soloCoord, ...idValido, controller.listar);
router.put(
  '/:id/estudiantes',
  ...soloCoord,
  ...idValido,
  body('estudiantes').isArray().withMessage('estudiantes debe ser una lista'),
  body('estudiantes.*.id_estudiante').isUUID().withMessage('Estudiante inválido'),
  body('estudiantes.*.estado').optional().isIn(ESTADOS).withMessage(`Estado debe ser uno de: ${ESTADOS.join(', ')}`),
  validate,
  controller.reemplazar,
);

module.exports = router;
