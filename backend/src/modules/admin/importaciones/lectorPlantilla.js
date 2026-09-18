// Lector de la plantilla oficial de importación (RF-ADM-02), generada por GET /admin/plantillas.
// Una hoja por recurso con el nombre de recurso.hoja; fila 1 = etiquetas de los campos; datos desde la fila 2.
// También acepta un CSV de un único recurso con la misma fila de encabezados.
const { parse } = require('csv-parse/sync');
const { valorCelda, buscarHoja, normalizar, FORMULA_SIN_VALOR } = require('./excel.util');

const HOJA_INSTRUCCIONES = 'Instrucciones';

const esPlantilla = (libro) => Boolean(buscarHoja(libro, HOJA_INSTRUCCIONES));

// Asocia cada campo del recurso a la columna cuyo encabezado coincide con su etiqueta (o su nombre técnico).
const mapearEncabezados = (encabezados, recurso) => {
  // El "*" marca columnas obligatorias en la plantilla; no forma parte del nombre.
  const indice = new Map(encabezados.map((e, i) => [normalizar(e).replace(/\s*\*$/, ''), i]));
  const mapa = {};
  const faltantes = [];
  for (const campo of recurso.campos) {
    const i = indice.get(normalizar(campo.label)) ?? indice.get(normalizar(campo.name));
    if (i === undefined) faltantes.push(campo.label);
    else mapa[campo.name] = i;
  }
  return { mapa, faltantes };
};

// Convierte las filas crudas en { fila, promocion?, valores } separando la promoción por nombre.
const aFilas = (filasCrudas, mapa, recurso, primeraFila) =>
  filasCrudas
    .map((celdas, i) => ({ celdas, fila: primeraFila + i }))
    .filter(({ celdas }) => celdas.some((v) => v !== null && v !== undefined && String(v).trim() !== ''))
    .map(({ celdas, fila }) => {
      const valores = {};
      let promocion;
      for (const campo of recurso.campos) {
        const v = mapa[campo.name] === undefined ? null : celdas[mapa[campo.name]];
        if (campo.type === 'cohorte') promocion = v === null || v === undefined ? null : String(v).trim();
        else valores[campo.name] = v;
      }
      return { fila, promocion, valores };
    });

const leerPlantilla = (libro, recursos) => {
  const datos = {};
  const advertencias = [];
  const hojasFaltantes = [];

  for (const recurso of recursos) {
    const hoja = buscarHoja(libro, recurso.hoja);
    if (!hoja) {
      hojasFaltantes.push(recurso.hoja);
      continue;
    }
    const leer = (celda) => {
      const v = valorCelda(celda);
      if (v === FORMULA_SIN_VALOR) {
        advertencias.push({ hoja: hoja.name, fila: celda.row, mensaje: `Fórmula sin valor calculado en ${celda.address}` });
        return null;
      }
      return v;
    };
    const encabezados = [];
    hoja.getRow(1).eachCell({ includeEmpty: true }, (c, col) => { encabezados[col - 1] = leer(c); });
    const { mapa, faltantes } = mapearEncabezados(encabezados, recurso);
    if (faltantes.length) {
      advertencias.push({ hoja: hoja.name, fila: 1, mensaje: `Columnas no encontradas: ${faltantes.join(', ')}` });
    }
    const crudas = [];
    for (let n = 2; n <= hoja.rowCount; n++) {
      const fila = [];
      for (let col = 1; col <= encabezados.length; col++) fila.push(leer(hoja.getRow(n).getCell(col)));
      crudas.push(fila);
    }
    datos[recurso.id] = aFilas(crudas, mapa, recurso, 2).map((f) => ({ ...f, hoja: hoja.name }));
  }
  return { datos, parametros: [], advertencias, hojasFaltantes };
};

// CSV de un único recurso (separador , o ; detectado automáticamente).
const leerCsv = (buffer, recurso) => {
  const texto = buffer.toString('utf8').replace(/^﻿/, '');
  const separador = (texto.split('\n')[0].match(/;/g) || []).length > (texto.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const [encabezados = [], ...filas] = parse(texto, { delimiter: separador, relax_column_count: true, skip_empty_lines: true });
  const { mapa, faltantes } = mapearEncabezados(encabezados, recurso);
  const advertencias = faltantes.length
    ? [{ hoja: 'CSV', fila: 1, mensaje: `Columnas no encontradas: ${faltantes.join(', ')}` }]
    : [];
  const datos = { [recurso.id]: aFilas(filas, mapa, recurso, 2).map((f) => ({ ...f, hoja: 'CSV' })) };
  return { datos, parametros: [], advertencias, hojasFaltantes: [] };
};

module.exports = { HOJA_INSTRUCCIONES, esPlantilla, leerPlantilla, leerCsv };
