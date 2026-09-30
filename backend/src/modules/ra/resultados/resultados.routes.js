const { Router } = require('express');
const { param } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const validate = require('../../../middlewares/validate');
const { ROLES } = require('../../../utils/roles');
const controller = require('./resultados.controller');

const { COORDINADOR, DOCENTE } = ROLES;
const router = Router();

// Montado en /api/v1/ra/resultados
router.get('/', authenticate, authorize(COORDINADOR, DOCENTE), controller.listar);
router.get('/:id', authenticate, authorize(COORDINADOR, DOCENTE),
  param('id').isInt({ min: 1 }).withMessage('Identificador de RA inválido').toInt(), validate, controller.obtener);

module.exports = router;
