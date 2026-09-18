// RF-ADM-05 — Cálculo de indicadores administrativos (funciones puras, sin BD).
// Reproducen las fórmulas de la hoja "Estadísticas MaIE" (totales, promedios, STDEV muestral y porcentajes).

const numeros = (valores) => valores.filter((v) => typeof v === 'number' && Number.isFinite(v));
const suma = (valores) => numeros(valores).reduce((a, b) => a + b, 0);
const promedio = (valores) => {
  const n = numeros(valores);
  return n.length ? suma(n) / n.length : null;
};
// Desviación estándar muestral (equivalente a STDEV de Excel).
const desviacion = (valores) => {
  const n = numeros(valores);
  if (n.length < 2) return null;
  const m = promedio(n);
  return Math.sqrt(n.reduce((a, v) => a + (v - m) ** 2, 0) / (n.length - 1));
};
const razon = (a, b) => (typeof a === 'number' && typeof b === 'number' && b !== 0 ? a / b : null);

// Totales / promedio / desviación de las columnas indicadas.
const resumenColumnas = (filas, columnas) => ({
  totales: Object.fromEntries(columnas.map((c) => [c, suma(filas.map((f) => f[c]))])),
  promedio: Object.fromEntries(columnas.map((c) => [c, promedio(filas.map((f) => f[c]))])),
  desviacion: Object.fromEntries(columnas.map((c) => [c, desviacion(filas.map((f) => f[c]))])),
});

// Población de referencia de una promoción: egresados si ya egresó; si no, el último semestre aprobado
// reportado; si no, los matriculados. Se usa para los "% sobre población estudiantil".
const poblacionReferencia = (c) =>
  [c.egresados, c.aprobados_sem3, c.aprobados_sem2, c.aprobados_sem1, c.matriculados].find(
    (v) => typeof v === 'number',
  ) ?? null;

const promociones = (cohortes) => {
  const filas = cohortes.map((c) => {
    const pctEgresados = c.egresados === null ? null : razon(c.egresados, c.matriculados);
    return {
      ...c,
      poblacion_referencia: poblacionReferencia(c),
      pct_egresados: pctEgresados,
      pct_graduados: razon(c.graduados, c.egresados),
      pct_retiros: pctEgresados === null ? null : 1 - pctEgresados,
    };
  });
  const cols = ['inscritos', 'matriculados', 'aprobados_sem1', 'aprobados_sem2', 'aprobados_sem3', 'egresados', 'graduados'];
  const r = resumenColumnas(filas, cols);
  // Los porcentajes globales solo consideran promociones que ya egresaron.
  const egresadas = filas.filter((f) => f.egresados !== null);
  const pctEgresados = razon(suma(egresadas.map((f) => f.egresados)), suma(egresadas.map((f) => f.matriculados)));
  return {
    filas,
    ...r,
    indicadores: {
      pct_egresados: pctEgresados,
      pct_graduados: razon(suma(egresadas.map((f) => f.graduados)), suma(egresadas.map((f) => f.egresados))),
      pct_retiros: pctEgresados === null ? null : 1 - pctEgresados,
      promedio_pct_egresados: promedio(egresadas.map((f) => f.pct_egresados)),
      poblacion_total: suma(filas.map((f) => f.poblacion_referencia)),
    },
  };
};

const puntoEquilibrio = (filas) => ({
  filas,
  ...resumenColumnas(filas, ['estudiantes_equilibrio', 'valor_matricula_smmlv', 'ingresos_proyectados']),
});

const cursosDocentes = (filas, parametros) => {
  const porSemestre = [1, 2, 3, 4].map((semestre) => {
    const del = filas.filter((f) => f.semestre === semestre);
    const cursos = suma(del.map((f) => f.n_cursos));
    const udenar = suma(del.map((f) => f.docentes_udenar));
    const externos = suma(del.map((f) => f.docentes_externos));
    return {
      semestre,
      n_cursos: cursos,
      docentes_udenar: udenar,
      docentes_externos: externos,
      promedio_cursos: promedio(del.map((f) => f.n_cursos)),
      relacion_udenar_externos: razon(udenar, externos),
      relacion_docentes_cursos: razon(udenar + externos, cursos),
      creditos: parametros[`creditos_semestre_${semestre}`] ?? null,
    };
  });
  const cursos = suma(porSemestre.map((s) => s.n_cursos));
  const udenar = suma(porSemestre.map((s) => s.docentes_udenar));
  const externos = suma(porSemestre.map((s) => s.docentes_externos));

  // Totales por promoción (las 4 columnas "Totales" de la hoja)
  const porCohorte = Object.values(
    filas.reduce((acc, f) => {
      const a = (acc[f.id_cohorte] ??= { id_cohorte: f.id_cohorte, cohorte: f.cohorte, n_cursos: 0, docentes_udenar: 0, docentes_externos: 0 });
      a.n_cursos += f.n_cursos;
      a.docentes_udenar += f.docentes_udenar;
      a.docentes_externos += f.docentes_externos;
      return acc;
    }, {}),
  );

  return {
    porSemestre,
    porCohorte,
    totales: {
      n_cursos: cursos,
      docentes_udenar: udenar,
      docentes_externos: externos,
      relacion_udenar_externos: razon(udenar, externos),
      relacion_docentes_cursos: razon(udenar + externos, cursos),
      creditos: suma(porSemestre.map((s) => s.creditos)),
    },
  };
};

// Presupuesto: toma el corte más reciente de cada promoción y completa la distribución del saldo
// con los porcentajes parametrizados cuando no fue registrada.
const presupuesto = (filas, parametros) => {
  const ultimoPorCohorte = Object.values(
    filas.reduce((acc, f) => {
      if (!acc[f.id_cohorte] || f.fecha_corte > acc[f.id_cohorte].fecha_corte) acc[f.id_cohorte] = f;
      return acc;
    }, {}),
  );
  const pct = {
    transferencia_central: parametros.pct_transferencia_central,
    transferencia_viis: parametros.pct_transferencia_viis,
    fondo_investigaciones: parametros.pct_fondo_investigaciones,
    unidad_academica: parametros.pct_unidad_academica,
  };
  const resultado = ultimoPorCohorte.map((f) => {
    const distribucion = Object.fromEntries(
      Object.entries(pct).map(([campo, p]) => {
        if (typeof f[campo] === 'number') return [campo, f[campo]];
        const base = f.saldo_certificado ?? f.saldo_comprometido;
        return [campo, base > 0 && typeof p === 'number' ? (base * p) / 100 : null];
      }),
    );
    return { ...f, ...distribucion, pct_ejecucion: razon(f.gastos_comprometidos, f.ingresos) };
  });
  const cols = ['ingresos', 'gastos_comprometidos', 'saldo_comprometido', 'saldo_certificado', ...Object.keys(pct)];
  const r = resumenColumnas(resultado, cols);
  return {
    fecha_corte: resultado.reduce((max, f) => (max === null || f.fecha_corte > max ? f.fecha_corte : max), null),
    filas: resultado,
    ...r,
    indicadores: { pct_ejecucion: razon(r.totales.gastos_comprometidos, r.totales.ingresos) },
  };
};

const pregrado = (filas, equilibrio) => {
  const ingresoProyectado = new Map(equilibrio.map((e) => [e.id_cohorte, e.ingresos_proyectados]));
  const porCohorte = Object.values(
    filas.reduce((acc, f) => {
      const a = (acc[f.id_cohorte] ??= { id_cohorte: f.id_cohorte, cohorte: f.cohorte, estudiantes: 0, inscripciones: 0, ingreso: 0 });
      a.estudiantes += f.estudiantes;
      a.inscripciones += f.inscripciones;
      a.ingreso += f.ingreso;
      return acc;
    }, {}),
  ).map((c) => ({
    ...c,
    ingresos_proyectados: ingresoProyectado.get(c.id_cohorte) ?? null,
    pct_aporte: razon(c.ingreso, ingresoProyectado.get(c.id_cohorte)),
  }));
  const porPeriodo = Object.values(
    filas.reduce((acc, f) => {
      const a = (acc[f.periodo] ??= { periodo: f.periodo, estudiantes: 0, inscripciones: 0, ingreso: 0 });
      a.estudiantes += f.estudiantes;
      a.inscripciones += f.inscripciones;
      a.ingreso += f.ingreso;
      return acc;
    }, {}),
  ).sort((a, b) => a.periodo.localeCompare(b.periodo));
  const r = resumenColumnas(porCohorte, ['estudiantes', 'inscripciones', 'ingreso']);
  return {
    porCohorte,
    porPeriodo,
    ...r,
    indicadores: {
      pct_aporte: razon(r.totales.ingreso, suma(porCohorte.map((c) => c.ingresos_proyectados))),
      promedio_estudiantes_periodo: promedio(porPeriodo.map((p) => p.estudiantes)),
      promedio_inscripciones_periodo: promedio(porPeriodo.map((p) => p.inscripciones)),
      promedio_ingreso_periodo: promedio(porPeriodo.map((p) => p.ingreso)),
    },
  };
};

const porPeriodo = (filas, campoCantidad) => ({
  filas,
  totales: { [campoCantidad]: suma(filas.map((f) => f[campoCantidad])), valor: suma(filas.map((f) => f.valor)) },
  promedio: { valor: promedio(filas.map((f) => f.valor)) },
});

const contrataciones = (filas, ingresosProyectadosTotales) => {
  const base = porPeriodo(filas, 'n_ops');
  return {
    ...base,
    indicadores: {
      pct_ejecucion_ingresos: razon(base.totales.valor, ingresosProyectadosTotales),
      promedio_valor_ops: razon(base.totales.valor, base.totales.n_ops),
    },
  };
};

// Hojas por promoción con conteos (beneficios, producción, pasantías): total por fila y % sobre población.
const conteosPorCohorte = (filas, columnas, poblacion) => {
  const conTotal = filas.map((f) => {
    const total = suma(columnas.map((c) => f[c]));
    return { ...f, total, pct_poblacion: razon(total, poblacion.get(f.id_cohorte)) };
  });
  const r = resumenColumnas(conTotal, [...columnas, 'total']);
  const poblacionTotal = suma(conTotal.map((f) => poblacion.get(f.id_cohorte)));
  return {
    filas: conTotal,
    ...r,
    pct_poblacion: Object.fromEntries([...columnas, 'total'].map((c) => [c, razon(r.totales[c], poblacionTotal)])),
  };
};

const docentes = (filas) => {
  const porCampo = {};
  for (const d of filas) {
    for (const campo of String(d.campo_formacion ?? 'Sin registrar').split(/\n|,|\s-\s|\+/)) {
      const nombre = campo.replace(/^[-•\s]+/, '').trim();
      if (nombre) porCampo[nombre] = (porCampo[nombre] ?? 0) + 1;
    }
  }
  return {
    total: filas.length,
    udenar: filas.filter((d) => d.afiliacion === 'UDENAR').length,
    externos: filas.filter((d) => d.afiliacion === 'EXTERNO').length,
    porCampo: Object.entries(porCampo)
      .map(([campo, cantidad]) => ({ campo, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad),
  };
};

// Consolida todas las secciones. `datos` = filas de cada recurso tal como las devuelve su repositorio.
const calcular = (datos) => {
  const parametros = Object.fromEntries(datos.parametros.map((p) => [p.clave, p.valor]));
  const prom = promociones(datos.cohortes);
  const poblacion = new Map(prom.filas.map((f) => [f.id_cohorte, f.poblacion_referencia]));
  const equilibrio = puntoEquilibrio(datos['punto-equilibrio']);
  return {
    promociones: prom,
    puntoEquilibrio: equilibrio,
    cursosDocentes: cursosDocentes(datos['cohorte-semestres'], parametros),
    presupuesto: presupuesto(datos.presupuesto, parametros),
    pregrado: pregrado(datos.pregrado, datos['punto-equilibrio']),
    transferencias: porPeriodo(datos.transferencias, 'n_docentes'),
    contrataciones: contrataciones(datos.contrataciones, equilibrio.totales.ingresos_proyectados),
    beneficios: conteosPorCohorte(
      datos.beneficios,
      ['becas_100', 'becas_hora_catedra', 'becas_sintraunicol', 'asistentes_investigacion', 'ayudantes_docencia'],
      poblacion,
    ),
    produccion: conteosPorCohorte(datos.produccion, ['articulos', 'ponencias', 'software', 'prototipos', 'tesis'], poblacion),
    pasantias: conteosPorCohorte(datos.pasantias, ['nacionales', 'internacionales'], poblacion),
    docentes: docentes(datos.docentes),
    parametros,
  };
};

module.exports = { calcular, presupuesto, suma, promedio, desviacion, poblacionReferencia };
