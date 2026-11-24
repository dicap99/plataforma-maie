// Estudiantes que participaron en un producto de investigación (Gestión académica › Datos del programa ›
// Investigación y movilidad). La producción se registra aquí, no en la gestión de usuarios (decisión del
// usuario, 2026-11-24); la ficha del estudiante solo la consulta.
const { Router } = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../../../middlewares/authenticate');
const authorize = require('../../../middlewares/authorize');
const validate = require('../../../middlewares/validate');
const asyncHandler = require('../../../utils/asyncHandler');
const { success } = require('../../../utils/apiResponse');
const ApiError = require('../../../utils/ApiError');
const { ROLES } = require('../../../utils/roles');
const db = require('../../../config/db');

const router = Router();
const filas = async (sql, params) => (await db.query(sql, params)).rows;
const id = [param('id').isInt({ min: 1 }).withMessage('Producto inválido').toInt()];

const consultar = async (idProducto) => {
  const [producto] = await filas(`SELECT p.id_producto, p.id_cohorte, h.nombre AS cohorte, p.tipo, p.cita, p.estudiantes
                                  FROM productos_investigacion p JOIN cohortes h USING (id_cohorte) WHERE p.id_producto = $1`, [idProducto]);
  if (!producto) throw ApiError.notFound('Producto no encontrado');
  const estudiantes = await filas(
    `SELECT u.id_usuario, u.identificacion, u.nombres, u.apellidos,
            EXISTS (SELECT 1 FROM producto_estudiantes pe WHERE pe.id_producto = $1 AND pe.id_estudiante = u.id_usuario) AS vinculado
     FROM cohorte_estudiantes ce JOIN usuarios u ON u.id_usuario = ce.id_estudiante
     WHERE ce.id_cohorte = $2 ORDER BY u.apellidos, u.nombres`, [idProducto, producto.id_cohorte]);
  return { producto, estudiantes };
};

// GET /admin/productos/:id/estudiantes — estudiantes de la promoción del producto, con los vinculados marcados
router.get('/:id/estudiantes', authenticate, authorize(ROLES.COORDINADOR), ...id, validate,
  asyncHandler(async (req, res) => success(res, await consultar(req.params.id))));

// PUT /admin/productos/:id/estudiantes — { estudiantes: [uuid] } reemplaza los participantes registrados
router.put('/:id/estudiantes', authenticate, authorize(ROLES.COORDINADOR), ...id,
  body('estudiantes').isArray({ max: 200 }).withMessage('estudiantes debe ser una lista'),
  body('estudiantes.*').isUUID().withMessage('Estudiante inválido'), validate,
  asyncHandler(async (req, res) => {
    const { producto, estudiantes } = await consultar(req.params.id);
    const validos = new Set(estudiantes.map((e) => e.id_usuario));
    const ids = [...new Set(req.body.estudiantes)];
    const ajenos = ids.filter((x) => !validos.has(x));
    if (ajenos.length) throw ApiError.badRequest(`Hay estudiantes que no son de la promoción ${producto.cohorte}`, ajenos);
    await db.withTransaction(async (cliente) => {
      await cliente.query('DELETE FROM producto_estudiantes WHERE id_producto = $1', [producto.id_producto]);
      if (ids.length) {
        await cliente.query('INSERT INTO producto_estudiantes (id_producto, id_estudiante) SELECT $1, unnest($2::uuid[])', [producto.id_producto, ids]);
      }
    });
    success(res, await consultar(producto.id_producto));
  }));

module.exports = router;
