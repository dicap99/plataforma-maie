// Módulo 1: Procesos Administrativos (RF-ADM-01 a RF-ADM-06)
const { Router } = require('express');

const router = Router();

router.use('/cohortes', require('./cohortes/cohortes.routes'));
router.use('/cursos', require('./cursos/cursos.routes'));
router.use('/presupuesto', require('./presupuesto/presupuesto.routes'));
router.use('/', require('./finanzas/finanzas.routes')); // /transferencias, /contratos-ops
router.use('/investigacion', require('./investigacion/investigacion.routes'));
router.use('/docentes', require('./docentes/docentes.routes'));
router.use('/importaciones', require('./importaciones/importaciones.routes'));
router.use('/plantillas', require('./plantillas/plantillas.routes'));
router.use('/reportes', require('./reportes/reportes.routes'));

module.exports = router;
