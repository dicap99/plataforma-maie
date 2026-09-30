const r = require('../src/modules/ra/rubrica');

// Rúbrica de RA2 (Tabla 6): pesos 25 / 30 / 25 / 20
const RA2 = [
  { id_criterio: 1, orden: 1, peso_porcentaje: 25 },
  { id_criterio: 2, orden: 2, peso_porcentaje: 30 },
  { id_criterio: 3, orden: 3, peso_porcentaje: 25 },
  { id_criterio: 4, orden: 4, peso_porcentaje: 20 },
];

describe('Rúbricas RA — nivel de una nota (RF-RA-01)', () => {
  it.each([
    [5, 'Alto'], [4.5, 'Alto'], [4.495, 'Alto'], [4.49, 'Medio'], [4.44, 'Medio'], [3.5, 'Medio'],
    [3.49, 'Basico'], [3.44, 'Basico'], [3.0, 'Basico'], [2.99, 'Insuficiente'], [0, 'Insuficiente'],
  ])('%p → %s', (nota, nivel) => {
    expect(r.nivelDeNota(nota)).toBe(nivel);
  });

  it('rechaza notas fuera de 0–5 o no numéricas', () => {
    expect(() => r.nivelDeNota(-0.01)).toThrow(RangeError);
    expect(() => r.nivelDeNota(5.01)).toThrow(RangeError);
    expect(() => r.nivelDeNota('4')).toThrow(RangeError);
    expect(() => r.nivelDeNota(NaN)).toThrow(RangeError);
  });
});

describe('Rúbricas RA — pesos', () => {
  it('acepta pesos que suman 100', () => {
    expect(r.validarPesos(RA2)).toEqual({ valido: true, suma: 100, errores: [] });
    expect(r.validarPesos([{ orden: 1, peso_porcentaje: 33.33 }, { orden: 2, peso_porcentaje: 33.33 },
      { orden: 3, peso_porcentaje: 33.34 }]).valido).toBe(true);
  });

  it('rechaza sumas distintas de 100, pesos no positivos, órdenes repetidos y rúbricas vacías', () => {
    const suma95 = r.validarPesos(RA2.map((c) => (c.orden === 2 ? { ...c, peso_porcentaje: 25 } : c)));
    expect(suma95).toMatchObject({ valido: false, suma: 95 });
    expect(r.validarPesos([{ orden: 1, peso_porcentaje: 0 }, { orden: 2, peso_porcentaje: 100 }]).valido).toBe(false);
    expect(r.validarPesos(RA2.map((c) => ({ ...c, orden: 1 }))).errores)
      .toContain('El orden de los criterios no puede repetirse');
    expect(r.validarPesos([]).valido).toBe(false);
  });
});

describe('Rúbricas RA — total ponderado (RF-RA-03)', () => {
  it('reproduce la ficha de Aprendizaje Profundo del documento RA (2,88 × 25 % = 0,72)', () => {
    expect(r.totalPonderado(RA2, { 1: 2.88, 2: 0, 3: 0, 4: 0 }).total).toBe(0.72);
    // Criterios 4,88 · 4,91 · 5,00 · 5,00 → 4,94 (Alto)
    expect(r.resultadoRA(RA2, { 1: 4.88, 2: 4.91, 3: 5, 4: 5 })).toMatchObject({ total: 4.94, nivel: 'Alto', completo: true });
  });

  it('calcula en centésimas sin errores de coma flotante', () => {
    // 3.75×25 + 4.27×30 + 4.63×25 + 4.55×20 = 428.6 → 4.286 → 4.29
    expect(r.totalPonderado(RA2, { 1: 3.75, 2: 4.27, 3: 4.63, 4: 4.55 }).total).toBe(4.29);
    // 4.495 exacto se redondea hacia arriba
    const dos = [{ id_criterio: 1, peso_porcentaje: 50 }, { id_criterio: 2, peso_porcentaje: 50 }];
    expect(r.totalPonderado(dos, { 1: 4.49, 2: 4.5 }).total).toBe(4.5);
  });

  it('deja el total en null y lista los criterios faltantes si la rúbrica está incompleta', () => {
    expect(r.resultadoRA(RA2, new Map([[1, 4], [2, 4]]))).toEqual({ total: null, nivel: null, completo: false, faltantes: [3, 4] });
  });

  it('rechaza notas inválidas dentro de la rúbrica', () => {
    expect(() => r.totalPonderado(RA2, { 1: 6, 2: 4, 3: 4, 4: 4 })).toThrow(RangeError);
  });
});

describe('Rúbricas RA — consolidación y distribución (RF-RA-04)', () => {
  it('promedia los totales de un mismo RA y clasifica el promedio', () => {
    expect(r.consolidar([4.4, 4.6])).toEqual({ total: 4.5, nivel: 'Alto' });
    expect(r.consolidar([null, 3.2])).toEqual({ total: 3.2, nivel: 'Basico' });
    expect(r.consolidar([])).toEqual({ total: null, nivel: null });
  });

  it('agrupa unidades por estudiante y RA antes de contar', () => {
    const filas = [
      { id_estudiante: 'a', ra: 'RA5', total: 4.0 },
      { id_estudiante: 'a', ra: 'RA5', total: 5.0 },
      { id_estudiante: 'b', ra: 'RA5', total: 2.0 },
    ];
    const unidades = r.agruparUnidades(filas, (f) => `${f.id_estudiante}|${f.ra}`);
    expect(unidades).toHaveLength(2);
    expect(unidades[0]).toMatchObject({ id_estudiante: 'a', total: 4.5, nivel: 'Alto' });
  });

  it('cuenta estudiantes por nivel, con porcentajes que suman 1', () => {
    const unidades = [4.8, 4.6, 3.9, 3.1, 2.0].map((total, i) => ({ ra: 'RA1', total, id: i }))
      .concat([{ ra: 'RA2', total: 4.0 }, { ra: 'RA2', total: null }]);
    const [ra1, ra2] = r.distribucion(unidades, 'ra');
    expect(ra1).toMatchObject({ grupo: 'RA1', Alto: 2, Medio: 1, Basico: 1, Insuficiente: 1, evaluados: 5, promedio: 3.68 });
    expect(Object.values(ra1.pct).reduce((s, p) => s + p, 0)).toBeCloseTo(1);
    expect(ra2).toMatchObject({ grupo: 'RA2', Medio: 1, evaluados: 1 });
  });

  it('valida un RA contra la meta de % en Alto o Medio', () => {
    expect(r.validacion({ Alto: 5, Medio: 2, evaluados: 10 }, 70)).toBe('Cumple');
    expect(r.validacion({ Alto: 5, Medio: 1, evaluados: 10 }, 70)).toBe('En riesgo');
    expect(r.validacion({ evaluados: 0 }, 70)).toBe('Sin datos');
  });
});
