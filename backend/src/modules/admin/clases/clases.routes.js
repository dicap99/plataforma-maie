const { Router } = require('express');
const { body, param, query } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const validate = require('../../../middlewares/validate');
const { ROLES } = require('../../../utils/roles');
const controller = require('./clases.controller');

const { COORDINADOR, DOCENTE } = ROLES;
const router = Router();

const lectura = [authenticate, authorize(COORDINADOR, DOCENTE)];
const soloCoord = [authenticate, authorize(COORDINADOR)];
const idValido = [param('id').isInt({ min: 1 }).withMessage('Identificador de clase inválido').toInt(), validate];
const reglas = [
  body('nombre').isString().trim().notEmpty().isLength({ max: 150 }).withMessage('Nombre de la clase requerido (máx. 150)'),
  body('id_catalogo').isInt({ min: 1 }).withMessage('Curso del plan requerido').toInt(),
  body('descripcion').optional({ values: 'null' }).isString().trim(),
  body('activa').optional().custom((v) => typeof v === 'boolean').withMessage('activa debe ser true o false'),
  validate,
];

// Montado en /api/v1/admin/clases
router.get('/', ...lectura, query('catalogo').optional().isInt({ min: 1 }).toInt(), validate, controller.listar);
router.get('/:id', ...lectura, ...idValido, controller.obtener);
router.post('/', ...soloCoord, ...reglas, controller.crear);
router.put('/:id', ...soloCoord, ...idValido, ...reglas, controller.actualizar);
router.delete('/:id', ...soloCoord, ...idValido, controller.eliminar);

module.exports = router;
