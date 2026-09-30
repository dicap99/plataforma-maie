const asyncHandler = require('../../../utils/asyncHandler');
const requestContext = require('../../../utils/requestContext');
const { success } = require('../../../utils/apiResponse');
const service = require('./cursos.service');

// GET /api/v1/admin/cursos/catalogo
const catalogo = asyncHandler(async (req, res) => {
  success(res, await service.catalogo(requestContext(req)));
});

// GET /api/v1/admin/cursos
const listar = asyncHandler(async (req, res) => {
  success(res, await service.listar(requestContext(req)));
});

// GET /api/v1/admin/cursos/:id
const obtener = asyncHandler(async (req, res) => {
  success(res, await service.obtener(requestContext(req)));
});

// POST /api/v1/admin/cursos
const crear = asyncHandler(async (req, res) => {
  success(res, await service.crear(requestContext(req)), 201);
});

// PUT /api/v1/admin/cursos/:id
const actualizar = asyncHandler(async (req, res) => {
  success(res, await service.actualizar(requestContext(req)));
});

// DELETE /api/v1/admin/cursos/:id
const eliminar = asyncHandler(async (req, res) => {
  success(res, await service.eliminar(requestContext(req)));
});

// PUT /api/v1/admin/cursos/:id/docentes
const asignarDocentes = asyncHandler(async (req, res) => {
  success(res, await service.asignarDocentes(requestContext(req)));
});

// PUT /api/v1/admin/cursos/:id/estudiantes
const inscribir = asyncHandler(async (req, res) => {
  success(res, await service.inscribir(requestContext(req)));
});

// POST /api/v1/admin/cursos/:id/estudiantes/cohorte
const matricularCohorte = asyncHandler(async (req, res) => {
  success(res, await service.matricularCohorte(requestContext(req)));
});

module.exports = { catalogo, listar, obtener, crear, actualizar, eliminar, asignarDocentes, inscribir, matricularCohorte };
