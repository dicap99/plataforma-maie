// Módulo 2: Resultados de Aprendizaje (RF-RA-01 a RF-RA-04)
const { Router } = require('express');

const router = Router();

router.use('/resultados', require('./resultados/resultados.routes'));
router.use('/estrategias', require('./estrategias/estrategias.routes'));
router.use('/rubricas', require('./rubricas/rubricas.routes'));
router.use('/evaluaciones', require('./evaluaciones/evaluaciones.routes'));
router.use('/reportes', require('./reportes/reportes.routes'));

module.exports = router;
