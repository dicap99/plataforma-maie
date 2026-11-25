// Contraseñas temporales generadas por la plataforma (crear cuenta y restablecer).
const { generarPasswordTemporal, LONGITUD } = require('../src/utils/passwordTemporal');

describe('Contraseña temporal', () => {
  it('tiene la longitud fija, mayúscula, minúscula y dígito, sin caracteres confundibles', () => {
    for (let i = 0; i < 200; i += 1) {
      const p = generarPasswordTemporal();
      expect(p).toHaveLength(LONGITUD);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[2-9]/);
      expect(p).not.toMatch(/[0O1lI]/);
    }
  });

  it('no se repite', () => {
    const vistas = new Set(Array.from({ length: 500 }, generarPasswordTemporal));
    expect(vistas.size).toBe(500);
  });
});
