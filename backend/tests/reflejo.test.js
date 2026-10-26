const { combinarCohortes, combinarBeneficios, combinarSemestres } = require('../src/modules/admin/reportes/reflejo');

const hojaCohortes = [
  { id_cohorte: 1, nombre: 'I', inscritos: 12, matriculados: 11, aprobados_sem1: 9, egresados: 9, graduados: 9 },
  { id_cohorte: 2, nombre: 'II', inscritos: 8, matriculados: 8, aprobados_sem1: 8, egresados: null, graduados: 0 },
];

describe('Reflejo de Gestión académica en Información académica', () => {
  it('las promociones con estudiantes registrados toman sus cifras de Gestión; las demás conservan la hoja', () => {
    const [i, ii] = combinarCohortes(hojaCohortes, [
      { id_cohorte: 2, inscritos: 9, matriculados: 7, egresados: 0, graduados: 0 },
    ]);
    expect(i).toMatchObject({ inscritos: 12, matriculados: 11, egresados: 9, origen: 'registro' });
    expect(ii).toMatchObject({ inscritos: 9, matriculados: 7, egresados: null, graduados: 0, aprobados_sem1: 8, origen: 'gestion' });
  });

  it('las becas por tipo salen de los estudiantes y el resto de beneficios de la hoja', () => {
    const filas = combinarBeneficios(
      [{ id_cohorte: 1, cohorte: 'I', becas_100: 3, becas_hora_catedra: 0, becas_sintraunicol: 0, asistentes_investigacion: 4, ayudantes_docencia: 1 }],
      [
        { id_cohorte: 1, becas_100: 1, becas_hora_catedra: 2, becas_sintraunicol: 0 },
        { id_cohorte: 2, becas_100: 0, becas_hora_catedra: 0, becas_sintraunicol: 1 },
      ],
      hojaCohortes,
    );
    expect(filas[0]).toMatchObject({ becas_100: 1, becas_hora_catedra: 2, asistentes_investigacion: 4, origen: 'gestion' });
    expect(filas[1]).toMatchObject({ id_cohorte: 2, cohorte: 'II', becas_sintraunicol: 1, asistentes_investigacion: 0, origen: 'gestion' });
    // Sin fila en la hoja: al editarla desde Información académica se crea en lugar de actualizarse.
    expect(filas[0].sin_registro).toBeUndefined();
    expect(filas[1].sin_registro).toBe(true);
  });

  it('cada semestre con clases ofertadas sale de las ofertas; los demás conservan la hoja', () => {
    const filas = combinarSemestres(
      [
        { id_cohorte: 1, semestre: 1, n_cursos: 3, docentes_udenar: 2, docentes_externos: 1 },
        { id_cohorte: 2, semestre: 1, n_cursos: 5, docentes_udenar: 5, docentes_externos: 0 },
        { id_cohorte: 2, semestre: 2, n_cursos: 4, docentes_udenar: 2, docentes_externos: 2 },
      ],
      [{ id_cohorte: 2, semestre: 1, n_cursos: 3, docentes_udenar: 1, docentes_externos: 2 }],
      hojaCohortes,
    );
    expect(filas).toEqual([
      expect.objectContaining({ id_cohorte: 1, n_cursos: 3, origen: 'registro' }),
      expect.objectContaining({ id_cohorte: 2, n_cursos: 3, docentes_externos: 2, cohorte: 'II', origen: 'gestion' }),
      expect.objectContaining({ id_cohorte: 2, semestre: 2, n_cursos: 4, origen: 'registro' }),
    ]);
  });
});

describe('Producción científica por producto', () => {
  const { combinarProduccion } = require('../src/modules/admin/reportes/reflejo');

  it('las promociones con productos cuentan por tipo y listan las citas; las demás conservan la hoja', () => {
    const filas = combinarProduccion(
      [
        { id_cohorte: 1, cohorte: 'I', articulos: 5, ponencias: 2, software: 0, prototipos: 0, tesis: 9, detalles: 'histórico' },
        { id_cohorte: 2, cohorte: 'II', articulos: 1, ponencias: 0, software: 0, prototipos: 0, tesis: 0, detalles: null },
      ],
      [
        { id_cohorte: 2, tipo: 'Artículo', cita: 'Pérez, A. «Control MPC». Rev. X, 2024.', anio: 2024 },
        { id_cohorte: 2, tipo: 'Artículo', cita: 'Gómez, B. «Redes 5G». Rev. Y.', anio: null },
        { id_cohorte: 2, tipo: 'Tesis', cita: 'Ruiz, C. «Robótica móvil».', anio: 2025 },
        { id_cohorte: 3, tipo: 'Software', cita: 'MaIE-Sim v1', anio: 2026 },
      ],
      hojaCohortes.concat({ id_cohorte: 3, nombre: 'III' }),
    );
    expect(filas[0]).toMatchObject({ articulos: 5, detalles: 'histórico', origen: 'registro' });
    expect(filas[1]).toMatchObject({ articulos: 2, ponencias: 0, tesis: 1, origen: 'gestion' });
    expect(filas[1].detalles.split('\n')).toEqual([
      '• Artículo: Pérez, A. «Control MPC». Rev. X, 2024. (2024)',
      '• Artículo: Gómez, B. «Redes 5G». Rev. Y.',
      '• Tesis: Ruiz, C. «Robótica móvil». (2025)',
    ]);
    expect(filas[2]).toMatchObject({ id_cohorte: 3, cohorte: 'III', software: 1, articulos: 0, sin_registro: true });
  });
});
