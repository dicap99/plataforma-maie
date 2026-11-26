// Módulo 1: Procesos Administrativos (RF-ADM-01 a RF-ADM-06)
// Las rutas específicas van antes del CRUD genérico para que p. ej. /presupuesto/resumen
// o /docentes/me/perfil no se interpreten como /:llave.
const { Router } = require('express');

const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const { ROLES } = require('../../utils/roles');
const plantillasController = require('./plantillas/plantillas.controller');

const router = Router();

router.use('/', require('./reportes/reportes.routes')); // /reportes/estadisticas, /presupuesto/resumen
router.use('/docentes', require('./docentes/docentes.routes')); // /docentes/me/perfil
router.use('/importaciones', require('./importaciones/importaciones.routes'));
router.use('/plantillas', require('./plantillas/plantillas.routes'));
router.get('/exportar/:recurso', authenticate, authorize(ROLES.COORDINADOR), plantillasController.exportarRecurso);
router.use('/clases', require('./clases/clases.routes')); // clases con identificador único
router.use('/cursos', require('./cursos/cursos.routes')); // catálogo y ofertas por promoción
router.use('/cohortes', require('./matriculas/matriculas.routes')); // /cohortes/:id/estudiantes
router.use('/productos', require('./productos/productos.routes')); // /productos/:id/estudiantes (antes del CRUD)
router.use('/matriculas-financieras', require('./financiero/financiero.routes')); // matrícula financiera (posgrado/pregrado)
router.use('/', require('./recursos/recursos.routes')); // /recursos y CRUD de cada hoja

module.exports = router;
