// RF-ADM-03 — Lectura del informe oficial «Presupuesto de Gastos - Recursos Administrados»
// (Oficina de Presupuesto, código PSP-GEF-FR-03), uno por promoción y mes.
// De la fila raíz (el rubro de la promoción) salen los valores de la hoja «Presupuesto» del libro:
//   INGRESOS = apropiación DEFINITIVA, GASTOS = COMPROMETIDO, SALDO CERTIFICADO = Por_CDP.
const ApiError = require('../../../utils/ApiError');

// Columnas numéricas del informe, en el orden en que aparecen sus encabezados.
const COLUMNAS = [
  { campo: 'inicial', encabezado: /^INICIAL$/i },
  { campo: 'anterior', encabezado: /^ANTERIOR$/i },
  { campo: 'modificacion_mes', encabezado: /^MOD\.?\s*MES$/i },
  { campo: 'definitiva', encabezado: /^DEFINITIVA$/i },
  { campo: 'pago', encabezado: /^PAGO$/i },
  { campo: 'comprometido', encabezado: /^COMPROMETI/i },
  { campo: 'registro', encabezado: /^REGISTRO$/i },
  { campo: 'obligacion', encabezado: /^OBLIGACI[OÓ]N$/i },
  { campo: 'por_cdp', encabezado: /^POR_?CDP$/i },
];

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const ROMANOS = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const aRomano = (n) => {
  let resto = n;
  let r = '';
  for (const [valor, letra] of ROMANOS) {
    while (resto >= valor) { r += letra; resto -= valor; }
  }
  return r;
};

// El informe mezcla «63.172.922,10» y «21,022,757.00»: el separador seguido de dos cifras al final es el decimal.
const RE_NUMERO = /^-?\d{1,3}([.,]\d{3})*([.,]\d{2})?$|^-?\d+([.,]\d{2})?$/;
const aNumero = (texto) => {
  const t = texto.trim();
  if (!RE_NUMERO.test(t)) return null;
  const decimal = /[.,]\d{2}$/.test(t) ? t.slice(-3) : '';
  const entero = (decimal ? t.slice(0, -3) : t).replace(/[.,]/g, '');
  return Number(`${entero}${decimal ? `.${decimal.slice(1)}` : ''}`);
};

const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

// Agrupa los textos de una página en renglones por su coordenada vertical.
const renglones = (items, tolerancia = 2) => {
  const ordenados = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const filas = [];
  for (const it of ordenados) {
    const fila = filas.find((f) => Math.abs(f.y - it.y) <= tolerancia);
    if (fila) fila.items.push(it);
    else filas.push({ y: it.y, items: [it] });
  }
  for (const f of filas) f.items.sort((a, b) => a.x - b.x);
  return filas;
};

// Interpreta el informe a partir de los textos posicionados de cada página
// (`paginas`: [[{ texto, x, y, ancho }]]). Es pura para poder probarla sin el PDF.
const interpretarGastos = (paginas) => {
  const todos = paginas.flat();
  const textos = todos.map((i) => i.texto.trim()).filter(Boolean);
  const buscar = (re) => textos.map((t) => t.match(re)).find(Boolean);

  const codigo = buscar(/C[oó]digo:\s*(PSP-GEF-FR-\d+)/i)?.[1]?.toUpperCase();
  if (codigo !== 'PSP-GEF-FR-03' || !textos.some((t) => /PRESUPUESTO DE GASTOS/i.test(t))) {
    throw ApiError.badRequest(
      codigo === 'PSP-GEF-FR-04'
        ? 'El archivo es el informe de ingresos (PSP-GEF-FR-04); suba el de gastos (PSP-GEF-FR-03)'
        : 'El PDF no es el informe «Presupuesto de Gastos - Recursos Administrados» (PSP-GEF-FR-03) de la Oficina de Presupuesto',
    );
  }

  const promocionTxt = buscar(/^(\d{1,2})\s*[AaªºOo]?\.?\s*PROMOCI[OÓ]N\b.*$/i);
  if (!promocionTxt) throw ApiError.badRequest('No se encontró la promoción en el encabezado del informe (p. ej. «4A. PROMOCION MAESTRIA …»)');
  const numero = Number(promocionTxt[1]);

  const mesTxt = buscar(/MES DE\s+([A-Za-zÁÉÍÓÚáéíóú]+)\s+DE\s+(\d{4})/i);
  const mes = mesTxt ? MESES.indexOf(normalizar(mesTxt[1]).toLowerCase()) + 1 : 0;
  if (!mes) throw ApiError.badRequest('No se encontró el mes del informe (p. ej. «MES DE Noviembre DE 2025»)');
  const anio = Number(mesTxt[2]);
  const impresion = buscar(/Fecha de Impresi[oó]n:\s*(.+)$/i)?.[1]?.trim() ?? null;

  const rubros = [];
  for (const items of paginas) {
    // Los encabezados se repiten en cada página; los valores van alineados a la derecha bajo ellos.
    const encabezados = COLUMNAS.map((c) => {
      const it = items.find((i) => c.encabezado.test(i.texto.trim()));
      return it ? { campo: c.campo, borde: it.x + it.ancho } : null;
    }).filter(Boolean);
    if (encabezados.length < COLUMNAS.length) continue;
    const xTipo = items.find((i) => i.texto.trim() === 'T')?.x;

    for (const { items: fila } of renglones(items)) {
      const primero = fila[0];
      const cod = primero.texto.trim().match(/^\d{10,}/)?.[0];
      if (!cod) continue;
      const rubro = { codigo: cod, detalle: '', tipo: null };
      const detalle = [primero.texto.trim().slice(cod.length)];
      for (const it of fila.slice(1)) {
        const t = it.texto.trim();
        const valor = aNumero(t);
        if (valor !== null && it.x > (xTipo ?? 0)) {
          const borde = it.x + it.ancho;
          const col = encabezados.reduce((a, b) => (Math.abs(b.borde - borde) < Math.abs(a.borde - borde) ? b : a));
          rubro[col.campo] = valor;
        } else if (/^[GD]$/.test(t) && xTipo !== undefined && Math.abs(it.x - xTipo) < 6) {
          rubro.tipo = t;
        } else {
          detalle.push(t);
        }
      }
      rubro.detalle = detalle.join(' ').replace(/\s+/g, ' ').trim();
      rubros.push(rubro);
    }
  }

  // La fila raíz es el rubro de código más corto (el de la promoción); sus hijos directos son
  // las áreas (Docencia, Bienestar, Soporte institucional…).
  const raiz = rubros.reduce((a, b) => (b.codigo.length < a.codigo.length ? b : a), rubros[0]);
  if (!raiz || typeof raiz.definitiva !== 'number' || typeof raiz.comprometido !== 'number') {
    throw ApiError.badRequest('No se encontraron los totales de la promoción en el informe');
  }
  const totales = Object.fromEntries(COLUMNAS.map((c) => [c.campo, raiz[c.campo] ?? 0]));
  // Verificación aritmética: lo que queda por comprometer = definitiva − comprometido.
  if (Math.abs(totales.definitiva - totales.comprometido - totales.por_cdp) > 0.01) {
    throw ApiError.badRequest('Los totales del informe no cuadran (definitiva − comprometido ≠ Por_CDP); revise que el PDF esté completo');
  }
  const areas = rubros
    .filter((r) => r.codigo.length === raiz.codigo.length + 1 && r.codigo.startsWith(raiz.codigo))
    .map((r) => ({ codigo: r.codigo, detalle: r.detalle, definitiva: r.definitiva ?? 0, comprometido: r.comprometido ?? 0, por_cdp: r.por_cdp ?? 0 }));

  return {
    codigo,
    promocion: aRomano(numero),
    numeroPromocion: numero,
    mes,
    anio,
    nombreMes: MESES[mes - 1],
    impresion,
    totales,
    areas,
    rubros: rubros.length,
  };
};

// Extrae los textos posicionados del PDF con pdf.js (módulo ESM, se carga bajo demanda).
const extraerTextos = async (buffer) => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let documento;
  try {
    documento = await pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0, isEvalSupported: false }).promise;
  } catch {
    throw ApiError.badRequest('No se pudo leer el PDF (¿está dañado o protegido?)');
  }
  const paginas = [];
  for (let n = 1; n <= documento.numPages; n++) {
    const pagina = await documento.getPage(n);
    const { items } = await pagina.getTextContent();
    paginas.push(items.filter((i) => i.str.trim()).map((i) => ({ texto: i.str, x: i.transform[4], y: i.transform[5], ancho: i.width })));
  }
  await documento.destroy();
  return paginas;
};

const leerGastosPdf = async (buffer) => interpretarGastos(await extraerTextos(buffer));

module.exports = { leerGastosPdf, interpretarGastos, aNumero, aRomano };
