-- Migración: parámetros del Panel general acordados en la reunión de avances del 20-oct-2026.
--   docker compose exec -T db psql -v ON_ERROR_STOP=1 -U maie_admin -d maie_db < database/migraciones/2026-10-26_parametros_panel.sql
INSERT INTO parametros_programa (clave, valor, descripcion) VALUES
('smmlv_2025', 1423500, 'Salario mínimo mensual legal vigente 2025 (COP), Decreto 2641 de 2024'),
('smmlv_2026', 1750905, 'Salario mínimo mensual legal vigente 2026 (COP), Decreto 1469 de 2025'),
('creditos_obligatorios', 48, 'Créditos obligatorios del plan de estudios'),
('plazo_sustentacion_anios', 3, 'Años para sustentar el trabajo de grado desde el fin de la promoción')
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, descripcion = EXCLUDED.descripcion;
