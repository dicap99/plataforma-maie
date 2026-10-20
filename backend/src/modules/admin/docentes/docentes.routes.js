const { Router } = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const validate = require('../../../middlewares/validate');
const { ROLES } = require('../../../utils/roles');
const { PERIODO_REGEX } = require('../../../shared/crud/campos');
const { CAMPOS_EDITABLES } = require('./docentes.repository');
const controller = require('./docentes.controller');

const { DOCENTE, COORDINADOR } = ROLES;
const router = Router();

const soloDocente = [authenticate, authorize(DOCENTE)];
const soloCoord = [authenticate, authorize(COORDINADOR)];
const idDocente = param('id').isUUID().withMessage('Docente inválido');
const idCurso = param('idCurso').isInt({ min: 1 }).withMessage('Curso inválido').toInt();
// Participación en una oferta: promoción, periodo y curso (clase del plan).
const participacion = [
  body('id_cohorte').isInt({ min: 1 }).withMessage('Indique la promoción').toInt(),
  body('periodo').matches(PERIODO_REGEX).withMessage('El periodo debe tener formato AAAA-A o AAAA-B'),
  body('id_clase').isInt({ min: 1 }).withMessage('Indique el curso').toInt(),
];

// Montado en /api/v1/admin/docentes (antes del CRUD genérico, para que "me" no se tome como :id_docente)
router.get('/me/perfil', ...soloDocente, controller.obtenerPerfilPropio);
router.put(
  '/me/perfil',
  ...soloDocente,
  ...CAMPOS_EDITABLES.map((c) => body(c).optional({ values: 'null' }).isString().trim()),
  validate,
  controller.actualizarPerfilPropio,
);
router.post('/me/cursos', ...soloDocente, ...participacion, validate, controller.agregarCursoPropio);
router.delete('/me/cursos/:idCurso', ...soloDocente, idCurso, validate, controller.quitarCursoPropio);

router.get('/:id/perfil', ...soloCoord, idDocente, validate, controller.obtenerPerfil);
router.post('/:id/cursos', ...soloCoord, idDocente, ...participacion, validate, controller.agregarCurso);
router.delete('/:id/cursos/:idCurso', ...soloCoord, idDocente, idCurso, validate, controller.quitarCurso);

module.exports = router;
