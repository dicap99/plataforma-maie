// Módulo 2 (Resultados de Aprendizaje) de punta a punta contra PostgreSQL, sobre la base
// "maie_test_ra" poblada con datos sintéticos (semilla fija). Debe apuntarse a esa base antes
// de cargar la aplicación.
const { URL_PRUEBAS_RA } = require('./baseDePruebas');

process.env.DATABASE_URL = URL_PRUEBAS_RA;

const request = require('supertest');
const ExcelJS = require('exceljs');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { generar, CATALOGO } = require('../../scripts/sintetico/generador');
const { cargar } = require('../../scripts/sintetico/cargador');
const { totalPonderado, agruparUnidades, distribucion, CLAVES_NIVEL } = require('../../src/modules/ra/rubrica');

const API = '/api/v1';
const COORD = { email: 'coordinacion.maie@udenar.edu.co', password: 'CambiarMaIE2026' };
const PASSWORD = 'Sintetico-Pruebas-2026';

const login = async (email, password = PASSWORD) =>
  (await request(app).post(`${API}/auth/login`).send({ email, password })).body.data?.token;
const conToken = (token) => ({
  get: (url) => request(app).get(`${API}${url}`).set('Authorization', `Bearer ${token}`),
  post: (url, body) => request(app).post(`${API}${url}`).set('Authorization', `Bearer ${token}`).send(body),
  put: (url, body) => request(app).put(`${API}${url}`).set('Authorization', `Bearer ${token}`).send(body),
  delete: (url) => request(app).delete(`${API}${url}`).set('Authorization', `Bearer ${token}`),
  descargar: (url) => request(app).get(`${API}${url}`).set('Authorization', `Bearer ${token}`)
    .buffer(true).parse((res, cb) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); }),
});
const idDe = async (sql, params) => (await db.query(sql, params)).rows[0];

const datos = generar({ semilla: 42 });
let coord;
let rubricas; // { RA1: [{ id_criterio, orden, peso_porcentaje }] }

// Oráculo: reproduce en JS, a partir de los datos generados, lo que deben devolver los reportes.
const oraculo = ({ cohorte, modulo, semestreTope } = {}, catalogo = []) => {
  const cursos = new Map(datos.cursos.map((c) => [c.clave, c]));
  const kat = new Map(catalogo.map((k) => [k.codigo, k]));
  const celdas = new Map();
  for (const n of datos.calificaciones) {
    const c = cursos.get(n.curso);
    const k = kat.get(c.catalogo);
    if (cohorte && c.cohorte !== cohorte) continue;
    if (modulo && k.modulo !== modulo) continue;
    if (semestreTope && k.semestre > semestreTope) continue;
    const clave = `${n.curso}|${n.estudiante}|${n.ra}`;
    if (!celdas.has(clave)) celdas.set(clave, { estudiante: n.estudiante, ra: n.ra, notas: {} });
    const criterio = rubricas[n.ra].find((x) => x.orden === n.orden);
    celdas.get(clave).notas[criterio.id_criterio] = n.calificacion;
  }
  const filas = [...celdas.values()]
    .map((c) => ({ ...c, total: totalPonderado(rubricas[c.ra], c.notas).total }))
    .filter((c) => c.total !== null);
  return distribucion(agruparUnidades(filas, (f) => `${f.estudiante}|${f.ra}`), 'ra');
};

const comparar = (reporte, esperado) => {
  for (const e of esperado) {
    const fila = reporte.find((r) => r.grupo === e.grupo);
    expect(CLAVES_NIVEL.map((n) => fila[n])).toEqual(CLAVES_NIVEL.map((n) => e[n]));
    expect(fila.promedio).toBe(e.promedio);
  }
  expect(reporte.filter((r) => r.evaluados > 0)).toHaveLength(esperado.length);
};

beforeAll(async () => {
  await db.withTransaction((cliente) => cargar(cliente, datos, { password: PASSWORD }));
  coord = conToken(await login(COORD.email, COORD.password));
  const res = await coord.get('/ra/rubricas');
  rubricas = Object.fromEntries(res.body.data.ras.map((r) => [r.codigo, r.criterios]));
});

afterAll(() => db.pool.end());

describe('Catálogo y rúbricas (RF-RA-01)', () => {
  it('el catálogo sembrado coincide con las Tablas 3 y 4 que usa el generador', async () => {
    const res = await coord.get('/admin/cursos/catalogo');
    expect(res.status).toBe(200);
    expect(res.body.data.map((k) => ({ codigo: k.codigo, semestre: k.semestre, ras: k.ras.map((r) => r.codigo) })))
      .toEqual(CATALOGO);
  });

  it('cada RA tiene su rúbrica de 4 criterios con pesos que suman 100 % y los umbrales de nivel', async () => {
    const res = await coord.get('/ra/rubricas');
    expect(res.body.data.niveles.map((n) => n.nivel)).toEqual(['Alto', 'Medio', 'Basico', 'Insuficiente']);
    expect(res.body.data.ras).toHaveLength(7);
    for (const ra of res.body.data.ras) {
      expect(ra.criterios).toHaveLength(4);
      expect(ra.suma_pesos).toBe(100);
    }
    const ra1 = await coord.get('/ra/resultados/1');
    expect(ra1.body.data).toMatchObject({ codigo: 'RA1', criterios: 4 });
    expect(ra1.body.data.cursos.map((c) => c.codigo)).toEqual(['MaIE-CB1', 'MaIE-CB2']);
  });

  it('Coordinación edita la rúbrica completa; se rechazan pesos ≠ 100, docentes y criterios calificados', async () => {
    const actual = (await coord.get('/ra/rubricas?ra=2')).body.data.ras[0];
    const docente = conToken(await login(datos.docentes[0].email));
    expect((await docente.put('/ra/rubricas/2', { criterios: actual.criterios })).status).toBe(403);

    const mal = actual.criterios.map((c, i) => (i === 0 ? { ...c, peso_porcentaje: 15 } : c));
    const r400 = await coord.put('/ra/rubricas/2', { criterios: mal });
    expect(r400.status).toBe(400);
    expect(r400.body.error.details[0]).toMatch(/suman 90/);

    expect((await coord.put('/ra/rubricas/2', { criterios: actual.criterios.slice(1).map((c) => ({ ...c, peso_porcentaje: 100 / 3 })) })).status)
      .toBe(400); // 33,33 × 3 ≠ 100
    const sinUno = actual.criterios.slice(0, 3).map((c, i) => ({ ...c, peso_porcentaje: [40, 30, 30][i] }));
    expect((await coord.put('/ra/rubricas/2', { criterios: sinUno })).status).toBe(409);

    const reordenada = actual.criterios.map((c) => ({ ...c, orden: 5 - c.orden, nombre_criterio: `${c.nombre_criterio} (rev.)` }));
    const ok = await coord.put('/ra/rubricas/2', { criterios: reordenada });
    expect(ok.status).toBe(200);
    expect(ok.body.data.criterios[0].id_criterio).toBe(actual.criterios[3].id_criterio);
    expect((await coord.put('/ra/rubricas/2', { criterios: actual.criterios })).status).toBe(200);
  });
});

describe('Reportes consolidados (RF-RA-03, RF-RA-04)', () => {
  let catalogo;
  beforeAll(async () => {
    catalogo = (await coord.get('/admin/cursos/catalogo')).body.data;
  });

  it('la distribución por RA coincide con el cálculo independiente sobre los datos sintéticos', async () => {
    const res = await coord.get('/ra/reportes');
    expect(res.status).toBe(200);
    expect(res.body.data.porRA).toHaveLength(7);
    comparar(res.body.data.porRA, oraculo({}, catalogo));
    const { meta } = res.body.data;
    expect(meta.estudiantes_evaluados).toBeGreaterThan(0);
    expect(meta.rubricas_incompletas).toBeGreaterThan(0); // el generador deja ~2 % sin terminar
    expect(meta.meta_satisfactorio_pct).toBe(70);
  });

  it('combina filtros de promoción, módulo y momento de análisis', async () => {
    const { id_cohorte: idCohorte } = await idDe("SELECT id_cohorte FROM cohortes WHERE nombre = 'Sintética II'");
    const { id_modulo: idModulo } = await idDe("SELECT id_modulo FROM modulos_curriculares WHERE nombre = 'Investigativo'");
    const res = await coord.get(`/ra/reportes?cohorte=${idCohorte}&modulo=${idModulo}&momento=fin-IV`);
    comparar(res.body.data.porRA, oraculo({ cohorte: 'Sintética II', modulo: 'Investigativo', semestreTope: 4 }, catalogo));

    const inicio = await coord.get('/ra/reportes?momento=inicio-III');
    comparar(inicio.body.data.porRA, oraculo({ semestreTope: 2 }, catalogo));
    expect(inicio.body.data.porRA.find((r) => r.grupo === 'RA5').evaluados).toBe(0); // RA5 se evalúa desde el semestre III
  });

  it('agrupa por curso, módulo, promoción y estudiante', async () => {
    for (const agrupar of ['curso', 'catalogo', 'modulo', 'cohorte', 'estudiante']) {
      const res = await coord.get(`/ra/reportes?agrupar=${agrupar}`);
      expect(res.status).toBe(200);
      expect(res.body.data.filas.length).toBeGreaterThan(0);
      for (const f of res.body.data.filas) {
        expect(CLAVES_NIVEL.reduce((s, n) => s + f[n], 0)).toBe(f.evaluados);
      }
    }
    const modulos = (await coord.get('/ra/reportes?agrupar=modulo')).body.data.filas.map((f) => f.etiqueta);
    expect(modulos).toEqual(['Básico', 'Profundización', 'Electivo', 'Investigativo']);
  });

  it('exporta el reporte a Excel con sus hojas', async () => {
    const res = await coord.descargar('/ra/reportes/exportar?agrupar=cohorte');
    expect(res.status).toBe(200);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(res.body);
    expect(libro.worksheets.map((h) => h.name))
      .toEqual(['Distribución por RA', 'Por cohorte', 'Estudiante × RA', 'Detalle por criterio']);
    expect(libro.getWorksheet('Detalle por criterio').rowCount - 1).toBe(datos.calificaciones.length);
  });
});

describe('Ofertas de curso, matrícula y calificación (RF-RA-02)', () => {
  const cohorte = 'Sintética V';
  let idCohorte;
  let oferta;
  let docente;
  let otroDocente;
  const docenteA = datos.docentes[0];
  const docenteB = datos.docentes[1];

  beforeAll(async () => {
    ({ id_cohorte: idCohorte } = await idDe('SELECT id_cohorte FROM cohortes WHERE nombre = $1', [cohorte]));
    docente = conToken(await login(docenteA.email));
    otroDocente = conToken(await login(docenteB.email));
  });

  it('Coordinación crea una oferta con docente y matricula a la promoción (sin retirados)', async () => {
    const { id_catalogo: idCatalogo } = await idDe("SELECT id_catalogo FROM cursos_catalogo WHERE codigo = 'MaIE-CE2'");
    const { id_usuario: idDocente } = await idDe('SELECT id_usuario FROM usuarios WHERE email = $1', [docenteA.email]);
    const res = await coord.post('/admin/cursos', {
      id_catalogo: idCatalogo, id_cohorte: idCohorte, periodo: '2027-A', nombre: 'Aprendizaje Profundo', docentes: [idDocente],
    });
    expect(res.status).toBe(201);
    oferta = res.body.data;
    expect(oferta).toMatchObject({ codigo: 'MaIE-CE2', nombre: 'Aprendizaje Profundo', ras: ['RA2'], criterios: 4 });
    expect((await coord.post('/admin/cursos', { id_catalogo: idCatalogo, id_cohorte: idCohorte, periodo: '2027-A' })).status).toBe(409);

    const activos = datos.estudiantes.filter((e) => e.cohorte === cohorte && e.estado !== 'retirado').length;
    const mat = await coord.post(`/admin/cursos/${oferta.id_curso}/estudiantes/cohorte`);
    expect(mat.body.data.agregados).toBe(activos);
    expect(mat.body.data.curso.estudiantes).toHaveLength(activos);
  });

  it('no inscribe estudiantes de otra promoción ni usuarios que no son estudiantes', async () => {
    const ajeno = datos.estudiantes.find((e) => e.cohorte !== cohorte);
    const { id_usuario: idAjeno } = await idDe('SELECT id_usuario FROM usuarios WHERE email = $1', [ajeno.email]);
    const { id_usuario: idDoc } = await idDe('SELECT id_usuario FROM usuarios WHERE email = $1', [docenteB.email]);
    expect((await coord.put(`/admin/cursos/${oferta.id_curso}/estudiantes`, { estudiantes: [idAjeno] })).status).toBe(400);
    expect((await coord.put(`/admin/cursos/${oferta.id_curso}/estudiantes`, { estudiantes: [idDoc] })).status).toBe(400);
  });

  it('el docente ve solo sus ofertas; otro docente no accede a la planilla', async () => {
    const mias = (await docente.get('/admin/cursos')).body.data;
    expect(mias.length).toBeGreaterThan(0);
    expect(mias.every((c) => c.docentes.some((d) => d.nombre === `${docenteA.nombres} ${docenteA.apellidos}`))).toBe(true);
    const ajena = mias.find((c) => !c.docentes.some((d) => d.nombre === `${docenteB.nombres} ${docenteB.apellidos}`));
    expect((await otroDocente.get(`/ra/evaluaciones?curso=${ajena.id_curso}`)).status).toBe(403);
    expect((await otroDocente.get(`/admin/cursos/${ajena.id_curso}`)).status).toBe(403);
  });

  it('la planilla de una oferta sintética reproduce los totales ponderados de los datos generados', async () => {
    const clave = datos.cursos.find((c) => c.catalogo === 'MaIE-CI1').clave;
    const [cohorteClave] = clave.split('|');
    const { id_curso: idCurso } = await idDe(
      `SELECT c.id_curso FROM cursos c JOIN cohortes h USING (id_cohorte) JOIN cursos_catalogo k USING (id_catalogo)
       WHERE h.nombre = $1 AND k.codigo = 'MaIE-CI1'`, [cohorteClave],
    );
    const planilla = (await coord.get(`/ra/evaluaciones?curso=${idCurso}`)).body.data;
    expect(planilla.ras.map((r) => r.codigo)).toEqual(['RA3', 'RA5']);
    for (const e of planilla.estudiantes) {
      for (const ra of planilla.ras) {
        const notas = Object.fromEntries(datos.calificaciones
          .filter((n) => n.curso === clave && n.estudiante === e.email && n.ra === ra.codigo)
          .map((n) => [rubricas[ra.codigo].find((x) => x.orden === n.orden).id_criterio, n.calificacion]));
        expect(e.resultados[ra.id_ra].total).toBe(totalPonderado(rubricas[ra.codigo], notas).total);
      }
    }
  });

  it('el docente registra notas: valida curso, inscripción y rango, y calcula total y nivel', async () => {
    const planilla = (await docente.get(`/ra/evaluaciones?curso=${oferta.id_curso}`)).body.data;
    const [ra2] = planilla.ras;
    const est = planilla.estudiantes[0];
    const celda = (id_criterio, calificacion, id_estudiante = est.id_estudiante) => ({ id_estudiante, id_criterio, calificacion });

    const criterioRA1 = rubricas.RA1[0].id_criterio;
    expect((await docente.post('/ra/evaluaciones', { id_curso: oferta.id_curso, calificaciones: [celda(criterioRA1, 4)] })).status).toBe(400);
    expect((await docente.post('/ra/evaluaciones', { id_curso: oferta.id_curso, calificaciones: [celda(ra2.criterios[0].id_criterio, 5.01)] })).status).toBe(400);
    const { id_usuario: noInscrito } = await idDe(
      "SELECT id_usuario FROM usuarios WHERE rol = 'estudiante' AND NOT (id_usuario = ANY($1::uuid[])) LIMIT 1",
      [planilla.estudiantes.map((e) => e.id_estudiante)],
    );
    expect((await docente.post('/ra/evaluaciones', { id_curso: oferta.id_curso, calificaciones: [celda(ra2.criterios[0].id_criterio, 4, noInscrito)] })).status).toBe(409);
    expect((await otroDocente.post('/ra/evaluaciones', { id_curso: oferta.id_curso, calificaciones: [celda(ra2.criterios[0].id_criterio, 4)] })).status).toBe(403);

    // Ficha del documento RA (Aprendizaje Profundo): 4,88 · 4,91 · 5,00 · 5,00 → 4,94 Alto
    const notas = [4.88, 4.91, 5, 5];
    const ok = await docente.post('/ra/evaluaciones', {
      id_curso: oferta.id_curso, calificaciones: ra2.criterios.map((c, i) => celda(c.id_criterio, notas[i])),
    });
    expect(ok.status).toBe(201);
    const fila = ok.body.data.estudiantes.find((e) => e.id_estudiante === est.id_estudiante);
    expect(fila.resultados[ra2.id_ra]).toMatchObject({ total: 4.94, nivel: 'Alto', completo: true });

    const borrar = await docente.post('/ra/evaluaciones', { id_curso: oferta.id_curso, calificaciones: [celda(ra2.criterios[3].id_criterio, null)] });
    const tras = borrar.body.data.estudiantes.find((e) => e.id_estudiante === est.id_estudiante);
    expect(tras.resultados[ra2.id_ra]).toMatchObject({ total: null, completo: false, faltantes: [ra2.criterios[3].id_criterio] });
  });

  it('no se desmatricula a un estudiante calificado ni se elimina una oferta con notas', async () => {
    expect((await coord.put(`/admin/cursos/${oferta.id_curso}/estudiantes`, { estudiantes: [] })).status).toBe(409);
    expect((await coord.delete(`/admin/cursos/${oferta.id_curso}`)).status).toBe(409);
  });
});

describe('Estudiantes (RNF-SEG-01)', () => {
  it('un estudiante no consulta resultados de aprendizaje ni ofertas', async () => {
    const estudiante = conToken(await login(datos.estudiantes[0].email));
    for (const ruta of ['/ra/rubricas', '/ra/resultados', '/ra/reportes', '/ra/evaluaciones?curso=1', '/admin/cursos']) {
      expect((await estudiante.get(ruta)).status).toBe(403);
    }
  });
});
