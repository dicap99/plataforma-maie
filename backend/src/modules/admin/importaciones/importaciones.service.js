// RF-ADM-01/02 — Importación masiva desde Excel/CSV.
// Formatos: libro histórico "Estadísticas MaIE", plantilla oficial (.xlsx) o CSV de un recurso.
// RF-ADM-03 — Informe PDF de gastos de la Oficina de Presupuesto (PSP-GEF-FR-03): actualiza el corte de la promoción.
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
const { leerGastosPdf } = require('./lectorGastosPdf');

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
      // El SMMLV oficial (decreto) lo registra Coordinación; el libro trae un valor de referencia
      // (p. ej. «SMMLV 2025: 1.400.000») que solo se usa si el año aún no está registrado.
      if (p.clave.startsWith('smmlv_')) {
        const existe = await cliente.query('SELECT 1 FROM parametros_programa WHERE clave = $1', [p.clave]);
        if (existe.rowCount) {
          lectura.advertencias.push({
            hoja: 'Punto de equilibrio',
            fila: '—',
            mensaje: `Se conservó el ${p.clave.replace('smmlv_', 'SMMLV ')} registrado; el del libro (${p.valor}) no se importó.`,
          });
          continue;
        }
      }
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

// Informe de gastos (PDF) → corte de «Presupuesto» de la promoción, como lo registra Coordinación en el libro:
// INGRESOS = apropiación definitiva, GASTOS = comprometido y SALDO CERTIFICADO = Por_CDP.
// Un informe por mes: si la promoción ya tiene un corte en ese mes se actualiza (conserva su fecha);
// si no, se crea con el último día del mes. La distribución del saldo se deja vacía para que se
// calcule con los porcentajes de Parámetros sobre el saldo nuevo.
const DISTRIBUCION = ['transferencia_central', 'transferencia_viis', 'fondo_investigaciones', 'unidad_academica'];
const CAMBIOS = [
  { campo: 'ingresos', etiqueta: 'Ingresos (apropiación definitiva)' },
  { campo: 'gastos_comprometidos', etiqueta: 'Gastos (comprometido)' },
  { campo: 'saldo_certificado', etiqueta: 'Saldo certificado (Por_CDP)' },
];

const importarGastosPdf = async (file, simular) => {
  const informe = await leerGastosPdf(file.buffer);
  const recurso = porId.presupuesto;
  const mm = String(informe.mes).padStart(2, '0');
  const periodo = `${informe.nombreMes} de ${informe.anio}`;

  const ejecutar = async (cliente) => {
    const { rows: [cohorte] } = await cliente.query(
      'SELECT id_cohorte, nombre FROM cohortes WHERE UPPER(nombre) = $1', [informe.promocion],
    );
    if (!cohorte) {
      throw ApiError.badRequest(`La promoción ${informe.promocion} del informe no existe en «Promociones y Estudiantes»`);
    }
    const { rows: cortes } = await cliente.query(
      'SELECT * FROM presupuesto_cohorte WHERE id_cohorte = $1 ORDER BY fecha_corte DESC', [cohorte.id_cohorte],
    );
    const anterior = cortes.find((c) => c.fecha_corte.startsWith(`${informe.anio}-${mm}`)) ?? null;
    const ultimoDia = new Date(Date.UTC(informe.anio, informe.mes, 0)).getUTCDate();
    const fechaCorte = anterior?.fecha_corte ?? `${informe.anio}-${mm}-${ultimoDia}`;

    const { valores, errores } = validarFila(recurso.campos, {
      id_cohorte: cohorte.id_cohorte,
      fecha_corte: fechaCorte,
      ingresos: informe.totales.definitiva,
      gastos_comprometidos: informe.totales.comprometido,
      saldo_certificado: informe.totales.por_cdp,
      ...Object.fromEntries(DISTRIBUCION.map((c) => [c, null])),
      observaciones: anterior?.observaciones || `Informe ${informe.codigo} de ${periodo} (${file.originalname})`,
    });
    if (errores.length) throw ApiError.badRequest('El informe tiene valores inválidos', { errores });

    const advertencias = [];
    const masReciente = cortes.find((c) => c.fecha_corte > fechaCorte);
    if (masReciente) {
      advertencias.push({
        hoja: 'Presupuesto',
        fila: cohorte.nombre,
        mensaje: `La promoción tiene un corte más reciente (${masReciente.fecha_corte}); los tableros seguirán mostrando ese.`,
      });
    }

    const r = simular ? { insertado: !anterior } : await repositorios.presupuesto.upsert(valores, cliente);
    return {
      formato: 'gastos-pdf',
      simulacion: simular,
      resumen: [{ hoja: 'Presupuesto', filas: 1, insertados: r.insertado ? 1 : 0, actualizados: r.insertado ? 0 : 1 }],
      parametros: [],
      advertencias,
      hojasFaltantes: [],
      informe: {
        codigo: informe.codigo,
        promocion: cohorte.nombre,
        periodo,
        impresion: informe.impresion,
        fecha_corte: fechaCorte,
        areas: informe.areas,
        cambios: CAMBIOS.map(({ campo, etiqueta }) => ({ campo, etiqueta, anterior: anterior?.[campo] ?? null, nuevo: valores[campo] })),
      },
    };
  };

  return simular ? ejecutar(db.pool) : db.withTransaction(ejecutar);
};

module.exports = {
  // POST /admin/importaciones — multipart "archivo"; ?simular=true valida sin guardar; ?recurso= para CSV.
  async importar({ file, query }) {
    if (!file) throw ApiError.badRequest('Adjunte un archivo .xlsx, .csv o .pdf en el campo "archivo"');
    if (path.extname(file.originalname).toLowerCase() === '.pdf') return importarGastosPdf(file, query.simular === 'true');
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
