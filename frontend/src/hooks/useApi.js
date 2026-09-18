import { useCallback, useEffect, useState } from 'react'

// Carga datos con una función del API: { data, error, cargando, recargar }.
// `fn` debe devolver el DTO { status, data }; aquí se expone solo `data`.
export default function useApi(fn, deps = []) {
  const [estado, setEstado] = useState({ data: null, error: null, cargando: true })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cargar = useCallback(fn, deps)

  const recargar = useCallback(async () => {
    setEstado((e) => ({ ...e, cargando: true, error: null }))
    try {
      const { data } = await cargar()
      setEstado({ data, error: null, cargando: false })
    } catch (error) {
      setEstado({ data: null, error, cargando: false })
    }
  }, [cargar])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { ...estado, recargar }
}
