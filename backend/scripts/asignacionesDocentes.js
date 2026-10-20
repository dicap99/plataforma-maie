#!/usr/bin/env node
// Carga asignaciones docente → curso ofertado desde un JSON (p. ej. lo deducido de la evaluación docente).
//   node scripts/asignacionesDocentes.js --archivo <asignaciones.json>
// Cada elemento: { "docente": "<nombre_completo del directorio>", "promocion": "II", "periodo": "2022-A",
// "curso": "<código de la clase, p. ej. CE1-03>" }. Crea la oferta si no existe; volver a cargar no duplica.
const fs = require('fs');
const db = require('../src/config/db');
const docentes = require('../src/modules/admin/docentes/docentes.repository');
const { semestreDe } = require('../src/modules/admin/docentes/docentes.service');

const argumento = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

const main = async () => {
  const archivo = argumento('archivo');
  if (!archivo) throw new Error('Indique el archivo: --archivo <asignaciones.json>');
  const asignaciones = JSON.parse(fs.readFileSync(archivo, 'utf8'));

  const porNombre = async (sql, valor) => (await db.query(sql, [valor])).rows[0] ?? null;
  const errores = [];
  let cargadas = 0;
  for (const [i, a] of asignaciones.entries()) {
    const perfil = await porNombre('SELECT id_docente FROM docentes_perfil WHERE UPPER(nombre_completo) = UPPER($1)', a.docente);
    const cohorte = await porNombre('SELECT id_cohorte, periodo_inicio FROM cohortes WHERE UPPER(nombre) = UPPER($1)', a.promocion);
    const clase = await porNombre('SELECT id_clase FROM clases WHERE UPPER(codigo) = UPPER($1)', a.curso);
    const problema = !perfil ? `el docente «${a.docente}» no está en el directorio`
      : !cohorte ? `la promoción «${a.promocion}» no existe`
        : !clase ? `el curso «${a.curso}» no existe`
          : ![1, 2, 3, 4].includes(semestreDe(a.periodo, cohorte.periodo_inicio)) ? `${a.periodo} no es un semestre de la promoción ${a.promocion}`
            : null;
    if (problema) {
      errores.push(`#${i + 1}: ${problema}`);
      continue;
    }
    await docentes.agregarCurso(perfil.id_docente, { id_cohorte: cohorte.id_cohorte, periodo: a.periodo, id_clase: clase.id_clase });
    cargadas++;
  }
  console.log(`Asignaciones cargadas: ${cargadas} de ${asignaciones.length}`);
  for (const e of errores) console.log(`  · ${e}`);
  if (errores.length) process.exitCode = 1;
};

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
