// Estudiantes de pregrado que toman cursos de la maestría (asesoría del 20-oct-2026): lista por semestre,
// promoción y curso, que los habilita para el formulario EE cuando Coordinación incluye el pregrado en la
// evaluación del semestre. Se cargan con una plantilla Excel con el mismo patrón de importación del
// Módulo 1: validar (simular) → confirmar, todo o nada.
// Cada estudiante necesita una cuenta para evaluar: si el correo no existe se crea con rol estudiante y una
// contraseña temporal (debe cambiarla al entrar); las credenciales se entregan UNA vez, al confirmar.
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');
const env = require('../../../config/env');
const db = require('../../../config/db');
const ApiError = require('../../../utils/ApiError');
const { valorCelda, normalizar, buscarHoja } = require('../../admin/importaciones/excel.util');

const HOJA = 'Pregrado';
const COLUMNAS = [
  { clave: 'periodo', titulo: 'Semestre académico', ejemplo: '2026-B', ancho: 18 },
  { clave: 'promocion', titulo: 'Promoción', ejemplo: 'VI', ancho: 12 },
  { clave: 'curso', titulo: 'Curso (código o nombre de la clase)', ejemplo: 'CE2-01', ancho: 34 },
  { clave: 'identificacion', titulo: 'Identificación', ejemplo: '1085000000', ancho: 16 },
  { clave: 'nombres', titulo: 'Nombres', ejemplo: 'Nombre', ancho: 20 },
  { clave: 'apellidos', titulo: 'Apellidos', ejemplo: 'Apellido Apellido', ancho: 22 },
  { clave: 'email', titulo: 'Correo', ejemplo: 'estudiante@udenar.edu.co', ancho: 30 },
  { clave: 'programa', titulo: 'Programa de pregrado', ejemplo: 'Ingeniería Electrónica', ancho: 26 },
];
const ENCABEZADO = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF040039' } } };
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERIODO = /^[0-9]{4}-[AB]$/;

class Simulacion extends Error {
  constructor(resultado) {
    super('simulacion');
    this.resultado = resultado;
  }
}

const passwordTemporal = () => crypto.randomBytes(9).toString('base64url');
const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());

// Lee la hoja «Pregrado» (o la primera) por encabezados.
const leer = async (buffer) => {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer);
  } catch {
    throw ApiError.badRequest('No se pudo leer el archivo .xlsx (¿está dañado o protegido?)');
  }
  const hoja = buscarHoja(libro, HOJA) ?? libro.worksheets[0];
  if (!hoja) throw ApiError.badRequest('El archivo no tiene hojas');
  const encabezados = [];
  hoja.getRow(1).eachCell((c, i) => { encabezados[i] = normalizar(valorCelda(c)); });
  const indice = Object.fromEntries(COLUMNAS.map((c) => [c.clave, encabezados.indexOf(normalizar(c.titulo))]));
  const faltan = COLUMNAS.filter((c) => c.clave !== 'programa' && indice[c.clave] < 1).map((c) => c.titulo);
  if (faltan.length) throw ApiError.badRequest(`Faltan columnas en la hoja «${hoja.name}»: ${faltan.join(', ')}`);
  const filas = [];
  hoja.eachRow((fila, n) => {
    if (n === 1) return;
    const datos = Object.fromEntries(COLUMNAS.map((c) => [c.clave, indice[c.clave] > 0 ? texto(valorCelda(fila.getCell(indice[c.clave]))) : '']));
    if (Object.values(datos).some(Boolean)) filas.push({ fila: n, ...datos });
  });
  return filas;
};

// Oferta del semestre para la promoción y la clase (por código o nombre). Una clase con varios grupos
// en el mismo semestre es ambigua: se rechaza.
const buscarOferta = async (cliente, { periodo, promocion, curso }) => {
  const { rows } = await cliente.query(`
    SELECT c.id_curso, c.grupo FROM cursos c
    JOIN cohortes h ON h.id_cohorte = c.id_cohorte
    JOIN clases cl ON cl.id_clase = c.id_clase
    WHERE c.periodo = $1 AND UPPER(h.nombre) = UPPER($2) AND (UPPER(cl.codigo) = UPPER($3) OR LOWER(cl.nombre) = LOWER($3))`,
  [periodo, promocion, curso]);
  if (!rows.length) return { error: `No hay oferta de «${curso}» para la promoción ${promocion} en ${periodo} (Gestión académica › Asignación por semestre)` };
  if (rows.length > 1) return { error: `«${curso}» tiene ${rows.length} grupos en ${periodo}; no se puede saber a cuál inscribir` };
  return { id_curso: rows[0].id_curso };
};

const procesar = async (filas, simular) => {
  const errores = [];
  const credenciales = [];
  const cuenta = { filas: filas.length, usuarios_nuevos: 0, inscripciones_nuevas: 0, actualizadas: 0 };

  const ejecutar = async (cliente) => {
    const nuevos = new Map(); // correo → id en esta misma importación
    for (const f of filas) {
      const err = (mensaje) => errores.push({ hoja: HOJA, fila: f.fila, mensaje });
      if (!PERIODO.test(f.periodo)) { err('Semestre académico con formato AAAA-A o AAAA-B'); continue; }
      if (!f.promocion || !f.curso) { err('Indique la promoción y el curso'); continue; }
      if (!f.identificacion || !f.nombres || !f.apellidos) { err('Identificación, nombres y apellidos son obligatorios'); continue; }
      if (!CORREO.test(f.email)) { err(`Correo inválido: «${f.email}»`); continue; }
      const oferta = await buscarOferta(cliente, f);
      if (oferta.error) { err(oferta.error); continue; }

      const email = f.email.toLowerCase();
      let idEstudiante = nuevos.get(email);
      if (!idEstudiante) {
        const { rows: [u] } = await cliente.query('SELECT id_usuario, rol, identificacion FROM usuarios WHERE email = $1', [email]);
        const { rows: [porId] } = await cliente.query('SELECT email FROM usuarios WHERE identificacion = $1', [f.identificacion]);
        if (u && u.rol !== 'estudiante') { err(`El correo ${email} pertenece a una cuenta de ${u.rol}`); continue; }
        if (u && u.identificacion !== f.identificacion) { err(`El correo ${email} está registrado con otra identificación`); continue; }
        if (!u && porId) { err(`La identificación ${f.identificacion} ya está registrada con el correo ${porId.email}`); continue; }
        if (u) idEstudiante = u.id_usuario;
        else {
          const password = passwordTemporal();
          const { rows: [nuevo] } = await cliente.query(
            `INSERT INTO usuarios (identificacion, nombres, apellidos, email, password_hash, rol, debe_cambiar_password)
             VALUES ($1, $2, $3, $4, $5, 'estudiante', TRUE) RETURNING id_usuario`,
            [f.identificacion, f.nombres, f.apellidos, email, simular ? 'simulacion' : await bcrypt.hash(password, env.bcryptCost)],
          );
          idEstudiante = nuevo.id_usuario;
          cuenta.usuarios_nuevos += 1;
          credenciales.push({ identificacion: f.identificacion, nombre: `${f.nombres} ${f.apellidos}`, email, password });
        }
        nuevos.set(email, idEstudiante);
      }
      const { rows: [posgrado] } = await cliente.query('SELECT 1 FROM curso_estudiantes WHERE id_curso = $1 AND id_estudiante = $2', [oferta.id_curso, idEstudiante]);
      if (posgrado) { err(`${email} ya está inscrito como estudiante de posgrado en ese curso`); continue; }
      const { rows: [r] } = await cliente.query(
        `INSERT INTO curso_estudiantes_pregrado (id_curso, id_estudiante, programa) VALUES ($1, $2, $3)
         ON CONFLICT (id_curso, id_estudiante) DO UPDATE SET programa = COALESCE(EXCLUDED.programa, curso_estudiantes_pregrado.programa), estado = 'inscrito'
         RETURNING (xmax = 0) AS insertado`, [oferta.id_curso, idEstudiante, f.programa || null],
      );
      if (r.insertado) cuenta.inscripciones_nuevas += 1;
      else cuenta.actualizadas += 1;
    }
    const resultado = { simulacion: simular, resumen: cuenta };
    if (errores.length) {
      throw ApiError.badRequest(`El archivo tiene ${errores.length} error(es); no se guardó ningún dato`, { ...resultado, errores });
    }
    if (simular) throw new Simulacion(resultado); // fuerza el ROLLBACK
    // Las contraseñas temporales se muestran una sola vez, al confirmar.
    return { ...resultado, credenciales };
  };

  try {
    return await db.withTransaction(ejecutar);
  } catch (err) {
    if (err instanceof Simulacion) return err.resultado;
    throw err;
  }
};

module.exports = {
  // GET /eval-docente/pregrado?periodo
  async listar({ query }) {
    const { rows } = await db.query(`
      SELECT cp.id_curso, cp.id_estudiante, cp.programa, cp.estado, c.periodo, h.nombre AS cohorte, cl.codigo AS clase_codigo,
             cl.nombre AS clase, u.identificacion, u.nombres, u.apellidos, u.email, u.activo
      FROM curso_estudiantes_pregrado cp
      JOIN cursos c ON c.id_curso = cp.id_curso
      JOIN cohortes h ON h.id_cohorte = c.id_cohorte
      JOIN clases cl ON cl.id_clase = c.id_clase
      JOIN usuarios u ON u.id_usuario = cp.id_estudiante
      WHERE ($1::varchar IS NULL OR c.periodo = $1)
      ORDER BY c.periodo DESC, h.periodo_inicio, cl.nombre, u.apellidos, u.nombres`, [query.periodo ?? null]);
    return rows;
  },

  // GET /eval-docente/pregrado/plantilla?periodo — hoja «Pregrado» y, de referencia, las ofertas del semestre.
  async plantilla({ query }) {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'Plataforma MaIE';
    const h = libro.addWorksheet(HOJA);
    h.columns = COLUMNAS.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho }));
    h.getRow(1).eachCell((c) => Object.assign(c, ENCABEZADO));
    h.views = [{ state: 'frozen', ySplit: 1 }];
    const ofertas = (await db.query(`
      SELECT c.periodo, h.nombre AS promocion, cl.codigo, cl.nombre, c.grupo
      FROM cursos c JOIN cohortes h ON h.id_cohorte = c.id_cohorte JOIN clases cl ON cl.id_clase = c.id_clase
      WHERE ($1::varchar IS NULL OR c.periodo = $1)
      ORDER BY c.periodo DESC, h.periodo_inicio, cl.nombre`, [query.periodo ?? null])).rows;
    const ref = libro.addWorksheet('Ofertas (referencia)');
    ref.columns = [
      { header: 'Semestre académico', key: 'periodo', width: 18 }, { header: 'Promoción', key: 'promocion', width: 12 },
      { header: 'Código de la clase', key: 'codigo', width: 18 }, { header: 'Clase', key: 'nombre', width: 40 }, { header: 'Grupo', key: 'grupo', width: 8 },
    ];
    ref.getRow(1).eachCell((c) => Object.assign(c, ENCABEZADO));
    ofertas.forEach((o) => ref.addRow(o));
    const ayuda = libro.addWorksheet('Instrucciones');
    [
      'Una fila por estudiante de pregrado y curso de la maestría que toma en el semestre.',
      'El curso se identifica por el código o el nombre de la clase (hoja «Ofertas (referencia)»).',
      'Si el correo no existe se crea una cuenta de estudiante con contraseña temporal; las credenciales se muestran una vez al confirmar.',
      'La importación es todo o nada: primero se valida y, si no hay errores, se confirma.',
    ].forEach((t) => ayuda.addRow([t]));
    ayuda.getColumn(1).width = 120;
    return {
      nombreArchivo: `Plantilla_Pregrado_MaIE${query.periodo ? `_${query.periodo}` : ''}.xlsx`,
      tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await libro.xlsx.writeBuffer(),
    };
  },

  // POST /eval-docente/pregrado/importar?simular=true — multipart «archivo» (.xlsx)
  async importar({ file, query }) {
    if (!file) throw ApiError.badRequest('Adjunte la plantilla .xlsx en el campo "archivo"');
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) throw ApiError.badRequest('La lista de pregrado se carga con la plantilla .xlsx');
    const filas = await leer(file.buffer);
    if (!filas.length) throw ApiError.badRequest('La hoja no tiene filas para importar');
    return procesar(filas, query.simular === 'true');
  },

  // POST /eval-docente/pregrado — inscripción individual de un estudiante de pregrado en una oferta
  async inscribir({ body }) {
    const { rows: [curso] } = await db.query('SELECT id_curso FROM cursos WHERE id_curso = $1', [body.id_curso]);
    if (!curso) throw ApiError.notFound('Curso no encontrado');
    const { rows: [est] } = await db.query('SELECT id_usuario, rol FROM usuarios WHERE id_usuario = $1', [body.id_estudiante]);
    if (!est || est.rol !== 'estudiante') throw ApiError.badRequest('El usuario debe existir y tener rol estudiante');
    const { rows: [posgrado] } = await db.query(
      'SELECT 1 FROM curso_estudiantes WHERE id_curso = $1 AND id_estudiante = $2',
      [body.id_curso, body.id_estudiante],
    );
    if (posgrado) throw ApiError.conflict('El estudiante ya está matriculado como posgrado en este curso');
    const { rows: [r] } = await db.query(
      `INSERT INTO curso_estudiantes_pregrado (id_curso, id_estudiante, programa)
       VALUES ($1, $2, $3)
       ON CONFLICT (id_curso, id_estudiante)
       DO UPDATE SET programa = COALESCE(EXCLUDED.programa, curso_estudiantes_pregrado.programa), estado = 'inscrito'
       RETURNING id_curso, id_estudiante, programa, estado`,
      [body.id_curso, body.id_estudiante, body.programa?.trim() || null],
    );
    return r;
  },

  // PUT /eval-docente/pregrado/:idCurso/:idEstudiante — { estado: 'inscrito' | 'retirado' }
  async cambiarEstado({ params, body }) {
    const { rows: [r] } = await db.query(
      `UPDATE curso_estudiantes_pregrado SET estado = $3 WHERE id_curso = $1 AND id_estudiante = $2 RETURNING id_curso, id_estudiante, estado`,
      [params.idCurso, params.idEstudiante, body.estado],
    );
    if (!r) throw ApiError.notFound('Inscripción de pregrado no encontrada');
    return r;
  },

  // DELETE /eval-docente/pregrado/:idCurso/:idEstudiante (la cuenta del estudiante se conserva)
  async quitar({ params }) {
    const { rowCount } = await db.query('DELETE FROM curso_estudiantes_pregrado WHERE id_curso = $1 AND id_estudiante = $2', [params.idCurso, params.idEstudiante]);
    if (!rowCount) throw ApiError.notFound('Inscripción de pregrado no encontrada');
    return { eliminado: true };
  },

  COLUMNAS,
};
