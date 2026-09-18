// Servicio genérico: traduce el contexto de la petición a operaciones del repositorio.
const ApiError = require('../../utils/ApiError');

const crudService = (recurso, repository) => {
  const llavesDe = (params) => recurso.llave.map((k) => params[k]);
  const noEncontrado = () => ApiError.notFound(`${recurso.titulo}: registro no encontrado`);

  return {
    listar: () => repository.list(),

    async obtener({ params }) {
      const fila = await repository.get(llavesDe(params));
      if (!fila) throw noEncontrado();
      return fila;
    },

    crear: ({ body }) => repository.create(body),

    async actualizar({ params, body }) {
      const fila = await repository.update(llavesDe(params), body);
      if (!fila) throw noEncontrado();
      return fila;
    },

    async eliminar({ params }) {
      if (!(await repository.remove(llavesDe(params)))) throw noEncontrado();
      return { eliminado: true };
    },
  };
};

module.exports = crudService;
