// Avance de la calificación de rúbricas en semestres abiertos: alerta del Panel y aviso del Análisis (2026-11-25).
const { resumir, filtrar } = require('../src/modules/ra/periodos/avance');
const { calcular } = require('../src/modules/admin/reportes/alertas');

const curso = (cambios) => ({
  periodo: '2026-B', id_curso: 1, id_cohorte: 13, cohorte: 'VI', curso: 'Tesis I', docentes: ['Ana Pérez'], esperadas: 24, notas: 24, ...cambios,
});
const ESTADISTICAS = { promociones: { filas: [] }, presupuesto: { fecha_corte: '2026-11-01' }, parametros: {} };
const HOY = new Date(2026, 10, 25);

describe('Avance de la calificación de rúbricas', () => {
  it('solo informa los semestres con cursos incompletos', () => {
    const r = resumir([
      curso({ id_curso: 1, notas: 24 }),
      curso({ id_curso: 2, curso: 'Aprendizaje Profundo', notas: 4 }),
      curso({ id_curso: 3, curso: 'Formulación', notas: 0, esperadas: 48 }),
      curso({ periodo: '2026-A', id_curso: 4, notas: 24 }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ periodo: '2026-B', cursos: 3, completos: 1, notas: 28, esperadas: 96 });
    expect(r[0].pendientes.map((c) => [c.id_curso, c.faltan])).toEqual([[2, 20], [3, 48]]);
  });

  it('un curso sin estudiantes o sin rúbricas no queda pendiente', () => {
    expect(resumir([curso({ esperadas: 0, notas: 0 })])).toEqual([]);
  });

  it('se limita a los filtros del reporte (semestre y promoción)', () => {
    const r = resumir([curso({ notas: 0 }), curso({ id_curso: 2, id_cohorte: 12, cohorte: 'V', notas: 0 })]);
    expect(filtrar(r, { periodo: '2026-A' })).toEqual([]);
    expect(filtrar(r, { cohorte: '12' })[0].pendientes.map((c) => c.cohorte)).toEqual(['V']);
    expect(filtrar(r, {})[0].pendientes).toHaveLength(2);
  });

  it('alerta del Panel: un renglón por curso pendiente; crítico el que no tiene notas', () => {
    const resumen = resumir([curso({ notas: 24 }), curso({ id_curso: 2, notas: 4 }), curso({ id_curso: 3, notas: 0 })]);
    const a = calcular(ESTADISTICAS, [], HOY, resumen).find((x) => x.tipo === 'calificacion_ra');
    expect(a.nivel).toBe('atencion');
    expect(a.detalle).toMatch(/2026-B: 2 de 3 cursos/);
    expect(a.enlace.a).toBe('ra/calificacion');
    expect(a.items.map((i) => i.nivel)).toEqual(['atencion', 'critico']);
  });

  it('sin semestres abiertos incompletos no hay alerta', () => {
    expect(calcular(ESTADISTICAS, [], HOY, []).some((x) => x.tipo === 'calificacion_ra')).toBe(false);
  });
});
