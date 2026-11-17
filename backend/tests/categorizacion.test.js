// Categorización de usuarios del Módulo 3: quién evalúa a quién y con qué formulario (Acuerdo 058, Art. 3–6).
const {
  MATRIZ, CASOS_BORDE, unidadesDelPeriodo, asignacionesEstudiantes, autorizar, pendientesDe, recibeRespuestas,
} = require('../src/modules/evalDocente/categorizacion');

// Docentes: Ana (UDENAR, con cuenta), Beto (externo, con cuenta), Ciro (externo, SIN cuenta),
// Coral (UDENAR; su cuenta es la del coordinador).
const ANA = { id_docente: 'd-ana', id_usuario: 'u-ana', nombre: 'Ana', afiliacion: 'UDENAR' };
const BETO = { id_docente: 'd-beto', id_usuario: 'u-beto', nombre: 'Beto', afiliacion: 'EXTERNO' };
const CIRO = { id_docente: 'd-ciro', id_usuario: null, nombre: 'Ciro', afiliacion: 'EXTERNO' };
const CORAL = { id_docente: 'd-coral', id_usuario: 'u-coord', nombre: 'Coral', afiliacion: 'UDENAR' };

// Semestre 2026-B: promoción VI (inicio 2026-A) y VII (inicio 2026-B).
const VI = { id_cohorte: 6, cohorte: 'VI', cohorte_inicio: '2026-A' };
const VII = { id_cohorte: 7, cohorte: 'VII', cohorte_inicio: '2026-B' };
const ofertas = [
  { id_curso: 1, ...VI, clase: 'Robótica', docentes: [ANA, BETO] },      // oferta con dos docentes
  { id_curso: 2, ...VI, clase: 'Control óptimo', docentes: [ANA] },      // Ana: dos ofertas en la VI
  { id_curso: 3, ...VII, clase: 'Optimización', docentes: [ANA] },       // Ana también en la VII
  { id_curso: 4, ...VII, clase: 'Sistemas lineales', docentes: [CIRO, CORAL] },
];

const pos = (id_curso, id_estudiante, extra = {}) => ({ id_curso, id_estudiante, id_cohorte_estudiante: extra.cohorte ?? 6, estado_promocion: 'matriculado', activo: true, ...extra });
const pre = (id_curso, id_estudiante, extra = {}) => ({ id_curso, id_estudiante, estado: 'inscrito', activo: true, ...extra });

const posgrado = [
  pos(1, 'e-luis'), pos(2, 'e-luis'),              // Luis: dos cursos con Ana en la VI
  pos(1, 'e-rita', { estado_promocion: 'retirado' }), // Rita: retirada de la promoción
  pos(1, 'e-inac', { activo: false }),              // cuenta inactiva
  pos(4, 'e-vale', { cohorte: 7 }), pos(1, 'e-vale', { cohorte: 7 }), // Vale (VII) repite Robótica en la VI
];
const pregrado = [
  pre(1, 'p-sol'), pre(3, 'p-sol'),                // Sol: Ana en la VI y en la VII
  pre(4, 'p-tom', { estado: 'retirado' }),
  pre(2, 'e-luis'),                                 // Luis también figura como pregrado con Ana
];

describe('Matriz de categorización documentada', () => {
  it('declara los tres formularios del Art. 3 y su fuente', () => {
    expect(MATRIZ.map((m) => m.formulario)).toEqual(['EE', 'EE', 'EC', 'AE', '—']);
    for (const m of MATRIZ) expect(m.fuente).toMatch(/Acuerdo 058/);
    expect(CASOS_BORDE.length).toBeGreaterThanOrEqual(10);
  });
});

describe('Unidades evaluables: docente × promoción del semestre', () => {
  const unidades = unidadesDelPeriodo(ofertas);

  it('un docente con varias ofertas en la misma promoción es UNA unidad; en dos promociones son DOS', () => {
    const ana = unidades.filter((u) => u.id_docente === 'd-ana');
    expect(ana.map((u) => u.cohorte)).toEqual(['VI', 'VII']);
    expect(ana[0].cursos.map((c) => c.clase)).toEqual(['Robótica', 'Control óptimo']);
  });

  it('cada docente de una oferta compartida es una unidad propia; externos y UDENAR por igual', () => {
    expect(unidades.map((u) => `${u.docente}|${u.cohorte}`).sort())
      .toEqual(['Ana|VI', 'Ana|VII', 'Beto|VI', 'Ciro|VII', 'Coral|VII']);
    expect(unidades.find((u) => u.docente === 'Beto').afiliacion).toBe('EXTERNO');
  });
});

describe('Estudiantes (EE): a quién evalúa cada uno', () => {
  const soloPosgrado = asignacionesEstudiantes({ ofertas, posgrado, pregrado, incluyePregrado: false });
  const conPregrado = asignacionesEstudiantes({ ofertas, posgrado, pregrado, incluyePregrado: true });
  const de = (mapa, e) => (mapa.get(e) ?? []).map((a) => `${a.docente}|${a.cohorte}|${a.poblacion}`);

  it('estudiante en varios cursos del mismo docente lo evalúa UNA vez; oferta con dos docentes → evalúa a ambos', () => {
    expect(de(soloPosgrado, 'e-luis')).toEqual(['Ana|VI|posgrado', 'Beto|VI|posgrado']);
    expect(soloPosgrado.get('e-luis')[0].cursos).toEqual(['Control óptimo', 'Robótica']);
  });

  it('retirado de la promoción o con la cuenta inactiva no evalúa', () => {
    expect(soloPosgrado.has('e-rita')).toBe(false);
    expect(soloPosgrado.has('e-inac')).toBe(false);
  });

  it('con el mismo docente en dos promociones cuenta en la PROPIA; si no es ninguna, en la más antigua', () => {
    expect(de(soloPosgrado, 'e-vale')).toEqual(['Ana|VI|posgrado', 'Beto|VI|posgrado', 'Ciro|VII|posgrado', 'Coral|VII|posgrado']);
    // Sol (pregrado) tiene a Ana en la VI y en la VII: una sola evaluación, en la VI (más antigua).
    expect(de(conPregrado, 'p-sol')).toEqual(['Ana|VI|pregrado', 'Beto|VI|pregrado']);
  });

  it('pregrado solo evalúa si el semestre lo incluye; retirado de la lista no evalúa', () => {
    expect(soloPosgrado.has('p-sol')).toBe(false);
    expect(conPregrado.has('p-tom')).toBe(false);
  });

  it('si es posgrado y pregrado con el mismo docente, cuenta como posgrado', () => {
    expect(de(conPregrado, 'e-luis')).toEqual(['Ana|VI|posgrado', 'Beto|VI|posgrado']);
  });
});

describe('Autorización por formulario', () => {
  const unidades = unidadesDelPeriodo(ofertas);
  const asignaciones = asignacionesEstudiantes({ ofertas, posgrado, pregrado, incluyePregrado: true });
  const estudiante = (id) => ({ rol: 'estudiante', id_usuario: id, id_docente_propio: null });
  const coordinador = { rol: 'coordinador', id_usuario: 'u-coord', id_docente_propio: 'd-coral' };
  const ana = { rol: 'docente', id_usuario: 'u-ana', id_docente_propio: 'd-ana' };
  const ctx = (id) => ({ unidades, asignaciones: asignaciones.get(id) ?? [] });

  it('EE: el estudiante evalúa solo a sus docentes; la promoción y la población las fija la plataforma', () => {
    expect(autorizar(estudiante('p-sol'), 'EE', { id_docente: 'd-ana', id_cohorte: 7 }, ctx('p-sol')))
      .toEqual({ permitido: true, id_cohorte: 6, poblacion: 'pregrado' });
    expect(autorizar(estudiante('e-luis'), 'EE', { id_docente: 'd-ciro' }, ctx('e-luis')).permitido).toBe(false);
  });

  it('EE no es para docentes ni para Coordinación', () => {
    expect(autorizar(ana, 'EE', { id_docente: 'd-beto' }, ctx('u-ana')).motivo).toMatch(/solo para estudiantes/);
    expect(autorizar(coordinador, 'EE', { id_docente: 'd-beto' }, ctx('u-coord')).permitido).toBe(false);
  });

  it('EC: Coordinación evalúa a cualquier docente con oferta en esa promoción, salvo su propio perfil', () => {
    expect(autorizar(coordinador, 'EC', { id_docente: 'd-ciro', id_cohorte: 7 }, ctx()).permitido).toBe(true); // externo sin cuenta
    expect(autorizar(coordinador, 'EC', { id_docente: 'd-ciro', id_cohorte: 6 }, ctx()).permitido).toBe(false); // no tiene oferta en la VI
    expect(autorizar(coordinador, 'EC', { id_docente: 'd-coral', id_cohorte: 7 }, ctx()).motivo).toMatch(/conflicto de interés/);
    expect(autorizar(ana, 'EC', { id_docente: 'd-beto', id_cohorte: 6 }, ctx()).permitido).toBe(false);
  });

  it('AE: solo el propio docente (también si es coordinador), en cada promoción donde tiene oferta', () => {
    expect(autorizar(ana, 'AE', { id_docente: 'd-ana', id_cohorte: 6 }, ctx()).permitido).toBe(true);
    expect(autorizar(ana, 'AE', { id_docente: 'd-ana', id_cohorte: 7 }, ctx()).permitido).toBe(true);
    expect(autorizar(ana, 'AE', { id_docente: 'd-beto', id_cohorte: 6 }, ctx()).motivo).toMatch(/propia autoevaluación/);
    expect(autorizar(coordinador, 'AE', { id_docente: 'd-coral', id_cohorte: 7 }, ctx()).permitido).toBe(true);
    expect(autorizar({ rol: 'docente', id_usuario: 'u-x', id_docente_propio: null }, 'AE', { id_docente: 'd-ciro', id_cohorte: 7 }, ctx()).permitido)
      .toBe(false);
    expect(autorizar(estudiante('e-luis'), 'AE', { id_docente: 'd-ana', id_cohorte: 6 }, ctx()).permitido).toBe(false);
  });

  it('formulario desconocido', () => {
    expect(autorizar(ana, 'XX', {}, ctx()).permitido).toBe(false);
  });
});

describe('Pendientes por actor', () => {
  const unidades = unidadesDelPeriodo(ofertas);
  const asignaciones = asignacionesEstudiantes({ ofertas, posgrado, pregrado, incluyePregrado: false });

  it('estudiante: un EE por docente, marcado si ya hay constancia', () => {
    const p = pendientesDe({ rol: 'estudiante' }, { asignaciones: asignaciones.get('e-luis') }, { ee: new Set(['d-ana']) });
    expect(p.map((x) => [x.tipo, x.docente, x.diligenciado])).toEqual([['EE', 'Ana', true], ['EE', 'Beto', false]]);
  });

  it('coordinador con perfil docente: EC de todas las unidades menos la suya, y su propia AE', () => {
    const p = pendientesDe({ rol: 'coordinador', id_docente_propio: 'd-coral' }, { unidades }, { ecAe: new Set(['EC|d-ana|6']) });
    expect(p.filter((x) => x.tipo === 'EC').map((x) => `${x.docente}|${x.cohorte}|${x.diligenciado}`))
      .toEqual(['Ana|VI|true', 'Beto|VI|false', 'Ana|VII|false', 'Ciro|VII|false']);
    expect(p.filter((x) => x.tipo === 'AE').map((x) => `${x.docente}|${x.cohorte}`)).toEqual(['Coral|VII']);
  });

  it('docente: una AE por promoción en la que tiene oferta', () => {
    const p = pendientesDe({ rol: 'docente', id_docente_propio: 'd-ana' }, { unidades });
    expect(p.map((x) => `${x.tipo}|${x.cohorte}`)).toEqual(['AE|VI', 'AE|VII']);
  });
});

describe('Recepción de respuestas según la habilitación del semestre', () => {
  const hoy = new Date(2026, 10, 16);
  it.each([
    [null, false, /no está habilitada/],
    [{ habilitada: false }, false, /no está habilitada/],
    [{ habilitada: true }, true, null],
    [{ habilitada: true, fecha_apertura: '2026-11-17' }, false, /abre el 2026-11-17/],
    [{ habilitada: true, fecha_cierre: '2026-11-15' }, false, /cerró el 2026-11-15/],
    [{ habilitada: true, fecha_apertura: '2026-11-16', fecha_cierre: '2026-11-16' }, true, null],
    [{ habilitada: false, publicado: true }, false, /publicaron/],
  ])('%j', (periodo, abierta, motivo) => {
    const r = recibeRespuestas(periodo, hoy);
    expect(r.abierta).toBe(abierta);
    if (motivo) expect(r.motivo).toMatch(motivo);
  });
});
