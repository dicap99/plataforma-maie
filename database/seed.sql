-- DATOS INICIALES (se ejecuta después de init.sql por orden alfabético en docker-entrypoint-initdb.d)
-- Fuente de RA y estrategias: Documento de Resultados de Aprendizaje (RA) MaIE / PEP.

INSERT INTO resultados_aprendizaje (codigo, descripcion) VALUES
('RA1', 'Aplica conceptos de la teoría de optimización y de los sistemas lineales, para formular, analizar y resolver problemas en el contexto de la ingeniería electrónica.'),
('RA2', 'Aplica nuevos métodos y herramientas avanzadas, propias de la Ingeniería Electrónica y otras disciplinas, para la comprensión y solución de problemas de ingeniería.'),
('RA3', 'Identifica y analiza problemáticas de investigaciones relevantes y pertinentes para la sociedad, de acuerdo con los avances de las distintas líneas de investigación del área de la ingeniería electrónica.'),
('RA4', 'Resuelve problemas complejos y de dinámicas particulares mediante el uso de conocimiento y técnicas avanzadas y especializadas desde las líneas de investigación propias de la Ingeniería Electrónica y otras disciplinas, para el desarrollo de soluciones específicas y con impacto en el desarrollo investigativo.'),
('RA5', 'Presenta soluciones a las problemáticas de la región y la sociedad mediante la formulación, estructuración y gestión de proyectos de investigación científica y/o aplicada que promuevan el desarrollo humano, social, científico y tecnológico.'),
('RA6', 'Comprende, reconoce y aplica las responsabilidades éticas y profesionales en compromiso con el desarrollo de nuevo conocimiento para alcanzar la proyección social de la investigación, hacia la región.'),
('RA7', 'Aplica nuevos métodos y herramientas avanzadas, propias de la Ingeniería Electrónica y otras disciplinas, para la comprensión y solución de problemas de ingeniería.');

INSERT INTO estrategias_evaluacion (codigo, descripcion) VALUES
('E1', 'Estudios de casos en proyectos de final de curso'),
('E2', 'Simulaciones y talleres'),
('E3', 'Formulación adecuada del problema del proyecto de investigación'),
('E4', 'Estructuración del proyecto de investigación'),
('E5', 'Desarrollo del proyecto de investigación'),
('E6', 'Sustentación del resultado (producto de nuevo conocimiento)');

INSERT INTO modulos_curriculares (nombre, descripcion) VALUES
('Básico', 'Componente de formación básica (MaIE-CB1, MaIE-CB2)'),
('Profundización', 'Componente de profundización (MaIE-CP1, MaIE-CP2, MaIE-CP3)'),
('Electivo', 'Componente electivo (MaIE-CE1, MaIE-CE2)'),
('Investigativo', 'Componente investigativo (MaIE-CI1, MaIE-CI2, Tesis I, Tesis II)');

-- Parámetros del programa (valores de la hoja "Estadísticas MaIE 2025-B"; editables por Coordinación)
INSERT INTO parametros_programa (clave, valor, descripcion) VALUES
('smmlv_2025', 1400000, 'Salario mínimo mensual legal vigente 2025 (COP)'),
('pct_transferencia_central', 15, '% del saldo presupuestal transferido a la administración central'),
('pct_transferencia_viis', 5, '% del saldo presupuestal transferido a la VIIS'),
('pct_fondo_investigaciones', 50, '% del saldo presupuestal destinado al Fondo de Investigaciones'),
('pct_unidad_academica', 30, '% del saldo presupuestal destinado a la Unidad Académica'),
('creditos_semestre_1', 12, 'Número de créditos del I semestre'),
('creditos_semestre_2', 19.2, 'Número de créditos del II semestre'),
('creditos_semestre_3', 16, 'Número de créditos del III semestre'),
('creditos_semestre_4', 12, 'Número de créditos del IV semestre');

-- Usuario coordinador inicial. Hash bcrypt (costo 10) compatible con bcryptjs.
-- CAMBIAR LA CONTRASEÑA tras el primer ingreso.
INSERT INTO usuarios (identificacion, nombres, apellidos, email, password_hash, rol) VALUES
('0000000000', 'Coordinación', 'MaIE', 'coordinacion.maie@udenar.edu.co',
 crypt('CambiarMaIE2026', gen_salt('bf', 10)), 'coordinador');
