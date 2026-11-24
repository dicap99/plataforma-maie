// Módulo 3 (Evaluación Docente, Acuerdo 058) de punta a punta contra PostgreSQL, sobre la base
// "maie_test_ed" poblada con datos sintéticos (semilla fija) de los módulos 1, 2 y 3.
const { URL_PRUEBAS_ED } = require('./baseDePruebas');

process.env.DATABASE_URL = URL_PRUEBAS_ED;

const request = require('supertest');
const ExcelJS = require('exceljs');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { generar, PREGUNTAS_058 } = require('../../scripts/sintetico/generador');
const { cargar } = require('../../scripts/sintetico/cargador');
const { consolidar } = require('../../src/modules/evalDocente/resultados/consolidado');
const { asignacionesEstudiantes } = require('../../src/modules/evalDocente/categorizacion');

const API = '/api/v1';
const COORD = { email: 'coordinacion.maie@udenar.edu.co', password: 'CambiarMaIE2026' };
const PASSWORD = 'Sintetico-Pruebas-2026';
const ACTUAL = '2026-B';

const login = async (email, password = PASSWORD) => (await request(app).post(`${API}/auth/login`).send({ email, password })).body.data?.token;
const conToken = (token) => ({
  get: (url) => request(app).get(`${API}${url}`).set('Authorization', `Bearer ${token}`),
  post: (url, body) => request(app).post(`${API}${url}`).set('Authorization', `Bearer ${token}`).send(body),
  put: (url, body) => request(app).put(`${API}${url}`).set('Authorization', `Bearer ${token}`).send(body),
  delete: (url) => request(app).delete(`${API}${url}`).set('Authorization', `Bearer ${token}`),
  subir: (url, nombre, buffer) => request(app).post(`${API}${url}`).set('Authorization', `Bearer ${token}`).attach('archivo', buffer, nombre),
  descargar: (url) => request(app).get(`${API}${url}`).set('Authorization', `Bearer ${token}`)
    .buffer(true).parse((res, cb) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); }),
});
const filas = async (sql, params) => (await db.query(sql, params)).rows;

const datos = generar({ semilla: 42 });
const m3 = datos.modulo3;
let coord;
let ids; // { docente: email → id_docente, usuario: email → id_usuario, cohorte: nombre → id }
let formularios; // { EE: { codigo → id_pregunta } … }

// Respuestas completas (todas MA) para un formulario.
const completas = (tipo, valor = 'MA') => Object.fromEntries(Object.values(formularios[tipo]).map((id) => [id, valor]));

beforeAll(async () => {
  await db.withTransaction((cliente) => cargar(cliente, datos, { password: PASSWORD, modulo3: true }));
  coord = conToken(await login(COORD.email, COORD.password));
  const docentes = await filas(`SELECT u.email, d.id_docente FROM docentes_perfil d JOIN usuarios u ON u.id_usuario = d.id_usuario`);
  const usuarios = await filas('SELECT email, id_usuario FROM usuarios');
  const cohortes = await filas('SELECT nombre, id_cohorte FROM cohortes');
  ids = {
    docente: new Map(docentes.map((d) => [d.email, d.id_docente])),
    usuario: new Map(usuarios.map((u) => [u.email, u.id_usuario])),
    cohorte: new Map(cohortes.map((c) => [c.nombre, c.id_cohorte])),
  };
  formularios = {};
  for (const tipo of ['EE', 'EC', 'AE']) {
    const r = await coord.get(`/eval-docente/formularios/${tipo}`);
    formularios[tipo] = Object.fromEntries(r.body.data.caracteristicas.flatMap((c) => c.preguntas.map((p) => [p.codigo, p.id_pregunta])));
  }
});

afterAll(() => db.pool.end());

// Asignaciones del semestre actual calculadas con la regla pura sobre los datos generados (oráculo).
const asignacionesGeneradas = (incluyePregrado = true) => {
  const inicio = new Map(datos.cohortes.map((h) => [h.nombre, h.periodo_inicio]));
  const estado = new Map(datos.estudiantes.map((e) => [e.email, e]));
  const cursos = datos.cursos.filter((c) => c.periodo === ACTUAL);
  const claves = new Set(cursos.map((c) => c.clave));
  return asignacionesEstudiantes({
    ofertas: cursos.map((c) => ({ id_curso: c.clave, id_cohorte: c.cohorte, cohorte: c.cohorte, cohorte_inicio: inicio.get(c.cohorte), clase: c.clase, docentes: c.docentes.map((d) => ({ id_docente: d, nombre: d })) })),
    posgrado: datos.inscripciones.filter((i) => claves.has(i.curso)).map((i) => ({ id_curso: i.curso, id_estudiante: i.estudiante, activo: true, id_cohorte_estudiante: estado.get(i.estudiante).cohorte, estado_promocion: estado.get(i.estudiante).estado })),
    pregrado: m3.pregrado.flatMap((p) => p.cursos.filter((c) => claves.has(c)).map((c) => ({ id_curso: c, id_estudiante: p.email, estado: 'inscrito', activo: true }))),
    incluyePregrado,
  });
};

describe('Instrumentos del Acuerdo 058 (RF-EVAL-01)', () => {
  it('EE (Art. 4), EC (Art. 5) y AE (Art. 6) con su numeración y características', async () => {
    for (const [tipo, estructura] of Object.entries(PREGUNTAS_058)) {
      const r = await coord.get(`/eval-docente/formularios/${tipo}`);
      expect(r.status).toBe(200);
      expect(Object.fromEntries(r.body.data.caracteristicas.map((c) => [c.caracteristica, c.preguntas.length]))).toEqual(estructura);
      expect(r.body.data.valores.map((v) => v.valor)).toEqual(['MA', 'A', 'I', 'MI', 'NA']);
    }
    const ee = (await coord.get('/eval-docente/formularios/EE')).body.data;
    expect(ee.caracteristicas[0]).toMatchObject({ caracteristica: 0, nombre: 'Autoevaluación del estudiante', cuenta_docente: false });
    expect(ee.caracteristicas[0].preguntas[0].escala).toMatch(/12–10 h\/semana/);
  });

  it('expone la matriz de quién evalúa a quién', async () => {
    const r = await coord.get('/eval-docente/categorizacion');
    expect(r.body.data.matriz.map((m) => m.formulario)).toEqual(['EE', 'EE', 'EC', 'AE', '—']);
  });
});

describe('Habilitación por semestre y avance', () => {
  it('lista los semestres con su configuración; el actual recibe respuestas y su avance coincide con lo cargado', async () => {
    const r = await coord.get('/eval-docente/periodos');
    expect(r.status).toBe(200);
    expect(r.body.data.map((p) => p.periodo)).toEqual(m3.periodos.map((p) => p.periodo).reverse());
    const actual = r.body.data.find((p) => p.periodo === ACTUAL);
    expect(actual).toMatchObject({ habilitada: true, incluye_pregrado: true, publicado: false, abierta: true });
    const generadas = m3.respuestas.filter((x) => x.periodo === ACTUAL);
    expect(actual.avance.ee.posgrado.recibidas).toBe(generadas.filter((x) => x.poblacion === 'posgrado').length);
    expect(actual.avance.ee.pregrado.recibidas).toBe(generadas.filter((x) => x.poblacion === 'pregrado').length);
    const esperadas = [...asignacionesGeneradas().values()].flat();
    expect(actual.avance.ee.posgrado.esperadas).toBe(esperadas.filter((a) => a.poblacion === 'posgrado').length);
    expect(actual.avance.ee.pregrado.esperadas).toBe(esperadas.filter((a) => a.poblacion === 'pregrado').length);
  });

  it('rechaza fechas invertidas y roles distintos de Coordinación', async () => {
    expect((await coord.put(`/eval-docente/periodos/${ACTUAL}`, { fecha_apertura: '2026-11-30', fecha_cierre: '2026-11-01' })).status).toBe(400);
    const docente = conToken(await login(datos.docentes[1].email));
    expect((await docente.put(`/eval-docente/periodos/${ACTUAL}`, { habilitada: false })).status).toBe(403);
  });
});

describe('Estudiantes: formulario EE anónimo', () => {
  // Un estudiante de posgrado con al menos un docente pendiente en el semestre actual.
  const elegirEstudiante = () => {
    const hechas = new Set(m3.constancias.filter((c) => c.periodo === ACTUAL).map((c) => `${c.estudiante}|${c.docente}`));
    for (const [email, lista] of asignacionesGeneradas()) {
      const pendiente = lista.find((a) => a.poblacion === 'posgrado' && !hechas.has(`${email}|${a.id_docente}`));
      if (pendiente) return { email, lista, pendiente, hechas };
    }
    throw new Error('Sin estudiantes con evaluaciones pendientes');
  };

  it('/pendientes devuelve exactamente los docentes que le asigna la regla de categorización', async () => {
    const { email, lista, hechas } = elegirEstudiante();
    const est = conToken(await login(email));
    const r = await est.get('/eval-docente/pendientes');
    expect(r.status).toBe(200);
    const semestre = r.body.data.find((p) => p.periodo === ACTUAL);
    expect(semestre.abierta).toBe(true);
    expect(semestre.formularios.map((f) => [f.tipo, f.id_docente, f.id_cohorte, f.diligenciado]).sort())
      .toEqual(lista.map((a) => ['EE', ids.docente.get(a.id_docente), ids.cohorte.get(a.id_cohorte), hechas.has(`${email}|${a.id_docente}`)]).sort());
  });

  it('registra el EE sin evaluador; una segunda vez → 409; otro docente o formulario incompleto → 403/400', async () => {
    const { email, pendiente, lista } = elegirEstudiante();
    const est = conToken(await login(email));
    const idDocente = ids.docente.get(pendiente.id_docente);
    const antes = await filas(`SELECT COUNT(*)::int AS n FROM evaluacion_respuestas WHERE periodo = $1 AND tipo_formulario = 'EE'`, [ACTUAL]);

    const incompleto = { ...completas('EE') };
    delete incompleto[formularios.EE['6.3']];
    expect((await est.post('/eval-docente/respuestas', { periodo: ACTUAL, tipo: 'EE', id_docente: idDocente, respuestas: incompleto })).status).toBe(400);
    expect((await est.post('/eval-docente/respuestas', { periodo: ACTUAL, tipo: 'EE', id_docente: idDocente, respuestas: { ...completas('EE'), [formularios.EE['1.1']]: 'X' } })).status).toBe(400);

    const ajeno = [...ids.docente.entries()].find(([e]) => !lista.some((a) => a.id_docente === e));
    const r403 = await est.post('/eval-docente/respuestas', { periodo: ACTUAL, tipo: 'EE', id_docente: ajeno[1], respuestas: completas('EE') });
    expect(r403.status).toBe(403);

    const ok = await est.post('/eval-docente/respuestas', { periodo: ACTUAL, tipo: 'EE', id_docente: idDocente, respuestas: completas('EE'), comentario: 'Comentario de prueba' });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toEqual({ registrada: true, tipo: 'EE' });
    const repetido = await est.post('/eval-docente/respuestas', { periodo: ACTUAL, tipo: 'EE', id_docente: idDocente, respuestas: completas('EE') });
    expect(repetido.status).toBe(409);

    const despues = await filas(`SELECT COUNT(*)::int AS n FROM evaluacion_respuestas WHERE periodo = $1 AND tipo_formulario = 'EE'`, [ACTUAL]);
    expect(despues[0].n).toBe(antes[0].n + 1);
    // Anonimato: ningún EE guarda evaluador ni fecha; la constancia no tiene vínculo con la respuesta.
    expect(await filas(`SELECT 1 FROM evaluacion_respuestas WHERE tipo_formulario = 'EE' AND (id_evaluador IS NOT NULL OR actualizado_en IS NOT NULL)`)).toEqual([]);
    const columnas = (await filas(`SELECT column_name FROM information_schema.columns WHERE table_name = 'evaluacion_constancias'`)).map((c) => c.column_name).sort();
    expect(columnas).toEqual(['huella', 'periodo']);
    // Ni el estudiante puede leer su EE (solo EC/AE se consultan).
    expect((await est.get(`/eval-docente/respuestas/propia?periodo=${ACTUAL}&tipo=EE&id_docente=${idDocente}&id_cohorte=1`)).status).toBe(400);
  });

  it('el docente no diligencia EE ni EC', async () => {
    const docente = conToken(await login(datos.docentes[1].email));
    const id = ids.docente.get(datos.docentes[2].email);
    expect((await docente.post('/eval-docente/respuestas', { periodo: ACTUAL, tipo: 'EE', id_docente: id, respuestas: completas('EE') })).status).toBe(403);
    expect((await docente.post('/eval-docente/respuestas', { periodo: ACTUAL, tipo: 'EC', id_docente: id, id_cohorte: 1, respuestas: completas('EC') })).status).toBe(403);
  });

  it('estudiante retirado de su promoción: sin pendientes y su EE se rechaza', async () => {
    const { email, pendiente } = elegirEstudiante();
    const idUsuario = ids.usuario.get(email);
    await db.query(`UPDATE cohorte_estudiantes SET estado = 'retirado' WHERE id_estudiante = $1`, [idUsuario]);
    try {
      const est = conToken(await login(email));
      const r = await est.get('/eval-docente/pendientes');
      expect(r.body.data.find((p) => p.periodo === ACTUAL).formularios).toEqual([]);
      const post = await est.post('/eval-docente/respuestas', { periodo: ACTUAL, tipo: 'EE', id_docente: ids.docente.get(pendiente.id_docente), respuestas: completas('EE') });
      expect(post.status).toBe(403);
    } finally {
      await db.query(`UPDATE cohorte_estudiantes SET estado = 'matriculado' WHERE id_estudiante = $1`, [idUsuario]);
    }
  });

  it('pregrado evalúa solo si Coordinación incluye el pregrado en el semestre', async () => {
    const [email, lista] = [...asignacionesGeneradas().entries()].find(([, l]) => l.some((a) => a.poblacion === 'pregrado'));
    const est = conToken(await login(email));
    const con = (await est.get('/eval-docente/pendientes')).body.data.find((p) => p.periodo === ACTUAL);
    expect(con.formularios.length).toBe(lista.length);
    expect((await coord.put(`/eval-docente/periodos/${ACTUAL}`, { incluye_pregrado: false })).status).toBe(200);
    try {
      const sin = (await est.get('/eval-docente/pendientes')).body.data.find((p) => p.periodo === ACTUAL);
      expect(sin.formularios.filter((f) => f.poblacion === 'pregrado')).toEqual([]);
    } finally {
      await coord.put(`/eval-docente/periodos/${ACTUAL}`, { incluye_pregrado: true });
    }
  });

  it('al cerrar, las EE se barajan: ninguna comparte transacción con su constancia y los resultados no cambian', async () => {
    // Un estudiante con un EE pendiente según la API (no según los datos generados: otras pruebas ya respondieron).
    let est;
    let idDocente;
    for (const [email] of asignacionesGeneradas()) {
      const t = conToken(await login(email));
      const sem = (await t.get('/eval-docente/pendientes')).body.data?.find((p) => p.periodo === ACTUAL);
      const f = sem?.formularios.find((x) => x.tipo === 'EE' && !x.diligenciado && x.poblacion === 'posgrado');
      if (f) { est = t; idDocente = f.id_docente; break; }
    }
    expect(est).toBeDefined();
    expect((await est.post('/eval-docente/respuestas', { periodo: ACTUAL, tipo: 'EE', id_docente: idDocente, respuestas: completas('EE', 'A') })).status).toBe(201);

    const cruces = async () => (await filas(`SELECT COUNT(*)::int AS n FROM evaluacion_respuestas r
      JOIN evaluacion_constancias c ON c.periodo = r.periodo AND c.xmin = r.xmin
      WHERE r.periodo = $1 AND r.tipo_formulario = 'EE'`, [ACTUAL]))[0].n;
    const conteo = async () => (await filas(`SELECT
      (SELECT COUNT(*)::int FROM evaluacion_respuestas WHERE periodo = $1 AND tipo_formulario = 'EE') AS respuestas,
      (SELECT COUNT(*)::int FROM evaluacion_respuesta_items i JOIN evaluacion_respuestas r USING (id_respuesta)
        WHERE r.periodo = $1 AND r.tipo_formulario = 'EE') AS items`, [ACTUAL]))[0];
    const resumen = async () => (await coord.get(`/eval-docente/resultados?periodo=${ACTUAL}`)).body.data.unidades
      .map((u) => [u.id_docente, u.id_cohorte, u.ee?.respuestas ?? 0, u.ee?.global?.pct_ip ?? null, u.ee?.idst_d?.por_variable?.valor ?? null])
      .sort((a, b) => `${a[0]}|${a[1]}`.localeCompare(`${b[0]}|${b[1]}`));

    // Abierta: la respuesta recién guardada comparte transacción con su constancia (el riesgo que se corrige).
    expect(await cruces()).toBeGreaterThan(0);
    const [antes, resultadosAntes] = [await conteo(), await resumen()];

    expect((await coord.put(`/eval-docente/periodos/${ACTUAL}`, { habilitada: false })).status).toBe(200);
    try {
      expect(await cruces()).toBe(0);
      const xmins = await filas(`SELECT COUNT(DISTINCT xmin::text)::int AS n FROM evaluacion_respuestas WHERE periodo = $1 AND tipo_formulario = 'EE'`, [ACTUAL]);
      expect(xmins[0].n).toBe(1); // todas reescritas en una sola transacción
      expect(await conteo()).toEqual(antes);
      expect(await resumen()).toEqual(resultadosAntes);
    } finally {
      expect((await coord.put(`/eval-docente/periodos/${ACTUAL}`, { habilitada: true })).status).toBe(200);
    }
    // La huella sigue impidiendo repetir y marca el formulario como diligenciado.
    expect((await est.post('/eval-docente/respuestas', { periodo: ACTUAL, tipo: 'EE', id_docente: idDocente, respuestas: completas('EE') })).status).toBe(409);
    const sem = (await est.get('/eval-docente/pendientes')).body.data.find((p) => p.periodo === ACTUAL);
    expect(sem.formularios.find((f) => f.tipo === 'EE' && f.id_docente === idDocente).diligenciado).toBe(true);
  });
});

describe('Coordinación (EC) y autoevaluación (AE)', () => {
  it('EC: una por docente y promoción; se corrige mientras está abierta y se consulta', async () => {
    const pend = (await coord.get('/eval-docente/pendientes')).body.data.find((p) => p.periodo === ACTUAL).formularios;
    expect(pend.every((f) => f.tipo === 'EC')).toBe(true);
    const u = pend[0];
    const cuerpo = { periodo: ACTUAL, tipo: 'EC', id_docente: u.id_docente, id_cohorte: u.id_cohorte, respuestas: completas('EC', 'A') };
    expect((await coord.post('/eval-docente/respuestas', cuerpo)).status).toBe(201);
    expect((await coord.post('/eval-docente/respuestas', { ...cuerpo, respuestas: completas('EC', 'MA'), comentario: 'Corregida' })).status).toBe(201);
    const guardada = await coord.get(`/eval-docente/respuestas/propia?periodo=${ACTUAL}&tipo=EC&id_docente=${u.id_docente}&id_cohorte=${u.id_cohorte}`);
    expect(guardada.body.data.comentario).toBe('Corregida');
    expect(Object.values(guardada.body.data.items).every((v) => v === 'MA')).toBe(true);
    const n = await filas(`SELECT COUNT(*)::int AS n FROM evaluacion_respuestas WHERE periodo = $1 AND tipo_formulario = 'EC' AND id_docente = $2 AND id_cohorte = $3`, [ACTUAL, u.id_docente, u.id_cohorte]);
    expect(n[0].n).toBe(1);
    expect((await coord.post('/eval-docente/respuestas', { ...cuerpo, id_cohorte: 999 })).status).toBe(403);
  });

  it('AE: el docente solo la suya, en cada promoción donde tiene oferta', async () => {
    const curso = datos.cursos.find((c) => c.periodo === ACTUAL);
    const email = curso.docentes[0];
    const docente = conToken(await login(email));
    const pend = (await docente.get('/eval-docente/pendientes')).body.data.find((p) => p.periodo === ACTUAL).formularios;
    expect(pend.length).toBeGreaterThan(0);
    expect(pend.every((f) => f.tipo === 'AE' && f.id_docente === ids.docente.get(email))).toBe(true);
    const r = await docente.post('/eval-docente/respuestas', { periodo: ACTUAL, tipo: 'AE', id_docente: pend[0].id_docente, id_cohorte: pend[0].id_cohorte, respuestas: completas('AE') });
    expect(r.status).toBe(201);
    const otro = [...ids.docente.values()].find((x) => x !== ids.docente.get(email));
    expect((await docente.post('/eval-docente/respuestas', { periodo: ACTUAL, tipo: 'AE', id_docente: otro, id_cohorte: pend[0].id_cohorte, respuestas: completas('AE') })).status).toBe(403);
  });

  it('coordinador con perfil docente: diligencia su AE pero no su propia EC', async () => {
    const curso = datos.cursos.find((c) => c.periodo === ACTUAL);
    const idDocente = ids.docente.get(curso.docentes[0]);
    const coordId = ids.usuario.get(COORD.email);
    const [{ id_usuario: original }] = await filas('SELECT id_usuario FROM docentes_perfil WHERE id_docente = $1', [idDocente]);
    await db.query('UPDATE docentes_perfil SET id_usuario = $2 WHERE id_docente = $1', [idDocente, coordId]);
    try {
      const pend = (await coord.get('/eval-docente/pendientes')).body.data.find((p) => p.periodo === ACTUAL).formularios;
      expect(pend.some((f) => f.tipo === 'EC' && f.id_docente === idDocente)).toBe(false);
      const propia = pend.find((f) => f.tipo === 'AE');
      expect(propia.id_docente).toBe(idDocente);
      const ec = await coord.post('/eval-docente/respuestas', { periodo: ACTUAL, tipo: 'EC', id_docente: idDocente, id_cohorte: propia.id_cohorte, respuestas: completas('EC') });
      expect(ec.status).toBe(403);
      expect(ec.body.error.message).toMatch(/conflicto de interés/);
    } finally {
      await db.query('UPDATE docentes_perfil SET id_usuario = $2 WHERE id_docente = $1', [idDocente, original]);
    }
  });
});

describe('Resultados (RF-EVAL-02 a 04)', () => {
  // Oráculo: consolidado recalculado desde los datos generados con la función pura.
  const oraculo = async (periodo, poblacion = 'todas') => {
    const preguntas = (await Promise.all(['EE', 'EC', 'AE'].map(async (tipo) => (await coord.get(`/eval-docente/formularios/${tipo}`)).body.data.caracteristicas
      .flatMap((c) => c.preguntas.map((p, i) => ({ ...p, tipo_formulario: tipo, caracteristica: c.caracteristica, nombre_caracteristica: c.nombre, orden: c.caracteristica * 100 + i })))))).flat();
    const aIds = (tipo, items) => Object.fromEntries(Object.entries(items).map(([codigo, v]) => [formularios[tipo][codigo], v]));
    const respuestas = [
      ...m3.respuestas.filter((r) => r.periodo === periodo).map((r) => ({ ...r, tipo_formulario: 'EE' })),
      ...m3.nominales.filter((r) => r.periodo === periodo).map((r) => ({ ...r, tipo_formulario: r.tipo })),
    ].map((r) => ({ ...r, id_docente: ids.docente.get(r.docente), id_cohorte: ids.cohorte.get(r.cohorte), items: aIds(r.tipo_formulario, r.items) }));
    const unidades = [...new Map(respuestas.map((r) => [`${r.id_docente}|${r.id_cohorte}`, { id_docente: r.id_docente, id_cohorte: r.id_cohorte, docente: r.docente, cohorte: r.cohorte, cohorte_inicio: '' }])).values()];
    return consolidar({ preguntas, unidades, respuestas, poblacion });
  };

  it('el consolidado de un semestre publicado coincide con el oráculo (por unidad, promoción y programa)', async () => {
    const r = await coord.get('/eval-docente/resultados?periodo=2025-B');
    expect(r.status).toBe(200);
    const o = await oraculo('2025-B');
    for (const esperado of o.unidades.filter((u) => u.ee)) {
      const u = r.body.data.unidades.find((x) => x.id_docente === esperado.id_docente && x.id_cohorte === esperado.id_cohorte);
      expect(u.ee.respuestas).toBe(esperado.ee.respuestas);
      expect(u.ee.caracteristicas.map((c) => [c.pct_ip, c.sigla, c.excel.pct_ip])).toEqual(esperado.ee.caracteristicas.map((c) => [c.pct_ip, c.sigla, c.excel.pct_ip]));
      expect(u.ee.idst_d).toEqual(esperado.ee.idst_d);
      expect(u.ec?.global.pct_ip ?? null).toBe(esperado.ec?.global.pct_ip ?? null);
      expect(u.ae?.global.pct_ip ?? null).toBe(esperado.ae?.global.pct_ip ?? null);
    }
    expect(r.body.data.programa.idst_p).toEqual(o.programa.idst_p);
    expect(r.body.data.programa.idsc).toEqual(o.programa.idsc);
    expect(r.body.data.historico.map((h) => h.periodo)).toEqual(expect.arrayContaining(['2022-A', '2025-B']));
  });

  it('separados o unidos: posgrado + pregrado = todas', async () => {
    const [todas, pos, pre] = await Promise.all(['todas', 'posgrado', 'pregrado'].map((p) => coord.get(`/eval-docente/resultados?periodo=2025-B&poblacion=${p}`)));
    expect(pos.body.data.programa.respuestas_ee + pre.body.data.programa.respuestas_ee).toBe(todas.body.data.programa.respuestas_ee);
    expect(pre.body.data.programa.respuestas_ee).toBe(m3.respuestas.filter((x) => x.periodo === '2025-B' && x.poblacion === 'pregrado').length);
  });

  it('Parágrafo 2: con la opción activa se informan las respuestas extremas excluidas', async () => {
    // 2026-B: se cargan 11 EE «todo MA» a un docente para superar el umbral de 10 respuestas.
    const est = asignacionesGeneradas();
    const objetivo = [...est.values()].flat()[0];
    const idDocente = ids.docente.get(objetivo.id_docente);
    const idCohorte = ids.cohorte.get(objetivo.id_cohorte);
    for (let i = 0; i < 11; i += 1) {
      const [{ id_respuesta: id }] = await filas(`INSERT INTO evaluacion_respuestas (periodo, tipo_formulario, id_docente, id_cohorte, poblacion)
        VALUES ($1, 'EE', $2, $3, 'posgrado') RETURNING id_respuesta`, [ACTUAL, idDocente, idCohorte]);
      await db.query(`INSERT INTO evaluacion_respuesta_items SELECT $1, id_pregunta, 'MA' FROM evaluacion_preguntas WHERE tipo_formulario = 'EE'`, [id]);
    }
    const sin = await coord.get(`/eval-docente/resultados?periodo=${ACTUAL}`);
    expect(sin.body.data.programa.excluidas).toBe(0);
    await coord.put(`/eval-docente/periodos/${ACTUAL}`, { excluir_extremas: true });
    const con = await coord.get(`/eval-docente/resultados?periodo=${ACTUAL}`);
    const u = con.body.data.unidades.find((x) => x.id_docente === idDocente && x.id_cohorte === idCohorte);
    expect(u.ee.excluidas).toBeGreaterThanOrEqual(11);
    expect(con.body.data.programa.excluidas).toBeGreaterThanOrEqual(11);
    await coord.put(`/eval-docente/periodos/${ACTUAL}`, { excluir_extremas: false });
  });

  it('exporta el libro con el formato de Coordinación y los informes PDF', async () => {
    const x = await coord.descargar('/eval-docente/resultados/exportar?periodo=2025-B');
    expect(x.status).toBe(200);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(x.body);
    expect(libro.worksheets.map((h) => h.name)).toEqual(['2025-B', 'EC y AE', 'IDSC-Prog', 'IDST-P', 'Notas']);
    expect(libro.getWorksheet('2025-B').getCell('A1').value).toBe('DOCENTE');
    const pdf = await coord.descargar('/eval-docente/resultados/informe.pdf?periodo=2025-B&poblacion=posgrado');
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
    const idDocente = ids.docente.get(datos.docentes[0].email);
    const pdfDocente = await coord.descargar(`/eval-docente/resultados/docentes/${idDocente}/informe.pdf`);
    expect(pdfDocente.body.subarray(0, 4).toString()).toBe('%PDF');
  });
});

describe('Publicación y consulta del docente (RF-EVAL-05)', () => {
  it('el docente ve solo sus resultados de semestres publicados, sin datos de quién respondió', async () => {
    const email = datos.docentes[0].email;
    const docente = conToken(await login(email));
    const r = await docente.get('/eval-docente/resultados/me');
    expect(r.status).toBe(200);
    expect(r.body.data.periodos.every((p) => p.publicado)).toBe(true);
    expect(r.body.data.periodos.map((p) => p.periodo)).not.toContain(ACTUAL);
    const idDocente = ids.docente.get(email);
    expect(r.body.data.periodos.flatMap((p) => p.unidades).every((u) => u.id_docente === idDocente)).toBe(true);
    const texto = JSON.stringify(r.body.data);
    for (const e of datos.estudiantes.slice(0, 20)) expect(texto).not.toContain(e.email);
    expect(texto).not.toMatch(/id_evaluador|id_estudiante/);
    expect((await docente.get('/eval-docente/resultados?periodo=2025-B')).status).toBe(403);
    expect((await docente.get(`/eval-docente/resultados/docentes/${idDocente}`)).status).toBe(403);
    const pdf = await docente.descargar('/eval-docente/resultados/me/informe.pdf');
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('publicar exige cerrar; publicado bloquea cambios y respuestas; luego el docente lo ve', async () => {
    expect((await coord.post(`/eval-docente/periodos/${ACTUAL}/publicacion`, { publicado: true })).status).toBe(409);
    expect((await coord.put(`/eval-docente/periodos/${ACTUAL}`, { habilitada: false })).status).toBe(200);
    // Cerrada: ya no recibe respuestas.
    const u = (await coord.get('/eval-docente/pendientes')).body.data.find((p) => p.periodo === ACTUAL);
    expect(u).toBeUndefined();
    const curso = datos.cursos.find((c) => c.periodo === ACTUAL);
    const idDocente = ids.docente.get(curso.docentes[0]);
    const cerrado = await coord.post('/eval-docente/respuestas', { periodo: ACTUAL, tipo: 'EC', id_docente: idDocente, id_cohorte: ids.cohorte.get(curso.cohorte), respuestas: completas('EC') });
    expect(cerrado.status).toBe(409);

    expect((await coord.post(`/eval-docente/periodos/${ACTUAL}/publicacion`, { publicado: true })).status).toBe(200);
    expect((await coord.put(`/eval-docente/periodos/${ACTUAL}`, { habilitada: true })).status).toBe(409);
    const docente = conToken(await login(curso.docentes[0]));
    const mios = await docente.get('/eval-docente/resultados/me');
    expect(mios.body.data.periodos.map((p) => p.periodo)).toContain(ACTUAL);

    expect((await coord.post(`/eval-docente/periodos/${ACTUAL}/publicacion`, { publicado: false })).status).toBe(200);
    expect((await coord.put(`/eval-docente/periodos/${ACTUAL}`, { habilitada: true })).status).toBe(200);
  });

  it('fuera del cronograma no se reciben respuestas', async () => {
    expect((await coord.put(`/eval-docente/periodos/${ACTUAL}`, { fecha_apertura: '2020-01-01', fecha_cierre: '2020-01-31' })).status).toBe(200);
    const curso = datos.cursos.find((c) => c.periodo === ACTUAL);
    const r = await coord.post('/eval-docente/respuestas', { periodo: ACTUAL, tipo: 'EC', id_docente: ids.docente.get(curso.docentes[0]), id_cohorte: ids.cohorte.get(curso.cohorte), respuestas: completas('EC') });
    expect(r.status).toBe(409);
    expect(r.body.error.message).toMatch(/cerró el 2020-01-31/);
    await coord.put(`/eval-docente/periodos/${ACTUAL}`, { fecha_apertura: null, fecha_cierre: null });
  });
});

describe('Lista de pregrado (plantilla → validar → confirmar)', () => {
  const plantillaCon = async (filasDatos) => {
    const r = await coord.descargar(`/eval-docente/pregrado/plantilla?periodo=${ACTUAL}`);
    expect(r.status).toBe(200);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(r.body);
    expect(libro.worksheets.map((h) => h.name)).toEqual(['Pregrado', 'Ofertas (referencia)', 'Instrucciones']);
    const hoja = libro.getWorksheet('Pregrado');
    filasDatos.forEach((f) => hoja.addRow(f));
    return Buffer.from(await libro.xlsx.writeBuffer());
  };

  it('valida sin guardar, rechaza errores (todo o nada) y al confirmar crea cuentas con contraseña temporal', async () => {
    const curso = datos.cursos.find((c) => c.periodo === ACTUAL);
    const [{ codigo }] = await filas('SELECT codigo FROM clases WHERE nombre = $1', [curso.clase]);
    const valida = [ACTUAL, curso.cohorte, codigo, 'PRE-9001', 'Ana', 'Prueba Pregrado', 'ana.pregrado@prueba.local', 'Ingeniería Electrónica'];
    const mala = [ACTUAL, curso.cohorte, 'NO-EXISTE', 'PRE-9002', 'Luis', 'Prueba', 'luis.pregrado@prueba.local', ''];

    const conError = await coord.subir('/eval-docente/pregrado/importar?simular=true', 'pregrado.xlsx', await plantillaCon([valida, mala]));
    expect(conError.status).toBe(400);
    expect(conError.body.error.details.errores).toHaveLength(1);
    expect(conError.body.error.details.errores[0]).toMatchObject({ fila: 3 });

    const archivo = await plantillaCon([valida]);
    const simulada = await coord.subir('/eval-docente/pregrado/importar?simular=true', 'pregrado.xlsx', archivo);
    expect(simulada.status).toBe(200);
    expect(simulada.body.data).toMatchObject({ simulacion: true, resumen: { usuarios_nuevos: 1, inscripciones_nuevas: 1 } });
    expect(simulada.body.data.credenciales).toBeUndefined();
    expect(await filas(`SELECT 1 FROM usuarios WHERE email = 'ana.pregrado@prueba.local'`)).toEqual([]);

    const confirmada = await coord.subir('/eval-docente/pregrado/importar', 'pregrado.xlsx', archivo);
    expect(confirmada.status).toBe(201);
    const [cred] = confirmada.body.data.credenciales;
    expect(cred.email).toBe('ana.pregrado@prueba.local');
    const token = await login(cred.email, cred.password);
    expect(token).toBeTruthy();
    const lista = await coord.get(`/eval-docente/pregrado?periodo=${ACTUAL}`);
    expect(lista.body.data.some((x) => x.email === cred.email && x.programa === 'Ingeniería Electrónica')).toBe(true);
    // La nueva estudiante ya tiene EE pendientes con los docentes de la oferta (el semestre incluye pregrado).
    const pend = (await conToken(token).get('/eval-docente/pendientes')).body.data.find((p) => p.periodo === ACTUAL);
    expect(pend.formularios.map((f) => f.id_docente).sort()).toEqual(curso.docentes.map((d) => ids.docente.get(d)).sort());
    expect(pend.formularios.every((f) => f.poblacion === 'pregrado')).toBe(true);

    // Reimportar no duplica; retirarla la saca de la evaluación.
    const otra = await coord.subir('/eval-docente/pregrado/importar', 'pregrado.xlsx', archivo);
    expect(otra.body.data.resumen).toMatchObject({ usuarios_nuevos: 0, inscripciones_nuevas: 0, actualizadas: 1 });
    const fila = lista.body.data.find((x) => x.email === cred.email);
    expect((await coord.put(`/eval-docente/pregrado/${fila.id_curso}/${fila.id_estudiante}`, { estado: 'retirado' })).status).toBe(200);
    const sin = (await conToken(token).get('/eval-docente/pendientes')).body.data.find((p) => p.periodo === ACTUAL);
    expect(sin.formularios).toEqual([]);
    expect((await coord.delete(`/eval-docente/pregrado/${fila.id_curso}/${fila.id_estudiante}`)).status).toBe(200);
  });

  it('rechaza a quien ya está inscrito como posgrado en el mismo curso', async () => {
    const curso = datos.cursos.find((c) => c.periodo === ACTUAL);
    const inscrito = datos.inscripciones.find((i) => i.curso === curso.clave);
    const est = datos.estudiantes.find((e) => e.email === inscrito.estudiante);
    const [{ codigo }] = await filas('SELECT codigo FROM clases WHERE nombre = $1', [curso.clase]);
    const r = await coord.subir('/eval-docente/pregrado/importar?simular=true', 'pregrado.xlsx',
      await plantillaCon([[ACTUAL, curso.cohorte, codigo, est.identificacion, est.nombres, est.apellidos, est.email, '']]));
    expect(r.status).toBe(400);
    expect(r.body.error.details.errores[0].mensaje).toMatch(/posgrado/);
  });
});

describe('Formularios editables (Acuerdo 058, Art. 8)', () => {
  const codigosDe = async (tipo) => (await coord.get(`/eval-docente/formularios/${tipo}`)).body.data.caracteristicas
    .flatMap((c) => c.preguntas.map((p) => p.codigo));
  const variablesEE = async (periodo) => {
    const d = (await coord.get(`/eval-docente/resultados?periodo=${periodo}`)).body.data;
    return new Set(d.unidades.filter((u) => u.ee).flatMap((u) => u.ee.variables.map((v) => v.codigo)));
  };

  it('agrega, protege lo respondido, desactiva sin alterar el histórico y elimina lo no respondido', async () => {
    const todas = (await coord.get('/eval-docente/formularios/EE/preguntas')).body.data;
    expect(todas).toHaveLength(30);
    const p11 = todas.find((p) => p.codigo === '1.1');
    expect(p11.respuestas).toBeGreaterThan(0);

    // Solo Coordinación
    const docente = conToken(await login(datos.docentes[1].email));
    expect((await docente.get('/eval-docente/formularios/EE/preguntas')).status).toBe(403);

    // Nueva pregunta al final de C3: código generado y visible en el formulario del estudiante, tras la 3.6.
    const nueva = await coord.post('/eval-docente/formularios/EE/preguntas', { caracteristica: 3, texto: 'Vincula a los estudiantes con proyectos de investigación.' });
    expect(nueva.status).toBe(201);
    expect(nueva.body.data).toMatchObject({ codigo: '3.7', activa: true, respuestas: 0 });
    let codigos = await codigosDe('EE');
    expect(codigos.indexOf('3.7')).toBe(codigos.indexOf('3.6') + 1);

    // Con respuestas: no cambia la redacción; sin respuestas: sí.
    expect((await coord.put(`/eval-docente/formularios/preguntas/${p11.id_pregunta}`, { texto: 'Otra redacción' })).status).toBe(409);
    expect((await coord.put(`/eval-docente/formularios/preguntas/${nueva.body.data.id_pregunta}`, { texto: 'Vincula a los estudiantes con proyectos y semilleros.' })).body.data.texto)
      .toMatch(/semilleros/);

    // Desactivar 1.1: sale del formulario, pero sigue en los resultados del semestre en que se respondió.
    const antes = await variablesEE('2025-B');
    expect(antes.has('1.1')).toBe(true);
    expect((await coord.put(`/eval-docente/formularios/preguntas/${p11.id_pregunta}`, { activa: false })).body.data.activa).toBe(false);
    try {
      codigos = await codigosDe('EE');
      expect(codigos).not.toContain('1.1');
      expect((await variablesEE('2025-B')).has('1.1')).toBe(true);
      // Una pregunta con respuestas no se elimina; la nueva (sin respuestas) sí.
      expect((await coord.delete(`/eval-docente/formularios/preguntas/${p11.id_pregunta}`)).status).toBe(409);
      expect((await coord.delete(`/eval-docente/formularios/preguntas/${nueva.body.data.id_pregunta}`)).status).toBe(200);
      expect(await codigosDe('EE')).not.toContain('3.7');
    } finally {
      await coord.put(`/eval-docente/formularios/preguntas/${p11.id_pregunta}`, { activa: true });
    }
    expect(await codigosDe('EE')).toContain('1.1');
  });

  it('una característica nueva exige su nombre', async () => {
    expect((await coord.post('/eval-docente/formularios/EC/preguntas', { caracteristica: 3, texto: 'Participa en la autoevaluación del programa.' })).status).toBe(400);
    const r = await coord.post('/eval-docente/formularios/EC/preguntas', { caracteristica: 3, nombre_caracteristica: 'Compromiso institucional', texto: 'Participa en la autoevaluación del programa.' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ codigo: '3.1', nombre_caracteristica: 'Compromiso institucional' });
    expect((await coord.delete(`/eval-docente/formularios/preguntas/${r.body.data.id_pregunta}`)).status).toBe(200);
  });
});
