const { Router } = require('express');
const { body } = require('express-validator');
const authenticate = require('../../middlewares/authenticate');
const validate = require('../../middlewares/validate');
const controller = require('./auth.controller');

const router = Router();

// Montado en /api/v1/auth
router.post(
  '/login',
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
  validate,
  controller.login,
);
router.get('/me', authenticate, controller.me);

module.exports = router;
