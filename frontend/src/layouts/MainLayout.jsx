import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { ETIQUETA_ROL, MENU_POR_ROL } from '../routes/navigation'
import { periodoAcademico } from '../utils/periodo'
import Icono from '../components/common/Icono.jsx'

// Iniciales para el avatar: evita depender de una foto de perfil.
const iniciales = (nombre = '') =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '·'

// Cascarón principal (mockup del coordinador): menú lateral oscuro agrupado por
// módulo + barra superior fija. En móvil el menú se colapsa (RNF-USA-02).
export default function MainLayout() {
  const { usuario, logout } = useAuth()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const { pathname } = useLocation()
  const grupos = MENU_POR_ROL[usuario?.rol] ?? []

  // Al cambiar de ruta el menú móvil se cierra solo.
  useEffect(() => setMenuAbierto(false), [pathname])

  const claseEnlace = ({ isActive }) =>
    `flex items-center gap-space-sm px-space-sm py-2 rounded-xl transition-colors ${
      isActive
        ? 'bg-secondary-container text-on-secondary-container font-semibold shadow-sm'
        : 'text-primary-fixed-dim hover:bg-primary-container hover:text-on-primary'
    }`

  return (
    <div className="min-h-screen bg-background font-body text-body-md text-on-surface">
      {/* Menú lateral */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-sidebar max-w-[85vw] flex-col overflow-y-auto bg-primary shadow-[0_4px_20px_rgba(4,0,57,0.15)] transition-transform duration-200 md:translate-x-0 ${
          menuAbierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center gap-space-sm bg-primary-container px-space-lg">
          <img
            src="/logo-udenar.png"
            alt="Universidad de Nariño"
            className="shrink-0 object-contain"
            style={{ filter: 'brightness(0) invert(1)', maxHeight: 38, width: 'auto' }}
          />
          <div className="mx-2 h-9 shrink-0 border-l border-white/20" />
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-extrabold leading-tight tracking-wider text-white">MaIE</span>
            <span className="truncate text-[10px] font-semibold leading-tight text-primary-fixed-dim">
              Maestría en Ingeniería Electrónica
            </span>
          </div>
        </div>

        <div className="shrink-0 px-space-md py-space-sm">
          <div className="flex items-center justify-between rounded-xl bg-tertiary-container/80 p-space-sm">
            <div className="flex items-center gap-space-sm">
              <Icono nombre="account_tree" className="text-[20px] text-secondary-fixed" />
              <div className="flex flex-col">
                <span className="text-label-sm uppercase text-outline-variant">Facultad</span>
                <span className="text-label-md text-on-primary">Ingeniería</span>
              </div>
            </div>
            <span className="rounded bg-secondary/30 px-1.5 py-0.5 text-label-sm font-semibold text-secondary-fixed">
              SNIES
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-space-md px-space-md py-space-sm">
          {grupos.map((grupo, i) => (
            <div key={grupo.grupo ?? `inicio-${i}`} className="space-y-1 pt-space-xs first:pt-0">
              {grupo.grupo && (
                <div className="flex items-center gap-1 px-space-sm pb-1 text-label-sm font-semibold uppercase tracking-wider text-on-primary-container">
                  <Icono nombre={grupo.icono} className="text-[16px]" />
                  {grupo.grupo}
                </div>
              )}
              {grupo.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={claseEnlace}>
                  <Icono nombre={item.icono} className="text-[20px]" />
                  <span className="text-label-lg">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="shrink-0 bg-primary-container/60 p-space-md">
          <div className="flex items-center gap-space-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-secondary-fixed" />
            <span className="text-label-sm text-primary-fixed-dim">Servidor MaIE conectado</span>
          </div>
        </div>
      </aside>

      {/* Telón del menú en móvil */}
      {menuAbierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-primary/50 backdrop-blur-sm md:hidden"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      <div className="md:pl-sidebar">
        <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between gap-space-sm bg-surface-container-lowest/90 px-space-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl md:left-sidebar md:px-space-lg">
          <div className="flex min-w-0 items-center gap-space-md">
            <button
              type="button"
              aria-label="Abrir menú"
              aria-expanded={menuAbierto}
              className="-ml-1 rounded-xl p-2 text-on-surface-variant hover:bg-surface-container md:hidden"
              onClick={() => setMenuAbierto(true)}
            >
              <Icono nombre="menu" className="text-[22px]" />
            </button>
            <div className="flex items-center gap-space-xs">
              <Icono nombre="home" className="text-[18px] text-secondary" />
              <span className="text-label-sm font-bold uppercase tracking-wide text-primary">MaIE Portal</span>
            </div>
            <div className="hidden items-center gap-2 rounded-xl bg-surface-container-low px-3 py-1.5 lg:flex">
              <Icono nombre="calendar_month" className="text-[18px] text-secondary" />
              <span className="text-label-sm font-semibold text-on-surface-variant">Periodo:</span>
              <span className="text-label-md font-bold text-primary">{periodoAcademico()}</span>
            </div>
          </div>

          <div className="flex items-center gap-space-sm md:gap-space-md">
            <div className="hidden items-center gap-1.5 rounded-xl bg-surface-container-low px-3 py-1.5 sm:inline-flex">
              <span className="text-label-sm text-on-surface-variant">Rol:</span>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-label-sm font-semibold text-on-secondary shadow-sm">
                {ETIQUETA_ROL[usuario?.rol] ?? usuario?.rol}
              </span>
            </div>
            <div className="flex items-center gap-space-sm">
              <div className="hidden flex-col text-right md:flex">
                <span className="text-label-md font-bold leading-tight text-primary">{usuario?.nombre}</span>
                <span className="text-label-sm text-on-surface-variant">
                  {ETIQUETA_ROL[usuario?.rol] ?? usuario?.rol} MaIE
                </span>
              </div>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-label-md font-bold text-on-primary ring-2 ring-surface-container-high">
                {iniciales(usuario?.nombre)}
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface md:px-3"
            >
              <Icono nombre="logout" className="text-[18px]" />
              <span className="hidden md:inline">Salir</span>
            </button>
          </div>
        </header>

        <main className="min-h-screen w-full bg-background px-space-md py-space-lg pt-[calc(4rem+1rem)] md:px-space-lg md:pt-[calc(4rem+1.5rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
