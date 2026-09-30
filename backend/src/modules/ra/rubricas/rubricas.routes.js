const { Router } = require('express');
const { body, param, query } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const validate = require('../../../middlewares/validate');
const { ROLES } = require('../../../utils/roles');
const controller = require('./rubricas.controller');

const { COORDINADOR, DOCENTE } = ROLES;
const router = Router();

const texto = (campo, max) => body(`criterios.*.${campo}`).isString().trim().notEmpty()
  .isLength({ max }).withMessage(`${campo} es obligatorio (máx. ${max} caracteres)`);

// Montado en /api/v1/ra/rubricas
router.get('/', authenticate, authorize(COORDINADOR, DOCENTE),
  query('ra').optional().isInt({ min: 1 }).withMessage('RA inválido').toInt(), validate, controller.listar);
router.put(
  '/:idRa',
  authenticate,
  authorize(COORDINADOR),
  param('idRa').isInt({ min: 1 }).withMessage('RA inválido').toInt(),
  body('criterios').isArray({ min: 1, max: 20 }).withMessage('criterios debe ser una lista con al menos un criterio'),
  body('criterios.*.id_criterio').optional({ values: 'null' }).isInt({ min: 1 }).toInt(),
  body('criterios.*.orden').isInt({ min: 1, max: 99 }).withMessage('orden debe ser un entero positivo').toInt(),
  body('criterios.*.peso_porcentaje').isFloat({ gt: 0, max: 100 }).withMessage('peso_porcentaje debe estar entre 0 y 100').toFloat(),
  texto('nombre_criterio', 200),
  texto('desc_nivel_alto', 2000),
  texto('desc_nivel_medio', 2000),
  texto('desc_nivel_basico', 2000),
  texto('desc_nivel_insuficiente', 2000),
  validate,
  controller.reemplazar,
);

module.exports = router;
