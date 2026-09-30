const { generar, CATALOGO, CRITERIOS_POR_RA, DOMINIO, aIndice, aPeriodo } = require('../scripts/sintetico/generador');

describe('Datos sintéticos del Módulo 2', () => {
  const datos = generar({ semilla: 42 });

  it('son deterministas: la misma semilla produce los mismos datos y otra semilla no', () => {
    expect(generar({ semilla: 42 })).toEqual(datos);
    expect(generar({ semilla: 43 })).not.toEqual(datos);
  });

  it('usan identidades sintéticas únicas, fuera del dominio institucional', () => {
    const personas = [...datos.docentes, ...datos.estudiantes];
    expect(new Set(personas.map((p) => p.email)).size).toBe(personas.length);
    expect(new Set(personas.map((p) => p.identificacion)).size).toBe(personas.length);
    expect(personas.every((p) => p.email.endsWith(`@${DOMINIO}`) && p.identificacion.startsWith('SIN-'))).toBe(true);
  });

  it('producen notas entre 0 y 5 con dos decimales y cubren los cuatro niveles', () => {
    const notas = datos.calificaciones.map((c) => c.calificacion);
    expect(notas.every((n) => n >= 0 && n <= 5 && Math.round(n * 100) === Math.round(n * 100 * 1e6) / 1e6)).toBe(true);
    expect(Math.min(...notas)).toBeLessThan(3);
    expect(Math.max(...notas)).toBeGreaterThanOrEqual(4.5);
  });

  it('solo califican RA que el curso evalúa y criterios existentes de la rúbrica', () => {
    const cursos = new Map(datos.cursos.map((c) => [c.clave, c]));
    const ras = new Map(CATALOGO.map((k) => [k.codigo, k.ras]));
    for (const n of datos.calificaciones) {
      expect(ras.get(cursos.get(n.curso).catalogo)).toContain(n.ra);
      expect(n.orden).toBeGreaterThanOrEqual(1);
      expect(n.orden).toBeLessThanOrEqual(CRITERIOS_POR_RA);
      expect(cursos.get(n.curso).docentes).toContain(n.docente);
    }
  });

  it('califican solo a estudiantes inscritos, y se inscriben estudiantes de la promoción de la oferta', () => {
    const inscritos = new Set(datos.inscripciones.map((i) => `${i.curso}|${i.estudiante}`));
    expect(datos.calificaciones.every((n) => inscritos.has(`${n.curso}|${n.estudiante}`))).toBe(true);
    const cohorteDe = new Map(datos.estudiantes.map((e) => [e.email, e.cohorte]));
    const cursos = new Map(datos.cursos.map((c) => [c.clave, c]));
    expect(datos.inscripciones.every((i) => cohorteDe.get(i.estudiante) === cursos.get(i.curso).cohorte)).toBe(true);
  });

  it('no crean ofertas posteriores al periodo actual ni inscriben retirados después del semestre II', () => {
    expect(datos.cursos.every((c) => aIndice(c.periodo) <= aIndice('2026-B'))).toBe(true);
    const retirados = new Set(datos.estudiantes.filter((e) => e.estado === 'retirado').map((e) => e.email));
    const semestre = new Map(CATALOGO.map((k) => [k.codigo, k.semestre]));
    const cursos = new Map(datos.cursos.map((c) => [c.clave, c]));
    const tardias = datos.inscripciones.filter((i) => retirados.has(i.estudiante) && semestre.get(cursos.get(i.curso).catalogo) > 2);
    expect(tardias).toEqual([]);
  });

  it('convierte periodos académicos en índices y de vuelta', () => {
    expect(aPeriodo(aIndice('2025-B') + 1)).toBe('2026-A');
    expect(aPeriodo(aIndice('2025-A') + 3)).toBe('2026-B');
  });
});
