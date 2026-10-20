#!/usr/bin/env node
// Crea una cuenta temporal a cada docente del directorio que aún no la tiene y la vincula a su perfil.
//   node scripts/cuentasDocentes.js --salida <ruta.csv>
// Identificación TMP-NNN, correo <nombre>.<apellido>@temporal.maie.local y contraseña aleatoria; la cuenta
// queda marcada para que el docente cambie sus datos y su contraseña al entrar (Mi perfil).
// Las credenciales se escriben en el CSV indicado, que no debe guardarse en el repositorio.
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');
const db = require('../src/config/db');

const DOMINIO_TEMPORAL = 'temporal.maie.local';

const argumento = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

const capitalizar = (p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

// «ANDRÉS DARÍO PANTOJA BUCHELI» → nombres «Andrés Darío», apellidos «Pantoja Bucheli».
// Con tres palabras la primera es el nombre; con una sola, es el apellido.
const separarNombre = (nombreCompleto) => {
  const p = nombreCompleto.trim().split(/\s+/).map(capitalizar);
  if (p.length === 1) return { nombres: 'Docente', apellidos: p[0] };
  const corte = p.length >= 4 ? p.length - 2 : 1;
  return { nombres: p.slice(0, corte).join(' '), apellidos: p.slice(corte).join(' ') };
};

const correoTemporal = ({ nombres, apellidos }, usados) => {
  const base = [nombres.split(' ')[0], apellidos.split(' ')[0]].map(sinTildes).filter(Boolean).join('.');
  let correo = `${base}@${DOMINIO_TEMPORAL}`;
  for (let n = 2; usados.has(correo); n++) correo = `${base}${n}@${DOMINIO_TEMPORAL}`;
  usados.add(correo);
  return correo;
};

const passwordTemporal = () => crypto.randomBytes(9).toString('base64url');

const csv = (filas) => filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');

const main = async () => {
  const salida = argumento('salida');
  if (!salida) throw new Error('Indique el archivo de credenciales: --salida <ruta.csv> (fuera del repositorio)');

  const credenciales = await db.withTransaction(async (cliente) => {
    const { rows: perfiles } = await cliente.query(
      'SELECT id_docente, nombre_completo FROM docentes_perfil WHERE id_usuario IS NULL ORDER BY nombre_completo',
    );
    const usados = new Set((await cliente.query('SELECT LOWER(email) AS email FROM usuarios')).rows.map((r) => r.email));
    const { rows: [{ n }] } = await cliente.query(
      "SELECT COUNT(*)::int AS n FROM usuarios WHERE identificacion LIKE 'TMP-%'",
    );
    const filas = [];
    for (const [i, perfil] of perfiles.entries()) {
      const nombre = separarNombre(perfil.nombre_completo);
      const email = correoTemporal(nombre, usados);
      const identificacion = `TMP-${String(n + i + 1).padStart(3, '0')}`;
      const password = passwordTemporal();
      const { rows: [u] } = await cliente.query(
        `INSERT INTO usuarios (identificacion, nombres, apellidos, email, password_hash, rol, debe_cambiar_password)
         VALUES ($1, $2, $3, $4, $5, 'docente', TRUE) RETURNING id_usuario`,
        [identificacion, nombre.nombres, nombre.apellidos, email, await bcrypt.hash(password, env.bcryptCost)],
      );
      await cliente.query('UPDATE docentes_perfil SET id_usuario = $2 WHERE id_docente = $1', [perfil.id_docente, u.id_usuario]);
      filas.push([perfil.nombre_completo, identificacion, email, password]);
    }
    return filas;
  });

  if (credenciales.length) {
    fs.writeFileSync(salida, `${csv([['docente', 'identificacion_temporal', 'correo_temporal', 'contrasena_temporal'], ...credenciales])}\n`);
  }
  console.log(`Cuentas temporales creadas: ${credenciales.length}${credenciales.length ? ` · credenciales en ${salida}` : ''}`);
};

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(() => db.pool.end());
}

module.exports = { separarNombre, correoTemporal };
