const ExcelJS = require('exceljs');
const { consolidar } = require('../src/modules/evalDocente/resultados/consolidado');
const informes = require('../src/modules/evalDocente/resultados/informes');

describe('Informes del Módulo 3 (Acuerdo 058, sin método Excel de referencia)', () => {
  const preguntas = [
    { id_pregunta: 1, tipo_formulario: 'EE', caracteristica: 0, nombre_caracteristica: 'Autoevaluación del estudiante', codigo: '0.1', orden: 1 },
    { id_pregunta: 2, tipo_formulario: 'EE', caracteristica: 1, nombre_caracteristica: 'Competencia pedagógica', codigo: '1.1', orden: 2 },
    { id_pregunta: 3, tipo_formulario: 'EE', caracteristica: 2, nombre_caracteristica: 'Dominio disciplinar', codigo: '2.1', orden: 3 },
    { id_pregunta: 4, tipo_formulario: 'EC', caracteristica: 1, nombre_caracteristica: 'Planeación y gestión', codigo: '1.1', orden: 1 },
    { id_pregunta: 5, tipo_formulario: 'AE', caracteristica: 1, nombre_caracteristica: 'Reflexión docente', codigo: '1.1', orden: 1 },
  ];
  const unidades = [
    { id_docente: 'doc-1', docente: 'Ana Gómez', afiliacion: 'UDENAR', id_cohorte: 1, cohorte: 'VI', cohorte_inicio: '2026-A' },
  ];
  const respuestas = [
    { tipo_formulario: 'EE', id_docente: 'doc-1', id_cohorte: 1, poblacion: 'posgrado', comentario: 'Muy claro', items: { 1: 'A', 2: 'MA', 3: 'I' } },
    { tipo_formulario: 'EC', id_docente: 'doc-1', id_cohorte: 1, poblacion: 'posgrado', comentario: null, items: { 4: 'MA' } },
  ];
  const c = consolidar({ preguntas, unidades, respuestas, poblacion: 'todas' });
  const config = { periodo: '2026-B', excluir_extremas: false };
  const historico = [{ periodo: '2026-B', docentes: c.programa.docentes, idst_p: c.programa.idst_p, promedio_ip: c.programa.promedio_ip }];

  it('excel conserva las 5 hojas esperadas y omite filas/columnas del método Excel de referencia', async () => {
    const out = await informes.excel({ config, consolidado: c, historico, poblacion: 'todas' });
    expect(out.tipo).toMatch(/spreadsheetml/);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(out.buffer);
    expect(libro.worksheets.map((h) => h.name)).toEqual(['2026-B', 'EC y AE', 'IDSC-Prog', 'IDST-P', 'Notas']);
    expect(libro.getWorksheet('2026-B').getCell('A1').value).toBe('DOCENTE');

    const textos = [];
    libro.worksheets.forEach((h) => h.eachRow((row) => row.eachCell((cell) => {
      if (typeof cell.value === 'string') textos.push(cell.value);
    })));
    expect(textos.join('\n')).not.toMatch(/método Excel|Ocurrencias \(Excel/i);
  });

  it('pdfConsolidado y pdfDocente generan PDFs válidos', async () => {
    const [p1, p2] = await Promise.all([
      informes.pdfConsolidado({ config, consolidado: c, historico, poblacion: 'todas' }),
      informes.pdfDocente({
        docente: { docente: 'Ana Gómez', afiliacion: 'UDENAR' },
        periodos: [{ periodo: '2026-B', unidades: c.unidades }],
      }),
    ]);
    expect(p1.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(p2.buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});

describe('Seguimiento de faltantes en periodos.service', () => {
  it('calcula conteos anónimos de EE y lista de docentes pendientes de EC y AE', async () => {
    jest.resetModules();
    const { huella } = require('../src/modules/evalDocente/anonimato');
    const env = require('../src/config/env');
    const repo = require('../src/modules/evalDocente/evalDocente.repository');

    jest.spyOn(repo, 'periodo').mockResolvedValue({
      periodo: '2026-B', habilitada: true, incluye_pregrado: true,
      fecha_apertura: '2026-11-01', fecha_cierre: '2026-11-30',
      excluir_extremas: false, publicado: false, actualizado_en: '2026-11-01',
    });
    jest.spyOn(repo, 'ofertas').mockResolvedValue([
      {
        id_curso: 'cur-1', id_cohorte: 1, cohorte: 'VI', cohorte_inicio: '2026-A', clase: 'Control',
        docentes: [
          { id_docente: 'doc-1', id_usuario: 'usr-d1', nombre: 'Ana Gómez', afiliacion: 'UDENAR' },
          { id_docente: 'doc-2', id_usuario: null, nombre: 'Luis Pérez', afiliacion: 'Externo' },
        ],
      },
    ]);
    jest.spyOn(repo, 'inscripcionesPosgrado').mockResolvedValue([
      { id_curso: 'cur-1', id_estudiante: 'est-1', activo: true, id_cohorte_estudiante: 1, estado_promocion: 'matriculado' },
      { id_curso: 'cur-1', id_estudiante: 'est-2', activo: true, id_cohorte_estudiante: 1, estado_promocion: 'matriculado' },
    ]);
    jest.spyOn(repo, 'inscripcionesPregrado').mockResolvedValue([
      { id_curso: 'cur-1', id_estudiante: 'pre-1', estado: 'inscrito', activo: true },
    ]);
    jest.spyOn(repo, 'avance').mockResolvedValue({
      ee: [{ id_docente: 'doc-1', id_cohorte: 1, poblacion: 'posgrado', n: 1 }],
      constancias: new Set([
        huella(env.evalSecreto, '2026-B', 'est-1', 'doc-1'),
        huella(env.evalSecreto, '2026-B', 'est-1', 'doc-2'),
      ]),
    });
    jest.spyOn(repo, 'ecAeHechas').mockResolvedValue(new Set(['EC|doc-1|1']));

    const periodosService = require('../src/modules/evalDocente/periodos/periodos.service');
    const r = await periodosService.obtener({ params: { periodo: '2026-B' } });

    expect(r.avance.faltantes.ee).toEqual({
      estudiantes_pendientes: 2,
      respuestas_posgrado: 3,
      respuestas_pregrado: 2,
    });
    expect(r.avance.faltantes.ec).toEqual([
      { id_docente: 'doc-2', docente: 'Luis Pérez', id_cohorte: 1, cohorte: 'VI' },
    ]);
    expect(r.avance.faltantes.ae).toEqual([
      { id_docente: 'doc-1', docente: 'Ana Gómez', id_cohorte: 1, cohorte: 'VI', sin_cuenta: false },
      { id_docente: 'doc-2', docente: 'Luis Pérez', id_cohorte: 1, cohorte: 'VI', sin_cuenta: true },
    ]);
    expect(JSON.stringify(r.avance.faltantes.ee)).not.toMatch(/est-1|est-2|pre-1/);
    jest.restoreAllMocks();
  });
});
