// Cálculos del informe administrativo contra valores de la hoja "Estadísticas MaIE 2025-B".
const { calcular, desviacion, poblacionReferencia } = require('../src/modules/admin/reportes/estadisticas');
const { validarFila } = require('../src/shared/crud/campos');

const cohorte = (id, nombre, datos) => ({ id_cohorte: id, nombre, cohorte: nombre, ...datos });

const datos = {
  parametros: [
    { clave: 'pct_transferencia_central', valor: 15 },
    { clave: 'pct_transferencia_viis', valor: 5 },
    { clave: 'pct_fondo_investigaciones', valor: 50 },
    { clave: 'pct_unidad_academica', valor: 30 },
    { clave: 'creditos_semestre_1', valor: 12 },
  ],
  cohortes: [
    cohorte(1, 'I', { inscritos: 12, matriculados: 11, aprobados_sem1: 9, aprobados_sem2: 9, aprobados_sem3: 9, egresados: 9, graduados: 9 }),
    cohorte(2, 'II', { inscritos: 19, matriculados: 16, aprobados_sem1: 10, aprobados_sem2: 9, aprobados_sem3: 9, egresados: 9, graduados: 7 }),
    cohorte(6, 'VI', { inscritos: 6, matriculados: 6, aprobados_sem1: 6, aprobados_sem2: null, aprobados_sem3: null, egresados: null, graduados: 0 }),
  ],
  'punto-equilibrio': [
    cohorte(1, 'I', { estudiantes_equilibrio: 10, valor_matricula_smmlv: 7, ingresos_proyectados: 241429787 }),
    cohorte(2, 'II', { estudiantes_equilibrio: 10, valor_matricula_smmlv: 6, ingresos_proyectados: 226222609 }),
  ],
  'cohorte-semestres': [
    cohorte(1, 'I', { semestre: 1, n_cursos: 3, docentes_udenar: 2, docentes_externos: 3 }),
    cohorte(2, 'II', { semestre: 1, n_cursos: 3, docentes_udenar: 2, docentes_externos: 4 }),
  ],
  presupuesto: [
    cohorte(3, 'III', {
      fecha_corte: '2025-11-23', ingresos: 99466747, gastos_comprometidos: 6389803, saldo_comprometido: 93076944,
      saldo_certificado: 93076944, transferencia_central: null, transferencia_viis: null, fondo_investigaciones: null, unidad_academica: null,
    }),
    cohorte(6, 'VI', {
      fecha_corte: '2025-11-23', ingresos: 72091768, gastos_comprometidos: 77403615, saldo_comprometido: -5311847,
      saldo_certificado: -5311847, transferencia_central: null, transferencia_viis: null, fondo_investigaciones: null, unidad_academica: null,
    }),
  ],
  pregrado: [
    cohorte(2, 'II', { periodo: '2021-A', estudiantes: 24, inscripciones: 39, ingreso: 62361739.44 }),
    cohorte(2, 'II', { periodo: '2021-B', estudiantes: 16, inscripciones: 22, ingreso: 35178417.12 }),
    cohorte(2, 'II', { periodo: '2022-A', estudiantes: 4, inscripciones: 4, ingreso: 6396075.84 }),
  ],
  transferencias: [],
  contrataciones: [
    { periodo: '2021-A', n_ops: 2, valor: 14536416 },
    { periodo: '2021-B', n_ops: 2, valor: 14385045 },
  ],
  beneficios: [cohorte(1, 'I', { becas_100: 1, becas_hora_catedra: 0, becas_sintraunicol: 0, asistentes_investigacion: 4, ayudantes_docencia: 4 })],
  produccion: [cohorte(1, 'I', { articulos: 2, ponencias: 0, software: 1, prototipos: 0, tesis: 9 })],
  pasantias: [cohorte(2, 'II', { nacionales: 4, internacionales: 0 })],
  docentes: [
    { afiliacion: 'UDENAR', campo_formacion: '- Procesamiento de Señales\n- Machine Learning' },
    { afiliacion: 'EXTERNO', campo_formacion: 'Machine Learning + LLM' },
  ],
};

describe('Estadísticas administrativas (RF-ADM-05)', () => {
  const r = calcular(datos);
  const cerca = (v, esperado) => expect(v).toBeCloseTo(esperado, 4);

  it('porcentajes por promoción como en la hoja "Promociones y Estudiantes"', () => {
    const [I, II, VI] = r.promociones.filas;
    cerca(I.pct_egresados, 0.8181818);
    cerca(I.pct_retiros, 0.1818182);
    cerca(II.pct_graduados, 0.7777778);
    expect(VI.pct_egresados).toBeNull(); // aún no egresa
    expect(VI.poblacion_referencia).toBe(6); // último semestre aprobado
  });

  it('globales solo con promociones egresadas', () => {
    cerca(r.promociones.indicadores.pct_egresados, 18 / 27);
    expect(r.promociones.totales.inscritos).toBe(37);
  });

  it('relaciones de cursos y docentes por semestre', () => {
    const s1 = r.cursosDocentes.porSemestre[0];
    expect(s1.n_cursos).toBe(6);
    cerca(s1.relacion_udenar_externos, 4 / 7);
    cerca(s1.relacion_docentes_cursos, 11 / 6);
    expect(s1.creditos).toBe(12);
  });

  it('distribuye el saldo con los porcentajes parametrizados y omite saldos negativos', () => {
    const III = r.presupuesto.filas.find((f) => f.cohorte === 'III');
    const VI = r.presupuesto.filas.find((f) => f.cohorte === 'VI');
    cerca(III.transferencia_central, 13961541.6);
    cerca(III.fondo_investigaciones, 46538472);
    expect(VI.transferencia_central).toBeNull();
    expect(r.presupuesto.fecha_corte).toBe('2025-11-23');
  });

  it('aporte del pregrado frente a la viabilidad de la promoción', () => {
    cerca(r.pregrado.porCohorte[0].pct_aporte, 0.4594422850);
  });

  it('indicadores de contratación OPS', () => {
    expect(r.contrataciones.totales).toEqual({ n_ops: 4, valor: 28921461 });
    cerca(r.contrataciones.indicadores.promedio_valor_ops, 28921461 / 4);
  });

  it('producción y beneficios sobre la población de referencia', () => {
    cerca(r.produccion.filas[0].pct_poblacion, 12 / 9);
    expect(r.beneficios.filas[0].total).toBe(9);
  });

  it('docentes por afiliación y campo', () => {
    expect(r.docentes).toMatchObject({ total: 2, udenar: 1, externos: 1 });
    expect(r.docentes.porCampo[0]).toEqual({ campo: 'Machine Learning', cantidad: 2 });
  });

  it('desviación estándar muestral (STDEV de Excel)', () => {
    cerca(desviacion([10, 10, 10, 8, 6, 6]), 1.9663841605);
    expect(desviacion([5])).toBeNull();
  });

  it('población de referencia prioriza egresados', () => {
    expect(poblacionReferencia({ egresados: 7, aprobados_sem3: 8, matriculados: 9 })).toBe(7);
  });
});

describe('Validación de filas importadas', () => {
  const campos = [
    { name: 'periodo', label: 'Periodo', type: 'periodo', required: true },
    { name: 'valor', label: 'Valor', type: 'dinero', required: true },
    { name: 'n', label: 'N', type: 'entero' },
    { name: 'fecha', label: 'Fecha', type: 'fecha' },
    { name: 'afiliacion', label: 'Afiliación', type: 'enum', options: ['UDENAR', 'EXTERNO'] },
  ];

  it('normaliza formatos de Excel y del usuario', () => {
    const { valores, errores } = validarFila(campos, {
      periodo: '2024-a', valor: '1.234.567,89', n: 3, fecha: '23-11-2025', afiliacion: 'externo',
    });
    expect(errores).toEqual([]);
    expect(valores).toEqual({ periodo: '2024-A', valor: 1234567.89, n: 3, fecha: '2025-11-23', afiliacion: 'EXTERNO' });
  });

  it('reporta obligatorios y valores inválidos', () => {
    const { errores } = validarFila(campos, { periodo: '2024-C', n: 2.5 });
    expect(errores).toEqual([
      'Periodo: valor inválido "2024-C"',
      'Valor es obligatorio',
      'N: valor inválido "2.5"',
    ]);
  });
});
