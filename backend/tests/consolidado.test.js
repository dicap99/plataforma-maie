// Consolidado de un semestre (RF-EVAL-04) de punta a punta con datos reales: se reconstruyen respuestas
// individuales de la hoja 2024-A del Excel de Coordinación (mismas frecuencias por pregunta que los
// porcentajes de Google Forms) y el consolidado debe reproducir las celdas del libro con el método del
// Excel (referencia) y el %IP del Acuerdo (oficial).
// El fixture tiene resultados REALES de la evaluación docente: no se versiona (el repositorio es público).
// Se genera en el equipo de Coordinación desde el libro; sin él, estas pruebas se omiten con aviso.
const fs = require('fs');
const path = require('path');

const RUTA_EXCEL = path.join(__dirname, 'fixtures', 'evaluacionDocenteExcel.json');
const excel = fs.existsSync(RUTA_EXCEL) ? JSON.parse(fs.readFileSync(RUTA_EXCEL, 'utf8')) : null;
const conExcel = excel ? describe : describe.skip;
if (!excel) console.warn(`Pruebas con el libro de Coordinación omitidas: falta ${RUTA_EXCEL} (no versionado).`);
const { consolidar } = require('../src/modules/evalDocente/resultados/consolidado');
const { indicadores, sumarConteos, VALORES } = require('../src/modules/evalDocente/acuerdo058');

const hoja = excel?.hojas.find((h) => h.periodo === '2024-A');
const PREGUNTAS_POR_C = { 0: 4, 1: 4, 2: 4, 3: 6, 4: 4, 5: 5, 6: 3 }; // Art. 4 (formulario EE)

// Preguntas sintéticas del EE con la estructura del Acuerdo; id = c*10 + j.
const preguntas = Object.entries(PREGUNTAS_POR_C).flatMap(([c, n]) => Array.from({ length: n }, (_, j) => ({
  id_pregunta: Number(c) * 10 + j + 1, tipo_formulario: 'EE', caracteristica: Number(c), nombre_caracteristica: `C${c}`,
  codigo: `${c}.${j + 1}`, orden: Number(c) * 10 + j + 1,
})));

// Menor número de estudiantes que reproduce los porcentajes (redondeados a 0,1) de todas las preguntas.
const estudiantes = (bloque) => {
  for (let n = 1; n <= 40; n += 1) {
    const ok = Object.values(bloque.caracteristicas).every((c) => c.preguntas.every((f) => {
      const k = VALORES.map((v) => (f[v] * n) / 100);
      return k.every((x) => Math.abs(x - Math.round(x)) < 0.08) && k.reduce((s, x) => s + Math.round(x), 0) === n;
    }));
    if (ok) return n;
  }
  throw new Error(`No se pudo reconstruir ${bloque.codigo}`);
};

// Respuestas individuales con las mismas frecuencias por pregunta (el cálculo solo depende de ellas).
const respuestasDe = (bloque, idDocente, idCohorte) => {
  const n = estudiantes(bloque);
  const rs = Array.from({ length: n }, () => ({ tipo_formulario: 'EE', id_docente: idDocente, id_cohorte: idCohorte, poblacion: 'posgrado', items: {} }));
  for (const [c, datos] of Object.entries(bloque.caracteristicas)) {
    datos.preguntas.forEach((f, j) => {
      const valores = VALORES.flatMap((v) => Array(Math.round((f[v] * n) / 100)).fill(v));
      valores.forEach((v, i) => { rs[i].items[Number(c) * 10 + j + 1] = v; });
    });
  }
  return rs;
};

const unidades = [];
const respuestas = [];
(hoja?.resumenes ?? []).forEach((resumen, i) => {
  for (const fila of resumen.docentes) {
    const bloque = hoja.docentes.find((d) => d.codigo === fila.codigo);
    unidades.push({ id_docente: fila.codigo, docente: fila.codigo, id_cohorte: fila.promocion, cohorte: String(fila.promocion), cohorte_inicio: String(i) });
    respuestas.push(...respuestasDe(bloque, fila.codigo, fila.promocion));
  }
});
const r = hoja ? consolidar({ preguntas, unidades, respuestas }) : null;

conExcel('Consolidado 2024-A reconstruido desde el Excel de Coordinación', () => {
  it('por unidad: %IP del método del Excel = celda «Indicador IP»; oficial = Acuerdo sobre los porcentajes', () => {
    for (const u of r.unidades) {
      const bloque = hoja.docentes.find((d) => d.codigo === u.id_docente);
      for (const c of u.ee.caracteristicas) {
        const datos = bloque.caracteristicas[String(c.caracteristica)];
        expect(c.excel.pct_ip).toBeCloseTo(datos.ip_excel, 9);
        expect(c.excel.categoria).toBe(datos.categoria_excel);
        expect(c.pct_ip).toBeCloseTo(indicadores(sumarConteos(datos.preguntas)).pct_ip, 1);
      }
    }
  });

  it('IDST-D por característica con el método del Excel = columna IDST-D; IDST-P = celda de cada promoción y del semestre', () => {
    for (const u of r.unidades) {
      const fila = hoja.resumenes.flatMap((x) => x.docentes).find((d) => d.codigo === u.id_docente);
      expect(u.ee.idst_d.excel.valor).toBeCloseTo(fila.idst_d_excel, 12);
    }
    r.promociones.forEach((p, i) => expect(p.referencia_excel.idst_p).toBeCloseTo(hoja.resumenes[i].idst_p_excel, 12));
    expect(r.programa.referencia_excel.idst_p).toBeCloseTo(excel.idst_p_semestre_excel['2024-A'], 12);
  });

  it('promedio del %IP por característica (referencia) = hoja IDST-P, columna 2024-A', () => {
    for (const c of r.programa.referencia_excel.promedio_ip) {
      expect(c.promedio).toBeCloseTo(excel.promedio_caracteristica_excel[`C${c.caracteristica}`]['2024-A'], 9);
    }
    expect(r.programa.referencia_excel.promedio_ip.map((c) => c.caracteristica)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('oficial: IDST-D por variable y por característica, IDSC-Prom e IDSC-Prog del Acuerdo', () => {
    for (const u of r.unidades) {
      expect(u.ee.idst_d.por_variable.total).toBeGreaterThanOrEqual(26); // 30 variables − 4 de la característica 0
      expect(u.ee.idst_d.por_caracteristica.total).toBe(6);
    }
    expect(r.promociones.map((p) => p.docentes)).toEqual([3, 6]);
    for (const p of r.promociones) {
      expect(p.idsc.map((c) => c.docentes)).toEqual(Array(6).fill(p.docentes));
    }
    // Programa: 9 docentes distintos; ninguno tiene categorías bajo Fortaleza en 2024-A → IDSC-Prog = 1.
    expect(r.programa.docentes).toBe(9);
    expect(r.programa.idsc.every((c) => c.valor === 1)).toBe(true);
  });

  it('filtro de población (separados o unidos): pregrado sin respuestas deja el consolidado vacío', () => {
    const soloPregrado = consolidar({ preguntas, unidades, respuestas, poblacion: 'pregrado' });
    expect(soloPregrado.programa.respuestas_ee).toBe(0);
    expect(soloPregrado.unidades.every((u) => u.ee === null)).toBe(true);
  });
});
