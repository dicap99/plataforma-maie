const { Router } = require('express');
const { param, query } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const validate = require('../../../middlewares/validate');
const { ROLES } = require('../../../utils/roles');
const { POBLACION_FILTRO } = require('./consolidado');
const controller = require('./resultados.controller');

const { COORDINADOR, DOCENTE } = ROLES;
const router = Router();

// Consolidados, histórico e informes: solo Coordinación (matriz de acceso: «Consolidado»).
const filtros = [
  authenticate,
  authorize(COORDINADOR),
  query('periodo').matches(/^[0-9]{4}-[AB]$/).withMessage('Semestre con formato AAAA-A o AAAA-B'),
  query('poblacion').optional().isIn(POBLACION_FILTRO).withMessage(`poblacion: ${POBLACION_FILTRO.join(', ')}`),
  validate,
];
const docente = [authenticate, authorize(COORDINADOR), param('idDocente').isUUID().withMessage('Docente inválido'), validate];

// Montado en /api/v1/eval-docente/resultados
// El docente: solo los propios y solo de semestres publicados (RF-EVAL-05).
router.get('/me', authenticate, authorize(DOCENTE, COORDINADOR), controller.propios);
router.get('/me/informe.pdf', authenticate, authorize(DOCENTE, COORDINADOR), controller.informePropioPdf);
router.get('/', ...filtros, controller.consolidado);
router.get('/exportar', ...filtros, controller.exportar);
router.get('/informe.pdf', ...filtros, controller.informePdf);
router.get('/docentes/:idDocente', ...docente, controller.porDocente);
router.get('/docentes/:idDocente/informe.pdf', ...docente, controller.informeDocentePdf);

module.exports = router;
