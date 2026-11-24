-- Producción académica de cada estudiante (decisión del usuario, 2026-11-24): cada producto de investigación
-- se vincula con los estudiantes registrados que participaron. La columna de texto
-- productos_investigacion.estudiantes se conserva para los productos de promociones sin cuentas.
BEGIN;

CREATE TABLE IF NOT EXISTS producto_estudiantes (
    id_producto INT NOT NULL REFERENCES productos_investigacion(id_producto) ON DELETE CASCADE,
    id_estudiante UUID NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    PRIMARY KEY (id_producto, id_estudiante)
);
CREATE INDEX IF NOT EXISTS idx_producto_estudiantes_estudiante ON producto_estudiantes (id_estudiante);

COMMIT;
