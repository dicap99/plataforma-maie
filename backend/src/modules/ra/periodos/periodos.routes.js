const { Router } = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const validate = require('../../../middlewares/validate');
const { ROLES } = require('../../../utils/roles');
const controller = require('./periodos.controller');

const { COORDINADOR, DOCENTE } = ROLES;
const router = Router();

// Montado en /api/v1/ra/periodos
router.get('/', authenticate, authorize(COORDINADOR, DOCENTE), controller.listar);
router.put(
  '/:periodo',
  authenticate,
  authorize(COORDINADOR),
  param('periodo').matches(/^[0-9]{4}-[AB]$/).withMessage('Semestre con formato AAAA-A o AAAA-B'),
  body('abierto').custom((v) => typeof v === 'boolean').withMessage('abierto debe ser true o false'),
  validate,
  controller.cambiar,
);

module.exports = router;
