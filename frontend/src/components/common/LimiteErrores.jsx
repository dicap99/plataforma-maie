import { Component } from 'react'
import Icono from './Icono.jsx'

// Límite de errores de React: si una pantalla falla al dibujarse, muestra un aviso con opciones para
// reintentar o volver, en lugar de dejar la página en blanco. `completo`: fuera del layout (sin menú),
// ocupa toda la ventana. El layout lo reinicia al cambiar de ruta (key = ruta).
export default class LimiteErrores extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Error al mostrar la pantalla:', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className={this.props.completo ? 'grid min-h-screen place-items-center bg-background p-space-lg' : ''}>
        <section role="alert" className="mx-auto flex max-w-2xl flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
          <div className="flex items-center gap-space-sm">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-error-container/60 text-error">
              <Icono nombre="error" className="text-[22px]" />
            </span>
            <h1 className="m-0 font-display text-headline-md text-primary">No se pudo mostrar esta pantalla</h1>
          </div>
          <p className="m-0 text-body-md text-on-surface-variant">
            Ocurrió un error inesperado al dibujar la página. Sus datos no se perdieron: puede intentarlo de nuevo o volver a la
            pantalla anterior. Si el problema se repite, informe a la Coordinación qué estaba haciendo.
          </p>
          <p className="m-0 rounded-lg bg-surface-container-low px-3 py-2 font-mono text-body-sm text-on-surface-variant">
            {String(error.message ?? error)}
          </p>
          <div className="flex flex-wrap gap-space-sm">
            <button type="button" className="btn btn-primario" onClick={() => this.setState({ error: null })}>
              <Icono nombre="refresh" className="text-[18px]" /> Reintentar
            </button>
            <button type="button" className="btn btn-secundario" onClick={() => window.history.back()}>
              <Icono nombre="arrow_back" className="text-[18px]" /> Volver
            </button>
            <button type="button" className="btn btn-secundario" onClick={() => window.location.assign('/')}>
              <Icono nombre="home" className="text-[18px]" /> Ir al inicio
            </button>
          </div>
        </section>
      </div>
    )
  }
}
