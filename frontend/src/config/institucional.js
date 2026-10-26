// Información institucional fija del programa (no proviene de la base de datos).
// Fuentes: Resolución MEN 010564 de 2026 (registro calificado), Manual de Identidad Visual de la
// Universidad de Nariño (Acuerdo 031 de 2023, textos legales y acreditación) y Coordinación MaIE.

export const PROGRAMA = {
  nombre: 'Maestría en Ingeniería Electrónica',
  snies: '108095',
}

// Renovación del registro calificado (Art. 1: siete años, 48 créditos, modalidad presencial en Pasto).
export const REGISTRO_CALIFICADO = {
  resolucion: '010564',
  fecha: '22 de abril de 2026',
  vigencia: '7 años',
}

// Acreditación Institucional en Alta Calidad (2023–2029); el texto legal sigue el numeral 1.3 del manual.
export const ACREDITACION = {
  resolucion: '000022',
  fecha: '11 de enero de 2023',
  logoBlanco: '/acreditacion-institucional-blanco.png',
}

export const TEXTO_LEGAL = 'Institución de Educación Superior | Vigilada por MINEDUCACIÓN'

// Texto legal completo del numeral 1.3 del manual, para pies de página.
export const TEXTO_LEGAL_COMPLETO = [
  'Universidad de Nariño',
  TEXTO_LEGAL,
  'Fundada mediante Decreto 049 del 4 de noviembre de 1904',
  `Acreditada en Alta Calidad Resolución No. ${ACREDITACION.resolucion} de ${ACREDITACION.fecha} por MINEDUCACIÓN`,
]

// Certificación ISO 9001 del Sistema Integrado de Gestión de Calidad (numerales 1.3 y 2.1.3 del manual):
// los sellos se usan en sus colores originales (manual de imagen de Icontec), con su código de certificado.
export const CERTIFICACION = {
  sellos: '/sellos-icontec-iqnet.png',
  codigos: ['SC-CER110449', 'CO-SC-CER110449'],
}

// Secretaría del programa.
export const CONTACTO = {
  direccion: ['Ciudad Universitaria Torobajo', 'Calle 18 No. 50 – 02', 'Bloque 6, oficina 309', 'Pasto - Nariño, Colombia'],
  telefono: '(602) 7244309 – Extensión 2015',
  email: 'maestriaelectronica@udenar.edu.co',
}

// Líneas de investigación del PEP, confirmadas en la reunión de avances del 20-oct-2026.
export const LINEAS_INVESTIGACION = {
  principales: ['Automatización y control', 'Sistemas de comunicaciones', 'Energía'],
  transversales: ['Inteligencia artificial y machine learning', 'Robótica', 'Procesamiento de señales'],
}
