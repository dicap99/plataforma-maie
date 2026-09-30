const { Router } = require('express');
const { body, param, query } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const validate = require('../../../middlewares/validate');
const { ROLES } = require('../../../utils/roles');
const controller = require('./cursos.controller');

const { COORDINADOR, DOCENTE } = ROLES;
const router = Router();

const PERIODO = /^[0-9]{4}-[AB]$/;
const lectura = [authenticate, authorize(COORDINADOR, DOCENTE)];
const soloCoord = [authenticate, authorize(COORDINADOR)];
const idValido = [param('id').isInt({ min: 1 }).withMessage('Identificador de curso inválido').toInt(), validate];

const listaUuid = (campo) => [
  body(campo).isArray().withMessage(`${campo} debe ser una lista`),
  body(`${campo}.*`).isUUID().withMessage(`${campo} contiene identificadores inválidos`),
];

const reglasOferta = [
  body('id_clase').isInt({ min: 1 }).withMessage('Clase requerida').toInt(),
  body('id_cohorte').isInt({ min: 1 }).withMessage('Promoción requerida').toInt(),
  body('periodo').matches(PERIODO).withMessage('Periodo con formato AAAA-A o AAAA-B'),
  body('grupo').optional().isInt({ min: 1, max: 99 }).toInt(),
  body('docentes').optional().isArray().withMessage('docentes debe ser una lista'),
  body('docentes.*').isUUID().withMessage('docentes contiene identificadores inválidos'),
  validate,
];

const filtros = [
  query('cohorte').optional().isInt({ min: 1 }).toInt(),
  query('catalogo').optional().isInt({ min: 1 }).toInt(),
  query('clase').optional().isInt({ min: 1 }).toInt(),
  query('docente').optional().isUUID().withMessage('Docente inválido'),
  query('periodo').optional().matches(PERIODO).withMessage('Periodo con formato AAAA-A o AAAA-B'),
  validate,
];

// Montado en /api/v1/admin/cursos
router.get('/catalogo', ...lectura, controller.catalogo);
router.get('/', ...lectura, ...filtros, controller.listar);
router.get('/:id', ...lectura, ...idValido, controller.obtener);
router.post('/', ...soloCoord, ...reglasOferta, controller.crear);
router.put('/:id', ...soloCoord, ...idValido, ...reglasOferta, controller.actualizar);
router.delete('/:id', ...soloCoord, ...idValido, controller.eliminar);
router.put('/:id/docentes', ...soloCoord, ...idValido, ...listaUuid('docentes'), validate, controller.asignarDocentes);
router.put('/:id/estudiantes', ...soloCoord, ...idValido, ...listaUuid('estudiantes'), validate, controller.inscribir);
router.post('/:id/estudiantes/cohorte', ...soloCoord, ...idValido, controller.matricularCohorte);

module.exports = router;
