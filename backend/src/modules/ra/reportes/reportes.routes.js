const { Router } = require('express');
const { query } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const validate = require('../../../middlewares/validate');
const { ROLES } = require('../../../utils/roles');
const { MOMENTOS } = require('../rubrica');
const controller = require('./reportes.controller');
const { AGRUPACIONES } = require('./reportes.service');

const { COORDINADOR } = ROLES;
const router = Router();

// Los consolidados son de Coordinación (SRS §2.3; RNF-SEG-01).
const filtros = [
  authenticate,
  authorize(COORDINADOR),
  query('agrupar').optional().isIn(AGRUPACIONES).withMessage(`agrupar debe ser uno de: ${AGRUPACIONES.join(', ')}`),
  query('momento').optional().isIn(['todos', ...Object.keys(MOMENTOS)])
    .withMessage(`momento debe ser uno de: todos, ${Object.keys(MOMENTOS).join(', ')}`),
  ...['cohorte', 'modulo', 'catalogo', 'curso', 'ra'].map((q) => query(q).optional().isInt({ min: 1 }).withMessage(`${q} inválido`).toInt()),
  query('periodo').optional().matches(/^[0-9]{4}-[AB]$/).withMessage('Periodo con formato AAAA-A o AAAA-B'),
  query('estudiante').optional().isUUID().withMessage('Estudiante inválido'),
  validate,
];

// Montado en /api/v1/ra/reportes
router.get('/', ...filtros, controller.consolidado);
router.get('/exportar', ...filtros, controller.exportar);

module.exports = router;
