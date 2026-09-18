// RF-ADM-02 — Plantilla estándar .xlsx para importación masiva (sin celdas combinadas).
// Con ?datos=true incluye los registros actuales (sirve también como exportación a Excel).
const ExcelJS = require('exceljs');
const { RECURSOS } = require('../recursos/recursos.definicion');
const repositorios = require('../recursos/recursos.repository');
const { HOJA_INSTRUCCIONES } = require('../importaciones/lectorPlantilla');

const IMPORTABLES = RECURSOS.filter((r) => r.id !== 'parametros');
const COLOR_ENCABEZADO = 'FF0B3D6B';
const MAX_FILAS_VALIDACION = 500;

const AYUDA_TIPO = {
  periodo: 'Formato AAAA-A o AAAA-B (p. ej. 2024-A)',
  fecha: 'Fecha AAAA-MM-DD',
  cohorte: 'Nombre de la promoción (I, II, III…) tal como aparece en "Promociones y Estudiantes"',
  entero: 'Número entero ≥ 0',
  dinero: 'Valor en pesos, sin símbolos',
  semestre: 'Semestre 1 a 4',
};

const letra = (n) => {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

const hojaInstrucciones = (libro) => {
  const h = libro.addWorksheet(HOJA_INSTRUCCIONES);
  h.getColumn(1).width = 110;
  const lineas = [
    ['PLANTILLA DE IMPORTACIÓN — PLATAFORMA MaIE (Módulo de Procesos Administrativos)', { bold: true, size: 14 }],
    [''],
    ['1. Diligencie cada hoja a partir de la fila 2. No cambie los nombres de las hojas ni los encabezados de la fila 1.'],
    ['2. Registre primero las promociones en "Promociones y Estudiantes"; las demás hojas las referencian por su nombre (I, II, III…).'],
    ['3. Deje vacías las celdas que aún no aplican (p. ej. semestres no cursados). Los encabezados en negrita con * son obligatorios.'],
    ['4. No agregue filas de totales, promedios ni porcentajes: la plataforma los calcula.'],
    ['5. Si una fila ya existe (misma promoción/periodo), la importación la actualiza.'],
    ['6. Puede dejar hojas vacías; solo se importan las filas diligenciadas. Si hay errores no se guarda nada y se listan por hoja y fila.'],
    [''],
    ['Hojas:', { bold: true }],
    ...IMPORTABLES.map((r) => [`• ${r.hoja} (${r.requisito}): ${r.titulo}`]),
  ];
  lineas.forEach(([texto, font], i) => {
    const c = h.getCell(i + 1, 1);
    c.value = texto;
    if (font) c.font = font;
  });
};

const hojaRecurso = (libro, recurso, filas) => {
  const h = libro.addWorksheet(recurso.hoja, { views: [{ state: 'frozen', ySplit: 1 }] });
  h.columns = recurso.campos.map((c) => ({
    header: c.label,
    key: c.name,
    width: Math.min(Math.max(c.label.length + 4, c.multilinea ? 45 : 14), 60),
    style: c.type === 'dinero' ? { numFmt: '#,##0.00' } : c.type === 'fecha' ? { numFmt: 'yyyy-mm-dd' } : {},
  }));

  const encabezado = h.getRow(1);
  recurso.campos.forEach((campo, i) => {
    const celda = encabezado.getCell(i + 1);
    celda.font = { bold: campo.required, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ENCABEZADO } };
    celda.alignment = { wrapText: true, vertical: 'middle' };
    const ayuda = campo.type === 'enum' ? `Valores: ${campo.options.join(', ')}` : AYUDA_TIPO[campo.type];
    if (ayuda || campo.required) celda.note = [campo.required ? 'Obligatorio.' : '', ayuda ?? ''].join(' ').trim();
    if (campo.required) celda.value = `${campo.label} *`;
  });
  encabezado.height = 32;

  // Listas desplegables
  recurso.campos.forEach((campo, i) => {
    const col = letra(i + 1);
    let regla = null;
    if (campo.type === 'enum') regla = { type: 'list', formulae: [`"${campo.options.join(',')}"`] };
    if (campo.type === 'semestre') regla = { type: 'whole', operator: 'between', formulae: [1, 4] };
    if (campo.type === 'cohorte') regla = { type: 'list', formulae: [`'Promociones y Estudiantes'!$A$2:$A$${MAX_FILAS_VALIDACION}`] };
    if (!regla) return;
    h.dataValidations.add(`${col}2:${col}${MAX_FILAS_VALIDACION}`, {
      ...regla,
      allowBlank: !campo.required,
      showErrorMessage: true,
      error: `Valor no válido para "${campo.label}"`,
    });
  });

  for (const fila of filas) {
    h.addRow(
      Object.fromEntries(
        recurso.campos.map((c) => {
          if (c.type === 'cohorte') return [c.name, fila.cohorte];
          if (c.type === 'fecha' && fila[c.name]) return [c.name, new Date(`${fila[c.name]}T00:00:00Z`)];
          return [c.name, fila[c.name]];
        }),
      ),
    );
  }
};

module.exports = {
  // Devuelve { nombreArchivo, buffer }
  async generar({ query }) {
    const conDatos = query.datos === 'true';
    const libro = new ExcelJS.Workbook();
    libro.creator = 'Plataforma MaIE';
    libro.created = new Date();
    hojaInstrucciones(libro);
    for (const recurso of IMPORTABLES) {
      const filas = conDatos ? await repositorios[recurso.id].list() : [];
      hojaRecurso(libro, recurso, filas);
    }
    const fecha = new Date().toISOString().slice(0, 10);
    return {
      nombreArchivo: conDatos ? `MaIE_datos_administrativos_${fecha}.xlsx` : 'MaIE_plantilla_importacion.xlsx',
      buffer: await libro.xlsx.writeBuffer(),
    };
  },
};
