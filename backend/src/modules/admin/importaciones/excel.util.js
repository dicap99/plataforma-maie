// Utilidades para leer celdas de exceljs de forma uniforme.

const FORMULA_SIN_VALOR = Symbol('formula-sin-valor');

// Valor "plano" de una celda: número, texto, Date o null.
// Las fórmulas sin resultado guardado (archivo nunca recalculado) devuelven FORMULA_SIN_VALOR.
const valorCelda = (celda) => {
  const v = celda?.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v !== 'object') return v;
  if ('formula' in v || 'sharedFormula' in v) return v.result === undefined ? FORMULA_SIN_VALOR : v.result;
  if (v.richText) return v.richText.map((r) => r.text).join('');
  if ('text' in v) return v.text; // hipervínculo
  if ('error' in v) return null;
  return null;
};

// Normaliza nombres de hoja/encabezados: minúsculas, sin tildes ni espacios repetidos.
const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const buscarHoja = (libro, nombre) => libro.worksheets.find((h) => normalizar(h.name) === normalizar(nombre));

const esRomano = (v) => typeof v === 'string' && /^[IVXLCDM]+$/.test(v.trim());

module.exports = { valorCelda, normalizar, buscarHoja, esRomano, FORMULA_SIN_VALOR };
