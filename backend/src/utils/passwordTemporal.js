// Contraseñas temporales (decisión del usuario, 2026-11-25): las genera la plataforma al crear una cuenta o al
// restablecerla; Coordinación la ve una sola vez para entregarla y el usuario debe cambiarla al ingresar.
// Sin caracteres que se confunden al dictarla o copiarla (0/O, 1/l/I).
const crypto = require('crypto');

const MAYUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz';
const DIGITOS = '23456789';
const TODOS = MAYUSCULAS + MINUSCULAS + DIGITOS;
const LONGITUD = 10;

const al = (conjunto) => conjunto[crypto.randomInt(conjunto.length)];

const generarPasswordTemporal = () => {
  // Al menos una mayúscula, una minúscula y un dígito; el resto al azar, en orden aleatorio.
  const letras = [al(MAYUSCULAS), al(MINUSCULAS), al(DIGITOS), ...Array.from({ length: LONGITUD - 3 }, () => al(TODOS))];
  for (let i = letras.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [letras[i], letras[j]] = [letras[j], letras[i]];
  }
  return letras.join('');
};

module.exports = { generarPasswordTemporal, LONGITUD };
