// Anonimato del formulario EE (Acuerdo 058, Art. 4; el diseño declara las respuestas anónimas).
//
// La respuesta EE no guarda evaluador, fecha ni un identificador ordenable. Para impedir que un
// estudiante evalúe dos veces al mismo docente en el semestre se guarda una CONSTANCIA, que no contiene
// los identificadores del estudiante ni del docente sino una HUELLA: HMAC-SHA256 con una clave secreta
// del servidor (EVAL_SECRETO). Sin esa clave, la constancia no revela quién evaluó a quién, ni siquiera
// si alguien con acceso a la base cruza filas de la misma transacción.
//
// Complemento (evalDocente.repository.barajarEE): al cerrar o publicar el semestre, las respuestas EE
// se reescriben en orden aleatorio y con identificadores nuevos, en una sola transacción, de modo que
// ya no comparten la transacción (xmin) ni el orden físico con su constancia.
const crypto = require('crypto');

// Huella de (semestre, estudiante, docente): 64 caracteres hexadecimales, determinista con la misma clave.
const huella = (secreto, periodo, idEstudiante, idDocente) => {
  if (!secreto) throw new Error('Falta la clave del anonimato (EVAL_SECRETO)');
  return crypto.createHmac('sha256', secreto).update(`${periodo}|${idEstudiante}|${idDocente}`).digest('hex');
};

module.exports = { huella };
