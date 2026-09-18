// Tipos de campo de los recursos tabulares y su validación (express-validator).
// Un campo: { name, label, type, required?, options? (enum) }
const { body } = require('express-validator');

const PERIODO_REGEX = /^\d{4}-[AB]$/;

// Cada tipo recibe la cadena de validación y el prefijo del mensaje ("<Etiqueta> debe…").
const TIPOS = {
  entero: (v, m) => v.isInt({ min: 0 }).withMessage(`${m} debe ser un entero mayor o igual a 0`).toInt(),
  numero: (v, m) => v.isFloat().withMessage(`${m} debe ser numérico`).toFloat(),
  dinero: (v, m) => v.isFloat().withMessage(`${m} debe ser un valor en pesos`).toFloat(),
  texto: (v, m) => v.isString().withMessage(`${m} debe ser texto`).trim(),
  periodo: (v, m) => v.matches(PERIODO_REGEX).withMessage(`${m} debe tener formato AAAA-A o AAAA-B`),
  fecha: (v, m) => v.isISO8601({ strict: true }).withMessage(`${m} debe ser una fecha AAAA-MM-DD`),
  cohorte: (v, m) => v.isInt({ min: 1 }).withMessage(`${m} debe ser una promoción válida`).toInt(),
  semestre: (v, m) => v.isInt({ min: 1, max: 4 }).withMessage(`${m} debe estar entre 1 y 4`).toInt(),
  enum: (v, m, campo) => v.isIn(campo.options).withMessage(`${m} debe ser uno de: ${campo.options.join(', ')}`),
};

const validadorCampo = (campo) => {
  const aplicar = TIPOS[campo.type];
  if (!aplicar) throw new Error(`Tipo de campo desconocido: ${campo.type}`);
  const base = body(campo.name);
  const v = campo.required
    ? base.exists({ values: 'null' }).withMessage(`${campo.label} es obligatorio`).bail()
    : base.optional({ values: 'null' });
  const cadena = aplicar(v, campo.label, campo);
  return campo.required && campo.type === 'texto'
    ? cadena.notEmpty().withMessage(`${campo.label} es obligatorio`)
    : cadena;
};

// Validadores para crear/actualizar (PUT reemplaza el registro completo, sin tocar la llave).
const validadores = (campos, { excluir = [] } = {}) =>
  campos.filter((c) => !excluir.includes(c.name)).map(validadorCampo);

// ---------------------------------------------------------------------------
// Validación de filas importadas (Excel/CSV): mismas reglas que la API, pero aceptando
// números como texto ("1.234,5" o "1234.5"), fechas de Excel y celdas vacías.
// ---------------------------------------------------------------------------
const aNumero = (v) => {
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\s|\$/g, '');
  // "1.234.567,89" (formato colombiano) → 1234567.89
  const normal = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  return normal === '' ? NaN : Number(normal);
};

const aFecha = (v) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/); // DD-MM-AAAA
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
};

const NORMALIZAR = {
  entero: (v) => { const n = aNumero(v); return Number.isInteger(n) && n >= 0 ? n : undefined; },
  semestre: (v) => { const n = aNumero(v); return Number.isInteger(n) && n >= 1 && n <= 4 ? n : undefined; },
  cohorte: (v) => { const n = aNumero(v); return Number.isInteger(n) && n >= 1 ? n : undefined; },
  numero: (v) => { const n = aNumero(v); return Number.isFinite(n) ? n : undefined; },
  dinero: (v) => { const n = aNumero(v); return Number.isFinite(n) ? n : undefined; },
  texto: (v) => String(v).trim(),
  periodo: (v) => { const s = String(v).trim().toUpperCase(); return PERIODO_REGEX.test(s) ? s : undefined; },
  fecha: (v) => aFecha(v) ?? undefined,
  enum: (v, campo) => campo.options.find((o) => o.toUpperCase() === String(v).trim().toUpperCase()),
};

// Devuelve { valores, errores[] } para una fila { campo: valorCrudo }.
const validarFila = (campos, fila) => {
  const valores = {};
  const errores = [];
  for (const campo of campos) {
    const crudo = fila[campo.name];
    const vacio = crudo === undefined || crudo === null || String(crudo).trim() === '';
    if (vacio) {
      if (campo.required) errores.push(`${campo.label} es obligatorio`);
      valores[campo.name] = null;
      continue;
    }
    const valor = NORMALIZAR[campo.type](crudo, campo);
    if (valor === undefined || valor === '') errores.push(`${campo.label}: valor inválido "${crudo}"`);
    valores[campo.name] = valor ?? null;
  }
  return { valores, errores };
};

module.exports = { validadores, validarFila, PERIODO_REGEX };
