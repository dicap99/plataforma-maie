const { separarNombre, correoTemporal } = require('../scripts/cuentasDocentes');
const { semestreDe } = require('../src/modules/admin/docentes/docentes.service');

describe('Docentes: cuentas temporales y semestre de la promoción', () => {
  test('separa nombres y apellidos del nombre del directorio', () => {
    expect(separarNombre('ANDRÉS DARÍO PANTOJA BUCHELI')).toEqual({ nombres: 'Andrés Darío', apellidos: 'Pantoja Bucheli' });
    expect(separarNombre('DARÍO FAJARDO FAJARDO')).toEqual({ nombres: 'Darío', apellidos: 'Fajardo Fajardo' });
    expect(separarNombre('JOHN BARCO')).toEqual({ nombres: 'John', apellidos: 'Barco' });
    expect(separarNombre('FLÓREZ')).toEqual({ nombres: 'Docente', apellidos: 'Flórez' });
  });

  test('el correo temporal no lleva tildes y no se repite', () => {
    const usados = new Set();
    expect(correoTemporal({ nombres: 'Germán Darío', apellidos: 'Obando Bravo' }, usados)).toBe('german.obando@temporal.maie.local');
    expect(correoTemporal({ nombres: 'Germán', apellidos: 'Obando' }, usados)).toBe('german.obando2@temporal.maie.local');
  });

  test('el semestre se cuenta desde el periodo de inicio de la promoción', () => {
    expect(semestreDe('2021-A', '2021-A')).toBe(1);
    expect(semestreDe('2022-A', '2021-A')).toBe(3);
    expect(semestreDe('2020-B', '2019-B')).toBe(3);
    expect(semestreDe('2021-A', '2021-B')).toBe(0);
  });
});
