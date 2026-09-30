// Módulo 1: Procesos Administrativos (RF-ADM-01 a RF-ADM-06)
// Las rutas específicas van antes del CRUD genérico para que p. ej. /presupuesto/resumen
// o /docentes/me/perfil no se interpreten como /:llave.
const { Router } = require('express');

const router = Router();

router.use('/', require('./reportes/reportes.routes')); // /reportes/estadisticas, /presupuesto/resumen
router.use('/docentes', require('./docentes/docentes.routes')); // /docentes/me/perfil
router.use('/importaciones', require('./importaciones/importaciones.routes'));
router.use('/plantillas', require('./plantillas/plantillas.routes'));
router.use('/clases', require('./clases/clases.routes')); // clases con identificador único
router.use('/cursos', require('./cursos/cursos.routes')); // catálogo y ofertas por promoción
router.use('/cohortes', require('./matriculas/matriculas.routes')); // /cohortes/:id/estudiantes
router.use('/', require('./recursos/recursos.routes')); // /recursos y CRUD de cada hoja

module.exports = router;
