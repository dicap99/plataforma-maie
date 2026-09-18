import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { MENU_POR_ROL } from '../routes/navigation'

// Cascarón principal: encabezado institucional + menú lateral responsivo por rol.
export default function MainLayout() {
  const { usuario, logout } = useAuth()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const menu = MENU_POR_ROL[usuario?.rol] ?? []

  return (
    <div className="layout">
      <header className="layout-header">
        <button
          className="btn-menu"
          aria-label="Abrir menú"
          aria-expanded={menuAbierto}
          onClick={() => setMenuAbierto((v) => !v)}
        >
          ☰
        </button>
        <span className="titulo">Plataforma MaIE · Universidad de Nariño</span>
        <span className="usuario">{usuario?.nombre ?? usuario?.rol}</span>
        <button className="btn btn-secundario" style={{ color: '#fff' }} onClick={logout}>
          Salir
        </button>
      </header>

      <aside className={`layout-sidebar${menuAbierto ? ' abierto' : ''}`}>
        <nav>
          {menu.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMenuAbierto(false)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="layout-contenido">
        <Outlet />
      </main>
    </div>
  )
}
