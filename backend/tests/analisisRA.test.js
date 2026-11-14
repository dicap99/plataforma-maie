// Análisis del programa (Módulo 2): funciones puras de reportes/analisis.js.
const { analizar, histograma, criterios } = require('../src/modules/ra/reportes/analisis');

const RAS = [
  { id_ra: 1, codigo: 'RA1', descripcion: 'uno' },
  { id_ra: 2, codigo: 'RA2', descripcion: 'dos' },
  { id_ra: 3, codigo: 'RA3', descripcion: 'tres' },
];

// Fila (oferta, estudiante, RA) como la devuelve reportes.repository.resultados.
let n = 0;
const fila = (total, { ra = 'RA1', est, cohorte = 1, periodo = '2025-A', catalogo = 1 } = {}) => ({
  id_curso: catalogo * 100 + cohorte, id_estudiante: est ?? `e${(n += 1)}`, id_ra: Number(ra.slice(2)), ra, total,
  id_cohorte: cohorte, cohorte: ['', 'I', 'II', 'III'][cohorte], periodo_inicio: `202${cohorte}-A`, periodo,
  id_catalogo: catalogo, curso_codigo: `MaIE-C${catalogo}`, curso_catalogo: `Curso ${catalogo}`, curso_orden: catalogo,
});

describe('Histograma de notas estudiante–RA', () => {
  it('usa intervalos de 0,5 alineados con los cortes de nivel y el 5,0 cae en el último', () => {
    const h = histograma([{ total: 0 }, { total: 2.99 }, { total: 3 }, { total: 3.49 }, { total: 3.5 }, { total: 4.49 }, { total: 4.5 }, { total: 5 }, { total: null }]);
    expect(h).toHaveLength(10);
    expect(h[0]).toMatchObject({ etiqueta: '0.0–0.5', nivel: 'Insuficiente', estudiantes: 1 });
    expect(h[5]).toMatchObject({ desde: 2.5, nivel: 'Insuficiente', estudiantes: 1 });
    expect(h[6]).toMatchObject({ desde: 3, nivel: 'Basico', estudiantes: 2 });
    expect(h[7]).toMatchObject({ desde: 3.5, nivel: 'Medio', estudiantes: 1 });
    expect(h[8]).toMatchObject({ desde: 4, nivel: 'Medio', estudiantes: 1 });
    expect(h[9]).toMatchObject({ desde: 4.5, nivel: 'Alto', estudiantes: 2 });
    expect(h.reduce((s, b) => s + b.estudiantes, 0)).toBe(8);
  });
});

describe('Desempeño por criterio de la rúbrica', () => {
  const nota = (id, calificacion) => ({ id_criterio: id, calificacion, ra: 'RA1', id_ra: 1, orden: id, nombre_criterio: `C${id}`, peso_porcentaje: 25 });

  it('ordena del promedio más bajo al más alto con su nivel y el % de notas insuficientes', () => {
    const r = criterios([nota(1, 4.8), nota(1, 4.6), nota(2, 3.4), nota(2, 3.4), nota(3, 5), nota(3, 4.9), nota(3, 4), nota(3, 2)]);
    expect(r.map((c) => c.id_criterio)).toEqual([2, 3, 1]);
    expect(r[0]).toMatchObject({ promedio: 3.4, nivel: 'Basico', Basico: 2, notas: 2 });
    expect(r[1]).toMatchObject({ promedio: 3.98, nivel: 'Medio', pct_insuficiente: 0.25 });
    expect(r[2]).toMatchObject({ promedio: 4.7, nivel: 'Alto', pct_insuficiente: 0 });
    expect(r.every((c) => !('bajo_desempeno' in c))).toBe(true); // sin umbrales propios
  });
});

describe('analizar: agregados del programa', () => {
  it('sin datos no inventa cifras', () => {
    const r = analizar({ filas: [], notas: [], ras: RAS, meta: 70 });
    expect(r.global.evaluados).toBe(0);
    expect(r.porRA.map((x) => x.evaluados)).toEqual([0, 0, 0]);
    expect(r.porRA.every((x) => x.validacion === 'Sin datos')).toBe(true);
    expect(r.histograma.every((b) => b.estudiantes === 0)).toBe(true);
    expect([r.porCohorte, r.porPeriodo, r.porCurso, r.criterios]).toEqual([[], [], [], []]);
    expect(r).not.toHaveProperty('conclusiones');
  });

  it('consolida al estudiante por RA, compara con la meta y agrupa por promoción, semestre y curso', () => {
    const filas = [
      // RA1: 6 estudiantes; 5 satisfactorios (83 %) → cumple
      ...[4.8, 4.6, 4.0, 3.6, 3.9, 2.0].map((t) => fila(t, { ra: 'RA1' })),
      // RA2: 5 estudiantes; 2 satisfactorios (40 %) → en riesgo
      ...[4.5, 3.5, 3.2, 3.0, 2.5].map((t) => fila(t, { ra: 'RA2', cohorte: 2, periodo: '2025-B' })),
      // El mismo estudiante en dos cursos con RA1: cuenta una vez con el promedio (4.0 y 2.0 → 3.0, Básico)
      fila(4.0, { ra: 'RA1', est: 'x', catalogo: 1 }), fila(2.0, { ra: 'RA1', est: 'x', catalogo: 2 }),
    ];
    const r = analizar({ filas, notas: [], ras: RAS, meta: 70 });
    expect(r.global).toMatchObject({ evaluados: 12, satisfactorio: 7 });
    const [ra1, ra2, ra3] = r.porRA;
    expect(ra1).toMatchObject({ evaluados: 7, Basico: 1, satisfactorio: 5, validacion: 'Cumple' });
    expect(ra2).toMatchObject({ evaluados: 5, satisfactorio: 2, validacion: 'En riesgo' });
    expect(ra3).toMatchObject({ evaluados: 0, validacion: 'Sin datos' });
    // Por curso del plan el estudiante «x» cuenta una vez en cada curso
    expect(r.porCurso.map((c) => c.evaluados)).toEqual([12, 1]);
    expect(r.porCohorte.map((c) => c.etiqueta)).toEqual(['Promoción I', 'Promoción II']);
    expect(r.porCohorte[0].ra.RA1).toMatchObject({ evaluados: 7 });
    expect(r.porPeriodo.map((c) => c.grupo)).toEqual(['2025-A', '2025-B']);

    expect(r.global.pct_satisfactorio).toBeCloseTo(7 / 12); // 58,3 % < 70 %
    expect(r.porCohorte.map((c) => c.validacion)).toEqual(['Cumple', 'En riesgo']);
  });
});
