#!/usr/bin/env node
// Datos de prueba para revisar la calificación de rúbricas (Módulo 2) en el semestre actual.
// Crea, en la promoción VI y el semestre 2026-B (su III semestre en el plan):
//   - 6 estudiantes de posgrado matriculados en la promoción,
//   - 3 docentes con cuenta y las ofertas del III semestre (Electiva II «Aprendizaje Profundo», Tesis I y
//     Formulación de Proyectos de Investigación), con los 6 estudiantes inscritos en cada una.
// No abre la calificación: eso se prueba desde «Apertura de calificación».
// Todo queda marcado con el dominio @sintetico.maie.local y se borra con --limpiar (también las notas).
//   node scripts/datosPruebaRA.js            → borra los datos de prueba anteriores y los vuelve a crear
//   node scripts/datosPruebaRA.js --limpiar  → solo los borra
// Usa DATABASE_URL (backend/.env). Contraseña de las cuentas de prueba: PRUEBA_PASSWORD o la de abajo.
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');
const db = require('../src/config/db');

const DOMINIO = 'sintetico.maie.local';
const PASSWORD = process.env.PRUEBA_PASSWORD || 'PruebaMaIE2026';
const PROMOCION = 'VI';
const PERIODO = '2026-B';

const ESTUDIANTES = [
  ['1085300101', 'Laura Sofía', 'Benavides Rosero'],
  ['1085300102', 'Juan Camilo', 'Eraso Delgado'],
  ['1085300103', 'María Fernanda', 'Insuasty Narváez'],
  ['1085300104', 'Santiago', 'Guerrero Bolaños'],
  ['1085300105', 'Valentina', 'Muñoz Chamorro'],
  ['1085300106', 'Andrés Felipe', 'Rosales Burbano'],
];

// [identificación, nombres, apellidos, afiliación, campo, código de la clase que dicta]
const DOCENTES = [
  ['98300201', 'Paula Andrea', 'Ortega Zambrano', 'EXTERNO', 'Machine Learning, Deep Learning', 'CE2-02'],
  ['98300202', 'Héctor Mauricio', 'Cabrera Erazo', 'UDENAR', 'Automatización y Control', 'TESIS-I-01'],
  ['98300203', 'Diana Carolina', 'Pantoja Ruano', 'UDENAR', 'Sistemas de Comunicaciones', 'CI1-01'],
];

const correo = (nombres, apellidos, sufijo) =>
  `${nombres.split(' ')[0]}.${apellidos.split(' ')[0]}.${sufijo}@${DOMINIO}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// Borra solo lo creado por este script: notas, inscripciones y ofertas del semestre con docentes de prueba,
// y las cuentas de prueba de este script (la promoción y las clases reales no se tocan).
const limpiar = async (c) => {
  const identificaciones = [...ESTUDIANTES, ...DOCENTES].map((x) => x[0]);
  const { rows: usuarios } = await c.query(
    'SELECT id_usuario FROM usuarios WHERE identificacion = ANY($1) AND email LIKE $2',
    [identificaciones, `%@${DOMINIO}`],
  );
  const ids = usuarios.map((u) => u.id_usuario);
  if (!ids.length) return 0;
  // Ofertas del semestre de prueba que dictan los docentes de prueba.
  const { rows: cursos } = await c.query(
    `SELECT DISTINCT cd.id_curso FROM curso_docentes cd
     JOIN docentes_perfil d ON d.id_docente = cd.id_docente
     JOIN cursos k ON k.id_curso = cd.id_curso
     WHERE d.id_usuario = ANY($1) AND k.periodo = $2`,
    [ids, PERIODO],
  );
  const idsCursos = cursos.map((x) => x.id_curso);
  await c.query('DELETE FROM evaluaciones_ra_estudiante WHERE id_estudiante = ANY($1) OR id_curso = ANY($2)', [ids, idsCursos]);
  await c.query('DELETE FROM cursos WHERE id_curso = ANY($1)', [idsCursos]);
  await c.query('DELETE FROM docentes_perfil WHERE id_usuario = ANY($1)', [ids]);
  return (await c.query('DELETE FROM usuarios WHERE id_usuario = ANY($1)', [ids])).rowCount;
};

const crear = async (c) => {
  const { rows: [cohorte] } = await c.query('SELECT id_cohorte FROM cohortes WHERE nombre = $1', [PROMOCION]);
  if (!cohorte) throw new Error(`No existe la promoción ${PROMOCION}`);
  const hash = await bcrypt.hash(PASSWORD, env.bcryptCost);

  const nuevoUsuario = async ([identificacion, nombres, apellidos], rol, sufijo) =>
    (await c.query(
      `INSERT INTO usuarios (identificacion, nombres, apellidos, email, password_hash, rol, debe_cambiar_password)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE) RETURNING id_usuario`,
      [identificacion, nombres, apellidos, correo(nombres, apellidos, sufijo), hash, rol],
    )).rows[0].id_usuario;

  const estudiantes = [];
  for (const e of ESTUDIANTES) {
    const id = await nuevoUsuario(e, 'estudiante', 'est');
    await c.query("INSERT INTO cohorte_estudiantes (id_cohorte, id_estudiante, estado) VALUES ($1, $2, 'matriculado')", [cohorte.id_cohorte, id]);
    estudiantes.push(id);
  }

  const ofertas = [];
  for (const d of DOCENTES) {
    const [, nombres, apellidos, afiliacion, campo, codigoClase] = d;
    const idUsuario = await nuevoUsuario(d, 'docente', 'doc');
    const { rows: [perfil] } = await c.query(
      `INSERT INTO docentes_perfil (id_usuario, nombre_completo, afiliacion, campo_formacion)
       VALUES ($1, $2, $3, $4) RETURNING id_docente`,
      [idUsuario, `${nombres} ${apellidos}`.toUpperCase(), afiliacion, campo],
    );
    const { rows: [clase] } = await c.query('SELECT id_clase, id_catalogo, nombre FROM clases WHERE codigo = $1', [codigoClase]);
    if (!clase) throw new Error(`No existe la clase ${codigoClase}`);
    const { rows: [curso] } = await c.query(
      `INSERT INTO cursos (id_catalogo, id_clase, id_cohorte, periodo) VALUES ($1, $2, $3, $4) RETURNING id_curso`,
      [clase.id_catalogo, clase.id_clase, cohorte.id_cohorte, PERIODO],
    );
    await c.query('INSERT INTO curso_docentes (id_curso, id_docente) VALUES ($1, $2)', [curso.id_curso, perfil.id_docente]);
    await c.query(
      'INSERT INTO curso_estudiantes (id_curso, id_estudiante) SELECT $1, unnest($2::uuid[])',
      [curso.id_curso, estudiantes],
    );
    ofertas.push(`${clase.nombre} → ${nombres} ${apellidos} (${d[0]})`);
  }
  return { estudiantes: estudiantes.length, ofertas };
};

const main = async () => {
  if (env.nodeEnv === 'production') throw new Error('No se cargan datos de prueba en producción');
  const soloLimpiar = process.argv.includes('--limpiar');
  const r = await db.withTransaction(async (c) => {
    const borrados = await limpiar(c);
    return { borrados, creados: soloLimpiar ? null : await crear(c) };
  });
  console.log('Cuentas de prueba borradas:', r.borrados);
  if (r.creados) {
    console.log(`Promoción ${PROMOCION}, ${PERIODO}: ${r.creados.estudiantes} estudiantes inscritos en`);
    r.creados.ofertas.forEach((o) => console.log('  -', o));
    console.log(`Ingreso con la identificación; contraseña de las cuentas de prueba: ${PASSWORD}`);
  }
};

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
