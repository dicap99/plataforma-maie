// Nombres y apellidos genéricos para usuarios sintéticos. Se combinan al azar y no corresponden
// a personas reales del programa (en particular, no se usan los nombres del documento RA MaIE).
const NOMBRES = [
  'Alejandra', 'Andrés', 'Ana', 'Camilo', 'Carolina', 'Cristian', 'Daniela', 'Diana', 'Esteban', 'Felipe',
  'Fernanda', 'Gabriel', 'Gloria', 'Hernán', 'Isabel', 'Iván', 'Javier', 'Jimena', 'Jorge', 'Julián',
  'Karen', 'Laura', 'Leonardo', 'Lina', 'Lucía', 'Manuel', 'Marcela', 'Martín', 'Mateo', 'Natalia',
  'Nicolás', 'Olga', 'Óscar', 'Paola', 'Pedro', 'Ricardo', 'Rocío', 'Samuel', 'Sara', 'Sebastián',
  'Silvia', 'Tatiana', 'Tomás', 'Valentina', 'Valeria', 'Víctor', 'Ximena', 'Yesenia', 'Zulma', 'Emilio',
];

const APELLIDOS = [
  'Acosta', 'Aguirre', 'Álvarez', 'Arango', 'Ayala', 'Bermúdez', 'Botero', 'Cabrera', 'Calderón', 'Castaño',
  'Cifuentes', 'Correa', 'Delgado', 'Duarte', 'Escobar', 'Figueroa', 'Franco', 'Galindo', 'Gallego', 'Guerrero',
  'Herrera', 'Ibarra', 'Jaramillo', 'Lara', 'León', 'Londoño', 'Maldonado', 'Mejía', 'Molina', 'Montoya',
  'Muñoz', 'Navarro', 'Ocampo', 'Orozco', 'Ortega', 'Palacios', 'Pineda', 'Quintero', 'Restrepo', 'Rincón',
  'Rojas', 'Salcedo', 'Serna', 'Solano', 'Tobón', 'Trujillo', 'Urrego', 'Valencia', 'Villegas', 'Zuluaga',
];

// Temas posibles de las ofertas cuyo nombre cambia en cada promoción (profundización y electivas).
const TEMAS = {
  'MaIE-CP2': ['Control Inteligente', 'Comunicaciones Inalámbricas', 'Microrredes'],
  'MaIE-CP3': ['Optimización Distribuida', 'Procesos Estocásticos', 'Smart Grids'],
  'MaIE-CE1': ['Reinforcement Learning', 'Ingeniería de RF', 'Sistemas Fotovoltaicos con Machine Learning'],
  'MaIE-CE2': ['Robótica', 'Aprendizaje Profundo', 'Teoría de Juegos'],
};

module.exports = { NOMBRES, APELLIDOS, TEMAS };
