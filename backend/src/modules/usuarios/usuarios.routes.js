const { Router } = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const { ROLES, TODOS } = require('../../utils/roles');
const controller = require('./usuarios.controller');

const { COORDINADOR } = ROLES;
const router = Router();

const reglas = (passwordObligatoria) => [
  body('identificacion').isString().trim().notEmpty().withMessage('Identificación requerida'),
  body('nombres').isString().trim().notEmpty().withMessage('Nombres requeridos'),
  body('apellidos').isString().trim().notEmpty().withMessage('Apellidos requeridos'),
  body('email').isEmail().withMessage('Email inválido'),
  body('rol').isIn(TODOS).withMessage(`Rol debe ser uno de: ${TODOS.join(', ')}`),
  body('activo').optional().isBoolean().toBoolean(),
  passwordObligatoria
    ? body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    : body('password').optional({ values: 'falsy' }).isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  body('id_docente').optional({ values: 'null' }).isUUID().withMessage('Perfil docente inválido'),
  validate,
];
const idValido = [param('id').isUUID().withMessage('Identificador inválido'), validate];
const soloCoord = [authenticate, authorize(COORDINADOR)];

// Montado en /api/v1/usuarios
router.get('/', ...soloCoord, controller.listar);
router.get('/:id', ...soloCoord, ...idValido, controller.obtener);
router.post('/', ...soloCoord, ...reglas(true), controller.crear);
router.put('/:id', ...soloCoord, ...idValido, ...reglas(false), controller.actualizar);
router.delete('/:id', ...soloCoord, ...idValido, controller.eliminar);

module.exports = router;
