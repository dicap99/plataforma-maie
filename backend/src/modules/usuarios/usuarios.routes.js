const { Router } = require('express');
const { body, param, query } = require('express-validator');
const authenticate = require('../../middlewares/authenticate');
const authorize = require('../../middlewares/authorize');
const validate = require('../../middlewares/validate');
const { ROLES, TODOS } = require('../../utils/roles');
const { VALORES_BENEFICIO } = require('../../utils/beneficios');
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
  body('afiliacion').optional({ values: 'null' }).isIn(['UDENAR', 'EXTERNO']).withMessage('Afiliación debe ser UDENAR o EXTERNO'),
  body('campos_formacion').optional({ values: 'null' }).isArray({ max: 20 }).withMessage('campos_formacion debe ser una lista'),
  body('campos_formacion.*').isString().trim().notEmpty().isLength({ max: 100 }).withMessage('Campo de formación inválido (máx. 100)'),
  body('id_cohorte').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Promoción inválida').toInt(),
  body('beca').optional({ values: 'null' }).isIn(['100', 'hora_catedra', 'sintraunicol']).withMessage('Tipo de beca inválido'),
  body('beneficios').optional({ values: 'null' }).isArray({ max: 20 }).withMessage('beneficios debe ser una lista'),
  body('beneficios.*.semestre').isInt({ min: 1, max: 4 }).withMessage('Semestre del beneficio inválido (1 a 4)').toInt(),
  body('beneficios.*.tipo').isIn(VALORES_BENEFICIO).withMessage(`Tipo de beneficio debe ser uno de: ${VALORES_BENEFICIO.join(', ')}`),
  validate,
];
const idValido = [param('id').isUUID().withMessage('Identificador inválido'), validate];
const soloCoord = [authenticate, authorize(COORDINADOR)];

// Montado en /api/v1/usuarios
router.get('/', ...soloCoord, query('rol').optional().isIn(TODOS).withMessage(`Rol debe ser uno de: ${TODOS.join(', ')}`), validate, controller.listar);
router.get('/campos-formacion', ...soloCoord, controller.camposFormacion);
router.get('/:id', ...soloCoord, ...idValido, controller.obtener);
router.post('/', ...soloCoord, ...reglas(true), controller.crear);
router.put('/:id', ...soloCoord, ...idValido, ...reglas(false), controller.actualizar);
router.delete('/:id', ...soloCoord, ...idValido, controller.eliminar);

module.exports = router;
