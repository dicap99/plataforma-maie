// Fórmulas del Acuerdo 058 de 2022 (RF-EVAL-02 a RF-EVAL-04) contrastadas con el libro de Coordinación
// «Estadísticas Evaluación Docente MaIE.xlsx» (fixture sin nombres: tests/fixtures/evaluacionDocenteExcel.json,
// extraído con los porcentajes por pregunta de Google Forms y los valores calculados del libro).
// El fixture tiene resultados REALES de la evaluación docente: no se versiona (el repositorio es público).
// Se genera en el equipo de Coordinación desde el libro; sin él, estas pruebas se omiten con aviso.
const fs = require('fs');
const path = require('path');

const RUTA_EXCEL = path.join(__dirname, 'fixtures', 'evaluacionDocenteExcel.json');
const excel = fs.existsSync(RUTA_EXCEL) ? JSON.parse(fs.readFileSync(RUTA_EXCEL, 'utf8')) : null;
const conExcel = excel ? describe : describe.skip;
if (!excel) console.warn(`Pruebas con el libro de Coordinación omitidas: falta ${RUTA_EXCEL} (no versionado).`);
const {
  categorizar, categoria, indicadores, indicadoresExcel, contar, sumarConteos, conteoCountifExcel, idstD, resultadoFormulario,
  idsc, promedioIpPorCaracteristica, idstP, valoracionExtrema, filtrarExtremas, META_PCT,
} = require('../src/modules/evalDocente/acuerdo058');

const SIGLA = { 'Gran Fortaleza': 'GF', Fortaleza: 'F', 'Transición': 'T', Debilidad: 'D', 'Gran Debilidad': 'GD' };
const C_DOCENTE = ['1', '2', '3', '4', '5', '6'];

// Indicadores de una característica del Excel con cada método.
const metodoExcel = (c) => indicadoresExcel(c.preguntas);
const metodoAcuerdo = (c) => indicadores(sumarConteos(c.preguntas)); // porcentajes sumados ∝ repeticiones

describe('Categorías del %IP (RF-EVAL-03; Acuerdo 058, Art. 2)', () => {
  it.each([
    [100, 'Gran Fortaleza'], [80, 'Gran Fortaleza'], [79.99, 'Fortaleza'], [79.9, 'Fortaleza'], [60, 'Fortaleza'],
    [59.99, 'Transición'], [40, 'Transición'], [39.99, 'Debilidad'], [20, 'Debilidad'], [19.99, 'Gran Debilidad'], [0, 'Gran Debilidad'],
  ])('%IP %p → %s (límite inferior inclusivo, sin redondeo previo)', (ip, nombre) => {
    expect(categorizar(ip)).toBe(nombre);
  });

  it('79,95 no cae en un hueco entre 79,9 y 80,0: es Fortaleza', () => {
    expect(categoria(79.95).sigla).toBe('F');
  });

  it('rechaza valores fuera de rango y deja sin categoría el %IP indefinido', () => {
    expect(() => categorizar(101)).toThrow(RangeError);
    expect(() => categorizar(-1)).toThrow(RangeError);
    expect(categoria(null)).toBeNull();
  });
});

describe('%IP y %IN (RF-EVAL-02; considerandos del Acuerdo 058)', () => {
  it('IP = 1,5·MA + A; IN = 1,5·MI + I; %IP = IP/(IP+IN); NA no cuenta', () => {
    const r = indicadores(contar(['MA', 'MA', 'A', 'I', 'MI', 'NA', 'NA']));
    expect(r.ip).toBe(4); // 1,5·2 + 1
    expect(r.in).toBe(2.5); // 1,5·1 + 1
    expect(r.pct_ip).toBeCloseTo(61.538, 3);
    expect(r.pct_in).toBeCloseTo(38.462, 3);
    expect(r.pct_ip + r.pct_in).toBeCloseTo(100, 10);
    expect(r.sigla).toBe('F');
  });

  it('sin valoraciones MA/A/I/MI el %IP queda indefinido', () => {
    expect(indicadores(contar(['NA', 'NA']))).toMatchObject({ pct_ip: null, categoria: null });
  });

  it('rechaza valoraciones desconocidas', () => {
    expect(() => contar(['MA', 'X'])).toThrow(RangeError);
  });
});

conExcel('Libro de Coordinación: método del Excel (COUNTIF) frente al Acuerdo', () => {
  const bloques = excel.hojas.flatMap((h) => h.docentes.map((d) => ({ ...d, periodo: h.periodo })));

  it('el fixture tiene los 5 semestres y 51 bloques docente–promoción', () => {
    expect(excel.hojas.map((h) => h.periodo)).toEqual(['2022-A', '2022-B', '2023-A', '2023-B', '2024-A']);
    expect(bloques).toHaveLength(51);
  });

  it('conteoCountifExcel reproduce «Ocurrencias», «Indicador IP» y «Categoría IP» de TODAS las características del libro', () => {
    let comparadas = 0;
    for (const b of bloques) {
      for (const [c, datos] of Object.entries(b.caracteristicas)) {
        const r = metodoExcel(datos);
        if (datos.ip_excel === '#DIV/0!') {
          // 2024-A, D10: bloque sin valoraciones; el Excel divide por cero y la plataforma deja el %IP sin definir.
          expect(r).toMatchObject({ pct_ip: null, categoria: null });
        } else {
          expect(r.pct_ip).toBeCloseTo(datos.ip_excel, 9);
          expect(r.categoria).toBe(datos.categoria_excel);
        }
        for (const v of ['MA', 'A', 'I', 'MI']) expect(conteoCountifExcel(datos.preguntas)[v]).toBe(datos.ocurrencias_excel[v]);
        comparadas += 1;
        expect(c).toMatch(/^[0-6]$/);
      }
    }
    expect(comparadas).toBe(51 * 7);
  });

  it('celdas exactas del libro, hoja 2024-A: D2·C3 = 87,5; D2·C0 = 90,909…; IDST-D de D4–D9 = 1', () => {
    const h = excel.hojas[4];
    const d2 = h.docentes.find((d) => d.codigo === 'D2').caracteristicas;
    expect(metodoExcel(d2['3']).pct_ip).toBe(87.5);
    expect(metodoExcel(d2['0']).pct_ip).toBe(100 / 1.1); // 90,9090…
    expect(metodoExcel(d2['0']).pct_ip).toBe(d2['0'].ip_excel);
    for (const codigo of ['D4', 'D5', 'D6', 'D7', 'D8', 'D9']) {
      const cs = h.docentes.find((d) => d.codigo === codigo).caracteristicas;
      const caracteristicas = C_DOCENTE.map((c) => ({ cuenta_docente: true, ...metodoExcel(cs[c]) }));
      expect(idstD({ variables: [], caracteristicas }, 'caracteristica').valor).toBe(1);
    }
  });

  it('caso 2024-A, D2, C3: el Excel da 87,5 % y el Acuerdo ≈ 93,65 % (cuenta repeticiones, no preguntas)', () => {
    const c3 = excel.hojas[4].docentes.find((d) => d.codigo === 'D2').caracteristicas['3'];
    expect(metodoExcel(c3).pct_ip).toBe(87.5);
    expect(c3.ip_excel).toBe(87.5);
    // Porcentajes sumados: MA 375, A 175, I 50 → IP = 737,5; IN = 50.
    expect(metodoAcuerdo(c3).pct_ip).toBeCloseTo((737.5 / 787.5) * 100, 9);
    expect(metodoAcuerdo(c3).pct_ip).toBeCloseTo(93.65, 2);
  });

  it('el %IP del Acuerdo no cambia de escala: porcentajes por pregunta = repeticiones (4 estudiantes)', () => {
    const c3 = excel.hojas[4].docentes.find((d) => d.codigo === 'D2').caracteristicas['3'];
    const repeticiones = sumarConteos(c3.preguntas.map((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, (v * 4) / 100]))));
    expect(repeticiones).toEqual({ MA: 15, A: 7, I: 2, MI: 0, NA: 0 });
    expect(indicadores(repeticiones).pct_ip).toBeCloseTo(metodoAcuerdo(c3).pct_ip, 9);
  });

  it('muestra cuántas características cambian de valor y de categoría entre ambos métodos', () => {
    let distintas = 0;
    let cambiaCategoria = 0;
    let haciaArriba = 0;
    for (const b of bloques) {
      for (const c of C_DOCENTE) {
        const datos = b.caracteristicas[c];
        if (!datos.preguntas.length) continue;
        const e = metodoExcel(datos);
        const a = metodoAcuerdo(datos);
        if (Math.abs(e.pct_ip - a.pct_ip) > 1e-9) distintas += 1;
        if (e.sigla !== a.sigla) cambiaCategoria += 1;
        if (e.sigla !== a.sigla && a.pct_ip > e.pct_ip) haciaArriba += 1;
      }
    }
    // Valores medidos con el libro real; documentados en PENDIENTES.md §8.
    // De 306 características C1–C6 con datos, 87 cambian de valor y 24 de categoría, todas hacia arriba
    // (p. ej. la única Transición de 2022-A, D4·C5, pasa de 57,7 % a 75,0 %, Fortaleza).
    expect({ distintas, cambiaCategoria, haciaArriba }).toEqual({ distintas: 87, cambiaCategoria: 24, haciaArriba: 24 });
    const d4 = excel.hojas[0].docentes.find((d) => d.codigo === 'D4').caracteristicas['5'];
    expect(metodoExcel(d4).sigla).toBe('T');
    expect(metodoAcuerdo(d4)).toMatchObject({ sigla: 'F' });
    expect(metodoAcuerdo(d4).pct_ip).toBeCloseTo(75, 1); // porcentajes del libro redondeados a 0,1
  });

  it('IDST-D por característica (C1–C6 / 6) con el método del Excel reproduce la columna IDST-D del libro', () => {
    for (const h of excel.hojas) {
      for (const resumen of h.resumenes) {
        for (const fila of resumen.docentes) {
          const b = h.docentes.find((d) => d.codigo === fila.codigo);
          const caracteristicas = C_DOCENTE.map((c) => ({ cuenta_docente: true, ...metodoExcel(b.caracteristicas[c]) }));
          expect(caracteristicas.map((x) => x.sigla)).toEqual(fila.siglas);
          const r = idstD({ variables: [], caracteristicas }, 'caracteristica');
          expect(r.valor).toBeCloseTo(fila.idst_d_excel, 12);
        }
      }
    }
  });

  it('IDST-P de cada promoción = promedio de sus IDST-D, y el del semestre = promedio de las promociones (hoja IDST-P)', () => {
    for (const h of excel.hojas) {
      const porPromocion = h.resumenes.map((resumen) => {
        const valores = resumen.docentes.map((fila) => {
          const b = h.docentes.find((d) => d.codigo === fila.codigo);
          const cs = C_DOCENTE.map((c) => ({ cuenta_docente: true, ...metodoExcel(b.caracteristicas[c]) }));
          return idstD({ variables: [], caracteristicas: cs }, 'caracteristica').valor;
        });
        expect(idstP(valores)).toBeCloseTo(resumen.idst_p_excel, 12);
        return idstP(valores);
      });
      expect(idstP(porPromocion)).toBeCloseTo(excel.idst_p_semestre_excel[h.periodo], 12);
    }
  });

  it('promedio del %IP por característica (tabla 22 del indicador) reproduce la hoja IDST-P salvo el error de 2023-B', () => {
    const NOMBRES = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
    for (const h of excel.hojas) {
      const porPromocion = h.resumenes.map((resumen) => promedioIpPorCaracteristica(resumen.docentes.map((fila) => {
        const b = h.docentes.find((d) => d.codigo === fila.codigo);
        return { caracteristicas: C_DOCENTE.map((c) => ({ caracteristica: Number(c), nombre: c, cuenta_docente: true, ...metodoExcel(b.caracteristicas[c]) })) };
      })));
      NOMBRES.forEach((nombre, i) => {
        const valorExcel = excel.promedio_caracteristica_excel[nombre][h.periodo];
        if (h.periodo === '2023-B') {
          // Error del libro: K4:K9 promedian '2023-B'!F111 con 'IDST-P'!F136 (vacía), es decir, solo la 1.ª promoción.
          expect(porPromocion[0][i].promedio).toBeCloseTo(valorExcel, 9);
        } else {
          expect((porPromocion[0][i].promedio + porPromocion[1][i].promedio) / 2).toBeCloseTo(valorExcel, 9);
        }
      });
    }
  });

  it('valores publicados en Indicador_Docentes_Evaluados_MaIE.docx (IDST-P del semestre, 1 decimal)', () => {
    const publicados = { '2022-A': 98.6, '2022-B': 100, '2023-A': 100, '2023-B': 98.6, '2024-A': 100 };
    for (const [p, v] of Object.entries(publicados)) expect(Math.round(excel.idst_p_semestre_excel[p] * 1000) / 10).toBe(v);
  });
});

describe('Resultado de un formulario (EE) para una unidad evaluada', () => {
  // EE simplificado: característica 0 (del estudiante) y dos del docente.
  const preguntas = [
    { id_pregunta: 1, caracteristica: 0, nombre_caracteristica: 'Autoevaluación del estudiante', codigo: '0.1', orden: 1 },
    { id_pregunta: 2, caracteristica: 1, nombre_caracteristica: 'Cumplimiento del docente', codigo: '1.1', orden: 2 },
    { id_pregunta: 3, caracteristica: 1, nombre_caracteristica: 'Cumplimiento del docente', codigo: '1.2', orden: 3 },
    { id_pregunta: 4, caracteristica: 2, nombre_caracteristica: 'Conocimientos del docente', codigo: '2.1', orden: 4 },
  ];
  const resp = (v1, v2, v3, v4, comentario) => ({ items: { 1: v1, 2: v2, 3: v3, 4: v4 }, comentario });

  const respuestas = [
    resp('MI', 'MA', 'I', 'MA', 'Muy buen curso'),
    resp('MI', 'MA', 'I', 'A', '  '),
    resp('MI', 'A', 'MI', 'NA'),
  ];

  it('agrega por variable y por característica; la característica 0 no cuenta para el docente', () => {
    const r = resultadoFormulario(preguntas, respuestas);
    expect(r.respuestas).toBe(3);
    expect(r.variables.map((v) => v.codigo)).toEqual(['0.1', '1.1', '1.2', '2.1']);
    const c1 = r.caracteristicas.find((c) => c.caracteristica === 1);
    expect(c1.conteos).toEqual({ MA: 2, A: 1, I: 2, MI: 1, NA: 0 });
    expect(c1.pct_ip).toBeCloseTo((4 / (4 + 3.5)) * 100, 9);
    expect(r.caracteristicas.find((c) => c.caracteristica === 0)).toMatchObject({ cuenta_docente: false, sigla: 'GD' });
    // Global del docente: variables 1.1, 1.2 y 2.1 (sin la 0.1).
    expect(r.global.ip).toBe(1.5 * 3 + 2);
    expect(r.comentarios).toEqual(['Muy buen curso']);
  });

  it('IDST-D por variable (Acuerdo, por defecto) y por característica (Excel) sin la característica 0', () => {
    const r = resultadoFormulario(preguntas, respuestas);
    // Variables: 1.1 = 100 % (GF), 1.2 = 0 % (GD), 2.1 = 100 % (GF) → 2/3.
    expect(r.idst_d.por_variable).toEqual({ granularidad: 'variable', satisfactorias: 2, total: 3, valor: 2 / 3 });
    // C1 = 53,3 % (T), C2 = 100 % (GF) → 1/2.
    expect(r.idst_d.por_caracteristica).toEqual({ granularidad: 'caracteristica', satisfactorias: 1, total: 2, valor: 0.5 });
    expect(() => idstD(r, 'otra')).toThrow(RangeError);
  });

  it('cada característica trae el %IP del Excel como referencia, con su diferencia frente al oficial', () => {
    const r = resultadoFormulario(preguntas, respuestas);
    const c1 = r.caracteristicas.find((c) => c.caracteristica === 1);
    // Ocurrencias: MA en 1 pregunta (1.1), A en 1 (1.1), I en 1 (1.2), MI en 1 (1.2) → IP 2,5; IN 2,5 → 50 %.
    expect(c1.excel).toMatchObject({ ocurrencias: { MA: 1, A: 1, I: 1, MI: 1, NA: 0 }, pct_ip: 50, sigla: 'T' });
    expect(c1.excel.diferencia).toBeCloseTo(50 - c1.pct_ip, 12);
    // IDST-D de referencia (características con el método del Excel): C1 = T, C2 = GF → 1/2.
    expect(r.idst_d.excel.valor).toBe(0.5);
  });

  it('Parágrafo 2: valoración extrema = todas las variables del docente MA (o MI)', () => {
    expect(valoracionExtrema({ 1: 'MI', 2: 'MA', 3: 'MA', 4: 'MA' }, [2, 3, 4])).toBe('MA');
    expect(valoracionExtrema({ 2: 'MI', 3: 'MI', 4: 'MI' }, [2, 3, 4])).toBe('MI');
    expect(valoracionExtrema({ 2: 'MA', 3: 'NA', 4: 'MA' }, [2, 3, 4])).toBeNull();
  });

  it('Parágrafo 2: solo excluye si Coordinación lo activa y hay MÁS de 10 respuestas, e informa cuántas', () => {
    const extrema = resp('A', 'MA', 'MA', 'MA');
    const normal = resp('A', 'A', 'MA', 'I');
    const diez = [...Array(3).fill(extrema), ...Array(7).fill(normal)];
    const once = [...diez, normal];
    expect(filtrarExtremas(once, [2, 3, 4], { activa: false }).excluidas).toBe(0);
    expect(filtrarExtremas(diez, [2, 3, 4], { activa: true }).excluidas).toBe(0);
    expect(filtrarExtremas(once, [2, 3, 4], { activa: true })).toMatchObject({ excluidas: 3 });
    const r = resultadoFormulario(preguntas, once, { excluirExtremas: true });
    expect(r).toMatchObject({ respuestas: 8, excluidas: 3 });
  });
});

describe('Indicadores del programa (Art. 12, Parágrafo 1)', () => {
  const docente = (...siglas) => ({
    caracteristicas: siglas.map((s, i) => ({ caracteristica: i + 1, nombre: `C${i + 1}`, cuenta_docente: true, sigla: s, pct_ip: { GF: 90, F: 70, T: 50 }[s] })),
  });

  it('IDSC = docentes con GF o F en la característica / total de docentes', () => {
    const r = idsc([docente('GF', 'T'), docente('F', 'GF'), docente('T', 'GF'), docente('GF', null)]);
    expect(r).toEqual([
      { caracteristica: 1, nombre: 'C1', docentes: 4, satisfactorios: 3, valor: 0.75 },
      { caracteristica: 2, nombre: 'C2', docentes: 3, satisfactorios: 2, valor: 2 / 3 },
    ]);
  });

  it('promedio del %IP por característica e IDST-P (promedio de IDST-D); meta del indicador 90 %', () => {
    expect(promedioIpPorCaracteristica([docente('GF', 'T'), docente('F', 'GF')]).map((c) => c.promedio)).toEqual([80, 70]);
    expect(idstP([1, 0.5, null])).toBe(0.75);
    expect(idstP([])).toBeNull();
    expect(META_PCT).toBe(90);
  });

  it('las siglas del Excel coinciden con las categorías', () => {
    expect(Object.values(SIGLA)).toEqual(['GF', 'F', 'T', 'D', 'GD']);
  });
});
