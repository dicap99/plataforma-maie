#!/usr/bin/env node
// Completa el directorio docente con la Tabla 23 del PEP («Identificación de los docentes de la MaIE»).
//   node scripts/docentesPep.js --archivo <docentes_pep.json> [--aplicar]
// Sin --aplicar solo simula (todo en una transacción que se deshace) e informa los cambios.
// Reglas (decisión del usuario, 2026-11-09): solo se llenan datos VACÍOS; no se toca el campo de formación
// de perfiles existentes. En los externos, si «Formación profesional» guarda solo la institución (así viene
// del libro «Estadísticas MaIE»), esa institución pasa a «Universidad» y la formación se llena con el PEP.
// La titulación del PEP va en «Formación profesional» (no hay campo aparte de titulación máxima).
// Cada elemento: { nombre_pep, nombre_plataforma, afiliacion, vinculacion_tipo, universidad,
// departamento, grupo_investigacion, formacion_profesional, renombrar_a?, crear?: { nombre_completo,
// campo_formacion } }. Si «Universidad» ya tiene otro valor, la formación no se toca (se informa para revisar).
const fs = require('fs');
const db = require('../src/config/db');

const COMPLETABLES = ['vinculacion_tipo', 'universidad', 'departamento', 'grupo_investigacion', 'formacion_profesional'];
const vacio = (v) => v === null || v === undefined || String(v).trim() === '';
// Texto que nombra solo una institución: una línea sin títulos ni profesiones (p. ej. «ESPOL»,
// «Universidad de los Andes»). Ante la duda se considera formación y no se mueve.
const TITULOS = /ingenier|doctor|bachelor|mag[ií]ster|m[aá]ster|maestr|candidat|licenciad|f[ií]sic|matem[aá]tic|qu[ií]mic|ph\.?\s?d|m\.?\s?sc|b\.?\s?sc|especiali|tecn[oó]log|t[eé]cnic|economist|administrad|profesional|estudiante/i;
const esInstitucion = (t) => !vacio(t) && !t.includes('\n') && !TITULOS.test(t);

const argumento = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

const main = async () => {
  const archivo = argumento('archivo');
  if (!archivo) throw new Error('Indique el archivo: --archivo <docentes_pep.json>');
  const aplicar = process.argv.includes('--aplicar');
  const filas = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const cambios = [];
  const revisar = [];
  const anotar = (docente, columna, antes, despues) => cambios.push({ docente, columna, antes, despues });

  const cliente = await db.pool.connect();
  try {
    await cliente.query('BEGIN');
    const perfil = async (nombre) =>
      (await cliente.query('SELECT * FROM docentes_perfil WHERE UPPER(nombre_completo) = UPPER($1)', [nombre])).rows[0] ?? null;
    const actualizar = (id, columna, valor) =>
      cliente.query(`UPDATE docentes_perfil SET ${columna} = $2 WHERE id_docente = $1`, [id, valor]);
    const enPep = new Set();

    for (const f of filas) {
      // Idempotente: si ya se renombró o se creó en una corrida anterior, se busca por el nombre final.
      // `||`: un nombre vacío ('') también pasa al siguiente criterio.
      let p = (f.nombre_plataforma && await perfil(f.nombre_plataforma))
        || (f.renombrar_a && await perfil(f.renombrar_a)) || (f.crear && await perfil(f.crear.nombre_completo)) || null;
      if (!p && f.crear) {
        p = (await cliente.query(
          `INSERT INTO docentes_perfil (nombre_completo, afiliacion, campo_formacion) VALUES ($1, $2, $3) RETURNING *`,
          [f.crear.nombre_completo, f.afiliacion, f.crear.campo_formacion ?? null],
        )).rows[0];
        anotar(p.nombre_completo, '(perfil)', null, `creado (${f.afiliacion}, ${f.crear.campo_formacion ?? 'sin campo'})`);
      }
      if (!p) throw new Error(`No se encontró el perfil «${f.nombre_plataforma}» (${f.nombre_pep})`);
      enPep.add(p.id_docente);

      // Formación con solo la institución (externos del libro): la institución pasa a «Universidad» si
      // ni la base ni el PEP la traen, y la formación se reemplaza por la del PEP.
      if (p.afiliacion === 'EXTERNO' && esInstitucion(p.formacion_profesional) && f.formacion_profesional) {
        if (!vacio(p.universidad) && p.universidad !== p.formacion_profesional) {
          revisar.push(`${p.nombre_completo}: la formación «${p.formacion_profesional}» se reemplazó por la del PEP y «Universidad» ya era «${p.universidad}»`);
        }
        if (vacio(p.universidad) && vacio(f.universidad)) {
          anotar(p.nombre_completo, 'universidad', p.universidad, p.formacion_profesional);
          await actualizar(p.id_docente, 'universidad', p.formacion_profesional);
          p.universidad = p.formacion_profesional;
        }
        anotar(p.nombre_completo, 'formacion_profesional', p.formacion_profesional, f.formacion_profesional);
        await actualizar(p.id_docente, 'formacion_profesional', f.formacion_profesional);
        p.formacion_profesional = f.formacion_profesional;
      }
      for (const columna of COMPLETABLES) {
        if (vacio(p[columna]) && !vacio(f[columna])) {
          anotar(p.nombre_completo, columna, p[columna], f[columna]);
          await actualizar(p.id_docente, columna, f[columna]);
        }
      }
      if (f.renombrar_a && p.nombre_completo !== f.renombrar_a) {
        if (await perfil(f.renombrar_a)) throw new Error(`Ya existe un perfil «${f.renombrar_a}»`);
        anotar(p.nombre_completo, 'nombre_completo', p.nombre_completo, f.renombrar_a);
        await actualizar(p.id_docente, 'nombre_completo', f.renombrar_a);
      }
    }

    // Externos que no están en el PEP: la institución guardada como formación pasa a «Universidad».
    const { rows: externos } = await cliente.query("SELECT * FROM docentes_perfil WHERE afiliacion = 'EXTERNO'");
    for (const p of externos.filter((e) => !enPep.has(e.id_docente) && esInstitucion(e.formacion_profesional))) {
      if (!vacio(p.universidad) && p.universidad !== p.formacion_profesional) {
        revisar.push(`${p.nombre_completo}: «${p.formacion_profesional}» no se movió porque «Universidad» ya es «${p.universidad}»`);
        continue;
      }
      if (vacio(p.universidad)) {
        anotar(p.nombre_completo, 'universidad', p.universidad, p.formacion_profesional);
        await actualizar(p.id_docente, 'universidad', p.formacion_profesional);
      }
      anotar(p.nombre_completo, 'formacion_profesional', p.formacion_profesional, null);
      await actualizar(p.id_docente, 'formacion_profesional', null);
    }

    await cliente.query(aplicar ? 'COMMIT' : 'ROLLBACK');
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }

  const corto = (v) => (v === null || v === undefined ? '∅' : String(v).replace(/\n/g, ' / ').slice(0, 70));
  for (const c of cambios) console.log(`${c.docente} · ${c.columna}: ${corto(c.antes)} → ${corto(c.despues)}`);
  for (const r of revisar) console.log(`REVISAR · ${r}`);
  console.log(`${cambios.length} cambio(s) ${aplicar ? 'APLICADOS' : 'simulados (use --aplicar para guardarlos)'}`);
};

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(() => db.pool.end());
}

module.exports = { esInstitucion };
