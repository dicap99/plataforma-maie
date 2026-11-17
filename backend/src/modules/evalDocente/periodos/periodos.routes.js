const { Router } = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const validate = require('../../../middlewares/validate');
const { ROLES } = require('../../../utils/roles');
const controller = require('./periodos.controller');

const { COORDINADOR } = ROLES;
const router = Router();
const booleano = (campo) => body(campo).optional().custom((v) => typeof v === 'boolean').withMessage(`${campo} debe ser true o false`);
const fecha = (campo) => body(campo).optional({ values: 'undefined' })
  .custom((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v)).withMessage(`${campo} con formato AAAA-MM-DD o null`);
const periodo = param('periodo').matches(/^[0-9]{4}-[AB]$/).withMessage('Semestre con formato AAAA-A o AAAA-B');

// Montado en /api/v1/eval-docente/periodos (solo Coordinación)
router.use(authenticate, authorize(COORDINADOR));
router.get('/', controller.listar);
router.get('/:periodo', periodo, validate, controller.obtener);
router.put(
  '/:periodo',
  periodo,
  ...['habilitada', 'incluye_pregrado', 'excluir_extremas'].map(booleano),
  fecha('fecha_apertura'),
  fecha('fecha_cierre'),
  validate,
  controller.cambiar,
);
router.post('/:periodo/publicacion', periodo, body('publicado').custom((v) => typeof v === 'boolean').withMessage('publicado debe ser true o false'),
  validate, controller.publicar);

module.exports = router;
