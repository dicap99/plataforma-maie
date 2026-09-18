const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const { ROLES } = require('../../../utils/roles');
const controller = require('./resultados.controller');

const { COORDINADOR, DOCENTE } = ROLES;
const router = Router();

// Montado en /api/v1/eval-docente/resultados
router.get('/me', authenticate, authorize(DOCENTE), controller.obtenerPropios);
router.get(
  '/:docenteId',
  authenticate,
  authorize(COORDINADOR, DOCENTE),
  controller.obtenerPorDocente,
);
router.get('/:docenteId/informe.pdf', authenticate, authorize(COORDINADOR), controller.informePdf);

module.exports = router;
