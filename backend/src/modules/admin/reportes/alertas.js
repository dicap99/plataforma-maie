// RF-ADM-05 — Alertas del Panel general del coordinador (funciones puras, sin BD).
// Tipos acordados en la reunión de avances del 20-oct-2026: evaluación docente próxima o en curso,
// plazos de titulación por promoción, corte presupuestal desactualizado y datos por actualizar.
// Cada alerta: { nivel: 'critico'|'atencion'|'info', tipo, titulo, detalle, enlace?, items? }.

const DIA = 86_400_000;
const NIVELES = ['critico', 'atencion', 'info'];
const PLAZO_SUSTENTACION_ANIOS = 3; // valor por defecto si falta el parámetro
// Corte presupuestal: a partir de un trimestre conviene avisar; desde medio año deja de servir.
const DIAS_CORTE_ATENCION = 90;
const DIAS_CORTE_CRITICO = 180;
// Evaluación docente: se avisa con un mes de anticipación y es crítica en su última semana.
const DIAS_AVISO_EVALUACION = 30;
const DIAS_CIERRE_CRITICO = 7;

const periodoDe = (fecha) => `${fecha.getFullYear()}-${fecha.getMonth() < 6 ? 'A' : 'B'}`;
// Último día de un periodo académico AAAA-A (30-jun) / AAAA-B (31-dic).
const finDePeriodo = (periodo) => {
  const anio = Number(periodo.slice(0, 4));
  return periodo.endsWith('A') ? new Date(anio, 5, 30) : new Date(anio, 11, 31);
};
// Fecha AAAA-MM-DD en hora local (toISOString la correría a UTC).
const iso = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
const sumarAnios = (fecha, anios) => new Date(fecha.getFullYear() + anios, fecha.getMonth(), fecha.getDate());
const dias = (desde, hasta) => Math.ceil((hasta - desde) / DIA);
const meses = (desde, hasta) =>
  (hasta.getFullYear() - desde.getFullYear()) * 12 + hasta.getMonth() - desde.getMonth() - (hasta.getDate() < desde.getDate() ? 1 : 0);
const peor = (niveles) => NIVELES.find((n) => niveles.includes(n)) ?? 'info';
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Evaluación docente: periodo activo en curso o próximo a abrir; si el semestre no tiene periodo, se recuerda.
const evaluacionDocente = (periodos, hoy) => {
  const activos = periodos.filter((p) => p.activo !== false);
  const enCurso = activos.find((p) => new Date(p.fecha_apertura) <= hoy && hoy <= new Date(p.fecha_cierre));
  if (enCurso) {
    const restan = dias(hoy, new Date(enCurso.fecha_cierre));
    return {
      nivel: restan <= DIAS_CIERRE_CRITICO ? 'critico' : 'atencion',
      tipo: 'evaluacion_docente',
      titulo: `Evaluación docente ${enCurso.codigo_periodo} en curso`,
      detalle: `Cierra en ${plural(restan, 'día', 'días')} (${iso(new Date(enCurso.fecha_cierre))}).`,
    };
  }
  const proxima = activos
    .filter((p) => new Date(p.fecha_apertura) > hoy)
    .sort((a, b) => new Date(a.fecha_apertura) - new Date(b.fecha_apertura))[0];
  if (proxima && dias(hoy, new Date(proxima.fecha_apertura)) <= DIAS_AVISO_EVALUACION) {
    return {
      nivel: 'atencion',
      tipo: 'evaluacion_docente',
      titulo: `Se acerca la evaluación docente ${proxima.codigo_periodo}`,
      detalle: `Abre en ${plural(dias(hoy, new Date(proxima.fecha_apertura)), 'día', 'días')}. Verifique la asignación de docentes y cursos del semestre.`,
    };
  }
  const actual = periodoDe(hoy);
  if (!proxima && !periodos.some((p) => p.codigo_periodo === actual)) {
    return {
      nivel: 'atencion',
      tipo: 'evaluacion_docente',
      titulo: `Evaluación docente ${actual} sin programar`,
      detalle: `El semestre termina el ${iso(finDePeriodo(actual))}. Defina las fechas de apertura y cierre de la evaluación (Acuerdo 058).`,
    };
  }
  return null;
};

// Plazo legal para sustentar: desde el fin de la promoción (periodo_fin) más el plazo parametrizado.
// Una sola alerta con un renglón por promoción que aún tiene egresados sin graduar.
const plazosTitulacion = (cohortes, plazoAnios, hoy) => {
  const items = cohortes
    .filter((c) => typeof c.egresados === 'number' && c.egresados > (c.graduados ?? 0) && c.periodo_fin)
    .map((c) => {
      const limite = sumarAnios(finDePeriodo(c.periodo_fin), plazoAnios);
      const restantes = meses(hoy, limite);
      const vencido = limite < hoy;
      return {
        promocion: c.nombre ?? c.cohorte,
        pendientes: c.egresados - (c.graduados ?? 0),
        limite: iso(limite),
        meses_restantes: vencido ? 0 : restantes,
        vencido,
        nivel: vencido || restantes < 6 ? 'critico' : restantes < 12 ? 'atencion' : 'info',
      };
    });
  if (items.length === 0) return null;
  const pendientes = items.reduce((s, i) => s + i.pendientes, 0);
  return {
    nivel: peor(items.map((i) => i.nivel)),
    tipo: 'titulacion',
    titulo: 'Plazos de titulación por promoción',
    detalle: `${plural(pendientes, 'egresado', 'egresados')} sin sustentar. Plazo legal: ${plural(plazoAnios, 'año', 'años')} desde el fin de la promoción.`,
    enlace: { a: 'datos', texto: 'Ver promociones' },
    items,
  };
};

const cortePresupuestal = (fechaCorte, hoy) => {
  if (!fechaCorte) {
    return {
      nivel: 'critico',
      tipo: 'presupuesto',
      titulo: 'Presupuesto sin fecha de corte',
      detalle: 'Ninguna promoción tiene corte registrado. Cargue el informe de la Oficina de Presupuesto.',
      enlace: { a: 'presupuesto', texto: 'Ver presupuesto' },
    };
  }
  const antiguedad = Math.floor((hoy - new Date(fechaCorte)) / DIA);
  if (antiguedad <= DIAS_CORTE_ATENCION) return null;
  return {
    nivel: antiguedad > DIAS_CORTE_CRITICO ? 'critico' : 'atencion',
    tipo: 'presupuesto',
    titulo: `Presupuesto con corte al ${String(fechaCorte).slice(0, 10)}`,
    detalle: `Última actualización hace ${antiguedad} días. Descargue los reportes de la universidad y actualice el corte.`,
    enlace: { a: 'presupuesto', texto: 'Ver presupuesto' },
  };
};

// Datos por actualizar: promociones que ya terminaron sin egresados registrados y SMMLV de un año anterior.
const datosPorActualizar = (cohortes, parametros, hoy) => {
  const actual = periodoDe(hoy);
  const sinCerrar = cohortes.filter((c) => c.egresados === null && c.periodo_fin && c.periodo_fin < actual);
  const anioSmmlv = Object.keys(parametros).filter((k) => /^smmlv_\d{4}$/.test(k)).map((k) => Number(k.slice(6))).sort().at(-1);
  const pendientes = [
    ...sinCerrar.map((c) => `Promoción ${c.nombre ?? c.cohorte}: terminó en ${c.periodo_fin} y no tiene egresados registrados.`),
    ...(anioSmmlv && anioSmmlv < hoy.getFullYear() ? [`SMMLV registrado hasta ${anioSmmlv}; falta el de ${hoy.getFullYear()}.`] : []),
  ];
  if (pendientes.length === 0) return null;
  return {
    nivel: 'atencion',
    tipo: 'datos',
    titulo: 'Datos del programa por actualizar',
    detalle: pendientes.join(' '),
    enlace: { a: 'gestion', texto: 'Actualizar datos' },
  };
};

// `estadisticas` = resultado de estadisticas.calcular(); `periodosEvaluacion` = filas de evaluacion_periodos.
const calcular = (estadisticas, periodosEvaluacion = [], hoy = new Date()) => {
  const { promociones, presupuesto, parametros } = estadisticas;
  const plazo = Number(parametros.plazo_sustentacion_anios) || PLAZO_SUSTENTACION_ANIOS;
  return [
    evaluacionDocente(periodosEvaluacion, hoy),
    plazosTitulacion(promociones.filas, plazo, hoy),
    cortePresupuestal(presupuesto.fecha_corte, hoy),
    datosPorActualizar(promociones.filas, parametros, hoy),
  ]
    .filter(Boolean)
    .sort((a, b) => NIVELES.indexOf(a.nivel) - NIVELES.indexOf(b.nivel));
};

module.exports = { calcular, finDePeriodo, periodoDe };
