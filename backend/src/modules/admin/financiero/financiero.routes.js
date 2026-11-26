const { Router } = require('express');
const { body, param, query } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const validate = require('../../../middlewares/validate');
const { ROLES } = require('../../../utils/roles');
const { PERIODO_REGEX } = require('../../../shared/crud/campos');
const controller = require('./financiero.controller');

const router = Router();
const soloCoord = [authenticate, authorize(ROLES.COORDINADOR)];

const filtros = [
  query('periodo').optional().matches(PERIODO_REGEX).withMessage('Periodo con formato AAAA-A o AAAA-B'),
  query('id_cohorte').optional().isInt({ min: 1 }).withMessage('Promoción inválida').toInt(),
  query('poblacion').optional().isIn(['posgrado', 'pregrado']).withMessage('poblacion debe ser posgrado o pregrado'),
  validate,
];

const reglasPago = [
  body('id_estudiante').isUUID().withMessage('Estudiante inválido'),
  body('poblacion').isIn(['posgrado', 'pregrado']).withMessage('poblacion debe ser posgrado o pregrado'),
  body('id_cohorte').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Promoción inválida').toInt(),
  body('periodo').matches(PERIODO_REGEX).withMessage('Periodo con formato AAAA-A o AAAA-B'),
  body('pagado').isBoolean().withMessage('pagado debe ser booleano').toBoolean(),
  body('valor_pagado').isFloat({ min: 0 }).withMessage('Valor pagado debe ser mayor o igual a 0').toFloat(),
  body('fecha_pago').optional({ values: 'null' }).isISO8601({ strict: true }).withMessage('Fecha de pago AAAA-MM-DD'),
  body('referencia').optional({ values: 'null' }).isString().trim().isLength({ max: 80 }).withMessage('Referencia de hasta 80 caracteres'),
  body('observaciones').optional({ values: 'null' }).isString().trim(),
  validate,
];

// Montado en /api/v1/admin/matriculas-financieras
router.get('/', ...soloCoord, ...filtros, controller.listar);
router.get('/exportar', ...soloCoord, ...filtros, controller.exportar);
router.put('/', ...soloCoord, ...reglasPago, controller.guardar);
router.delete('/:id', ...soloCoord, param('id').isInt({ min: 1 }).withMessage('Identificador inválido').toInt(), validate, controller.eliminar);

module.exports = router;
