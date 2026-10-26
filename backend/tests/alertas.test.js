// Alertas del Panel general (reunión de avances 20-oct-2026).
const { calcular, finDePeriodo } = require('../src/modules/admin/reportes/alertas');

const HOY = new Date(2026, 9, 26); // 26-oct-2026

const base = (cambios = {}) => ({
  promociones: {
    filas: [
      { nombre: 'I', periodo_fin: '2019-B', egresados: 9, graduados: 9 },
      { nombre: 'II', periodo_fin: '2023-B', egresados: 9, graduados: 8 },
      { nombre: 'V', periodo_fin: '2025-A', egresados: 10, graduados: 4 },
      { nombre: 'VI', periodo_fin: '2027-A', egresados: null, graduados: 0 },
    ],
  },
  presupuesto: { fecha_corte: '2026-09-30' },
  parametros: { plazo_sustentacion_anios: 3, smmlv_2026: 1750905 },
  ...cambios,
});
const tipo = (alertas, t) => alertas.find((a) => a.tipo === t);

describe('Alertas del Panel general', () => {
  it('fin de periodo académico', () => {
    expect(finDePeriodo('2023-A')).toEqual(new Date(2023, 5, 30));
    expect(finDePeriodo('2023-B')).toEqual(new Date(2023, 11, 31));
  });

  it('plazo de titulación: un renglón por promoción con egresados sin graduar', () => {
    const t = tipo(calcular(base(), [], HOY), 'titulacion');
    expect(t.items.map((i) => i.promocion)).toEqual(['II', 'V']);
    const [II, V] = t.items;
    expect(II).toMatchObject({ pendientes: 1, limite: '2026-12-31', vencido: false, meses_restantes: 2, nivel: 'critico' });
    expect(V).toMatchObject({ pendientes: 6, limite: '2028-06-30', nivel: 'info' });
    expect(t.nivel).toBe('critico');
  });

  it('el plazo es parametrizable', () => {
    const t = tipo(calcular(base({ parametros: { plazo_sustentacion_anios: 2, smmlv_2026: 1 } }), [], HOY), 'titulacion');
    expect(t.items[0]).toMatchObject({ promocion: 'II', vencido: true, meses_restantes: 0 });
  });

  it('evaluación docente en curso, próxima o sin programar', () => {
    const enCurso = [{ codigo_periodo: '2026-B', fecha_apertura: new Date(2026, 9, 20), fecha_cierre: new Date(2026, 10, 1), activo: true }];
    expect(tipo(calcular(base(), enCurso, HOY), 'evaluacion_docente')).toMatchObject({ nivel: 'critico', titulo: expect.stringContaining('en curso') });

    const proxima = [{ codigo_periodo: '2026-B', fecha_apertura: new Date(2026, 10, 10), fecha_cierre: new Date(2026, 10, 30), activo: true }];
    expect(tipo(calcular(base(), proxima, HOY), 'evaluacion_docente').titulo).toMatch(/Se acerca/);

    expect(tipo(calcular(base(), [], HOY), 'evaluacion_docente').titulo).toMatch(/2026-B sin programar/);
  });

  it('corte presupuestal: sin aviso al día, crítico tras medio año o sin fecha', () => {
    expect(tipo(calcular(base(), [], HOY), 'presupuesto')).toBeUndefined();
    expect(tipo(calcular(base({ presupuesto: { fecha_corte: '2025-11-23' } }), [], HOY), 'presupuesto').nivel).toBe('critico');
    expect(tipo(calcular(base({ presupuesto: { fecha_corte: null } }), [], HOY), 'presupuesto').nivel).toBe('critico');
  });

  it('datos por actualizar: promoción terminada sin egresados y SMMLV de un año anterior', () => {
    const datos = base({
      parametros: { smmlv_2025: 1423500 },
      promociones: { filas: [{ nombre: 'IV', periodo_fin: '2025-B', egresados: null, graduados: 0 }] },
    });
    const d = tipo(calcular(datos, [], HOY), 'datos');
    expect(d.detalle).toMatch(/Promoción IV/);
    expect(d.detalle).toMatch(/falta el de 2026/);
  });

  it('ordenadas de la más grave a la menos grave', () => {
    const niveles = calcular(base({ presupuesto: { fecha_corte: null } }), [], HOY).map((a) => a.nivel);
    expect(niveles).toEqual([...niveles].sort((a, b) => ['critico', 'atencion', 'info'].indexOf(a) - ['critico', 'atencion', 'info'].indexOf(b)));
  });
});
