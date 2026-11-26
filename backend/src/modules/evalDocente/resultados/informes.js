// RF-EVAL-04 — Informes de la evaluación docente (Art. 12 del Acuerdo 058):
//  - Libro Excel con el formato del libro de Coordinación «Estadísticas Evaluación Docente MaIE.xlsx»
//    (bloque por docente con los porcentajes por pregunta, totales, %IP y categoría; tabla resumen por
//    promoción con IDST-D e IDST-P; hoja IDST-P con el histórico), que antes se llenaba a mano desde
//    Google Forms. Incluye el método oficial y, rotulado, el del Excel (referencia histórica).
//  - Informe PDF consolidado con gráficas y PDF por docente con su histórico.
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { VALORES, CATEGORIAS, META_PCT, categoria } = require('../acuerdo058');

const ETIQUETA_POBLACION = { todas: 'posgrado y pregrado unidos', posgrado: 'solo posgrado', pregrado: 'solo pregrado' };
const COLOR_CATEGORIA = {
  GF: '#1e7b34',
  F: '#2a78d6',
  T: '#9a6a00',
  D: '#c4511c',
  GD: '#ba1a1a',
};
const colorPorPct = (valor, fallback = '#2a78d6') => {
  if (valor === null || valor === undefined) return fallback;
  const cat = categoria(Math.max(0, Math.min(100, Number(valor))));
  return COLOR_CATEGORIA[cat?.sigla] ?? fallback;
};
const fecha = () => new Date().toISOString().slice(0, 10);
const pct = (x, d = 1) => (x === null || x === undefined ? '—' : `${x.toFixed(d).replace('.', ',')} %`);
const prop = (x) => (x === null || x === undefined ? '—' : pct(x * 100));

// ---- Excel --------------------------------------------------------------------------------------
const AZUL = 'FF040039';
const ENCABEZADO = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } } };
const negrita = { font: { bold: true } };

const encabezar = (fila) => fila.eachCell((c) => Object.assign(c, ENCABEZADO));

// Hoja del semestre con el formato del libro de Coordinación.
const hojaSemestre = (libro, config, c) => {
  const h = libro.addWorksheet(config.periodo);
  const caracteristicas = [...new Set(c.unidades.flatMap((u) => u.ee?.caracteristicas ?? []).map((x) => x.caracteristica))].sort();
  const nombres = Object.fromEntries(c.unidades.flatMap((u) => u.ee?.caracteristicas ?? []).map((x) => [x.caracteristica, x.nombre]));
  const ancho = VALORES.length + 1; // MA A I MI NA/NR T
  h.getColumn(1).width = 30;
  h.getColumn(2).width = 11;
  h.getColumn(3).width = 10;
  h.getColumn(4).width = 22;

  const f1 = h.addRow(['DOCENTE', 'PROMOCIÓN', 'Afiliación', 'Pregunta']);
  const f2 = h.addRow(['', '', '', '']);
  caracteristicas.forEach((k, i) => {
    const col = 5 + i * ancho;
    h.mergeCells(1, col, 1, col + ancho - 1);
    f1.getCell(col).value = `C${k}: ${nombres[k]}`;
    [...VALORES.map((v) => (v === 'NA' ? 'NA/NR' : v)), 'T'].forEach((v, j) => { f2.getCell(col + j).value = v; });
  });
  const comentarios = 5 + caracteristicas.length * ancho;
  f1.getCell(comentarios).value = 'Comentarios';
  encabezar(f1);
  encabezar(f2);

  for (const u of c.unidades.filter((x) => x.ee)) {
    const n = u.ee.respuestas;
    const porC = (k) => u.ee.variables.filter((v) => v.caracteristica === k);
    const filas = Math.max(...caracteristicas.map((k) => porC(k).length));
    for (let j = 0; j < filas; j += 1) {
      const fila = h.addRow([j === 0 ? `${u.docente}` : '', j === 0 ? u.cohorte : '', j === 0 ? (u.afiliacion ?? '') : '', j + 1]);
      caracteristicas.forEach((k, i) => {
        const v = porC(k)[j];
        if (!v || !n) return;
        VALORES.forEach((val, m) => { fila.getCell(5 + i * ancho + m).value = Math.round((v.conteos[val] / n) * 1000) / 10; });
        fila.getCell(5 + i * ancho + VALORES.length).value = 100;
      });
      if (j === 0) fila.getCell(comentarios).value = u.ee.comentarios.join(' | ');
    }
    const resumen = [
      ['Respuestas (estudiantes)', () => n],
      ['Repeticiones (Acuerdo 058)', (x, m) => x.conteos[VALORES[m]]],
      ['%IP oficial (Acuerdo 058)', (x) => (x.pct_ip === null ? null : Math.round(x.pct_ip * 10) / 10)],
      ['Categoría oficial', (x) => x.categoria],
    ];
    for (const [titulo, fn] of resumen) {
      const fila = h.addRow(['', '', titulo]);
      fila.getCell(3).font = { bold: true };
      if (titulo.startsWith('Respuestas')) { fila.getCell(4).value = n; continue; }
      caracteristicas.forEach((k, i) => {
        const x = u.ee.caracteristicas.find((y) => y.caracteristica === k);
        if (!x) return;
        if (titulo.startsWith('Repeticiones')) {
          VALORES.forEach((_, m) => { fila.getCell(5 + i * ancho + m).value = fn(x, m); });
        } else fila.getCell(5 + i * ancho).value = fn(x);
      });
    }
    h.addRow([]);
  }

  // Tabla resumen por promoción (Acuerdo 058).
  const cs = caracteristicas.filter((k) => k !== 0);
  for (const p of c.promociones) {
    h.addRow([]);
    const t = h.addRow([`Promoción ${p.cohorte}`, '', '', '', ...cs.map((k) => `C${k}`), ...cs.map((k) => `Cat. C${k}`),
      'IDST-D por variable', 'IDST-D por característica']);
    encabezar(t);
    for (const u of c.unidades.filter((x) => x.ee && x.id_cohorte === p.id_cohorte)) {
      const val = (k) => u.ee.caracteristicas.find((y) => y.caracteristica === k);
      h.addRow([u.docente, u.cohorte, u.afiliacion ?? '', '',
        ...cs.map((k) => (val(k)?.pct_ip == null ? null : Math.round(val(k).pct_ip * 10) / 10)),
        ...cs.map((k) => val(k)?.sigla ?? ''),
        u.ee.idst_d.por_variable.valor, u.ee.idst_d.por_caracteristica.valor]);
    }
    const prom = h.addRow(['Promedio %IP (oficial)', '', '', '', ...cs.map((k) => {
      const x = p.promedio_ip.find((y) => y.caracteristica === k);
      return x ? Math.round(x.promedio * 10) / 10 : null;
    })]);
    prom.font = negrita;
    h.addRow(['IDSC-Prom (Acuerdo, Parágrafo 1)', '', '', '', ...cs.map((k) => p.idsc.find((y) => y.caracteristica === k)?.valor ?? null)]).font = negrita;
    h.addRow(['IDST-P por variable / por característica', '', '', '', p.idst_p.por_variable, p.idst_p.por_caracteristica]).font = negrita;
  }
  return h;
};

const tabla = (libro, nombre, columnas, filas) => {
  const h = libro.addWorksheet(nombre);
  h.columns = columnas.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho ?? 14, style: c.formato ? { numFmt: c.formato } : {} }));
  encabezar(h.getRow(1));
  h.views = [{ state: 'frozen', ySplit: 1 }];
  filas.forEach((f) => h.addRow(f));
  return h;
};

const excel = async ({ config, consolidado: c, historico, poblacion }) => {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Plataforma MaIE';
  hojaSemestre(libro, config, c);

  // EC y AE: cada fuente por separado (el Acuerdo no define cómo combinarlas).
  const filasFuente = [];
  for (const u of c.unidades) {
    for (const [fuente, r] of [['EC', u.ec], ['AE', u.ae]]) {
      if (!r) continue;
      for (const x of r.caracteristicas) {
        filasFuente.push({ docente: u.docente, cohorte: u.cohorte, fuente, caracteristica: `C${x.caracteristica}: ${x.nombre}`, pct_ip: x.pct_ip === null ? null : x.pct_ip / 100, categoria: x.categoria, comentario: r.comentarios.join(' | ') });
      }
    }
  }
  tabla(libro, 'EC y AE', [
    { clave: 'docente', titulo: 'Docente', ancho: 30 }, { clave: 'cohorte', titulo: 'Promoción' }, { clave: 'fuente', titulo: 'Fuente', ancho: 8 },
    { clave: 'caracteristica', titulo: 'Característica', ancho: 44 }, { clave: 'pct_ip', titulo: '%IP', formato: '0.0%' },
    { clave: 'categoria', titulo: 'Categoría', ancho: 16 }, { clave: 'comentario', titulo: 'Comentario', ancho: 60 },
  ], filasFuente);

  // IDSC del programa (Acuerdo 058).
  tabla(libro, 'IDSC-Prog', [
    { clave: 'caracteristica', titulo: 'Característica', ancho: 44 }, { clave: 'docentes', titulo: 'Docentes' },
    { clave: 'satisfactorios', titulo: 'Con GF o F' }, { clave: 'valor', titulo: 'IDSC-Prog', formato: '0.0%' },
    { clave: 'promedio', titulo: 'Promedio %IP oficial', formato: '0.0' },
  ], c.programa.idsc.map((x) => ({
    caracteristica: `C${x.caracteristica}: ${x.nombre}`, docentes: x.docentes, satisfactorios: x.satisfactorios, valor: x.valor,
    promedio: c.programa.promedio_ip.find((y) => y.caracteristica === x.caracteristica)?.promedio ?? null,
  })));

  // Hoja IDST-P (histórico del indicador).
  tabla(libro, 'IDST-P', [
    { clave: 'periodo', titulo: 'Periodo académico' }, { clave: 'docentes', titulo: 'Docentes' },
    { clave: 'idst_p_variable', titulo: 'IDST-P por variable', formato: '0.0%' },
    { clave: 'idst_p_caracteristica', titulo: 'IDST-P por característica', formato: '0.0%' },
    ...[1, 2, 3, 4, 5, 6].map((k) => ({ clave: `c${k}`, titulo: `Promedio C${k}`, formato: '0.0' })),
  ], historico.map((p) => ({
    periodo: p.periodo, docentes: p.docentes, idst_p_variable: p.idst_p.por_variable, idst_p_caracteristica: p.idst_p.por_caracteristica,
    ...Object.fromEntries(p.promedio_ip.map((x) => [`c${x.caracteristica}`, x.promedio])),
  })));

  const nota = libro.addWorksheet('Notas');
  [
    `Semestre ${config.periodo} · población: ${ETIQUETA_POBLACION[poblacion]} · generado el ${fecha()}.`,
    'Cálculo oficial (Acuerdo 058 de 2022): IP = 1,5·MA + A; IN = 1,5·MI + I; %IP = IP/(IP+IN), con las repeticiones reales de cada valoración.',
    `Categorías: ${CATEGORIAS.map((x) => `${x.nombre} (${x.sigla}) ${x.rango}`).join('; ')}. Límites sin redondeo previo.`,
    'IDST-D por variable (Acuerdo, Parágrafo 1) y por característica (C1–C6). La característica 0 (autoevaluación del estudiante) no cuenta para el docente.',
    `Meta del indicador: ${META_PCT} % de docentes con evaluación satisfactoria (GF o F).`,
    `Respuestas extremas excluidas (Parágrafo 2): ${config.excluir_extremas ? `sí (${c.programa.excluidas})` : 'no'}.`,
    'EE, EC y AE se presentan por separado: el Acuerdo 058 no define pesos para combinarlas.',
  ].forEach((t) => nota.addRow([t]));
  nota.getColumn(1).width = 140;

  return {
    nombreArchivo: `Evaluacion_Docente_MaIE_${config.periodo}_${fecha()}.xlsx`,
    tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: await libro.xlsx.writeBuffer(),
  };
};

// ---- PDF ----------------------------------------------------------------------------------------
const COLORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7'];
const MARGEN = 50;

const generarPdf = (dibujar) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'LETTER', margin: MARGEN, info: { Title: 'Evaluación docente MaIE', Author: 'Plataforma MaIE' } });
  const partes = [];
  doc.on('data', (b) => partes.push(b));
  doc.on('end', () => resolve(Buffer.concat(partes)));
  doc.on('error', reject);
  dibujar(doc);
  doc.end();
});

const titulo = (doc, texto, sub) => {
  doc.fillColor('#040039').fontSize(16).font('Helvetica-Bold').text(texto);
  if (sub) doc.moveDown(0.2).fillColor('#474650').fontSize(9).font('Helvetica').text(sub);
  doc.moveDown(0.6).fillColor('black');
};
const subtitulo = (doc, texto) => {
  if (doc.y > 680) doc.addPage();
  doc.moveDown(0.4).fillColor('#040039').fontSize(12).font('Helvetica-Bold').text(texto).moveDown(0.3).fillColor('black').font('Helvetica');
};

// Barras agrupadas: categorias = etiquetas del eje; series = [{ nombre, valores, color?, colores? }] en 0–100.
const barras = (doc, { categorias, series, alto = 170, meta = null, leyendaCategorias = false }) => {
  if (doc.y + alto + (leyendaCategorias ? 55 : 40) > 740) doc.addPage();
  const x0 = MARGEN + 30;
  const y0 = doc.y + 8;
  const ancho = 512 - 30;
  doc.fontSize(7).fillColor('#474650');
  for (const v of [0, 20, 40, 60, 80, 100]) {
    const y = y0 + alto - (v / 100) * alto;
    doc.strokeColor('#dce9ff').lineWidth(0.5).moveTo(x0, y).lineTo(x0 + ancho, y).stroke();
    doc.text(String(v), MARGEN, y - 3, { width: 25, align: 'right' });
  }
  if (meta !== null) {
    const y = y0 + alto - (meta / 100) * alto;
    doc.strokeColor('#474650').dash(3, { space: 3 }).moveTo(x0, y).lineTo(x0 + ancho, y).stroke().undash();
    doc.text(`Meta ${meta} %`, x0 + ancho - 60, y - 9, { width: 60, align: 'right' });
  }
  const grupo = ancho / Math.max(1, categorias.length);
  const barra = Math.min(20, (grupo - 6) / Math.max(1, series.length));
  categorias.forEach((cat, i) => {
    series.forEach((s, j) => {
      const v = s.valores[i];
      if (v === null || v === undefined) return;
      const h = (v / 100) * alto;
      const x = x0 + i * grupo + (grupo - barra * series.length) / 2 + j * barra;
      const color = s.colores?.[i] ?? s.color ?? COLORES[j % COLORES.length];
      doc.fillColor(color).rect(x, y0 + alto - h, barra - 1, h).fill();
    });
    doc.fillColor('#474650').fontSize(7).text(cat, x0 + i * grupo, y0 + alto + 3, { width: grupo, align: 'center' });
  });
  let lx = x0;
  let ly = y0 + alto + 18;
  if (series.length > 1 || !leyendaCategorias) {
    series.forEach((s, j) => {
      if (s.colores) return;
      doc.fillColor(s.color ?? COLORES[j % COLORES.length]).rect(lx, ly, 7, 7).fill();
      doc.fillColor('#474650').fontSize(7).text(s.nombre, lx + 10, ly, { lineBreak: false });
      lx += 16 + doc.widthOfString(s.nombre);
    });
    if (lx > x0) ly += 12;
  }
  if (leyendaCategorias) {
    lx = x0;
    CATEGORIAS.forEach((cat) => {
      doc.fillColor(COLOR_CATEGORIA[cat.sigla]).rect(lx, ly, 7, 7).fill();
      const et = `${cat.sigla} (${cat.nombre})`;
      doc.fillColor('#474650').fontSize(6.8).text(et, lx + 10, ly, { lineBreak: false });
      lx += 14 + doc.widthOfString(et);
    });
    ly += 12;
  }
  doc.x = MARGEN;
  doc.y = ly + 6;
  doc.fillColor('black');
};

// Tabla simple con anchos relativos.
const tablaPdf = (doc, columnas, filas) => {
  const total = columnas.reduce((s, c) => s + (c.ancho ?? 1), 0);
  const anchos = columnas.map((c) => ((c.ancho ?? 1) / total) * 512);
  const fila = (valores, negritaFila) => {
    if (doc.y > 720) doc.addPage();
    const y = doc.y;
    doc.font(negritaFila ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.5);
    const alto = Math.max(...valores.map((v, i) => doc.heightOfString(String(v ?? ''), { width: anchos[i] - 4 })));
    let x = MARGEN;
    valores.forEach((v, i) => { doc.text(String(v ?? ''), x + 2, y + 2, { width: anchos[i] - 4 }); x += anchos[i]; });
    doc.strokeColor('#dce9ff').lineWidth(0.5).moveTo(MARGEN, y + alto + 4).lineTo(MARGEN + 512, y + alto + 4).stroke();
    doc.x = MARGEN;
    doc.y = y + alto + 6;
  };
  fila(columnas.map((c) => c.titulo), true);
  filas.forEach((f) => fila(columnas.map((c) => f[c.clave])));
  doc.font('Helvetica').moveDown(0.3);
};

const NOTA_METODOS = 'Cálculo oficial del Acuerdo 058 de 2022 (IP = 1,5·MA + A; IN = 1,5·MI + I; %IP = IP/(IP+IN) con repeticiones reales). Los resultados de estudiantes (EE), Coordinación (EC) y autoevaluación (AE) se reportan por separado.';

const pdfConsolidado = async ({ config, consolidado: c, historico, poblacion }) => {
  const buffer = await generarPdf((doc) => {
    titulo(doc, `Informe de evaluación docente ${config.periodo}`,
      `Maestría en Ingeniería Electrónica · Acuerdo 058 de 2022 · Población: ${ETIQUETA_POBLACION[poblacion]} · ${c.programa.respuestas_ee} respuestas de estudiantes${config.excluir_extremas ? ` (${c.programa.excluidas} extremas excluidas, Parágrafo 2)` : ''} · Generado el ${fecha()}`);
    doc.fontSize(8).fillColor('#474650').text(NOTA_METODOS).fillColor('black');

    subtitulo(doc, 'Resultados consolidados del programa');
    tablaPdf(doc, [
      { clave: 'indicador', titulo: 'Indicador', ancho: 3 }, { clave: 'valor', titulo: 'Valor', ancho: 1 },
    ], [
      { indicador: 'Docentes evaluados (EE)', valor: c.programa.docentes },
      { indicador: 'IDST-P del semestre, por variable (Acuerdo 058)', valor: prop(c.programa.idst_p.por_variable) },
      { indicador: 'IDST-P del semestre, por característica (C1–C6)', valor: prop(c.programa.idst_p.por_caracteristica) },
      { indicador: 'Meta del indicador', valor: `${META_PCT} %` },
    ]);
    const cs = c.programa.idsc;
    const promediosProg = cs.map((x) => c.programa.promedio_ip.find((y) => y.caracteristica === x.caracteristica)?.promedio ?? null);
    barras(doc, {
      categorias: cs.map((x) => `C${x.caracteristica}`),
      series: [
        { nombre: 'IDSC-Prog (Acuerdo 058)', color: '#040039', valores: cs.map((x) => x.valor * 100) },
        { nombre: 'Promedio %IP (color por categoría)', valores: promediosProg, colores: promediosProg.map((v) => colorPorPct(v)) },
      ],
      meta: META_PCT,
      leyendaCategorias: true,
    });
    doc.fontSize(7).fillColor('#474650').text(cs.map((x) => `C${x.caracteristica}: ${x.nombre}`).join(' · ')).fillColor('black');

    for (const p of c.promociones) {
      subtitulo(doc, `Promoción ${p.cohorte}: resultados por docente (EE)`);
      const us = c.unidades.filter((u) => u.ee && u.id_cohorte === p.id_cohorte);
      const ks = p.idsc.map((x) => x.caracteristica);
      tablaPdf(doc, [
        { clave: 'docente', titulo: 'Docente', ancho: 3 },
        ...ks.map((k) => ({ clave: `c${k}`, titulo: `C${k}`, ancho: 1.2 })),
        { clave: 'global', titulo: '%IP Global', ancho: 1.4 },
        { clave: 'var', titulo: 'IDST-D var.', ancho: 1.2 }, { clave: 'car', titulo: 'IDST-D car.', ancho: 1.2 },
      ], us.map((u) => ({
        docente: `${u.docente}${u.afiliacion ? ` (${u.afiliacion})` : ''}`,
        ...Object.fromEntries(ks.map((k) => {
          const x = u.ee.caracteristicas.find((y) => y.caracteristica === k);
          return [`c${k}`, x?.pct_ip == null ? '—' : `${x.pct_ip.toFixed(1).replace('.', ',')} ${x.sigla}`];
        })),
        global: u.ee.global?.pct_ip == null ? '—' : `${u.ee.global.pct_ip.toFixed(1).replace('.', ',')} ${u.ee.global.sigla}`,
        var: prop(u.ee.idst_d.por_variable.valor), car: prop(u.ee.idst_d.por_caracteristica.valor),
      })));
      if (us.length) {
        barras(doc, {
          categorias: us.map((u) => u.docente.split(' ').slice(0, 2).join(' ')),
          series: [{
            nombre: '%IP global EE por docente',
            valores: us.map((u) => u.ee.global?.pct_ip ?? null),
            colores: us.map((u) => colorPorPct(u.ee.global?.pct_ip)),
          }],
          alto: 140,
          leyendaCategorias: true,
        });
      }
      doc.fontSize(8).text(`IDSC-Prom: ${p.idsc.map((x) => `C${x.caracteristica} ${prop(x.valor)}`).join(' · ')}. IDST-P: ${prop(p.idst_p.por_variable)} por variable; ${prop(p.idst_p.por_caracteristica)} por característica.`);
    }

    const conFuentes = c.unidades.filter((u) => u.ec || u.ae);
    if (conFuentes.length) {
      subtitulo(doc, 'Evaluación de Coordinación (EC) y autoevaluación (AE), por separado');
      tablaPdf(doc, [
        { clave: 'docente', titulo: 'Docente', ancho: 3 }, { clave: 'cohorte', titulo: 'Promoción', ancho: 1 },
        { clave: 'ec', titulo: '%IP EC', ancho: 1.5 }, { clave: 'ae', titulo: '%IP AE', ancho: 1.5 },
      ], conFuentes.map((u) => ({
        docente: u.docente, cohorte: u.cohorte,
        ec: u.ec ? `${pct(u.ec.global.pct_ip)} ${u.ec.global.sigla ?? ''}` : 'sin diligenciar',
        ae: u.ae ? `${pct(u.ae.global.pct_ip)} ${u.ae.global.sigla ?? ''}` : 'sin diligenciar',
      })));
    }

    if (historico.length) {
      subtitulo(doc, 'Variación histórica del programa');
      barras(doc, {
        categorias: historico.map((h) => h.periodo),
        series: [
          { nombre: 'IDST-P por variable', color: '#040039', valores: historico.map((h) => (h.idst_p.por_variable ?? 0) * 100) },
          { nombre: 'IDST-P por característica', color: '#2a78d6', valores: historico.map((h) => (h.idst_p.por_caracteristica ?? 0) * 100) },
        ],
        meta: META_PCT,
        alto: 140,
      });
    }
  });
  return { nombreArchivo: `Informe_Evaluacion_Docente_${config.periodo}.pdf`, tipo: 'application/pdf', buffer };
};

const pdfDocente = async ({ docente, periodos }) => {
  const buffer = await generarPdf((doc) => {
    titulo(doc, `Evaluación docente: ${docente.docente}`,
      `Maestría en Ingeniería Electrónica · Acuerdo 058 de 2022 · ${docente.afiliacion ?? ''} · Generado el ${fecha()}`);
    doc.fontSize(8).fillColor('#474650').text(NOTA_METODOS).fillColor('black');
    if (!periodos.length) {
      doc.moveDown().fontSize(10).text('No hay resultados disponibles.');
      return;
    }
    const filas = periodos.flatMap((p) => p.unidades.filter((u) => u.ee).map((u) => ({ etiqueta: `${p.periodo} · ${u.cohorte}`, u })));
    if (filas.length) {
      subtitulo(doc, 'Desempeño global por semestre y promoción (%IP oficial EE)');
      barras(doc, {
        categorias: filas.map((f) => f.etiqueta),
        series: [{
          nombre: '%IP global (EE)',
          valores: filas.map((f) => f.u.ee.global?.pct_ip ?? null),
          colores: filas.map((f) => colorPorPct(f.u.ee.global?.pct_ip)),
        }],
        alto: 140,
        leyendaCategorias: true,
      });
    }
    for (const p of periodos) {
      for (const u of p.unidades) {
        subtitulo(doc, `${p.periodo} · Promoción ${u.cohorte}`);
        for (const [fuente, r] of [['Evaluación de los estudiantes (EE)', u.ee], ['Evaluación de Coordinación (EC)', u.ec], ['Autoevaluación (AE)', u.ae]]) {
          if (!r) continue;
          const cars = r.caracteristicas.filter((c) => c.cuenta_docente);
          doc.font('Helvetica-Bold').fontSize(9).text(`${fuente}${fuente.includes('EE') ? ` · ${r.respuestas} respuestas` : ''} · Global: ${pct(r.global?.pct_ip)} (${r.global?.categoria ?? '—'})`).font('Helvetica');
          if (cars.length) {
            barras(doc, {
              categorias: cars.map((c) => `C${c.caracteristica}`),
              series: [{ nombre: '%IP por característica', valores: cars.map((c) => c.pct_ip), colores: cars.map((c) => colorPorPct(c.pct_ip)) }],
              alto: 120,
              leyendaCategorias: true,
            });
          }
          tablaPdf(doc, [
            { clave: 'nombre', titulo: 'Característica', ancho: 4.5 }, { clave: 'ip', titulo: '%IP oficial', ancho: 1.4 },
            { clave: 'cat', titulo: 'Categoría', ancho: 2 },
          ], cars.map((c) => ({
            nombre: `C${c.caracteristica}: ${c.nombre}`, ip: pct(c.pct_ip), cat: c.categoria ?? '—',
          })));
          doc.fontSize(8).text(`IDST-D: ${prop(r.idst_d.por_variable.valor)} por variable · ${prop(r.idst_d.por_caracteristica.valor)} por característica. Promedio ${pct(r.estadistica.promedio)}, desviación ${pct(r.estadistica.desviacion)}; mejor ${r.estadistica.mejor?.codigo ?? '—'} (${pct(r.estadistica.mejor?.pct_ip)}), peor ${r.estadistica.peor?.codigo ?? '—'} (${pct(r.estadistica.peor?.pct_ip)}).`);
          if (r.comentarios.length) doc.fontSize(8).fillColor('#474650').text(`Comentarios: ${r.comentarios.map((x) => `«${x}»`).join(' ')}`).fillColor('black');
          doc.moveDown(0.4);
        }
      }
    }
  });
  const nombre = docente.docente.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_');
  return { nombreArchivo: `Evaluacion_Docente_${nombre}.pdf`, tipo: 'application/pdf', buffer };
};

module.exports = { excel, pdfConsolidado, pdfDocente };
