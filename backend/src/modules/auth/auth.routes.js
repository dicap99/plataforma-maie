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
router.put(
  '/me',
  authenticate,
  body('identificacion').optional().isString().trim().isLength({ min: 1, max: 20 }).withMessage('Identificación de 1 a 20 caracteres'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  validate,
  controller.actualizarCuenta,
);
router.put(
  '/password',
  authenticate,
  body('actual').notEmpty().withMessage('Contraseña actual requerida'),
  body('nueva').isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres'),
  validate,
  controller.cambiarPassword,
);

module.exports = router;
