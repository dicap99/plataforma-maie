const { Router } = require('express');
const { body } = require('express-validator');
const authenticate = require('../../middlewares/authenticate');
const validate = require('../../middlewares/validate');
const controller = require('./auth.controller');

const router = Router();

// Montado en /api/v1/auth
router.post(
  '/login',
  // Se ingresa con la identificación (decisión del usuario, 2026-11-25); el correo se sigue aceptando por
  // compatibilidad con integraciones y pruebas existentes.
  body('identificacion').optional().isString().trim().isLength({ min: 1, max: 20 }).withMessage('Identificación inválida'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body().custom((b) => Boolean(b.identificacion || b.email)).withMessage('Ingrese su identificación'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
  validate,
  controller.login,
);
router.get('/me', authenticate, controller.me);
// Identificación, correo y teléfono los gestiona Coordinación (/usuarios); cada usuario solo cambia su contraseña.
router.put(
  '/password',
  authenticate,
  body('actual').notEmpty().withMessage('Contraseña actual requerida'),
  body('nueva').isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres'),
  validate,
  controller.cambiarPassword,
);

module.exports = router;
