// Huella de las constancias del EE (Módulo 3): no contiene identificadores en claro y depende de la clave.
const { huella } = require('../src/modules/evalDocente/anonimato');

const EST = '4ed965ea-f864-4a54-957e-8b3fe8d9771a';
const DOC = 'eb286f01-5f90-467e-a65c-3e4cabad376e';

describe('Anonimato del EE — huella de la constancia', () => {
  it('es determinista y de 64 caracteres hexadecimales', () => {
    const h = huella('clave', '2026-B', EST, DOC);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(huella('clave', '2026-B', EST, DOC)).toBe(h);
  });

  it('no contiene los identificadores del estudiante ni del docente', () => {
    const h = huella('clave', '2026-B', EST, DOC);
    for (const parte of [...EST.split('-'), ...DOC.split('-')]) expect(h).not.toContain(parte);
  });

  it('cambia con el semestre, el estudiante, el docente y la clave', () => {
    const base = huella('clave', '2026-B', EST, DOC);
    expect(huella('clave', '2026-A', EST, DOC)).not.toBe(base);
    expect(huella('clave', '2026-B', DOC, EST)).not.toBe(base);
    expect(huella('clave', '2026-B', EST, EST)).not.toBe(base);
    expect(huella('otra-clave', '2026-B', EST, DOC)).not.toBe(base);
  });

  it('exige la clave', () => {
    expect(() => huella('', '2026-B', EST, DOC)).toThrow(/EVAL_SECRETO/);
  });
});
