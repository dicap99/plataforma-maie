// Módulo 1 (Procesos Administrativos) de punta a punta contra PostgreSQL.
const request = require('supertest');
const ExcelJS = require('exceljs');
const app = require('../../src/app');
const db = require('../../src/config/db');

const API = '/api/v1';
const COORD = { email: 'coordinacion.maie@udenar.edu.co', password: 'CambiarMaIE2026' };

const login = async (credenciales) => {
  const res = await request(app).post(`${API}/auth/login`).send(credenciales);
  return res.body.data?.token;
};
const conToken = (token) => ({
  get: (url) => request(app).get(`${API}${url}`).set('Authorization', `Bearer ${token}`),
  post: (url, body) => request(app).post(`${API}${url}`).set('Authorization', `Bearer ${token}`).send(body),
  put: (url, body) => request(app).put(`${API}${url}`).set('Authorization', `Bearer ${token}`).send(body),
  delete: (url) => request(app).delete(`${API}${url}`).set('Authorization', `Bearer ${token}`),
  subir: (url, buffer, nombre) =>
    request(app).post(`${API}${url}`).set('Authorization', `Bearer ${token}`).attach('archivo', buffer, nombre),
});
const contar = async (tabla) => (await db.query(`SELECT COUNT(*)::int AS n FROM ${tabla}`)).rows[0].n;

// Libro con la estructura del histórico "Estadísticas MaIE": encabezados en fila 2 y filas de totales.
const libroEstadisticas = async () => {
  const libro = new ExcelJS.Workbook();
  const prom = libro.addWorksheet('Promociones y Estudiantes');
  prom.getRow(2).values = [null, 'Promoción', 'Inicio', 'Fin', 'Inscritos', 'Matriculados', 'Aprob I', 'Aprob II', 'Aprob III', 'Egresados', 'Graduados'];
  prom.getRow(3).values = [null, 'I', '2019-B', '2021-A', 12, 11, 9, 9, 9, 9, 9];
  prom.getRow(4).values = [null, 'II', '2021-A', '2022-B', 19, 16, 10, 9, 9, 9, 7];
  prom.getRow(5).values = [null, 'Totales', 'Totales', 'Totales', 31, 27, 19, 18, 18, 18, 16];
  const ben = libro.addWorksheet('Beneficios');
  ben.getRow(2).values = [null, 'Promoción', 'Becas 100%', 'Hora cátedra', 'SINTRAUNICOL', 'Asistentes', 'Ayudantes'];
  ben.getRow(3).values = [null, 'I', 1, 0, 0, 4, 4];
  ben.getRow(4).values = [null, 'II', 1, 0, 0, 6, 0];
  const con = libro.addWorksheet('Contrataciones');
  con.getRow(2).values = [null, 'Promoción', '2021-A', '2021-A', '2021-B', '2021-B'];
  con.getRow(3).values = [null, 'Promoción', 'No. OPS', 'Valor OPS', 'No. OPS', 'Valor OPS'];
  con.getRow(4).values = [null, 'I, II', 2, 14536416, 2, 14385045];
  return Buffer.from(await libro.xlsx.writeBuffer());
};

let coord;

beforeAll(async () => {
  coord = conToken(await login(COORD));
});

afterAll(() => db.pool.end());

describe('Autenticación', () => {
  it('rechaza credenciales inválidas sin revelar si el correo existe', async () => {
    const a = await request(app).post(`${API}/auth/login`).send({ ...COORD, password: 'incorrecta' });
    const b = await request(app).post(`${API}/auth/login`).send({ email: 'nadie@udenar.edu.co', password: 'x' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it('login y /auth/me devuelven el usuario sin el hash de contraseña', async () => {
    const res = await coord.get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: COORD.email, rol: 'coordinador' });
    expect(res.body.data.password_hash).toBeUndefined();
  });

  it('cambio de contraseña verifica la actual', async () => {
    expect((await coord.put('/auth/password', { actual: 'otra', nueva: 'NuevaClave2026' })).status).toBe(400);
    expect((await coord.put('/auth/password', { actual: COORD.password, nueva: 'NuevaClave2026' })).status).toBe(200);
    expect(await login({ ...COORD, password: 'NuevaClave2026' })).toBeTruthy();
    await coord.put('/auth/password', { actual: 'NuevaClave2026', nueva: COORD.password });
  });
});

describe('CRUD de promociones (RF-ADM-01)', () => {
  let id;

  it('crea, lee, actualiza y elimina', async () => {
    const creado = await coord.post('/admin/cohortes', {
      nombre: 'X', periodo_inicio: '2030-A', periodo_fin: '2031-B', inscritos: 10, matriculados: 8, graduados: 0,
    });
    expect(creado.status).toBe(201);
    expect(creado.body.data).toMatchObject({ nombre: 'X', anio_inicio: 2030, aprobados_sem1: null });
    id = creado.body.data.id_cohorte;

    const editado = await coord.put(`/admin/cohortes/${id}`, {
      nombre: 'X', periodo_inicio: '2030-A', periodo_fin: '2031-B', inscritos: 10, matriculados: 9, aprobados_sem1: 8, graduados: 0,
    });
    expect(editado.body.data).toMatchObject({ matriculados: 9, aprobados_sem1: 8 });
    expect((await coord.get(`/admin/cohortes/${id}`)).body.data.matriculados).toBe(9);
  });

  it('valida formato, obligatorios y reglas de la BD', async () => {
    const base = { nombre: 'Y', periodo_inicio: '2030-A', periodo_fin: '2031-B', inscritos: 1, matriculados: 1, graduados: 0 };
    const formato = await coord.post('/admin/cohortes', { ...base, periodo_inicio: '2030-1' });
    expect(formato.status).toBe(400);
    expect(formato.body.error.details[0].msg).toMatch(/AAAA-A/);
    expect((await coord.post('/admin/cohortes', { ...base, inscritos: -1 })).status).toBe(400);
    expect((await coord.post('/admin/cohortes', { ...base, nombre: 'X' })).status).toBe(409); // duplicada
    expect((await coord.post('/admin/cohortes', { ...base, periodo_fin: '2029-A' })).status).toBe(400); // fin < inicio
  });

  it('las tablas hijas exigen una promoción existente', async () => {
    const fila = { id_cohorte: 99999, nacionales: 1, internacionales: 0 };
    expect((await coord.post('/admin/pasantias', fila)).status).toBe(409);
    const ok = await coord.post('/admin/pasantias', { ...fila, id_cohorte: id });
    expect(ok.status).toBe(201);
    expect(ok.body.data.cohorte).toBe('X');
  });

  it('eliminar la promoción elimina sus datos asociados; luego 404', async () => {
    expect((await coord.delete(`/admin/cohortes/${id}`)).status).toBe(200);
    expect((await coord.get(`/admin/pasantias/${id}`)).status).toBe(404);
    expect((await coord.delete(`/admin/cohortes/${id}`)).status).toBe(404);
  });
});

describe('Usuarios, RBAC y perfil docente', () => {
  let docente;
  let estudiante;

  beforeAll(async () => {
    const perfil = await coord.post('/admin/docentes', { nombre_completo: 'DOCENTE PRUEBA', afiliacion: 'UDENAR' });
    const usuario = await coord.post('/usuarios', {
      identificacion: '111', nombres: 'Docente', apellidos: 'Prueba', email: 'docente@udenar.edu.co',
      rol: 'docente', password: 'ClaveDocente1', id_docente: perfil.body.data.id_docente,
    });
    expect(usuario.status).toBe(201);
    expect(usuario.body.data.docente_vinculado).toBe('DOCENTE PRUEBA');
    await coord.post('/usuarios', {
      identificacion: '222', nombres: 'Est', apellidos: 'Prueba', email: 'estudiante@udenar.edu.co',
      rol: 'estudiante', password: 'ClaveEstudiante1',
    });
    docente = conToken(await login({ email: 'docente@udenar.edu.co', password: 'ClaveDocente1' }));
    estudiante = conToken(await login({ email: 'estudiante@udenar.edu.co', password: 'ClaveEstudiante1' }));
  });

  it('el estudiante no accede al módulo administrativo', async () => {
    expect((await estudiante.get('/admin/cohortes')).status).toBe(403);
    expect((await estudiante.get('/admin/recursos')).body.data).toEqual([]);
  });

  it('el docente consulta datos académicos pero no financieros ni escribe', async () => {
    expect((await docente.get('/admin/cohortes')).status).toBe(200);
    expect((await docente.get('/admin/presupuesto')).status).toBe(403);
    expect((await docente.get('/admin/reportes/estadisticas')).status).toBe(403);
    expect((await docente.post('/admin/beneficios', {})).status).toBe(403);
    const ids = (await docente.get('/admin/recursos')).body.data.map((r) => r.id);
    expect(ids).toContain('produccion');
    expect(ids).not.toContain('presupuesto');
  });

  it('el docente mantiene su propio perfil (RF-ADM-06)', async () => {
    const res = await docente.put('/admin/docentes/me/perfil', { linea_investigacion: 'Control', afiliacion: 'EXTERNO' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ linea_investigacion: 'Control', afiliacion: 'UDENAR' }); // afiliación no editable
    expect((await coord.get('/admin/docentes/me/perfil')).status).toBe(403);
  });

  it('solo Coordinación gestiona usuarios', async () => {
    expect((await docente.get('/usuarios')).status).toBe(403);
    expect((await coord.get('/usuarios')).body.data.length).toBe(3);
  });
});

describe('Importación (RF-ADM-01/02) y estadísticas (RF-ADM-05)', () => {
  it('simular no guarda nada', async () => {
    const res = await coord.subir('/admin/importaciones?simular=true', await libroEstadisticas(), 'estadisticas.xlsx');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ formato: 'estadisticas', simulacion: true });
    expect(await contar('cohortes')).toBe(0);
  });

  it('importa el libro histórico ignorando filas de totales', async () => {
    const res = await coord.subir('/admin/importaciones', await libroEstadisticas(), 'estadisticas.xlsx');
    expect(res.status).toBe(201);
    const porHoja = Object.fromEntries(res.body.data.resumen.map((r) => [r.hoja, r]));
    expect(porHoja['Promociones y Estudiantes']).toMatchObject({ filas: 2, insertados: 2 });
    expect(porHoja.Contrataciones).toMatchObject({ filas: 2, insertados: 2 });
    expect(await contar('cohorte_beneficios')).toBe(2);
  });

  it('un archivo con errores no guarda nada y reporta hoja y fila', async () => {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await libroEstadisticas());
    libro.getWorksheet('Beneficios').getRow(4).getCell(2).value = 'IX'; // promoción inexistente
    libro.getWorksheet('Promociones y Estudiantes').getRow(3).getCell(5).value = 99; // cambio válido que no debe persistir
    const res = await coord.subir('/admin/importaciones', Buffer.from(await libro.xlsx.writeBuffer()), 'e.xlsx');
    expect(res.status).toBe(400);
    expect(res.body.error.details.errores).toEqual([
      expect.objectContaining({ hoja: 'Beneficios', fila: 4, mensaje: expect.stringMatching(/IX/) }),
    ]);
    const { rows } = await db.query("SELECT inscritos FROM cohortes WHERE nombre = 'I'");
    expect(rows[0].inscritos).toBe(12);
  });

  it('la plantilla exportada con datos se puede volver a importar (actualiza)', async () => {
    const plantilla = await coord.get('/admin/plantillas?datos=true').buffer(true).parse((res, cb) => {
      const partes = [];
      res.on('data', (c) => partes.push(c)).on('end', () => cb(null, Buffer.concat(partes)));
    });
    expect(plantilla.status).toBe(200);
    expect(plantilla.headers['content-disposition']).toMatch(/\.xlsx/);
    const res = await coord.subir('/admin/importaciones', plantilla.body, 'plantilla.xlsx');
    expect(res.status).toBe(201);
    expect(res.body.data.formato).toBe('plantilla');
    const cohortes = res.body.data.resumen.find((r) => r.hoja === 'Promociones y Estudiantes');
    expect(cohortes).toMatchObject({ filas: 2, insertados: 0, actualizados: 2 });
  });

  it('CSV de un recurso', async () => {
    const csv = 'Periodo;Promociones;N.° OPS;Valor OPS\n2022-A;I, II;3;36800000\n';
    const res = await coord.subir('/admin/importaciones?recurso=contrataciones', Buffer.from(csv), 'ops.csv');
    expect(res.status).toBe(201);
    expect(await contar('contrataciones_periodo')).toBe(3);
  });

  it('calcula el informe con los datos importados', async () => {
    const res = await coord.get('/admin/reportes/estadisticas');
    expect(res.status).toBe(200);
    const { promociones, contrataciones } = res.body.data;
    expect(promociones.totales.inscritos).toBe(31);
    expect(promociones.indicadores.pct_egresados).toBeCloseTo(18 / 27, 6);
    expect(contrataciones.totales).toEqual({ n_ops: 7, valor: 65721461 });
  });
});
