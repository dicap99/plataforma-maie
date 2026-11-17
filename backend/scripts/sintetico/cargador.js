// Carga en PostgreSQL los datos de generador.js, resolviendo las claves lógicas contra el
// catálogo y las rúbricas sembrados en seed.sql. Todo corre dentro de la transacción del
// cliente recibido. Los datos sintéticos se reconocen por el dominio de correo y el prefijo
// de las promociones, y limpiar() los borra sin tocar los datos reales.
const bcrypt = require('bcryptjs');
const { nivelDeNota } = require('../../src/modules/ra/rubrica');
const { DOMINIO, PREFIJO_COHORTE } = require('./generador');
const { huella } = require('../../src/modules/evalDocente/anonimato');
const env = require('../../src/config/env');

const PASSWORD_POR_DEFECTO = 'MaIE-Sintetico-2026';

const mapa = (filas, clave, valor) => new Map(filas.map((f) => [f[clave], f[valor]]));
const m1Perfiles = (datos) => datos.modulo1?.perfiles ?? [];

const limpiar = async (cliente) => {
  const correo = `%@${DOMINIO}`;
  const cohorte = `${PREFIJO_COHORTE} %`;
  await cliente.query(
    `DELETE FROM evaluaciones_ra_estudiante e USING usuarios u
     WHERE u.id_usuario = e.id_estudiante AND u.email LIKE $1`,
    [correo],
  );
  // Módulo 3: las respuestas restringen el borrado de docentes y promociones (conservan el histórico).
  await cliente.query(
    `DELETE FROM evaluacion_respuestas r
     WHERE r.id_docente IN (SELECT d.id_docente FROM docentes_perfil d JOIN usuarios u ON u.id_usuario = d.id_usuario WHERE u.email LIKE $1)
        OR r.id_cohorte IN (SELECT id_cohorte FROM cohortes WHERE nombre LIKE $2)`,
    [correo, cohorte],
  );
  await cliente.query(
    'DELETE FROM docentes_perfil d USING usuarios u WHERE u.id_usuario = d.id_usuario AND u.email LIKE $1',
    [correo],
  );
  await cliente.query(
    'DELETE FROM cursos c USING cohortes h WHERE h.id_cohorte = c.id_cohorte AND h.nombre LIKE $1',
    [cohorte],
  );
  for (const tabla of ['transferencias_periodo', 'contrataciones_periodo']) {
    await cliente.query(`DELETE FROM ${tabla} WHERE promociones LIKE $1`, [cohorte]);
  }
  const usuarios = await cliente.query('DELETE FROM usuarios WHERE email LIKE $1', [correo]);
  const cohortes = await cliente.query('DELETE FROM cohortes WHERE nombre LIKE $1', [cohorte]);
  return { usuarios: usuarios.rowCount, cohortes: cohortes.rowCount };
};

// Módulo 3: habilitación por semestre (sin sobrescribir semestres ya configurados), lista de pregrado,
// respuestas EE anónimas con su constancia aparte, y EC/AE. Las preguntas se resuelven por código.
const cargarModulo3 = async (cliente, m3, { usuarios, cohortes, cursos, hash }) => {
  await cliente.query(
    `INSERT INTO evaluacion_periodos (periodo, habilitada, incluye_pregrado, publicado, publicado_en)
     SELECT p, h, i, pub, CASE WHEN pub THEN CURRENT_TIMESTAMP END FROM unnest($1::varchar[], $2::bool[], $3::bool[], $4::bool[]) AS x(p, h, i, pub)
     ON CONFLICT (periodo) DO NOTHING`,
    [m3.periodos.map((x) => x.periodo), m3.periodos.map((x) => x.habilitada), m3.periodos.map((x) => x.incluye_pregrado), m3.periodos.map((x) => x.publicado)],
  );
  await cliente.query(
    `INSERT INTO usuarios (identificacion, nombres, apellidos, email, password_hash, rol)
     SELECT x.a, x.b, x.c, x.d, $5, 'estudiante' FROM unnest($1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[]) AS x(a, b, c, d)
     ON CONFLICT (email) DO NOTHING`,
    [...['identificacion', 'nombres', 'apellidos', 'email'].map((k) => m3.pregrado.map((p) => p[k])), hash],
  );
  const pre = new Map((await cliente.query('SELECT id_usuario, email FROM usuarios WHERE email = ANY($1::varchar[])', [m3.pregrado.map((p) => p.email)]))
    .rows.map((r) => [r.email, r.id_usuario]));
  const filasPre = m3.pregrado.flatMap((p) => p.cursos.map((c) => [cursos.get(c), pre.get(p.email), p.programa]));
  await cliente.query(
    'INSERT INTO curso_estudiantes_pregrado (id_curso, id_estudiante, programa) SELECT * FROM unnest($1::int[], $2::uuid[], $3::varchar[])',
    [filasPre.map((x) => x[0]), filasPre.map((x) => x[1]), filasPre.map((x) => x[2])],
  );
  const persona = (email) => usuarios.get(email) ?? pre.get(email);
  const perfiles = new Map((await cliente.query('SELECT id_docente, id_usuario FROM docentes_perfil WHERE id_usuario IS NOT NULL')).rows.map((r) => [r.id_usuario, r.id_docente]));
  const docente = (email) => perfiles.get(usuarios.get(email));
  const preguntas = new Map((await cliente.query('SELECT id_pregunta, tipo_formulario, codigo FROM evaluacion_preguntas')).rows
    .map((r) => [`${r.tipo_formulario}|${r.codigo}`, r.id_pregunta]));

  // Constancias con huella (anonimato.js), con la misma clave que usa la API.
  await cliente.query(
    'INSERT INTO evaluacion_constancias (periodo, huella) SELECT * FROM unnest($1::varchar[], $2::text[])',
    [m3.constancias.map((c) => c.periodo),
      m3.constancias.map((c) => huella(env.evalSecreto, c.periodo, persona(c.estudiante), docente(c.docente)))],
  );
  const todas = [...m3.respuestas.map((r) => ({ ...r, tipo: 'EE' })), ...m3.nominales];
  const coordinador = (await cliente.query(`SELECT id_usuario FROM usuarios WHERE rol = 'coordinador' ORDER BY creado_en LIMIT 1`)).rows[0]?.id_usuario ?? null;
  for (const r of todas) {
    const evaluador = r.tipo === 'EE' ? null : r.tipo === 'EC' ? coordinador : usuarios.get(r.docente);
    const { rows: [x] } = await cliente.query(
      `INSERT INTO evaluacion_respuestas (periodo, tipo_formulario, id_docente, id_cohorte, poblacion, id_evaluador, comentario, actualizado_en)
       VALUES ($1, $2::tipo_formulario_eval, $3, $4, $5, $6, $7, CASE WHEN $2::tipo_formulario_eval = 'EE' THEN NULL ELSE CURRENT_TIMESTAMP END) RETURNING id_respuesta`,
      [r.periodo, r.tipo, docente(r.docente), cohortes.get(r.cohorte), r.tipo === 'EE' ? r.poblacion : null, evaluador, r.comentario],
    );
    const codigos = Object.keys(r.items);
    await cliente.query(
      `INSERT INTO evaluacion_respuesta_items (id_respuesta, id_pregunta, valor)
       SELECT $1, i, v::tipo_valoracion_058 FROM unnest($2::int[], $3::text[]) AS x(i, v)`,
      [x.id_respuesta, codigos.map((c) => preguntas.get(`${r.tipo}|${c}`)), codigos.map((c) => r.items[c])],
    );
  }
  return { pregrado: m3.pregrado.length, respuestas_ee: m3.respuestas.length, ec_ae: m3.nominales.length };
};

const cargar = async (cliente, datos, { password = PASSWORD_POR_DEFECTO, modulo3 = false } = {}) => {
  const hash = await bcrypt.hash(password, 10);

  const cohortes = mapa((await cliente.query(
    `INSERT INTO cohortes (nombre, periodo_inicio, periodo_fin, inscritos, matriculados,
                           aprobados_sem1, aprobados_sem2, aprobados_sem3, egresados, graduados)
     SELECT * FROM unnest($1::varchar[], $2::varchar[], $3::varchar[], $4::int[], $5::int[],
                          $6::int[], $7::int[], $8::int[], $9::int[], $10::int[])
     ON CONFLICT (nombre) DO UPDATE SET periodo_inicio = EXCLUDED.periodo_inicio, periodo_fin = EXCLUDED.periodo_fin,
       inscritos = EXCLUDED.inscritos, matriculados = EXCLUDED.matriculados, aprobados_sem1 = EXCLUDED.aprobados_sem1,
       aprobados_sem2 = EXCLUDED.aprobados_sem2, aprobados_sem3 = EXCLUDED.aprobados_sem3,
       egresados = EXCLUDED.egresados, graduados = EXCLUDED.graduados
     RETURNING id_cohorte, nombre`,
    ['nombre', 'periodo_inicio', 'periodo_fin', 'inscritos', 'matriculados', 'aprobados_sem1', 'aprobados_sem2',
      'aprobados_sem3', 'egresados', 'graduados'].map((k) => datos.cohortes.map((c) => c[k] ?? null)),
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
    `INSERT INTO cohorte_estudiantes (id_cohorte, id_estudiante, estado, beca)
     SELECT * FROM unnest($1::int[], $2::uuid[], $3::varchar[], $4::varchar[])
     ON CONFLICT (id_cohorte, id_estudiante) DO UPDATE SET estado = EXCLUDED.estado, beca = EXCLUDED.beca`,
    [datos.estudiantes.map((e) => cohortes.get(e.cohorte)), datos.estudiantes.map((e) => usuarios.get(e.email)),
      datos.estudiantes.map((e) => e.estado), datos.estudiantes.map((e) => e.beca ?? null)],
  );

  const clases = new Map((await cliente.query('SELECT id_clase, id_catalogo, nombre FROM clases')).rows.map((c) => [c.nombre, c]));
  const cursos = new Map();
  for (const c of datos.cursos) {
    const clase = clases.get(c.clase);
    if (!clase) throw new Error(`No existe la clase «${c.clase}» (seed.sql)`);
    const { rows } = await cliente.query(
      'INSERT INTO cursos (id_clase, id_catalogo, id_cohorte, periodo) VALUES ($1, $2, $3, $4) RETURNING id_curso',
      [clase.id_clase, clase.id_catalogo, cohortes.get(c.cohorte), c.periodo],
    );
    cursos.set(c.clave, rows[0].id_curso);
  }
  // curso_docentes guarda el perfil docente: cada docente sintético tiene uno (el de modulo1 lo completa).
  const perfil = new Map((m1Perfiles(datos)).map((p) => [p.email, p]));
  await cliente.query(
    `INSERT INTO docentes_perfil (id_usuario, nombre_completo, afiliacion)
     SELECT u.id_usuario, x.nombre, x.afiliacion::tipo_afiliacion
     FROM unnest($1::varchar[], $2::varchar[], $3::text[]) AS x(email, nombre, afiliacion)
     JOIN usuarios u ON u.email = x.email
     ON CONFLICT (nombre_completo) DO NOTHING`,
    [datos.docentes.map((d) => d.email),
      datos.docentes.map((d) => perfil.get(d.email)?.nombre_completo ?? `${d.nombres} ${d.apellidos}`),
      datos.docentes.map((d) => perfil.get(d.email)?.afiliacion ?? 'UDENAR')],
  );
  const docentesCurso = datos.cursos.flatMap((c) => c.docentes.map((d) => [cursos.get(c.clave), usuarios.get(d)]));
  await cliente.query(
    `INSERT INTO curso_docentes (id_curso, id_docente)
     SELECT x.curso, d.id_docente FROM unnest($1::int[], $2::uuid[]) AS x(curso, usuario)
     JOIN docentes_perfil d ON d.id_usuario = x.usuario`,
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

  const m1 = datos.modulo1;
  if (m1) {
    await cliente.query(
      `INSERT INTO docentes_perfil (id_usuario, nombre_completo, formacion_profesional, campo_formacion, afiliacion)
       SELECT a, b, c, d, e::tipo_afiliacion FROM unnest($1::uuid[], $2::varchar[], $3::text[], $4::varchar[], $5::text[]) AS x(a, b, c, d, e)
       ON CONFLICT (nombre_completo) DO UPDATE SET formacion_profesional = EXCLUDED.formacion_profesional,
         campo_formacion = EXCLUDED.campo_formacion, afiliacion = EXCLUDED.afiliacion`,
      [m1.perfiles.map((p) => usuarios.get(p.email)), ...['nombre_completo', 'formacion_profesional', 'campo_formacion', 'afiliacion']
        .map((k) => m1.perfiles.map((p) => p[k]))],
    );
    const porCohorte = async (tabla, filas, columnas, tipos) => {
      if (!filas.length) return;
      const lista = columnas.map((c, i) => `$${i + 2}::${tipos[i]}[]`).join(', ');
      await cliente.query(
        `INSERT INTO ${tabla} (id_cohorte, ${columnas.join(', ')}) SELECT * FROM unnest($1::int[], ${lista})`,
        [filas.map((f) => cohortes.get(f.cohorte)), ...columnas.map((c) => filas.map((f) => f[c]))],
      );
    };
    await porCohorte('cohorte_semestres', m1.semestres, ['semestre', 'n_cursos', 'docentes_udenar', 'docentes_externos'], ['smallint', 'int', 'int', 'int']);
    await porCohorte('cohorte_beneficios', m1.beneficios,
      ['becas_100', 'becas_hora_catedra', 'becas_sintraunicol', 'asistentes_investigacion', 'ayudantes_docencia'], ['int', 'int', 'int', 'int', 'int']);
    await porCohorte('cohorte_produccion', m1.produccion,
      ['articulos', 'ponencias', 'software', 'prototipos', 'tesis', 'detalles'], ['int', 'int', 'int', 'int', 'int', 'text']);
    await porCohorte('cohorte_pasantias', m1.pasantias, ['nacionales', 'internacionales'], ['int', 'int']);

    const f = m1.finanzas;
    await porCohorte('cohorte_punto_equilibrio', f.puntoEquilibrio, ['estudiantes_equilibrio', 'valor_matricula_smmlv', 'ingresos_proyectados'], ['int', 'numeric', 'numeric']);
    await porCohorte('presupuesto_cohorte', f.presupuesto,
      ['fecha_corte', 'ingresos', 'gastos_comprometidos', 'saldo_certificado'], ['date', 'numeric', 'numeric', 'numeric']);
    await porCohorte('pregrado_periodo', f.pregrado, ['periodo', 'estudiantes', 'inscripciones', 'ingreso'], ['varchar', 'int', 'int', 'numeric']);
    // Por periodo: no se sobrescriben periodos que ya tengan datos reales.
    for (const [tabla, filas, cantidad] of [['transferencias_periodo', f.transferencias, 'n_docentes'], ['contrataciones_periodo', f.contrataciones, 'n_ops']]) {
      await cliente.query(
        `INSERT INTO ${tabla} (periodo, promociones, ${cantidad}, valor)
         SELECT * FROM unnest($1::varchar[], $2::varchar[], $3::int[], $4::numeric[]) ON CONFLICT (periodo) DO NOTHING`,
        [filas.map((x) => x.periodo), filas.map((x) => x.promociones), filas.map((x) => x[cantidad]), filas.map((x) => x.valor)],
      );
    }
  }

  const evaluacion = modulo3 && datos.modulo3 ? await cargarModulo3(cliente, datos.modulo3, { usuarios, cohortes, cursos, hash }) : null;

  return {
    ...(evaluacion ? { evaluacion_docente: evaluacion } : {}),
    cohortes: cohortes.size,
    docentes: datos.docentes.length,
    estudiantes: datos.estudiantes.length,
    cursos: cursos.size,
    inscripciones: datos.inscripciones.length,
    calificaciones: notas.length,
  };
};

module.exports = { cargar, limpiar, PASSWORD_POR_DEFECTO };
