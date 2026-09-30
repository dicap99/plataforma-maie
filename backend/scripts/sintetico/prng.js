// Generador pseudoaleatorio con semilla (mulberry32): la misma semilla produce siempre los
// mismos datos sintéticos, lo que hace reproducibles las pruebas y la base de demostración.
const crearPrng = (semilla) => {
  let a = semilla >>> 0;
  const siguiente = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const entero = (min, max) => min + Math.floor(siguiente() * (max - min + 1));
  const elegir = (lista) => lista[Math.floor(siguiente() * lista.length)];
  const probabilidad = (p) => siguiente() < p;
  // Normal estándar por Box–Muller.
  const normal = () => {
    const u = 1 - siguiente();
    const v = siguiente();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const barajar = (lista) => {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i -= 1) {
      const j = Math.floor(siguiente() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  };

  return { siguiente, entero, elegir, probabilidad, normal, barajar };
};

module.exports = { crearPrng };
