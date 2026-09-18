const { Router } = require('express');
const { body } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const validate = require('../../../middlewares/validate');
const { ROLES } = require('../../../utils/roles');
const { CAMPOS_EDITABLES } = require('./docentes.repository');
const controller = require('./docentes.controller');

const { DOCENTE } = ROLES;
const router = Router();

// Montado en /api/v1/admin/docentes (antes del CRUD genérico, para que "me" no se tome como :id_docente)
router.get('/me/perfil', authenticate, authorize(DOCENTE), controller.obtenerPerfilPropio);
router.put(
  '/me/perfil',
  authenticate,
  authorize(DOCENTE),
  ...CAMPOS_EDITABLES.map((c) => body(c).optional({ values: 'null' }).isString().trim()),
  validate,
  controller.actualizarPerfilPropio,
);

module.exports = router;
