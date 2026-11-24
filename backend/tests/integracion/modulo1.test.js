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

  it('el docente consulta su perfil (RF-ADM-06) pero no lo modifica; Coordinación registra la afiliación', async () => {
    expect((await docente.put('/admin/docentes/me/perfil', { linea_investigacion: 'Control' })).status).toBe(404);
    expect((await coord.get('/admin/docentes/me/perfil')).status).toBe(403);

    const { id_usuario: idUsuario } = (await coord.get('/usuarios')).body.data.find((u) => u.email === 'docente@udenar.edu.co');
    const base = { identificacion: '111', nombres: 'Docente', apellidos: 'Prueba', email: 'docente@udenar.edu.co', rol: 'docente' };
    const externo = await coord.put(`/usuarios/${idUsuario}`, {
      ...base, afiliacion: 'EXTERNO', departamento: 'Departamento de Electrónica', universidad: 'Universidad del Cauca',
    });
    expect(externo.body.data).toMatchObject({ afiliacion: 'EXTERNO', departamento: 'Departamento de Electrónica', universidad: 'Universidad del Cauca' });
    expect((await docente.get('/admin/docentes/me/perfil')).body.data)
      .toMatchObject({ afiliacion: 'EXTERNO', departamento: 'Departamento de Electrónica', universidad: 'Universidad del Cauca' });

    // Sin enviar el departamento se conserva; al pasar a UDENAR la universidad se borra; un texto vacío borra.
    expect((await coord.put(`/usuarios/${idUsuario}`, { ...base, afiliacion: 'UDENAR' })).body.data)
      .toMatchObject({ afiliacion: 'UDENAR', departamento: 'Departamento de Electrónica', universidad: null });
    expect((await coord.put(`/usuarios/${idUsuario}`, { ...base, telefono: '3001234567' })).body.data).toMatchObject({ telefono: '3001234567' });
    // El teléfono sin enviar se conserva.
    expect((await coord.put(`/usuarios/${idUsuario}`, { ...base, departamento: '' })).body.data)
      .toMatchObject({ afiliacion: 'UDENAR', departamento: null, telefono: '3001234567' });
  });

  it('los cursos del docente alimentan «Cursos y docentes por semestre» (semestre real de la promoción)', async () => {
    const cohorte = (await coord.post('/admin/cohortes', {
      nombre: 'PD', periodo_inicio: '2030-A', periodo_fin: '2031-B', inscritos: 5, matriculados: 5, graduados: 0,
    })).body.data;
    const { rows: [robotica] } = await db.query("SELECT id_clase FROM clases WHERE codigo = 'CE2-01'");
    const curso = { id_cohorte: cohorte.id_cohorte, periodo: '2030-B', id_clase: robotica.id_clase };

    // El docente no registra sus cursos: lo hace Coordinación por él.
    // La ruta propia ya no existe: cae en /:id/cursos, reservada a Coordinación (403).
    expect((await docente.post('/admin/docentes/me/cursos', curso)).status).toBe(403);
    const { id_docente: idDocente } = (await docente.get('/admin/docentes/me/perfil')).body.data;
    expect((await docente.post(`/admin/docentes/${idDocente}/cursos`, curso)).status).toBe(403);
    const res = await coord.post(`/admin/docentes/${idDocente}/cursos`, curso);
    expect(res.status).toBe(201);
    expect(res.body.data.cursos).toEqual([expect.objectContaining({ clase: 'Robótica', semestre: 2, componente: 'Electivo' })]);
    expect(res.body.data.componentes).toEqual(['Electivo']);
    expect((await coord.post(`/admin/docentes/${idDocente}/cursos`, { ...curso, periodo: '2032-A' })).status).toBe(400);

    const semestres = (await coord.get('/admin/academico/reflejo')).body.data['cohorte-semestres'];
    expect(semestres.find((s) => s.id_cohorte === cohorte.id_cohorte))
      .toMatchObject({ semestre: 2, n_cursos: 1, docentes_udenar: 1, docentes_externos: 0, origen: 'gestion' });
    const directorio = (await coord.get('/admin/docentes')).body.data.find((d) => d.nombre_completo === 'DOCENTE PRUEBA');
    expect(directorio).toMatchObject({ cursos_asignados: 'Robótica', componentes_apoya: 'Electivo' });

    // La tabla no se edita a mano; Coordinación registra cursos por el docente.
    expect((await coord.post('/admin/cohorte-semestres', { id_cohorte: cohorte.id_cohorte, semestre: 1, n_cursos: 1, docentes_udenar: 0, docentes_externos: 0 })).status).toBe(403);
    const { cursos } = res.body.data;
    const otro = await coord.post(`/admin/docentes/${idDocente}/cursos`, { ...curso, periodo: '2031-A' });
    expect(otro.body.data.cursos).toHaveLength(2);

    // Al quitar al único docente, la oferta deja de existir.
    expect((await docente.delete(`/admin/docentes/${idDocente}/cursos/${cursos[0].id_curso}`)).status).toBe(403);
    const quitar = await coord.delete(`/admin/docentes/${idDocente}/cursos/${cursos[0].id_curso}`);
    expect(quitar.body.data.cursos.map((c) => c.periodo)).toEqual(['2031-A']);
    expect((await db.query('SELECT 1 FROM cursos WHERE id_curso = $1', [cursos[0].id_curso])).rowCount).toBe(0);
    await coord.delete(`/admin/cohortes/${cohorte.id_cohorte}`);
  });

  it('el usuario solo cambia su contraseña (quita la marca temporal); Coordinación cambia su correo', async () => {
    await db.query("UPDATE usuarios SET debe_cambiar_password = TRUE WHERE email = 'docente@udenar.edu.co'");
    expect((await docente.get('/auth/me')).body.data.debe_cambiar_password).toBe(true);
    expect((await docente.put('/auth/me', { email: 'docente.prueba@udenar.edu.co' })).status).toBe(404);
    const { id_usuario: idUsuario } = (await coord.get('/usuarios')).body.data.find((u) => u.email === 'docente@udenar.edu.co');
    const cuenta = await coord.put(`/usuarios/${idUsuario}`, {
      identificacion: '111-A', nombres: 'Docente', apellidos: 'Prueba', email: 'docente.prueba@udenar.edu.co', rol: 'docente',
    });
    expect(cuenta.body.data).toMatchObject({ identificacion: '111-A', email: 'docente.prueba@udenar.edu.co' });
    await docente.put('/auth/password', { actual: 'ClaveDocente1', nueva: 'ClaveDocente2' });
    expect((await docente.get('/auth/me')).body.data.debe_cambiar_password).toBe(false);
    expect(await login({ email: 'docente.prueba@udenar.edu.co', password: 'ClaveDocente2' })).toBeTruthy();
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

  it('reimportar el libro no borra los datos del docente que el libro no trae', async () => {
    await db.query("UPDATE docentes_perfil SET departamento = 'Departamento de Electrónica', grupo_investigacion = 'GIIEE' WHERE nombre_completo = 'DOCENTE PRUEBA'");
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await libroEstadisticas());
    const hoja = libro.addWorksheet('Docentes UDENAR-EXTERNOS');
    // En el libro real esta hoja empieza en la columna A (las demás dejan la A vacía).
    hoja.getRow(2).values = ['N.°', 'Docente', 'Formación profesional', 'Campo de formación', 'Afiliación'];
    hoja.getRow(3).values = [1, 'DOCENTE PRUEBA', 'Ingeniero Electrónico', 'Control', 'UDENAR'];
    const res = await coord.subir('/admin/importaciones', Buffer.from(await libro.xlsx.writeBuffer()), 'estadisticas.xlsx');
    expect(res.status).toBe(201);
    const { rows: [perfil] } = await db.query("SELECT * FROM docentes_perfil WHERE nombre_completo = 'DOCENTE PRUEBA'");
    expect(perfil).toMatchObject({
      formacion_profesional: 'Ingeniero Electrónico', campo_formacion: 'Control',
      departamento: 'Departamento de Electrónica', grupo_investigacion: 'GIIEE',
    });
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

  it('la hoja «Asignación docente» crea las ofertas con su docente y no duplica al reimportar', async () => {
    const vacia = await coord.get('/admin/plantillas').buffer(true).parse((res, cb) => {
      const partes = [];
      res.on('data', (c) => partes.push(c)).on('end', () => cb(null, Buffer.concat(partes)));
    });
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(vacia.body);
    libro.getWorksheet('Docentes UDENAR-EXTERNOS').addRow(['Docente Asignación Prueba', null, 'Control', 'UDENAR']);
    const hoja = libro.getWorksheet('Asignación docente');
    hoja.addRow(['II', 2, 'Docente Asignación Prueba', 'Profundización', 'CB1-01']); // componente errado: advertencia
    hoja.addRow(['II', 3, 'docente asignación prueba', null, 'Optimización']); // por nombre de la clase
    const archivo = Buffer.from(await libro.xlsx.writeBuffer());

    const res = await coord.subir('/admin/importaciones', archivo, 'asignacion.xlsx');
    expect(res.status).toBe(201);
    expect(res.body.data.resumen.find((r) => r.hoja === 'Asignación docente')).toMatchObject({ filas: 2, insertados: 2 });
    expect(res.body.data.advertencias).toEqual(expect.arrayContaining([
      expect.objectContaining({ hoja: 'Asignación docente', mensaje: expect.stringMatching(/componente Básico/) }),
    ]));
    // Promoción II empezó en 2021-A: su semestre 2 es 2021-B y el 3 es 2022-A.
    const { rows } = await db.query(`
      SELECT cl.codigo, c.periodo FROM cursos c JOIN clases cl ON cl.id_clase = c.id_clase
      JOIN curso_docentes cd ON cd.id_curso = c.id_curso JOIN docentes_perfil d ON d.id_docente = cd.id_docente
      WHERE d.nombre_completo = 'Docente Asignación Prueba' ORDER BY c.periodo`);
    expect(rows).toEqual([{ codigo: 'CB1-01', periodo: '2021-B' }, { codigo: 'CB2-01', periodo: '2022-A' }]);

    const otra = await coord.subir('/admin/importaciones', archivo, 'asignacion.xlsx');
    expect(otra.body.data.resumen.find((r) => r.hoja === 'Asignación docente')).toMatchObject({ insertados: 0, actualizados: 2 });

    const exportada = await coord.get('/admin/plantillas?datos=true').buffer(true).parse((r, cb) => {
      const partes = [];
      r.on('data', (c) => partes.push(c)).on('end', () => cb(null, Buffer.concat(partes)));
    });
    const libroExportado = new ExcelJS.Workbook();
    await libroExportado.xlsx.load(exportada.body);
    expect(libroExportado.getWorksheet('Asignación docente').getRow(2).values.slice(1))
      .toEqual(['II', 2, 'Docente Asignación Prueba', 'Básico', 'CB1-01']);
  });

  it('una asignación con un curso inexistente no guarda nada', async () => {
    const vacia = await coord.get('/admin/plantillas').buffer(true).parse((res, cb) => {
      const partes = [];
      res.on('data', (c) => partes.push(c)).on('end', () => cb(null, Buffer.concat(partes)));
    });
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(vacia.body);
    libro.getWorksheet('Asignación docente').addRow(['II', 4, 'Docente Asignación Prueba', null, 'Curso que no existe']);
    const res = await coord.subir('/admin/importaciones', Buffer.from(await libro.xlsx.writeBuffer()), 'mal.xlsx');
    expect(res.status).toBe(400);
    expect(res.body.error.details.errores).toEqual([
      expect.objectContaining({ hoja: 'Asignación docente', fila: 2, mensaje: expect.stringMatching(/Curso que no existe/) }),
    ]);
  });

  it('los beneficios por semestre se editan aparte del usuario, alimentan «Beneficios» y deducen su beca', async () => {
    const { rows: [ii] } = await db.query("SELECT id_cohorte FROM cohortes WHERE nombre = 'II'");
    const base = {
      identificacion: '333', nombres: 'Becada', apellidos: 'Prueba', email: 'becada@udenar.edu.co', telefono: '+57 300 123 4567',
      rol: 'estudiante', password: 'ClaveEstudiante1', id_cohorte: ii.id_cohorte,
    };
    const creado = await coord.post('/usuarios', base);
    expect(creado.status).toBe(201);
    expect(creado.body.data).toMatchObject({ telefono: '+57 300 123 4567', beca: null, beneficios: [] });
    const ruta = `/usuarios/${creado.body.data.id_usuario}/beneficios`;

    const doble = await coord.put(ruta, { id_cohorte: ii.id_cohorte, beneficios: [{ semestre: 2, tipo: '100' }, { semestre: 2, tipo: 'sintraunicol' }] });
    expect(doble.status).toBe(400);
    expect(doble.body.error.message).toMatch(/una beca por semestre/);
    expect((await request(app).put(`${API}${ruta}`).send({ id_cohorte: ii.id_cohorte, beneficios: [] })).status).toBe(401);
    expect((await coord.put(ruta, { beneficios: [] })).status).toBe(400); // falta la promoción
    // Una promoción a la que el estudiante no pertenece no se toca.
    const { rows: [i] } = await db.query("SELECT id_cohorte FROM cohortes WHERE nombre = 'I'");
    expect((await coord.put(ruta, { id_cohorte: i.id_cohorte, beneficios: [] })).status).toBe(404);

    const res = await coord.put(ruta, {
      id_cohorte: ii.id_cohorte,
      beneficios: [
        { semestre: 1, tipo: 'hora_catedra' }, { semestre: 2, tipo: '100' }, { semestre: 3, tipo: '100' },
        { semestre: 3, tipo: 'asistente_investigacion' },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ beca: '100', beneficios: expect.arrayContaining([{ semestre: 3, tipo: 'asistente_investigacion' }]) });
    const lista = (await coord.get('/usuarios/beneficios').query({ id_cohorte: ii.id_cohorte })).body.data;
    expect(lista.find((e) => e.identificacion === '333').beneficios).toHaveLength(4);

    // Editar el usuario (sin cambiar de promoción) conserva la beca y los beneficios.
    const editado = await coord.put(`/usuarios/${creado.body.data.id_usuario}`, { ...base, telefono: '' });
    expect(editado.body.data).toMatchObject({ telefono: null, beca: '100' });
    expect(editado.body.data.beneficios).toHaveLength(4);

    const fila = (await coord.get('/admin/academico/reflejo')).body.data.beneficios.find((b) => b.cohorte === 'II');
    // Cuenta estudiantes (no semestres) y, al haber beneficios por semestre, también los asistentes.
    expect(fila).toMatchObject({ becas_100: 1, becas_hora_catedra: 1, asistentes_investigacion: 1, ayudantes_docencia: 0, origen: 'gestion' });

    await coord.delete(`/usuarios/${creado.body.data.id_usuario}`);
    expect(await contar('estudiante_beneficios')).toBe(0);
  });

  it('la hoja «Beneficios por estudiante» reemplaza los beneficios de cada estudiante y deduce su beca', async () => {
    const { rows: [ii] } = await db.query("SELECT id_cohorte FROM cohortes WHERE nombre = 'II'");
    const creado = await coord.post('/usuarios', {
      identificacion: '444', nombres: 'Ana', apellidos: 'Plantilla', email: 'ana.plantilla@udenar.edu.co',
      rol: 'estudiante', password: 'ClaveEstudiante1', id_cohorte: ii.id_cohorte,
    });
    await coord.put(`/usuarios/${creado.body.data.id_usuario}/beneficios`, { id_cohorte: ii.id_cohorte, beneficios: [{ semestre: 4, tipo: 'ayudante_docencia' }] });
    const vacia = await coord.get('/admin/plantillas').buffer(true).parse((res, cb) => {
      const partes = [];
      res.on('data', (c) => partes.push(c)).on('end', () => cb(null, Buffer.concat(partes)));
    });
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(vacia.body);
    const hoja = libro.getWorksheet('Beneficios por estudiante');
    hoja.addRow(['II', 444, 'Plantilla Ana', 1, 'Beca SINTRAUNICOL']);
    hoja.addRow(['II', '444', null, 2, 'Beca SINTRAUNICOL']);
    hoja.addRow(['II', '444', null, 2, 'Asistente de investigación']);

    const res = await coord.subir('/admin/importaciones', Buffer.from(await libro.xlsx.writeBuffer()), 'beneficios.xlsx');
    expect(res.status).toBe(201);
    expect(res.body.data.resumen.find((r) => r.hoja === 'Beneficios por estudiante')).toMatchObject({ filas: 3, actualizados: 3 });
    const usuario = (await coord.get(`/usuarios/${creado.body.data.id_usuario}`)).body.data;
    expect(usuario.beca).toBe('sintraunicol');
    expect(usuario.beneficios).toHaveLength(3); // la ayudantía del semestre 4 ya no está en la hoja
    const fila = (await coord.get('/admin/academico/reflejo')).body.data.beneficios.find((b) => b.cohorte === 'II');
    expect(fila).toMatchObject({ becas_sintraunicol: 1, asistentes_investigacion: 1, ayudantes_docencia: 0 });

    hoja.addRow(['II', '444', null, 1, 'Beca 100 %']);
    hoja.addRow(['II', '999', null, 1, 'Beca 100 %']);
    const mal = await coord.subir('/admin/importaciones', Buffer.from(await libro.xlsx.writeBuffer()), 'mal.xlsx');
    expect(mal.status).toBe(400);
    expect(mal.body.error.details.errores).toEqual(expect.arrayContaining([
      expect.objectContaining({ fila: 6, mensaje: expect.stringMatching(/999/) }),
      expect.objectContaining({ mensaje: expect.stringMatching(/una beca por semestre \(semestre 1\)/) }),
    ]));

    await coord.delete(`/usuarios/${creado.body.data.id_usuario}`);
  });

  it('los contratos OPS con nombres calculan «Contrataciones» del periodo (solo Coordinación)', async () => {
    const { rows: [ii] } = await db.query("SELECT id_cohorte FROM cohortes WHERE nombre = 'II'");
    const base = { periodo: '2031-A', valor: 1000000 };
    const a = await coord.post('/admin/contratos-ops', { ...base, contratista: 'Ana Pérez', objeto: 'Robótica', id_cohorte: ii.id_cohorte });
    expect(a.status).toBe(201);
    expect(a.body.data).toMatchObject({ cohorte: 'II' });
    const b = await coord.post('/admin/contratos-ops', { ...base, contratista: 'Luis Gómez', objeto: 'Apoyo a laboratorios', valor: 500000 });
    expect(b.status).toBe(201);
    expect(b.body.data).toMatchObject({ id_cohorte: null, cohorte: null });
    expect((await coord.post('/admin/contratos-ops', { ...base, contratista: 'Sin objeto' })).status).toBe(400);

    const reflejo = await coord.get('/admin/finanzas/reflejo');
    expect(reflejo.body.data.contrataciones.find((c) => c.periodo === '2031-A'))
      .toMatchObject({ n_ops: 2, valor: 1500000, promociones: 'II', origen: 'gestion', sin_registro: true });
    const docente = conToken(await login({ email: 'docente.prueba@udenar.edu.co', password: 'ClaveDocente2' }));
    expect((await docente.get('/admin/finanzas/reflejo')).status).toBe(403);
    expect((await docente.get('/admin/contratos-ops')).status).toBe(403);
    // El Panel general usa las mismas cifras.
    const informe = (await coord.get('/admin/reportes/estadisticas')).body.data;
    expect(informe.contrataciones.filas.find((c) => c.periodo === '2031-A')).toMatchObject({ n_ops: 2, valor: 1500000 });

    // Editar la fila calculada envía las columnas reflejadas omitidas (todas): se conserva el histórico.
    expect((await coord.post('/admin/contrataciones', { periodo: '2031-A', n_ops: 9, valor: 9 })).status).toBe(201);
    const editada = await coord.put('/admin/contrataciones/2031-A', {});
    expect(editada.status).toBe(200);
    expect(editada.body.data).toMatchObject({ periodo: '2031-A', n_ops: 9, valor: 9 });
    await coord.delete('/admin/contrataciones/2031-A');

    await coord.delete(`/admin/contratos-ops/${a.body.data.id_contrato}`);
    await coord.delete(`/admin/contratos-ops/${b.body.data.id_contrato}`);
  });

  it('los productos de investigación calculan la «Producción científica» de su promoción', async () => {
    const { rows: [ii] } = await db.query("SELECT id_cohorte FROM cohortes WHERE nombre = 'II'");
    const mal = await coord.post('/admin/productos', { id_cohorte: ii.id_cohorte, tipo: 'Libro', cita: 'X' });
    expect(mal.status).toBe(400);
    const creado = await coord.post('/admin/productos', {
      id_cohorte: ii.id_cohorte, tipo: 'Ponencia', cita: 'Prueba, A. «Ponencia de integración». Congreso Z, 2025.',
      anio: 2025, estudiantes: 'Ana Prueba', enlace: null,
    });
    expect(creado.status).toBe(201);
    const fila = (await coord.get('/admin/academico/reflejo')).body.data.produccion.find((p) => p.cohorte === 'II');
    expect(fila).toMatchObject({ ponencias: 1, articulos: 0, origen: 'gestion', detalles: expect.stringMatching(/Ponencia de integración/) });
    expect((await coord.delete(`/admin/productos/${creado.body.data.id_producto}`)).status).toBe(200);
    expect((await coord.get('/admin/academico/reflejo')).body.data.produccion.find((p) => p.cohorte === 'II')?.origen ?? 'registro')
      .toBe('registro');
  });

  it('ficha del estudiante (consulta) y participantes de un producto (solo de su promoción)', async () => {
    const { rows: [iii] } = await db.query("SELECT id_cohorte FROM cohortes WHERE nombre = 'II'");
    const { rows: [iv] } = await db.query("SELECT id_cohorte FROM cohortes WHERE nombre = 'I'");
    const est = (await coord.post('/usuarios', {
      identificacion: '555', nombres: 'Ficha', apellidos: 'Prueba', email: 'ficha@udenar.edu.co',
      rol: 'estudiante', password: 'ClaveEstudiante1', id_cohorte: iii.id_cohorte,
    })).body.data;
    const propio = (await coord.post('/admin/productos', { id_cohorte: iii.id_cohorte, tipo: 'Artículo', cita: 'Ficha, P. «Artículo propio». Revista X, 2025.', anio: 2025 })).body.data;
    const ajeno = (await coord.post('/admin/productos', { id_cohorte: iv.id_cohorte, tipo: 'Software', cita: 'Otro, Q. «Software ajeno». 2025.' })).body.data;
    try {
      const ficha = (await coord.get(`/usuarios/${est.id_usuario}/ficha`)).body.data;
      expect(ficha).toMatchObject({ poblacion: 'posgrado', materias: [], beneficios: [], produccion: [] });
      expect(ficha.promociones.map((p) => p.cohorte)).toEqual(['II']);

      // La producción se registra desde el producto (Investigación y movilidad), no desde el usuario.
      const lista = (await coord.get(`/admin/productos/${propio.id_producto}/estudiantes`)).body.data;
      expect(lista.estudiantes.find((e) => e.id_usuario === est.id_usuario)).toMatchObject({ vinculado: false });
      expect((await coord.put(`/admin/productos/${ajeno.id_producto}/estudiantes`, { estudiantes: [est.id_usuario] })).status).toBe(400);
      const ok = await coord.put(`/admin/productos/${propio.id_producto}/estudiantes`, { estudiantes: [est.id_usuario] });
      expect(ok.status).toBe(200);
      expect(ok.body.data.estudiantes.find((e) => e.id_usuario === est.id_usuario).vinculado).toBe(true);
      const conProduccion = (await coord.get(`/usuarios/${est.id_usuario}/ficha`)).body.data;
      expect(conProduccion.produccion).toEqual([expect.objectContaining({ id_producto: propio.id_producto, tipo: 'Artículo' })]);
    } finally {
      await coord.delete(`/admin/productos/${propio.id_producto}`);
      await coord.delete(`/admin/productos/${ajeno.id_producto}`);
      await coord.delete(`/usuarios/${est.id_usuario}`);
    }
  });

  it('editar una fila calculada desde Gestión conserva el histórico y avisa del registro incompleto', async () => {
    const { rows: [ii] } = await db.query("SELECT * FROM cohortes WHERE nombre = 'II'");
    const estudiante = (await coord.post('/usuarios', {
      identificacion: '444', nombres: 'Parcial', apellidos: 'Prueba', email: 'parcial@udenar.edu.co',
      rol: 'estudiante', password: 'ClaveEstudiante1', id_cohorte: ii.id_cohorte,
    })).body.data;

    // Un solo estudiante registrado de los matriculados de la hoja: cifras de Gestión, con aviso.
    const reflejada = (await coord.get('/admin/academico/reflejo')).body.data.cohortes.find((c) => c.nombre === 'II');
    expect(reflejada).toMatchObject({ origen: 'gestion', matriculados: 1, registro_parcial: { registrados: 1, en_hoja: ii.matriculados } });
    const alertas = (await coord.get('/admin/reportes/estadisticas')).body.data.alertas;
    expect(alertas.find((a) => a.tipo === 'datos').detalle).toMatch(/Promoción II: 1 estudiante matriculado registrado/);

    // El formulario no envía las columnas reflejadas: el PUT las conserva y actualiza las demás.
    const put = await coord.put(`/admin/cohortes/${ii.id_cohorte}`, {
      nombre: 'II', periodo_inicio: ii.periodo_inicio, periodo_fin: ii.periodo_fin,
      aprobados_sem1: 11, aprobados_sem2: ii.aprobados_sem2, aprobados_sem3: ii.aprobados_sem3,
    });
    expect(put.status).toBe(200);
    const { rows: [despues] } = await db.query('SELECT * FROM cohortes WHERE id_cohorte = $1', [ii.id_cohorte]);
    expect(despues).toMatchObject({ aprobados_sem1: 11, inscritos: ii.inscritos, matriculados: ii.matriculados, egresados: ii.egresados, graduados: ii.graduados });
    // Enviarlas vacías sigue siendo un error.
    expect((await coord.put(`/admin/cohortes/${ii.id_cohorte}`, { nombre: 'II', periodo_inicio: ii.periodo_inicio, periodo_fin: ii.periodo_fin, graduados: null })).status).toBe(400);

    await coord.put(`/admin/cohortes/${ii.id_cohorte}`, { ...ii, aprobados_sem1: ii.aprobados_sem1 });
    await coord.delete(`/usuarios/${estudiante.id_usuario}`);
  });

  it('la hoja calculada «Cursos y docentes por semestre» no se importa por CSV y las ofertas caen en la promoción', async () => {
    const csv = 'Promoción;Semestre;N.° cursos;Docentes invitados UDENAR;Docentes invitados externos\nII;1;3;1;1\n';
    const res = await coord.subir('/admin/importaciones?recurso=cohorte-semestres', Buffer.from(csv), 'cursos.csv');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/no se edita/);

    const { rows: [ii] } = await db.query("SELECT id_cohorte FROM cohortes WHERE nombre = 'II'");
    const { rows: [clase] } = await db.query("SELECT id_clase FROM clases WHERE codigo = 'CE2-01'");
    const fuera = await coord.post('/admin/cursos', { id_clase: clase.id_clase, id_cohorte: ii.id_cohorte, periodo: '2030-A' });
    expect(fuera.status).toBe(400);
    expect(fuera.body.error.message).toMatch(/cuatro semestres/);
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
