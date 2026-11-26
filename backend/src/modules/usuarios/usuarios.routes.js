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

const reglas = () => [
  body('identificacion').isString().trim().notEmpty().withMessage('Identificación requerida'),
  body('nombres').isString().trim().notEmpty().withMessage('Nombres requeridos'),
  body('apellidos').isString().trim().notEmpty().withMessage('Apellidos requeridos'),
  body('email').isEmail().withMessage('Email inválido'),
  body('telefono').optional({ values: 'null' }).isString().trim()
    .matches(/^$|^[+()\d][\d\s().+-]{6,}(\s*(ext\.?|extensión)\s*\d{1,6})?$/i).withMessage('Teléfono inválido (dígitos, espacios, +, -, paréntesis y extensión opcional)')
    .isLength({ max: 30 }).withMessage('El teléfono admite hasta 30 caracteres'),
  body('rol').isIn(TODOS).withMessage(`Rol debe ser uno de: ${TODOS.join(', ')}`),
  body('activo').optional().isBoolean().toBoolean(),
  // La contraseña no se define aquí: la plataforma genera una temporal al crear la cuenta y al restablecerla.
  body('password').not().exists().withMessage('La contraseña la genera la plataforma (temporal); use «Restablecer contraseña»'),
  body('id_docente').optional({ values: 'null' }).isUUID().withMessage('Perfil docente inválido'),
  body('afiliacion').optional({ values: 'null' }).isIn(['UDENAR', 'EXTERNO']).withMessage('Afiliación debe ser UDENAR o EXTERNO'),
  body('departamento').optional({ values: 'null' }).isString().isLength({ max: 150 }).withMessage('Departamento de hasta 150 caracteres'),
  body('universidad').optional({ values: 'null' }).isString().isLength({ max: 150 }).withMessage('Universidad de hasta 150 caracteres'),
  body('campos_formacion').optional({ values: 'null' }).isArray({ max: 20 }).withMessage('campos_formacion debe ser una lista'),
  body('campos_formacion.*').isString().trim().notEmpty().isLength({ max: 100 }).withMessage('Campo de formación inválido (máx. 100)'),
  body('id_cohorte').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Promoción inválida').toInt(),
  validate,
];
// Beneficios por semestre del estudiante (pestaña «Beneficios»): reemplazan los anteriores.
const reglasBeneficios = [
  body('id_cohorte').isInt({ min: 1 }).withMessage('Indique la promoción (id_cohorte)').toInt(),
  body('beneficios').isArray({ max: 20 }).withMessage('beneficios debe ser una lista'),
  body('beneficios.*.semestre').isInt({ min: 1, max: 4 }).withMessage('Semestre del beneficio inválido (1 a 4)').toInt(),
  body('beneficios.*.tipo').isIn(VALORES_BENEFICIO).withMessage(`Tipo de beneficio debe ser uno de: ${VALORES_BENEFICIO.join(', ')}`),
  body('beneficios.*.detalle').optional({ values: 'null' }).isString().trim().isLength({ max: 500 }).withMessage('Detalle del beneficio de hasta 500 caracteres'),
  validate,
];
const idValido = [param('id').isUUID().withMessage('Identificador inválido'), validate];
const soloCoord = [authenticate, authorize(COORDINADOR)];

// Montado en /api/v1/usuarios
router.get('/', ...soloCoord, query('rol').optional().isIn(TODOS).withMessage(`Rol debe ser uno de: ${TODOS.join(', ')}`), validate, controller.listar);
router.get('/campos-formacion', ...soloCoord, controller.camposFormacion);
router.get('/beneficios', ...soloCoord, query('id_cohorte').isInt({ min: 1 }).withMessage('Indique la promoción (id_cohorte)').toInt(), validate,
  controller.listarBeneficios);
router.put('/:id/beneficios', ...soloCoord, ...idValido, ...reglasBeneficios, controller.reemplazarBeneficios);
router.get('/:id/ficha', ...soloCoord, ...idValido, controller.ficha);
router.post('/:id/restablecer-password', ...soloCoord, ...idValido, controller.restablecerPassword);
router.get('/:id', ...soloCoord, ...idValido, controller.obtener);
router.post('/', ...soloCoord, ...reglas(), controller.crear);
router.put('/:id', ...soloCoord, ...idValido, ...reglas(), controller.actualizar);
router.delete('/:id', ...soloCoord, ...idValido, controller.eliminar);

module.exports = router;
