// RF-ADM-02 — Plantilla estándar .xlsx para importación masiva (sin celdas combinadas).
// Con ?datos=true incluye los registros actuales (sirve también como exportación a Excel).
const ExcelJS = require('exceljs');
const { RECURSOS, porId } = require('../recursos/recursos.definicion');
const repositorios = require('../recursos/recursos.repository');
const ApiError = require('../../../utils/ApiError');
const { HOJA_INSTRUCCIONES } = require('../importaciones/lectorPlantilla');
const asignacion = require('../importaciones/asignacionDocente');
const beneficiosEstudiante = require('../importaciones/beneficiosEstudiante');
const reflejo = require('../reportes/reflejo');

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
  booleano: 'Valores: Sí, No',
  docente: 'Nombre completo del docente tal como aparece en "Docentes UDENAR-EXTERNOS"',
};
const LISTAS = {
  cohorte: `'Promociones y Estudiantes'!$A$2:$A$${MAX_FILAS_VALIDACION}`,
  docente: `'Docentes UDENAR-EXTERNOS'!$A$2:$A$${MAX_FILAS_VALIDACION}`,
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
    ['   En "Asignación docente" cada fila es un docente en un curso; el semestre es el de la promoción (1 a 4) y el curso es el código o nombre de la materia (Gestión académica › Materias).'],
    ['   En "Beneficios por estudiante" cada fila es un beneficio de un estudiante en un semestre (una sola beca por semestre); el estudiante debe estar registrado en su promoción y queda con exactamente los beneficios de sus filas.'],
    ['6. Puede dejar hojas vacías; solo se importan las filas diligenciadas. Si hay errores no se guarda nada y se listan por hoja y fila.'],
    ['7. En la exportación con datos, las hojas que la plataforma calcula desde Gestión académica (promociones, beneficios, cursos y'],
    ['   docentes, producción científica y contrataciones) traen el registro histórico guardado; la columna «Origen (informativo)»'],
    ['   indica qué filas se calculan y con qué cifras las muestra la plataforma. Esa columna no se importa.'],
    [''],
    ['Hojas:', { bold: true }],
    ...[...IMPORTABLES, asignacion.ASIGNACION, beneficiosEstudiante.BENEFICIOS_ESTUDIANTE].map((r) => [`• ${r.hoja} (${r.requisito}): ${r.titulo}`]),
  ];
  lineas.forEach(([texto, font], i) => {
    const c = h.getCell(i + 1, 1);
    c.value = texto;
    if (font) c.font = font;
  });
};

// `origenDe(fila)`: texto de la columna informativa «Origen» (solo hojas con reflejo, en la exportación).
const COLUMNA_ORIGEN = 'Origen (informativo)';

const hojaRecurso = (libro, recurso, filas, origenDe = null) => {
  const h = libro.addWorksheet(recurso.hoja, { views: [{ state: 'frozen', ySplit: 1 }] });
  h.columns = [
    ...recurso.campos.map((c) => ({
      header: c.label,
      key: c.name,
      width: Math.min(Math.max(c.label.length + 4, c.multilinea ? 45 : 14), 60),
      style: c.type === 'dinero' ? { numFmt: '#,##0.00' } : c.type === 'fecha' ? { numFmt: 'yyyy-mm-dd' } : {},
    })),
    ...(origenDe ? [{ header: COLUMNA_ORIGEN, key: '__origen', width: 60 }] : []),
  ];

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
    if (campo.type === 'booleano') regla = { type: 'list', formulae: ['"Sí,No"'] };
    if (campo.type === 'semestre') regla = { type: 'whole', operator: 'between', formulae: [1, 4] };
    if (LISTAS[campo.type]) regla = { type: 'list', formulae: [LISTAS[campo.type]] };
    if (!regla) return;
    h.dataValidations.add(`${col}2:${col}${MAX_FILAS_VALIDACION}`, {
      ...regla,
      allowBlank: !campo.required,
      showErrorMessage: true,
      error: `Valor no válido para "${campo.label}"`,
    });
  });

  for (const fila of filas) {
    h.addRow({
      ...Object.fromEntries(
        recurso.campos.map((c) => {
          if (c.type === 'cohorte') return [c.name, fila.cohorte];
          if (c.type === 'booleano') return [c.name, fila[c.name] ? 'Sí' : 'No'];
          if (c.type === 'fecha' && fila[c.name]) return [c.name, new Date(`${String(fila[c.name]).slice(0, 10)}T00:00:00Z`)];
          return [c.name, fila[c.name]];
        }),
      ),
      ...(origenDe ? { __origen: origenDe(fila) } : {}),
    });
  }
};

// Para cada hoja con reflejo, una función fila → texto de origen con las cifras que muestra la plataforma.
const origenesDeReflejo = async (datos) => {
  const combinado = await reflejo.aplicar(datos);
  const clave = (recurso, fila) => recurso.llave.map((k) => fila[k]).join('|');
  return Object.fromEntries(
    IMPORTABLES.filter((r) => r.reflejados?.length).map((recurso) => {
      const calculadas = new Map((combinado[recurso.id] ?? []).map((f) => [clave(recurso, f), f]));
      const origenDe = (fila) => {
        const f = calculadas.get(clave(recurso, fila));
        if (!f || f.origen !== 'gestion') return 'Registro histórico (la plataforma muestra estas cifras)';
        const columnas = f.reflejados ?? recurso.reflejados;
        const cifras = recurso.campos
          .filter((c) => columnas.includes(c.name) && !c.multilinea)
          .map((c) => `${c.label}: ${f[c.name] ?? '—'}`)
          .join('; ');
        return `Calculado desde Gestión académica; la plataforma muestra ${cifras}`;
      };
      return [recurso.id, origenDe];
    }),
  );
};

module.exports = {
  // Devuelve { nombreArchivo, buffer }
  async generar({ query }) {
    const conDatos = query.datos === 'true';
    const libro = new ExcelJS.Workbook();
    libro.creator = 'Plataforma MaIE';
    libro.created = new Date();
    hojaInstrucciones(libro);
    const datos = conDatos
      ? Object.fromEntries(await Promise.all(IMPORTABLES.map(async (r) => [r.id, await repositorios[r.id].list()])))
      : {};
    const origenes = conDatos ? await origenesDeReflejo(datos) : {};
    for (const recurso of IMPORTABLES) {
      hojaRecurso(libro, recurso, datos[recurso.id] ?? [], origenes[recurso.id] ?? null);
    }
    hojaRecurso(libro, await asignacion.definicion(), conDatos ? await asignacion.listar() : []);
    hojaRecurso(libro, beneficiosEstudiante.BENEFICIOS_ESTUDIANTE, conDatos ? await beneficiosEstudiante.listar() : []);
    const fecha = new Date().toISOString().slice(0, 10);
    return {
      nombreArchivo: conDatos ? `MaIE_datos_administrativos_${fecha}.xlsx` : 'MaIE_plantilla_importacion.xlsx',
      buffer: await libro.xlsx.writeBuffer(),
    };
  },

  // Exporta un único recurso tabular a Excel (.xlsx), aplicando el reflejo si corresponde (p. ej. Contratos OPS,
  // Contrataciones, Pasantías, Presupuesto, etc.).
  async exportarRecurso({ params }) {
    const recurso = porId[params.recurso];
    if (!recurso) throw ApiError.notFound('Recurso no encontrado');
    let filas = await repositorios[recurso.id].list();
    if (reflejo.RECURSOS_REFLEJADOS.includes(recurso.id) || recurso.id === 'contrataciones' || recurso.id === 'pregrado') {
      const todas = Object.fromEntries(await Promise.all(RECURSOS.map(async (r) => [r.id, await repositorios[r.id].list()])));
      const combinado = await reflejo.aplicar(todas);
      filas = combinado[recurso.id] ?? filas;
    }
    const libro = new ExcelJS.Workbook();
    libro.creator = 'Plataforma MaIE';
    libro.created = new Date();
    const conCalculados = recurso.calculados?.length
      ? { ...recurso, campos: [...recurso.campos, ...recurso.calculados.map((c) => ({ name: c.name, label: c.label, type: 'texto' }))] }
      : recurso;
    const tieneOrigen = filas.some((f) => f.origen);
    hojaRecurso(libro, conCalculados, filas, tieneOrigen ? (f) => (f.origen === 'gestion' ? 'Calculado desde Gestión académica' : 'Registro histórico') : null);
    const fecha = new Date().toISOString().slice(0, 10);
    return {
      nombreArchivo: `MaIE_${recurso.id}_${fecha}.xlsx`,
      buffer: await libro.xlsx.writeBuffer(),
    };
  },
};
