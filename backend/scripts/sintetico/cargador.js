// Carga en PostgreSQL los datos de generador.js, resolviendo las claves lógicas contra el
// catálogo y las rúbricas sembrados en seed.sql. Todo corre dentro de la transacción del
// cliente recibido. Los datos sintéticos se reconocen por el dominio de correo y el prefijo
// de las promociones, y limpiar() los borra sin tocar los datos reales.
const bcrypt = require('bcryptjs');
const { nivelDeNota } = require('../../src/modules/ra/rubrica');
const { DOMINIO, PREFIJO_COHORTE } = require('./generador');

const PASSWORD_POR_DEFECTO = 'MaIE-Sintetico-2026';

const mapa = (filas, clave, valor) => new Map(filas.map((f) => [f[clave], f[valor]]));

const limpiar = async (cliente) => {
  const correo = `%@${DOMINIO}`;
  const cohorte = `${PREFIJO_COHORTE} %`;
  await cliente.query(
    `DELETE FROM evaluaciones_ra_estudiante e USING usuarios u
     WHERE u.id_usuario = e.id_estudiante AND u.email LIKE $1`,
    [correo],
  );
  await cliente.query(
    'DELETE FROM cursos c USING cohortes h WHERE h.id_cohorte = c.id_cohorte AND h.nombre LIKE $1',
    [cohorte],
  );
  const usuarios = await cliente.query('DELETE FROM usuarios WHERE email LIKE $1', [correo]);
  const cohortes = await cliente.query('DELETE FROM cohortes WHERE nombre LIKE $1', [cohorte]);
  return { usuarios: usuarios.rowCount, cohortes: cohortes.rowCount };
};

const cargar = async (cliente, datos, { password = PASSWORD_POR_DEFECTO } = {}) => {
  const hash = await bcrypt.hash(password, 10);

  const cohortes = mapa((await cliente.query(
    `INSERT INTO cohortes (nombre, periodo_inicio, periodo_fin, inscritos, matriculados)
     SELECT * FROM unnest($1::varchar[], $2::varchar[], $3::varchar[], $4::int[], $5::int[])
     ON CONFLICT (nombre) DO UPDATE SET periodo_inicio = EXCLUDED.periodo_inicio, periodo_fin = EXCLUDED.periodo_fin,
       inscritos = EXCLUDED.inscritos, matriculados = EXCLUDED.matriculados
     RETURNING id_cohorte, nombre`,
    ['nombre', 'periodo_inicio', 'periodo_fin', 'inscritos', 'matriculados'].map((k) => datos.cohortes.map((c) => c[k])),
  )).rows, 'nombre', 'id_cohorte');

  const personas = [...datos.docentes.map((d) => ({ ...d, rol: 'docente' })), ...datos.estudiantes.map((e) => ({ ...e, rol: 'estudiante' }))];
  await cliente.query(
    `INSERT INTO usuarios (identificacion, nombres, apellidos, email, password_hash, rol)
     SELECT x.identificacion, x.nombres, x.apellidos, x.email, $5, x.rol::tipo_rol
     FROM unnest($1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $6::text[])
          AS x(identificacion, nombres, apellidos, email, rol)
     ON CONFLICT (email) DO NOTHING`,
    [...['identificacion', 'nombres', 'apellidos', 'email'].map((k) => personas.map((p) => p[k])), hash, personas.map((p) => p.rol)],
  );
  const usuarios = mapa((await cliente.query(
    'SELECT id_usuario, email FROM usuarios WHERE email = ANY($1::varchar[])',
    [personas.map((p) => p.email)],
  )).rows, 'email', 'id_usuario');

  await cliente.query(
    `INSERT INTO cohorte_estudiantes (id_cohorte, id_estudiante, estado)
     SELECT * FROM unnest($1::int[], $2::uuid[], $3::varchar[])
     ON CONFLICT (id_cohorte, id_estudiante) DO UPDATE SET estado = EXCLUDED.estado`,
    [datos.estudiantes.map((e) => cohortes.get(e.cohorte)), datos.estudiantes.map((e) => usuarios.get(e.email)),
      datos.estudiantes.map((e) => e.estado)],
  );

  const catalogo = mapa((await cliente.query('SELECT id_catalogo, codigo FROM cursos_catalogo')).rows, 'codigo', 'id_catalogo');
  const cursos = new Map();
  for (const c of datos.cursos) {
    const { rows } = await cliente.query(
      'INSERT INTO cursos (id_catalogo, id_cohorte, periodo, nombre) VALUES ($1, $2, $3, $4) RETURNING id_curso',
      [catalogo.get(c.catalogo), cohortes.get(c.cohorte), c.periodo, c.nombre],
    );
    cursos.set(c.clave, rows[0].id_curso);
  }
  const docentesCurso = datos.cursos.flatMap((c) => c.docentes.map((d) => [cursos.get(c.clave), usuarios.get(d)]));
  await cliente.query(
    'INSERT INTO curso_docentes (id_curso, id_docente) SELECT * FROM unnest($1::int[], $2::uuid[])',
    [docentesCurso.map((x) => x[0]), docentesCurso.map((x) => x[1])],
  );
  await cliente.query(
    'INSERT INTO curso_estudiantes (id_curso, id_estudiante) SELECT * FROM unnest($1::int[], $2::uuid[])',
    [datos.inscripciones.map((i) => cursos.get(i.curso)), datos.inscripciones.map((i) => usuarios.get(i.estudiante))],
  );

  const criterios = new Map((await cliente.query(
    'SELECT rc.id_criterio, r.codigo, rc.orden FROM rubricas_criterios rc JOIN resultados_aprendizaje r USING (id_ra)',
  )).rows.map((c) => [`${c.codigo}|${c.orden}`, c.id_criterio]));
  const notas = datos.calificaciones;
  const faltan = notas.filter((n) => !criterios.has(`${n.ra}|${n.orden}`));
  if (faltan.length) throw new Error(`La rúbrica de ${faltan[0].ra} no tiene criterio ${faltan[0].orden}`);
  await cliente.query(
    `INSERT INTO evaluaciones_ra_estudiante (id_curso, id_estudiante, id_criterio, id_docente, calificacion, nivel)
     SELECT a, b, c, d, e, f::tipo_nivel_logro
     FROM unnest($1::int[], $2::uuid[], $3::int[], $4::uuid[], $5::numeric[], $6::text[]) AS x(a, b, c, d, e, f)`,
    [notas.map((n) => cursos.get(n.curso)), notas.map((n) => usuarios.get(n.estudiante)),
      notas.map((n) => criterios.get(`${n.ra}|${n.orden}`)), notas.map((n) => usuarios.get(n.docente)),
      notas.map((n) => n.calificacion), notas.map((n) => nivelDeNota(n.calificacion))],
  );

  await cliente.query(
    `INSERT INTO periodos_calificacion_ra (periodo, abierto)
     SELECT unnest($1::varchar[]), TRUE
     ON CONFLICT (periodo) DO UPDATE SET abierto = TRUE, actualizado_en = CURRENT_TIMESTAMP`,
    [datos.periodosAbiertos ?? []],
  );

  return {
    cohortes: cohortes.size,
    docentes: datos.docentes.length,
    estudiantes: datos.estudiantes.length,
    cursos: cursos.size,
    inscripciones: datos.inscripciones.length,
    calificaciones: notas.length,
  };
};

module.exports = { cargar, limpiar, PASSWORD_POR_DEFECTO };
