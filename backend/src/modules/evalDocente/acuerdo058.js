// Reglas de dominio del Acuerdo 058 de 2022 como funciones puras (sin BD ni Express),
// para poder probarlas de forma aislada. Las usan los servicios de periodos y resultados.
const pendiente = require('../../utils/pendiente');

// RF-EVAL-03: rangos de categorización según %IP.
const CATEGORIAS = [
  { min: 80, nombre: 'Gran Fortaleza' },
  { min: 60, nombre: 'Fortaleza' },
  { min: 40, nombre: 'Transición' },
  { min: 20, nombre: 'Debilidad' },
  { min: 0, nombre: 'Gran Debilidad' },
];

const categorizar = (porcentajeIp) => {
  if (typeof porcentajeIp !== 'number' || Number.isNaN(porcentajeIp) || porcentajeIp < 0 || porcentajeIp > 100) {
    throw new RangeError('%IP debe ser un número entre 0 y 100');
  }
  return CATEGORIAS.find((c) => porcentajeIp >= c.min).nombre;
};

module.exports = {
  CATEGORIAS,
  categorizar,
  // RF-EVAL-02: IP, IN y %IP a partir de las frecuencias MA, A, I, MI
  // (pesos de referencia en database/init.sql: MA 1.5, A 1.0, I 1.0, MI 1.5).
  calcularIndicadores: pendiente('acuerdo058.calcularIndicadores'),
  // RF-EVAL-04: métricas de programa IDST-D, IDSC-Prom e IDSC-Prog.
  calcularIndicadoresPrograma: pendiente('acuerdo058.calcularIndicadoresPrograma'),
};
