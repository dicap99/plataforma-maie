const { Router } = require('express');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const { ROLES } = require('../../../utils/roles');
const controller = require('./docentes.controller');

const { COORDINADOR, DOCENTE } = ROLES;
const router = Router();

// Montado en /api/v1/admin/docentes
router.get('/', authenticate, authorize(COORDINADOR), controller.listar);
router.get('/me/perfil', authenticate, authorize(DOCENTE), controller.obtenerPerfilPropio);
router.put('/me/perfil', authenticate, authorize(DOCENTE), controller.actualizarPerfilPropio);
router.get('/:id/perfil', authenticate, authorize(COORDINADOR), controller.obtenerPerfil);
router.put('/:id/perfil', authenticate, authorize(COORDINADOR), controller.actualizarPerfil);

module.exports = router;
