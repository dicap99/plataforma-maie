// Módulo 3: Evaluación Docente — Acuerdo 058 (RF-EVAL-01 a RF-EVAL-05)
const { Router } = require('express');

const router = Router();

router.use('/periodos', require('./periodos/periodos.routes'));
router.use('/formularios', require('./formularios/formularios.routes'));
router.use('/respuestas', require('./respuestas/respuestas.routes'));
router.use('/resultados', require('./resultados/resultados.routes'));

module.exports = router;
