// RF-ADM-01/02 — Importación masiva desde Excel/CSV.
// Formatos: libro histórico "Estadísticas MaIE", plantilla oficial (.xlsx) o CSV de un recurso.
// Todo se guarda en UNA transacción: si alguna fila tiene errores no se guarda nada.
const path = require('path');
const ExcelJS = require('exceljs');
const db = require('../../../config/db');
const ApiError = require('../../../utils/ApiError');
const { validarFila } = require('../../../shared/crud/campos');
const { RECURSOS, porId } = require('../recursos/recursos.definicion');
const repositorios = require('../recursos/recursos.repository');
const { leerEstadisticas } = require('./lectorEstadisticas');
const { esPlantilla, leerPlantilla, leerCsv } = require('./lectorPlantilla');

// Recursos que se pueden importar (la tabla de parámetros se alimenta aparte).
const IMPORTABLES = RECURSOS.filter((r) => r.id !== 'parametros');

class Simulacion extends Error {
  constructor(resultado) {
    super('simulacion');
    this.resultado = resultado;
  }
}

const leerArchivo = async (file, query) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.csv') {
    const recurso = porId[query.recurso];
    if (!recurso || recurso.id === 'parametros') {
      throw ApiError.badRequest('Para un CSV indique el recurso destino (?recurso=cohortes, beneficios, …)');
    }
    return { formato: 'csv', ...leerCsv(file.buffer, recurso) };
  }
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(file.buffer);
  } catch {
    throw ApiError.badRequest('No se pudo leer el archivo .xlsx (¿está dañado o protegido?)');
  }
  return esPlantilla(libro)
    ? { formato: 'plantilla', ...leerPlantilla(libro, IMPORTABLES) }
    : { formato: 'estadisticas', ...leerEstadisticas(libro) };
};

// Inserta/actualiza una fila aislándola con un SAVEPOINT para poder seguir validando las demás.
const upsertFila = async (cliente, repositorio, valores) => {
  await cliente.query('SAVEPOINT fila');
  try {
    const r = await repositorio.upsert(valores, cliente);
    await cliente.query('RELEASE SAVEPOINT fila');
    return { ok: true, insertado: r.insertado };
  } catch (err) {
    await cliente.query('ROLLBACK TO SAVEPOINT fila');
    return { ok: false, mensaje: err.detail || err.message };
  }
};

const guardar = async (lectura, simular) => {
  const errores = [];
  const resumen = {};

  const ejecutar = async (cliente) => {
    for (const recurso of IMPORTABLES) {
      const filas = lectura.datos[recurso.id];
      if (!filas) continue;
      const cuenta = { hoja: recurso.hoja, filas: filas.length, insertados: 0, actualizados: 0 };
      resumen[recurso.id] = cuenta;

      // Las promociones se guardan primero, así que ya existen al resolver las demás hojas.
      const { rows } = await cliente.query('SELECT id_cohorte, nombre FROM cohortes');
      const idPorPromocion = new Map(rows.map((r) => [r.nombre.toUpperCase(), r.id_cohorte]));
      const usaCohorte = recurso.campos.some((c) => c.type === 'cohorte');

      for (const { fila, hoja, promocion, valores } of filas) {
        const crudos = { ...valores };
        if (usaCohorte) {
          const idCohorte = promocion ? idPorPromocion.get(promocion.toUpperCase()) : null;
          if (!idCohorte) {
            errores.push({ hoja, fila, mensaje: `La promoción "${promocion ?? ''}" no existe en "Promociones y Estudiantes"` });
            continue;
          }
          crudos.id_cohorte = idCohorte;
        }
        const { valores: limpios, errores: erroresFila } = validarFila(recurso.campos, crudos);
        if (erroresFila.length) {
          errores.push(...erroresFila.map((mensaje) => ({ hoja, fila, mensaje })));
          continue;
        }
        const r = await upsertFila(cliente, repositorios[recurso.id], limpios);
        if (!r.ok) errores.push({ hoja, fila, mensaje: r.mensaje });
        else if (r.insertado) cuenta.insertados++;
        else cuenta.actualizados++;
      }
    }

    for (const p of lectura.parametros) {
      await repositorios.parametros.upsert(p, cliente);
    }

    const resultado = {
      formato: lectura.formato,
      simulacion: simular,
      resumen: Object.values(resumen),
      parametros: lectura.parametros.map((p) => p.clave),
      advertencias: lectura.advertencias,
      hojasFaltantes: lectura.hojasFaltantes,
    };
    if (errores.length) {
      throw ApiError.badRequest(
        `El archivo tiene ${errores.length} error(es); no se guardó ningún dato`,
        { ...resultado, errores },
      );
    }
    if (simular) throw new Simulacion(resultado); // fuerza el ROLLBACK
    return resultado;
  };

  try {
    return await db.withTransaction(ejecutar);
  } catch (err) {
    if (err instanceof Simulacion) return err.resultado;
    throw err;
  }
};

module.exports = {
  // POST /admin/importaciones — multipart "archivo"; ?simular=true valida sin guardar; ?recurso= para CSV.
  async importar({ file, query }) {
    if (!file) throw ApiError.badRequest('Adjunte un archivo .xlsx o .csv en el campo "archivo"');
    const lectura = await leerArchivo(file, query);
    const totalFilas = Object.values(lectura.datos).reduce((s, f) => s + f.length, 0);
    if (totalFilas === 0) {
      throw ApiError.badRequest('No se encontraron datos para importar en el archivo', {
        hojasFaltantes: lectura.hojasFaltantes,
      });
    }
    return guardar(lectura, query.simular === 'true');
  },
};
