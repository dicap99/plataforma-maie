#!/usr/bin/env node
// Puebla la base de desarrollo con datos sintéticos del Módulo 2 para ver los tableros de RA.
//   npm run datos:sinteticos                  → borra los sintéticos anteriores y carga la semilla 2026
//   npm run datos:sinteticos -- --semilla 7   → otra semilla
//   npm run datos:sinteticos -- --limpiar     → solo borra los datos sintéticos
// Usa DATABASE_URL (backend/.env). Los usuarios comparten la contraseña de SINTETICO_PASSWORD.
const env = require('../src/config/env');
const db = require('../src/config/db');
const { generar } = require('./sintetico/generador');
const { cargar, limpiar, PASSWORD_POR_DEFECTO } = require('./sintetico/cargador');

const argumento = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? undefined : process.argv[i + 1] ?? true;
};

const main = async () => {
  if (env.nodeEnv === 'production') throw new Error('No se cargan datos sintéticos en producción');
  if (!env.databaseUrl) throw new Error('Defina DATABASE_URL (backend/.env)');

  const soloLimpiar = argumento('limpiar') !== undefined;
  const semilla = Number(argumento('semilla') ?? 2026);
  const password = process.env.SINTETICO_PASSWORD || PASSWORD_POR_DEFECTO;

  const resumen = await db.withTransaction(async (cliente) => {
    const borrados = await limpiar(cliente);
    if (soloLimpiar) return { borrados };
    return { borrados, cargados: await cargar(cliente, generar({ semilla }), { password }) };
  });

  console.log('Datos sintéticos eliminados:', resumen.borrados);
  if (resumen.cargados) {
    const { rows } = await db.query(
      `SELECT email FROM usuarios WHERE email LIKE '%@sintetico.maie.local' AND rol = 'docente' ORDER BY email LIMIT 1`,
    );
    console.log(`Datos sintéticos cargados (semilla ${semilla}):`, resumen.cargados);
    console.log(`Ejemplo de docente: ${rows[0]?.email} · contraseña de los usuarios sintéticos: ${password}`);
  }
};

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
