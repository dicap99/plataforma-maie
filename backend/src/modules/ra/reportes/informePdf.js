// Informe PDF de Resultados de Aprendizaje (asesoría 25-nov-2026):
// incluye los histogramas por cada RA (con las 4 categorías), la gráfica de % satisfactorio
// frente a la meta y sus tablas de datos subyacentes, sin conclusiones automáticas.
const PDFDocument = require('pdfkit');
const { NIVELES } = require('../rubrica');

const COLOR_NIVEL = {
  Alto: '#1e7b34',
  Medio: '#2a78d6',
  Basico: '#eda100',
  Insuficiente: '#ba1a1a',
};

const MARGEN = 50;
const ANCHO_UTIL = 512;
const AZUL = '#040039';
const GRIS = '#474650';
const LINEA = '#dce9ff';

const fecha = () => new Date().toISOString().slice(0, 10);
const pct = (frac) => (frac === null || frac === undefined ? '—' : `${(frac * 100).toFixed(1).replace('.', ',')} %`);
const nota = (v) => (v === null || v === undefined ? '—' : Number(v).toFixed(2).replace('.', ','));

const generarPdf = (dibujar) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: MARGEN,
    info: { Title: 'Informe de Resultados de Aprendizaje MaIE', Author: 'Plataforma MaIE' },
  });
  const partes = [];
  doc.on('data', (b) => partes.push(b));
  doc.on('end', () => resolve(Buffer.concat(partes)));
  doc.on('error', reject);
  dibujar(doc);
  doc.end();
});

const titulo = (doc, texto, sub) => {
  doc.fillColor(AZUL).fontSize(16).font('Helvetica-Bold').text(texto);
  if (sub) doc.moveDown(0.2).fillColor(GRIS).fontSize(9).font('Helvetica').text(sub);
  doc.moveDown(0.6).fillColor('black');
};

const subtitulo = (doc, texto) => {
  if (doc.y > 680) doc.addPage();
  doc.moveDown(0.4).fillColor(AZUL).fontSize(12).font('Helvetica-Bold').text(texto).moveDown(0.3).fillColor('black').font('Helvetica');
};

const tablaPdf = (doc, columnas, filas) => {
  const total = columnas.reduce((s, c) => s + (c.ancho ?? 1), 0);
  const anchos = columnas.map((c) => ((c.ancho ?? 1) / total) * ANCHO_UTIL);
  const dibujarFila = (valores, negritaFila) => {
    if (doc.y > 720) doc.addPage();
    const y = doc.y;
    doc.font(negritaFila ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5);
    const alto = Math.max(10, ...valores.map((v, i) => doc.heightOfString(String(v ?? ''), { width: anchos[i] - 4 })));
    let x = MARGEN;
    valores.forEach((v, i) => {
      doc.text(String(v ?? ''), x + 2, y + 2, { width: anchos[i] - 4, align: columnas[i].align ?? 'left' });
      x += anchos[i];
    });
    doc.strokeColor(LINEA).lineWidth(0.5).moveTo(MARGEN, y + alto + 4).lineTo(MARGEN + ANCHO_UTIL, y + alto + 4).stroke();
    doc.x = MARGEN;
    doc.y = y + alto + 6;
  };
  dibujarFila(columnas.map((c) => c.titulo), true);
  filas.forEach((f) => dibujarFila(columnas.map((c) => f[c.clave])));
  doc.font('Helvetica').moveDown(0.4);
};

// Dibuja un histograma individual de un RA con los 4 niveles en el eje X y conteo de estudiantes en el eje Y.
const dibujarHistogramaRA = (doc, ra, x0, y0, ancho, alto) => {
  doc.save();
  doc.strokeColor(LINEA).lineWidth(0.8).roundedRect(x0, y0, ancho, alto, 4).stroke();

  doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(9.5)
    .text(`${ra.grupo}`, x0 + 8, y0 + 6, { width: ancho - 16, lineBreak: false });
  doc.fillColor(GRIS).font('Helvetica').fontSize(7.2)
    .text(`${ra.evaluados ?? 0} eval. · Prom. ${nota(ra.promedio)} · ${ra.validacion ?? 'Sin datos'}`, x0 + 8, y0 + 18, { width: ancho - 16 });

  const gx = x0 + 26;
  const gy = y0 + 34;
  const gw = ancho - 34;
  const gh = alto - 56;
  const conteos = NIVELES.map((n) => ra[n.nivel] ?? 0);
  const maxY = Math.max(1, ...conteos);
  const marcas = [...new Set([0, Math.ceil(maxY / 2), maxY])];

  doc.fontSize(6.5).fillColor(GRIS);
  for (const v of marcas) {
    const y = gy + gh - (v / maxY) * gh;
    doc.strokeColor(LINEA).lineWidth(0.5).moveTo(gx, y).lineTo(gx + gw, y).stroke();
    doc.text(String(v), x0 + 4, y - 3, { width: 18, align: 'right' });
  }

  const slot = gw / NIVELES.length;
  const anchoBarra = Math.min(26, slot - 10);
  NIVELES.forEach((n, i) => {
    const val = ra[n.nivel] ?? 0;
    const bx = gx + i * slot + (slot - anchoBarra) / 2;
    const bh = (val / maxY) * gh;
    if (bh > 0) {
      doc.fillColor(COLOR_NIVEL[n.nivel]).rect(bx, gy + gh - bh, anchoBarra, bh).fill();
    }
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(6.8)
      .text(String(val), gx + i * slot, Math.max(gy - 8, gy + gh - bh - 9), { width: slot, align: 'center' });
    doc.fillColor(GRIS).font('Helvetica').fontSize(6.5)
      .text(n.etiqueta, gx + i * slot, gy + gh + 4, { width: slot, align: 'center' });
  });
  doc.restore();
};

// Gráfica de barras de % satisfactorio por RA frente a la meta (0–100 %).
const dibujarSatisfactorioPorRA = (doc, porRA, metaPct) => {
  const alto = 140;
  if (doc.y + alto + 45 > 730) doc.addPage();
  const x0 = MARGEN + 30;
  const y0 = doc.y + 8;
  const ancho = ANCHO_UTIL - 30;

  doc.fontSize(7).fillColor(GRIS);
  for (const v of [0, 25, 50, 75, 100]) {
    const y = y0 + alto - (v / 100) * alto;
    doc.strokeColor(LINEA).lineWidth(0.5).moveTo(x0, y).lineTo(x0 + ancho, y).stroke();
    doc.text(`${v}%`, MARGEN, y - 3, { width: 26, align: 'right' });
  }

  const slot = ancho / Math.max(1, porRA.length);
  const anchoBarra = Math.min(28, slot - 12);
  porRA.forEach((r, i) => {
    const val = r.evaluados && r.pct_satisfactorio !== null ? r.pct_satisfactorio * 100 : 0;
    const bh = (val / 100) * alto;
    const bx = x0 + i * slot + (slot - anchoBarra) / 2;
    if (r.evaluados > 0 && bh > 0) {
      doc.fillColor(r.validacion === 'En riesgo' ? COLOR_NIVEL.Insuficiente : COLOR_NIVEL.Medio)
        .rect(bx, y0 + alto - bh, anchoBarra, bh).fill();
      doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(7)
        .text(`${Math.round(val)}%`, x0 + i * slot, Math.max(y0 - 2, y0 + alto - bh - 10), { width: slot, align: 'center' });
    }
    doc.fillColor(GRIS).font('Helvetica').fontSize(7.5)
      .text(r.grupo, x0 + i * slot, y0 + alto + 4, { width: slot, align: 'center' });
  });

  if (metaPct !== null && metaPct !== undefined) {
    const ym = y0 + alto - (Math.min(100, Math.max(0, metaPct)) / 100) * alto;
    doc.strokeColor(GRIS).lineWidth(1).dash(3, { space: 3 }).moveTo(x0, ym).lineTo(x0 + ancho, ym).stroke().undash();
    doc.fillColor(GRIS).font('Helvetica-Bold').fontSize(7)
      .text(`Meta ${metaPct} %`, x0 + ancho - 65, ym - 9, { width: 65, align: 'right' });
  }

  doc.x = MARGEN;
  doc.y = y0 + alto + 22;
  doc.fillColor('black').font('Helvetica');
};

const resumenFiltros = (filtros = {}) => {
  const etiquetas = {
    cohorte: 'Promoción',
    periodo: 'Semestre',
    modulo: 'Componente',
    catalogo: 'Curso plan',
    curso: 'Oferta',
    ra: 'RA',
    clase: 'Materia',
    docente: 'Docente',
    estudiante: 'Estudiante',
  };
  const activos = Object.entries(filtros)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${etiquetas[k] ?? k}: ${v}`);
  return activos.length ? `Filtros aplicados: ${activos.join(' · ')}` : 'Población: todo el programa';
};

const generarInformePdf = async ({ meta = {}, global = {}, porRA = [], porCohorte = [] }) => {
  const metaPct = meta.meta_satisfactorio_pct ?? 70;
  const enRiesgo = porRA.filter((r) => r.validacion === 'En riesgo');

  const buffer = await generarPdf((doc) => {
    titulo(
      doc,
      'Informe de Resultados de Aprendizaje (RA)',
      `Maestría en Ingeniería Electrónica · Universidad de Nariño · Meta satisfactoria: ${metaPct} % · Generado el ${fecha()}\n${resumenFiltros(meta.filtros)}`,
    );

    subtitulo(doc, 'Resumen general del programa');
    tablaPdf(
      doc,
      [
        { clave: 'indicador', titulo: 'Indicador', ancho: 3 },
        { clave: 'valor', titulo: 'Valor', ancho: 1.5 },
      ],
      [
        { indicador: 'Resultados estudiante–RA evaluados', valor: global.evaluados ?? 0 },
        { indicador: '% Satisfactorio (nivel Alto o Medio)', valor: global.evaluados ? pct(global.pct_satisfactorio) : '—' },
        { indicador: 'Promedio general', valor: nota(global.promedio) },
        { indicador: 'Meta del programa', valor: `${metaPct} %` },
        { indicador: 'RA en riesgo', valor: enRiesgo.length ? enRiesgo.map((r) => r.grupo).join(', ') : 'Ninguno' },
        { indicador: 'Rúbricas incompletas (excluidas)', valor: meta.rubricas_incompletas ?? 0 },
      ],
    );

    subtitulo(doc, 'Distribución por nivel en cada Resultado de Aprendizaje');
    const anchoCaja = 246;
    const gap = 20;
    const altoCaja = 142;
    for (let i = 0; i < porRA.length; i += 2) {
      if (doc.y + altoCaja + 14 > 730) doc.addPage();
      const filaY = doc.y;
      dibujarHistogramaRA(doc, porRA[i], MARGEN, filaY, anchoCaja, altoCaja);
      if (porRA[i + 1]) {
        dibujarHistogramaRA(doc, porRA[i + 1], MARGEN + anchoCaja + gap, filaY, anchoCaja, altoCaja);
      }
      doc.x = MARGEN;
      doc.y = filaY + altoCaja + 12;
    }

    subtitulo(doc, 'Tabla consolidada por Resultado de Aprendizaje');
    tablaPdf(
      doc,
      [
        { clave: 'ra', titulo: 'RA', ancho: 0.7 },
        { clave: 'evaluados', titulo: 'Eval.', ancho: 0.65, align: 'right' },
        { clave: 'alto', titulo: 'Alto', ancho: 0.65, align: 'right' },
        { clave: 'medio', titulo: 'Medio', ancho: 0.65, align: 'right' },
        { clave: 'basico', titulo: 'Básico', ancho: 0.7, align: 'right' },
        { clave: 'insuficiente', titulo: 'Insuf.', ancho: 0.65, align: 'right' },
        { clave: 'satisfactorio', titulo: '% Satisf.', ancho: 0.9, align: 'right' },
        { clave: 'promedio', titulo: 'Prom.', ancho: 0.7, align: 'right' },
        { clave: 'validacion', titulo: 'Validación', ancho: 1.1 },
      ],
      porRA.map((r) => ({
        ra: r.grupo,
        evaluados: r.evaluados ?? 0,
        alto: r.Alto ?? 0,
        medio: r.Medio ?? 0,
        basico: r.Basico ?? 0,
        insuficiente: r.Insuficiente ?? 0,
        satisfactorio: r.evaluados ? pct(r.pct_satisfactorio) : '—',
        promedio: nota(r.promedio),
        validacion: r.validacion ?? 'Sin datos',
      })),
    );

    if (porRA.length > 0) {
      subtitulo(doc, '% Satisfactorio por RA frente a la meta');
      dibujarSatisfactorioPorRA(doc, porRA, metaPct);
    }

    if (porCohorte.length > 0) {
      subtitulo(doc, 'Resultados consolidados por promoción');
      tablaPdf(
        doc,
        [
          { clave: 'etiqueta', titulo: 'Promoción', ancho: 1.5 },
          { clave: 'evaluados', titulo: 'Eval.', ancho: 0.7, align: 'right' },
          { clave: 'alto', titulo: 'Alto', ancho: 0.65, align: 'right' },
          { clave: 'medio', titulo: 'Medio', ancho: 0.65, align: 'right' },
          { clave: 'basico', titulo: 'Básico', ancho: 0.7, align: 'right' },
          { clave: 'insuficiente', titulo: 'Insuf.', ancho: 0.65, align: 'right' },
          { clave: 'satisfactorio', titulo: '% Satisf.', ancho: 0.9, align: 'right' },
          { clave: 'promedio', titulo: 'Prom.', ancho: 0.7, align: 'right' },
        ],
        porCohorte.map((c) => ({
          etiqueta: c.etiqueta,
          evaluados: c.evaluados ?? 0,
          alto: c.Alto ?? 0,
          medio: c.Medio ?? 0,
          basico: c.Basico ?? 0,
          insuficiente: c.Insuficiente ?? 0,
          satisfactorio: c.evaluados ? pct(c.pct_satisfactorio) : '—',
          promedio: nota(c.promedio),
        })),
      );
    }
  });

  return {
    nombreArchivo: `Informe_RA_MaIE_${fecha()}.pdf`,
    tipo: 'application/pdf',
    buffer,
  };
};

module.exports = { generarInformePdf, COLOR_NIVEL };
