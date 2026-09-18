// Lector del libro histórico "Estadísticas MaIE" (formato actual de Coordinación).
// Cada hoja tiene encabezados combinados y filas de Totales/Promedio/Desviación: se toman solo
// las filas cuya columna B es una promoción en números romanos (I, II, …) y los valores
// calculados (totales, porcentajes) se ignoran porque el sistema los recalcula.
const { valorCelda, buscarHoja, esRomano, normalizar, FORMULA_SIN_VALOR } = require('./excel.util');

const PERIODO = /^\d{4}-[AB]$/;

// Crea un lector de celdas por hoja que registra advertencias de fórmulas sin valor.
const lectorHoja = (hoja, advertencias) => (fila, col) => {
  const v = valorCelda(hoja.getRow(fila).getCell(col));
  if (v === FORMULA_SIN_VALOR) {
    advertencias.push({
      hoja: hoja.name,
      fila,
      mensaje: `La celda ${hoja.getRow(fila).getCell(col).address} tiene una fórmula sin valor calculado; se tomó como vacía`,
    });
    return null;
  }
  return v;
};

// Filas de datos por promoción (columna B en romanos).
const filasPromocion = (hoja, celda) => {
  const filas = [];
  hoja.eachRow((row, n) => {
    const b = celda(n, 2);
    if (esRomano(b)) filas.push({ n, promocion: b.trim() });
  });
  return filas;
};

// Columna inicial de cada periodo 'AAAA-S' en las primeras filas (encabezados combinados).
const columnasPeriodo = (hoja, celda) => {
  for (let n = 1; n <= 6; n++) {
    const cols = new Map();
    for (let c = 1; c <= hoja.columnCount; c++) {
      const v = celda(n, c);
      if (typeof v === 'string' && PERIODO.test(v.trim()) && !cols.has(v.trim())) cols.set(v.trim(), c);
    }
    if (cols.size >= 1) return cols;
  }
  return new Map();
};

// Busca una celda cuyo texto cumpla la expresión y devuelve { match, fila, col }.
// Lee las celdas sin registrar advertencias: recorre también celdas que no son datos.
const buscarTexto = (hoja, celda, regex) => {
  let hallazgo = null;
  hoja.eachRow((row, n) => {
    row.eachCell((cell, c) => {
      const v = valorCelda(cell);
      const m = typeof v === 'string' && v.match(regex);
      if (m && !hallazgo) hallazgo = { match: m, fila: n, col: c };
    });
  });
  return hallazgo;
};

const LECTORES = {
  cohortes: {
    hoja: 'Promociones y Estudiantes',
    leer: (hoja, celda) =>
      filasPromocion(hoja, celda).map(({ n, promocion }) => ({
        fila: n,
        valores: {
          nombre: promocion,
          periodo_inicio: celda(n, 3),
          periodo_fin: celda(n, 4),
          inscritos: celda(n, 5),
          matriculados: celda(n, 6),
          aprobados_sem1: celda(n, 7),
          aprobados_sem2: celda(n, 8),
          aprobados_sem3: celda(n, 9),
          egresados: celda(n, 10),
          graduados: celda(n, 11),
        },
      })),
  },

  'punto-equilibrio': {
    hoja: 'Punto de equilibrio',
    leer: (hoja, celda) =>
      filasPromocion(hoja, celda).map(({ n, promocion }) => ({
        fila: n,
        promocion,
        valores: {
          estudiantes_equilibrio: celda(n, 5),
          valor_matricula_smmlv: celda(n, 6),
          ingresos_proyectados: celda(n, 7),
        },
      })),
    parametros: (hoja, celda) => {
      const h = buscarTexto(hoja, celda, /^SMMLV\s*(\d{4})/i);
      if (!h) return [];
      for (let c = h.col + 1; c <= hoja.columnCount; c++) {
        const v = valorCelda(hoja.getRow(h.fila).getCell(c));
        if (typeof v === 'number') {
          return [{ clave: `smmlv_${h.match[1]}`, valor: v, descripcion: `SMMLV ${h.match[1]} (COP)` }];
        }
      }
      return [];
    },
  },

  'cohorte-semestres': {
    hoja: 'Cursos y Docentes',
    leer: (hoja, celda) =>
      filasPromocion(hoja, celda).flatMap(({ n, promocion }) =>
        [1, 2, 3, 4]
          .map((semestre) => {
            const col = 3 + (semestre - 1) * 3;
            const valores = {
              semestre,
              n_cursos: celda(n, col),
              docentes_udenar: celda(n, col + 1),
              docentes_externos: celda(n, col + 2),
            };
            const vacio = [valores.n_cursos, valores.docentes_udenar, valores.docentes_externos]
              .every((v) => v === null || v === '');
            return vacio ? null : { fila: n, promocion, valores };
          })
          .filter(Boolean),
      ),
    parametros: (hoja, celda) => {
      const h = buscarTexto(hoja, celda, /^n[uú]mero de cr[eé]ditos/i);
      if (!h) return [];
      return [1, 2, 3, 4]
        .map((s) => ({ s, v: celda(h.fila, 3 + (s - 1) * 3) }))
        .filter(({ v }) => typeof v === 'number')
        .map(({ s, v }) => ({ clave: `creditos_semestre_${s}`, valor: v, descripcion: `Número de créditos del semestre ${s}` }));
    },
  },

  docentes: {
    hoja: 'Docentes UDENAR-EXTERNOS',
    leer: (hoja, celda) => {
      const filas = [];
      hoja.eachRow((row, n) => {
        const nombre = celda(n, 2);
        if (typeof celda(n, 1) !== 'number' || !nombre) return;
        filas.push({
          fila: n,
          valores: {
            nombre_completo: nombre,
            formacion_profesional: celda(n, 3),
            campo_formacion: celda(n, 4),
            afiliacion: celda(n, 5),
            componentes: celda(n, 6),
            cursos_participa: celda(n, 7),
            enlace_perfil: celda(n, 8),
          },
        });
      });
      return filas;
    },
  },

  presupuesto: {
    hoja: 'Presupuesto',
    leer: (hoja, celda) => {
      const corte = buscarTexto(hoja, celda, /corte:\s*(\d{1,2}[-/]\d{1,2}[-/]\d{4})/i);
      return filasPromocion(hoja, celda).map(({ n, promocion }) => ({
        fila: n,
        promocion,
        valores: {
          fecha_corte: corte?.match[1] ?? null,
          ingresos: celda(n, 3),
          gastos_comprometidos: celda(n, 4),
          saldo_certificado: celda(n, 6),
          transferencia_central: celda(n, 8),
          transferencia_viis: celda(n, 9),
          fondo_investigaciones: celda(n, 10),
          unidad_academica: celda(n, 11),
        },
      }));
    },
  },

  pregrado: {
    hoja: 'Estudiantes Pregrado',
    leer: (hoja, celda) => {
      const periodos = columnasPeriodo(hoja, celda);
      return filasPromocion(hoja, celda).flatMap(({ n, promocion }) =>
        [...periodos].flatMap(([periodo, col]) => {
          const estudiantes = celda(n, col);
          const inscripciones = celda(n, col + 1);
          // Solo periodos con actividad: los ceros de periodos no cursados no aportan información
          // (y su celda de ingreso suele ser una fórmula sin valor).
          if (!(Number(estudiantes) > 0 || Number(inscripciones) > 0)) return [];
          return [{ fila: n, promocion, valores: { periodo, estudiantes, inscripciones, ingreso: celda(n, col + 2) } }];
        }),
      );
    },
  },

  transferencias: {
    hoja: 'Transferencias ViceAcad',
    leer: (hoja, celda) => leerPorPeriodo(hoja, celda, ['n_docentes', 'valor']),
  },

  contrataciones: {
    hoja: 'Contrataciones',
    leer: (hoja, celda) => leerPorPeriodo(hoja, celda, ['n_ops', 'valor']),
  },

  beneficios: {
    hoja: 'Beneficios',
    leer: (hoja, celda) =>
      filasPromocion(hoja, celda).map(({ n, promocion }) => ({
        fila: n,
        promocion,
        valores: {
          becas_100: celda(n, 3),
          becas_hora_catedra: celda(n, 4),
          becas_sintraunicol: celda(n, 5),
          asistentes_investigacion: celda(n, 6),
          ayudantes_docencia: celda(n, 7),
        },
      })),
  },

  produccion: {
    hoja: 'Producción Científica',
    leer: (hoja, celda) =>
      filasPromocion(hoja, celda).map(({ n, promocion }) => ({
        fila: n,
        promocion,
        valores: {
          articulos: celda(n, 3),
          ponencias: celda(n, 4),
          software: celda(n, 5),
          prototipos: celda(n, 6),
          tesis: celda(n, 7),
        },
      })),
  },

  pasantias: {
    hoja: 'Pasantías',
    leer: (hoja, celda) =>
      filasPromocion(hoja, celda).map(({ n, promocion }) => ({
        fila: n,
        promocion,
        valores: { nacionales: celda(n, 3), internacionales: celda(n, 4) },
      })),
  },
};

// Hojas por periodo (Transferencias, Contrataciones): una fila con las promociones cubiertas
// y pares de columnas (cantidad, valor) por periodo.
function leerPorPeriodo(hoja, celda, [campoCantidad, campoValor]) {
  const periodos = columnasPeriodo(hoja, celda);
  const filas = [];
  hoja.eachRow((row, n) => {
    const b = celda(n, 2);
    if (typeof b !== 'string' || !b.trim() || normalizar(b) === 'promocion') return;
    if ([...periodos.values()].every((col) => typeof celda(n, col) !== 'number')) return;
    for (const [periodo, col] of periodos) {
      filas.push({
        fila: n,
        valores: { periodo, promociones: b.trim(), [campoCantidad]: celda(n, col), [campoValor]: celda(n, col + 1) },
      });
    }
  });
  return filas;
}

// Devuelve { datos: { recursoId: [{ fila, promocion?, valores }] }, parametros[], advertencias[], hojasFaltantes[] }
const leerEstadisticas = (libro) => {
  const datos = {};
  const parametros = [];
  const advertencias = [];
  const hojasFaltantes = [];

  for (const [recursoId, lector] of Object.entries(LECTORES)) {
    const hoja = buscarHoja(libro, lector.hoja);
    if (!hoja) {
      hojasFaltantes.push(lector.hoja);
      continue;
    }
    const celda = lectorHoja(hoja, advertencias);
    datos[recursoId] = lector.leer(hoja, celda).map((f) => ({ ...f, hoja: hoja.name }));
    if (lector.parametros) parametros.push(...lector.parametros(hoja, celda));
  }
  return { datos, parametros, advertencias, hojasFaltantes };
};

module.exports = { leerEstadisticas };
