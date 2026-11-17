// RF-EVAL-02 a RF-EVAL-04 — Consolidado de un semestre (función pura): resultados por unidad evaluada
// (docente en una promoción), por promoción y del programa, como el informe del Art. 12.
// Decisiones del usuario (2026-11-16): EE, EC y AE por separado (sin pesos ni resultado combinado);
// %IP oficial del Acuerdo con el del Excel como referencia; IDST-D por variable y por característica;
// IDSC del Acuerdo con el promedio del %IP y el IDST-P del Excel como referencia.
const {
  resultadoFormulario, idsc, promedioIpPorCaracteristica, idstP, META_PCT,
} = require('../acuerdo058');

const POBLACION_FILTRO = ['todas', 'posgrado', 'pregrado'];
const comparar = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const clave = (idDocente, idCohorte) => `${idDocente}|${idCohorte}`;

// Características con el %IP del método del Excel en lugar del oficial (para la referencia histórica).
const comoExcel = (caracteristicas) => caracteristicas.map((c) => ({ ...c, pct_ip: c.excel.pct_ip, sigla: c.excel.sigla }));

// Promedio de varios promedios por característica (hoja IDST-P del Excel: promedio de las promociones).
const promedioDePromedios = (listas) => promedioIpPorCaracteristica(listas.map((l) => ({
  caracteristicas: l.map((c) => ({ ...c, cuenta_docente: true, pct_ip: c.promedio })),
}))).map(({ docentes, ...c }) => ({ ...c, promociones: docentes }));

// Resumen de un conjunto de unidades con EE (una promoción).
const resumenDe = (us) => ({
  docentes: us.length,
  idst_p: {
    por_variable: idstP(us.map((u) => u.ee.idst_d.por_variable.valor)),
    por_caracteristica: idstP(us.map((u) => u.ee.idst_d.por_caracteristica.valor)),
  },
  idsc: idsc(us.map((u) => ({ caracteristicas: u.ee.caracteristicas }))),
  promedio_ip: promedioIpPorCaracteristica(us.map((u) => ({ caracteristicas: u.ee.caracteristicas }))),
  referencia_excel: {
    idst_p: idstP(us.map((u) => u.ee.idst_d.excel.valor)),
    promedio_ip: promedioIpPorCaracteristica(us.map((u) => ({ caracteristicas: comoExcel(u.ee.caracteristicas) }))),
  },
});

// preguntas: todas las activas (los tres formularios); unidades: unidadesDelPeriodo + las que solo
// aparecen en respuestas; respuestas: [{ tipo_formulario, id_docente, id_cohorte, poblacion, comentario, items }]
// config: { excluir_extremas }; poblacion: 'todas' | 'posgrado' | 'pregrado' (solo afecta al EE).
const consolidar = ({ preguntas, unidades, respuestas, config = {}, poblacion = 'todas' }) => {
  const opciones = { excluirExtremas: Boolean(config.excluir_extremas) };
  const deTipo = (tipo) => preguntas.filter((p) => p.tipo_formulario === tipo);
  const formularios = { EE: deTipo('EE'), EC: deTipo('EC'), AE: deTipo('AE') };

  const mapa = new Map(unidades.map((u) => [clave(u.id_docente, u.id_cohorte), { ...u, EE: [], EC: [], AE: [] }]));
  for (const r of respuestas) {
    if (r.tipo_formulario === 'EE' && poblacion !== 'todas' && r.poblacion !== poblacion) continue;
    const u = mapa.get(clave(r.id_docente, r.id_cohorte));
    if (u) u[r.tipo_formulario].push(r);
  }

  const resultadoUnidades = [...mapa.values()]
    .sort((a, b) => comparar(a.cohorte_inicio, b.cohorte_inicio) || comparar(a.docente, b.docente))
    .map(({ EE, EC, AE, ...u }) => ({
      ...u,
      poblaciones: { posgrado: EE.filter((r) => r.poblacion === 'posgrado').length, pregrado: EE.filter((r) => r.poblacion === 'pregrado').length },
      ee: EE.length ? resultadoFormulario(formularios.EE, EE, opciones) : null,
      // EC y AE son de una sola persona: el Parágrafo 2 (extremas) no aplica.
      ec: EC.length ? resultadoFormulario(formularios.EC, EC) : null,
      ae: AE.length ? resultadoFormulario(formularios.AE, AE) : null,
    }));

  const conEE = resultadoUnidades.filter((u) => u.ee && u.ee.respuestas > 0);

  // Por promoción (IDSC-Prom e IDST-P de la promoción).
  const grupos = [];
  for (const u of conEE) {
    let p = grupos.find((x) => x.id_cohorte === u.id_cohorte);
    if (!p) {
      p = { id_cohorte: u.id_cohorte, cohorte: u.cohorte, cohorte_inicio: u.cohorte_inicio, unidades: [] };
      grupos.push(p);
    }
    p.unidades.push(u);
  }
  const promociones = grupos
    .sort((a, b) => comparar(a.cohorte_inicio, b.cohorte_inicio))
    .map(({ unidades: us, ...p }) => ({ ...p, ...resumenDe(us) }));

  // Programa (IDSC-Prog): un docente con varias promociones cuenta una vez, con todas sus respuestas EE
  // del semestre juntas.
  const porDocente = new Map();
  for (const u of mapa.values()) {
    const ee = u.EE;
    if (!ee.length) continue;
    if (!porDocente.has(u.id_docente)) porDocente.set(u.id_docente, []);
    porDocente.get(u.id_docente).push(...ee);
  }
  const docentesPrograma = [...porDocente.values()].map((rs) => resultadoFormulario(formularios.EE, rs, opciones));

  return {
    configuracion: { ...opciones, poblacion, meta_pct: META_PCT },
    unidades: resultadoUnidades,
    promociones,
    programa: {
      docentes: docentesPrograma.length,
      // Semestre: promedio de los IDST-P de las promociones (hoja IDST-P del Excel, «Promedio promociones»).
      idst_p: {
        por_variable: idstP(promociones.map((p) => p.idst_p.por_variable)),
        por_caracteristica: idstP(promociones.map((p) => p.idst_p.por_caracteristica)),
      },
      idsc: idsc(docentesPrograma.map((d) => ({ caracteristicas: d.caracteristicas }))),
      promedio_ip: promedioDePromedios(promociones.map((p) => p.promedio_ip)),
      referencia_excel: {
        idst_p: idstP(promociones.map((p) => p.referencia_excel.idst_p)),
        promedio_ip: promedioDePromedios(promociones.map((p) => p.referencia_excel.promedio_ip)),
      },
      respuestas_ee: conEE.reduce((s, u) => s + u.ee.respuestas, 0),
      excluidas: conEE.reduce((s, u) => s + u.ee.excluidas, 0),
    },
  };
};

module.exports = { consolidar, POBLACION_FILTRO };
