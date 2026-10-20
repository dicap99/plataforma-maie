const { interpretarGastos, aNumero, aRomano } = require('../src/modules/admin/importaciones/lectorGastosPdf');

// Página sintética con la disposición del informe PSP-GEF-FR-03 (coordenadas como las entrega pdf.js).
const t = (texto, x, y, ancho = 40) => ({ texto, x, y, ancho });
const ENCABEZADO = [
  t('Código: PSP-GEF-FR-03', 819, 597, 80),
  t('PRESUPUESTO DE GASTOS - RECURSOS ADMINISTRADOS', 344, 570, 253),
  t('4A. PROMOCION MAESTRIA EN INGENIERIA ELECTRONICA(INGENIERIA ELECTRONICA)', 75, 547, 374),
  t('MES DE Noviembre DE 2025 - COMPLETO', 74, 531, 175),
  t('Fecha de Impresión: lunes, 19 de octubre de 2026 - 07:34:29 p.m.', 74, 517, 210),
  t('CODIGO', 74, 499, 35), t('DETALLE', 178, 499, 40), t('T', 418, 499, 5),
  t('INICIAL', 439, 499, 32), t('ANTERIOR', 490, 499, 46), t('MOD. MES', 549, 499, 44), t('DEFINITIVA', 605, 499, 48),
  t('Pago', 677, 499, 21), t('Comprometi', 720, 499, 52), t('Registro', 786, 499, 35), t('Obligación', 839, 499, 45), t('Por_CDP', 902, 499, 38),
];
// Valores alineados a la derecha bajo cada encabezado (el orden de los textos no importa).
const fila = (y, codigo, detalle, v) => [
  t(codigo, 74, y, 64), t(detalle, 178, y - 1, 100), t('G', 416, y, 5),
  t(v[0], 472, y, 12), t(v[1], 503, y, 39), t(v[2], 588, y, 12), t(v[3], 619, y, 39),
  t(v[8], 910, y, 39), t(v[5], 735, y, 39), t(v[7], 851, y, 39), t(v[6], 793, y, 39), t(v[4], 677, y, 39),
];
const RAIZ = ['0,00', '63.172.922,10', '0,00', '63.172.922,10', '21.022.757,00', '22.408.350,00', '22.161.557,00', '21,022,757.00', '40.764.572,10'];
const pagina = () => [
  ...ENCABEZADO,
  ...fila(489, '1040102010901020304', '4A. PROMOCION MAESTRIA EN INGENIERIA ELECTRONICA', RAIZ),
  ...fila(480, '10401020109010203041', 'DOCENCIA', ['0,00', '48.205.672,10', '0,00', '48.205.672,10', '6.302.300,00', '7.441.100,00', '7.441.100,00', '6,302,300.00', '40.764.572,10']),
  ...fila(471, '10401020109010203047', 'SOPORTE INSTITUCIONAL', ['0,00', '14.967.250,00', '0,00', '14.967.250,00', '14.720.457,00', '14.967.250,00', '14.720.457,00', '14,720,457.00', '0,00']),
];

describe('Informe PDF de gastos (PSP-GEF-FR-03)', () => {
  test('convierte números en formato colombiano y anglosajón', () => {
    expect(aNumero('63.172.922,10')).toBe(63172922.1);
    expect(aNumero('21,022,757.00')).toBe(21022757);
    expect(aNumero('0,00')).toBe(0);
    expect(aNumero('DOCENCIA')).toBeNull();
    expect(aRomano(4)).toBe('IV');
    expect(aRomano(9)).toBe('IX');
  });

  test('identifica la promoción, el mes y los totales de la fila raíz', () => {
    const r = interpretarGastos([pagina()]);
    expect(r).toMatchObject({ codigo: 'PSP-GEF-FR-03', promocion: 'IV', mes: 11, anio: 2025, nombreMes: 'noviembre' });
    expect(r.totales).toMatchObject({ definitiva: 63172922.1, comprometido: 22408350, registro: 22161557, obligacion: 21022757, pago: 21022757, por_cdp: 40764572.1 });
    expect(r.areas.map((a) => a.detalle)).toEqual(['DOCENCIA', 'SOPORTE INSTITUCIONAL']);
    expect(r.areas[1]).toMatchObject({ definitiva: 14967250, comprometido: 14967250, por_cdp: 0 });
  });

  test('rechaza el informe de ingresos y los totales que no cuadran', () => {
    const ingresos = pagina().map((i) => (i.texto.startsWith('Código') ? { ...i, texto: 'Código: PSP-GEF-FR-04' } : i));
    expect(() => interpretarGastos([ingresos])).toThrow(/PSP-GEF-FR-04/);
    const descuadre = pagina().map((i) => (i.y === 489 && i.x === 910 ? { ...i, texto: '40.000.000,00' } : i));
    expect(() => interpretarGastos([descuadre])).toThrow(/no cuadran/);
  });
});
