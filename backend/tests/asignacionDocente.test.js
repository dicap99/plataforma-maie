const { periodoDelSemestre, ASIGNACION } = require('../src/modules/admin/importaciones/asignacionDocente');

describe('Hoja «Asignación docente»', () => {
  it('convierte el semestre de la promoción en su semestre académico', () => {
    expect(periodoDelSemestre('2021-A', 1)).toBe('2021-A');
    expect(periodoDelSemestre('2021-A', 2)).toBe('2021-B');
    expect(periodoDelSemestre('2021-B', 2)).toBe('2022-A');
    expect(periodoDelSemestre('2019-B', 4)).toBe('2021-A');
  });

  it('tiene las columnas acordadas en la reunión: promoción, semestre, docente, componente y curso', () => {
    expect(ASIGNACION.campos.map((c) => c.label)).toEqual([
      'Promoción', 'Semestre de la promoción', 'Docente', 'Componente', 'Curso (código o nombre de la clase)',
    ]);
  });
});
