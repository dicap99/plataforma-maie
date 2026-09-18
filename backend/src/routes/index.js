// Router de la API v1: monta cada módulo bajo /api/v1
const { Router } = require('express');

const router = Router();

router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/usuarios', require('../modules/usuarios/usuarios.routes'));
router.use('/admin', require('../modules/admin/admin.routes'));
router.use('/ra', require('../modules/ra/ra.routes'));
router.use('/eval-docente', require('../modules/evalDocente/evalDocente.routes'));

module.exports = router;
