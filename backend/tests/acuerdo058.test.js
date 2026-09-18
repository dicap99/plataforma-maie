const { categorizar } = require('../src/modules/evalDocente/acuerdo058');

describe('Acuerdo 058 — categorización (RF-EVAL-03)', () => {
  it.each([
    [100, 'Gran Fortaleza'],
    [80, 'Gran Fortaleza'],
    [79.9, 'Fortaleza'],
    [60, 'Fortaleza'],
    [59.9, 'Transición'],
    [40, 'Transición'],
    [39.9, 'Debilidad'],
    [20, 'Debilidad'],
    [19.9, 'Gran Debilidad'],
    [0, 'Gran Debilidad'],
  ])('%IP %p → %s', (ip, categoria) => {
    expect(categorizar(ip)).toBe(categoria);
  });

  it('rechaza valores fuera de rango', () => {
    expect(() => categorizar(101)).toThrow(RangeError);
    expect(() => categorizar(-1)).toThrow(RangeError);
  });
});
