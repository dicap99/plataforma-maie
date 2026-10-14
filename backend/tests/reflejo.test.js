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
  });

  it('los semestres de una promoción con clases ofertadas salen de las ofertas', () => {
    const filas = combinarSemestres(
      [
        { id_cohorte: 1, semestre: 1, n_cursos: 3, docentes_udenar: 2, docentes_externos: 1 },
        { id_cohorte: 2, semestre: 1, n_cursos: 5, docentes_udenar: 5, docentes_externos: 0 },
      ],
      [{ id_cohorte: 2, semestre: 1, n_cursos: 3, docentes_udenar: 1, docentes_externos: 2 }],
      hojaCohortes,
    );
    expect(filas).toEqual([
      expect.objectContaining({ id_cohorte: 1, n_cursos: 3, origen: 'registro' }),
      expect.objectContaining({ id_cohorte: 2, n_cursos: 3, docentes_externos: 2, cohorte: 'II', origen: 'gestion' }),
    ]);
  });
});
