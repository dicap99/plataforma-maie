// Módulo 3: Evaluación Docente — Acuerdo 058 de 2022 (RF-EVAL-01 a RF-EVAL-05)
const { Router } = require('express');

const router = Router();

router.use('/periodos', require('./periodos/periodos.routes')); // habilitación por semestre y publicación
router.use('/pregrado', require('./pregrado/pregrado.routes')); // estudiantes de pregrado por oferta
router.use('/resultados', require('./resultados/resultados.routes'));
router.use('/formularios', require('./preguntas/preguntas.routes')); // edición de preguntas (Art. 8), antes de GET /formularios/:tipo
router.use('/', require('./respuestas/respuestas.routes')); // formularios, categorización, pendientes y respuestas

module.exports = router;
