// Periodo académico vigente en el formato institucional AAAA-A / AAAA-B:
// «A» para el primer semestre (enero–junio) y «B» para el segundo (julio–diciembre).
export const periodoAcademico = (fecha = new Date()) =>
  `${fecha.getFullYear()}-${fecha.getMonth() < 6 ? 'A' : 'B'}`
