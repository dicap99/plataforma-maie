const { becaPrincipal, semestresConVariasBecas } = require('../src/utils/beneficios');
const { combinarBeneficios } = require('../src/modules/admin/reportes/reflejo');

describe('Beneficios del estudiante por semestre', () => {
  it('la beca de la promoción es la de más semestres (empate: la primera)', () => {
    expect(becaPrincipal([
      { semestre: 1, tipo: 'hora_catedra' }, { semestre: 2, tipo: '100' }, { semestre: 3, tipo: '100' },
      { semestre: 3, tipo: 'asistente_investigacion' },
    ])).toBe('100');
    expect(becaPrincipal([{ semestre: 2, tipo: '100' }, { semestre: 1, tipo: 'sintraunicol' }])).toBe('sintraunicol');
    expect(becaPrincipal([{ semestre: 1, tipo: 'ayudante_docencia' }])).toBeNull();
  });

  it('detecta semestres con más de una beca; asistencias y ayudantías no cuentan', () => {
    expect(semestresConVariasBecas([
      { semestre: 2, tipo: '100' }, { semestre: 2, tipo: 'hora_catedra' },
      { semestre: 1, tipo: '100' }, { semestre: 1, tipo: 'asistente_investigacion' },
    ])).toEqual([2]);
  });

  it('con beneficios por semestre, asistentes y ayudantes salen de ellos y quedan como columnas calculadas', () => {
    const [i, ii] = combinarBeneficios(
      [
        { id_cohorte: 1, cohorte: 'I', becas_100: 3, asistentes_investigacion: 4, ayudantes_docencia: 1 },
        { id_cohorte: 2, cohorte: 'II', becas_100: 0, asistentes_investigacion: 6, ayudantes_docencia: 2 },
      ],
      [
        { id_cohorte: 1, becas_100: 1, becas_hora_catedra: 0, becas_sintraunicol: 0, asistentes_investigacion: 2, ayudantes_docencia: 0, por_semestre: true },
        { id_cohorte: 2, becas_100: 2, becas_hora_catedra: 0, becas_sintraunicol: 0, asistentes_investigacion: 0, ayudantes_docencia: 0, por_semestre: false },
      ],
      [{ id_cohorte: 1, nombre: 'I' }, { id_cohorte: 2, nombre: 'II' }],
    );
    expect(i).toMatchObject({ becas_100: 1, asistentes_investigacion: 2, ayudantes_docencia: 0, origen: 'gestion' });
    expect(i.reflejados).toEqual(expect.arrayContaining(['becas_100', 'asistentes_investigacion', 'ayudantes_docencia']));
    // Sin beneficios por semestre: becas de los estudiantes, asistentes y ayudantes de la hoja.
    expect(ii).toMatchObject({ becas_100: 2, asistentes_investigacion: 6, ayudantes_docencia: 2 });
    expect(ii.reflejados).not.toContain('asistentes_investigacion');
  });
});
