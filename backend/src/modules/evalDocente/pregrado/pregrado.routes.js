const { Router } = require('express');
const { body, param, query } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const validate = require('../../../middlewares/validate');
const upload = require('../../../middlewares/upload');
const { ROLES } = require('../../../utils/roles');
const controller = require('./pregrado.controller');

const router = Router();
const semestre = query('periodo').optional().matches(/^[0-9]{4}-[AB]$/).withMessage('Semestre con formato AAAA-A o AAAA-B');
const inscripcion = [
  param('idCurso').isInt({ min: 1 }).withMessage('Curso inválido').toInt(),
  param('idEstudiante').isUUID().withMessage('Estudiante inválido'),
];

// Montado en /api/v1/eval-docente/pregrado (solo Coordinación)
router.use(authenticate, authorize(ROLES.COORDINADOR));
router.get('/', semestre, validate, controller.listar);
router.post('/',
  body('id_curso').isInt({ min: 1 }).withMessage('Curso inválido').toInt(),
  body('id_estudiante').isUUID().withMessage('Estudiante inválido'),
  body('programa').optional({ values: 'null' }).isString().trim().isLength({ max: 150 }).withMessage('Programa de hasta 150 caracteres'),
  validate, controller.inscribir);
router.get('/plantilla', semestre, validate, controller.plantilla);
router.post('/importar', upload.single('archivo'), controller.importar);
router.put('/:idCurso/:idEstudiante', ...inscripcion,
  body('estado').isIn(['inscrito', 'retirado']).withMessage('estado: inscrito o retirado'), validate, controller.cambiarEstado);
router.delete('/:idCurso/:idEstudiante', ...inscripcion, validate, controller.quitar);

module.exports = router;
