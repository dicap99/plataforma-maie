// RF-ADM-03 — Matrícula financiera por estudiante (posgrado y pregrado)
const ExcelJS = require('exceljs');
const ApiError = require('../../../utils/ApiError');
const repository = require('./financiero.repository');

const resumir = (posgrado, pregrado) => {
  const sumaPagado = (lista) => lista.filter((f) => f.pagado).reduce((s, f) => s + Number(f.valor_pagado || 0), 0);
  const totalPosgrado = sumaPagado(posgrado);
  const totalPregrado = sumaPagado(pregrado);
  return {
    total_posgrado: totalPosgrado,
    total_pregrado: totalPregrado,
    total_recaudado: totalPosgrado + totalPregrado,
    pagados_posgrado: posgrado.filter((f) => f.pagado).length,
    pendientes_posgrado: posgrado.filter((f) => !f.pagado).length,
    pagados_pregrado: pregrado.filter((f) => f.pagado).length,
    pendientes_pregrado: pregrado.filter((f) => !f.pagado).length,
  };
};

module.exports = {
  async listar({ query }) {
    const filtros = {
      periodo: query.periodo ?? null,
      id_cohorte: query.id_cohorte ?? null,
    };
    const [posgrado, pregrado, porCohorte] = await Promise.all([
      query.poblacion === 'pregrado' ? [] : repository.listarPosgrado(filtros),
      query.poblacion === 'posgrado' ? [] : repository.listarPregrado(filtros),
      repository.resumenPorCohorte(),
    ]);
    return { posgrado, pregrado, resumen: resumir(posgrado, pregrado), por_cohorte: porCohorte };
  },

  async guardar({ body }) {
    if (!(await repository.existeEstudiante(body.id_estudiante))) {
      throw ApiError.badRequest('El usuario debe existir y tener rol estudiante');
    }
    if (body.poblacion === 'posgrado' && !body.id_cohorte) {
      throw ApiError.badRequest('Indique la promoción para la matrícula financiera de posgrado');
    }
    if (body.id_cohorte && !(await repository.existeCohorte(body.id_cohorte))) {
      throw ApiError.notFound('Promoción no encontrada');
    }
    return repository.upsertPago(body);
  },

  async eliminar({ params }) {
    if (!(await repository.removePago(params.id))) {
      throw ApiError.notFound('Registro de matrícula financiera no encontrado');
    }
    return { eliminado: true };
  },

  async exportar({ query }) {
    const datos = await this.listar({ query });
    const libro = new ExcelJS.Workbook();
    libro.creator = 'Plataforma MaIE';
    libro.created = new Date();

    const hoja = libro.addWorksheet('Matrícula financiera', { views: [{ state: 'frozen', ySplit: 1 }] });
    hoja.columns = [
      { header: 'Población', key: 'poblacion', width: 14 },
      { header: 'Semestre', key: 'periodo', width: 12 },
      { header: 'Promoción', key: 'cohorte', width: 14 },
      { header: 'Identificación', key: 'identificacion', width: 18 },
      { header: 'Estudiante', key: 'estudiante', width: 32 },
      { header: 'Estado pago', key: 'estado', width: 14 },
      { header: 'Valor pagado (COP)', key: 'valor_pagado', width: 20, style: { numFmt: '#,##0.00' } },
      { header: 'Fecha de pago', key: 'fecha_pago', width: 16 },
      { header: 'Referencia / recibo', key: 'referencia', width: 22 },
      { header: 'Observaciones', key: 'observaciones', width: 32 },
    ];
    hoja.getRow(1).eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3D6B' } };
    });
    for (const f of [...datos.posgrado, ...datos.pregrado]) {
      hoja.addRow({
        poblacion: f.poblacion === 'posgrado' ? 'Posgrado' : 'Pregrado',
        periodo: f.periodo,
        cohorte: f.cohorte ?? '—',
        identificacion: f.identificacion,
        estudiante: `${f.apellidos} ${f.nombres}`,
        estado: f.pagado ? 'Pagado' : 'Pendiente',
        valor_pagado: f.pagado ? Number(f.valor_pagado || 0) : 0,
        fecha_pago: f.fecha_pago ?? '',
        referencia: f.referencia ?? '',
        observaciones: f.observaciones ?? '',
      });
    }

    const resumen = libro.addWorksheet('Resumen por promoción', { views: [{ state: 'frozen', ySplit: 1 }] });
    resumen.columns = [
      { header: 'Promoción', key: 'cohorte', width: 16 },
      { header: 'Pagados posgrado', key: 'pagados_posgrado', width: 18 },
      { header: 'Ingresos posgrado (COP)', key: 'posgrado', width: 24, style: { numFmt: '#,##0.00' } },
      { header: 'Pagados pregrado', key: 'pagados_pregrado', width: 18 },
      { header: 'Ingresos pregrado (COP)', key: 'pregrado', width: 24, style: { numFmt: '#,##0.00' } },
      { header: 'Total recaudado (COP)', key: 'total', width: 24, style: { numFmt: '#,##0.00' } },
    ];
    resumen.getRow(1).eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3D6B' } };
    });
    for (const r of datos.por_cohorte) {
      resumen.addRow({
        ...r,
        cohorte: r.cohorte ? `Promoción ${r.cohorte}` : 'Sin promoción',
      });
    }

    const fecha = new Date().toISOString().slice(0, 10);
    return {
      nombreArchivo: `MaIE_matricula_financiera_${fecha}.xlsx`,
      buffer: await libro.xlsx.writeBuffer(),
    };
  },
};
