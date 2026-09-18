const asyncHandler = require('../../utils/asyncHandler');
const requestContext = require('../../utils/requestContext');
const { success } = require('../../utils/apiResponse');
const service = require('./auth.service');

// POST /api/v1/auth/login
const login = asyncHandler(async (req, res) => {
  success(res, await service.login(requestContext(req)));
});

// GET /api/v1/auth/me
const me = asyncHandler(async (req, res) => {
  success(res, await service.me(requestContext(req)));
});

module.exports = { login, me };
