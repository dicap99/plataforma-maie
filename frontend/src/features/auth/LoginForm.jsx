import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { INICIO_POR_ROL } from '../../routes/navigation'

export default function LoginForm() {
  const { usuario, login } = useAuth()
  const navigate = useNavigate()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  if (usuario) return <Navigate to={INICIO_POR_ROL[usuario.rol]} replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const sesion = await login(email, password)
      navigate(INICIO_POR_ROL[sesion.rol], { replace: true })
    } catch (err) {
      setError(err.message ?? 'No fue posible iniciar sesión')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="h-screen w-full bg-slate-950 font-body text-on-surface antialiased flex flex-col md:flex-row overflow-x-hidden selection:bg-secondary selection:text-white">
      {/* Panel Izquierdo: Hero Visual & Presencia Institucional MaIE */}
      <div className="relative w-full md:w-1/2 lg:w-7/12 min-h-[340px] md:min-h-full flex flex-col justify-between p-8 sm:p-12 lg:p-16 overflow-hidden bg-[#070b16]">
        {/* Imagen de fondo */}
        <div className="absolute inset-0 z-0">
          <img alt="Circuito integrado electrónico" className="w-full h-full object-cover object-center scale-105 filter brightness-75 contrast-110" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBnKJu4ixEsE0ji57xrEzmLsGU2FNoAl-Pkmql2oibryab19LSS5Ve4x7I0cMmJ-F-WmccU-Uf0G75x6hjDMSIXgpdNAa8tkfNJM-nAt8Who-XuaOctKzvXlWrapLWFuANZfhfrYYyuB1JCEZX7C2JhgqCML-DtV81AEnByXpR4faMXeX--86P_tYZePKQV__vrt5ozWzUUsfVfa6PLc6iEuO0XFjzX2jSoEgjfXJS2" />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#040039]/95 via-[#0b1120]/80 to-[#1b1856]/70 mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#040039] via-transparent to-transparent opacity-90"></div>
        </div>
        
        {/* Encabezado Institucional: Escudo */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img alt="Escudo Universidad de Nariño" className="h-9 md:h-11 w-auto object-contain brightness-0 invert opacity-95 transition-opacity hover:opacity-100" src="/logo-udenar.png" />
            <div className="h-6 w-px bg-white/20 hidden sm:block"></div>
            <span className="hidden sm:inline-block text-xs uppercase tracking-widest text-slate-300 font-medium">
              Facultad de Ingeniería
            </span>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-slate-200 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            SNIES 108095
          </div>
        </div>
        
        {/* Título Principal */}
        <div className="relative z-10 py-12 md:py-0 max-w-xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display tracking-tight text-white leading-tight mb-4">
            Plataforma Tecnológica <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-indigo-200 to-violet-300">MaIE</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed font-body">
            Maestría en Ingeniería Electrónica • Universidad de Nariño
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-2 text-xs text-slate-400"></div>
      </div>
      
      {/* Panel Derecho: Formulario de Autenticación */}
      <div className="w-full md:w-1/2 lg:w-5/12 flex-1 flex flex-col justify-between bg-surface-bright md:bg-white p-6 sm:p-10 lg:p-14 overflow-y-auto">
        {/* Top mini bar */}
        <div className="w-full flex items-center justify-between text-xs text-slate-500 mb-6">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Servicios Académicos Activos
          </span>
          <a className="inline-flex items-center gap-1 hover:text-secondary transition-colors" href="mailto:maie@udenar.edu.co">
            <span className="material-symbols-outlined text-[16px]">help_outline</span>
            <span>Soporte</span>
          </a>
        </div>
        
        {/* Contenedor central del Formulario */}
        <div className="w-full max-w-sm mx-auto my-auto space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">
              Iniciar Sesión
            </h2>
            <p className="text-sm text-slate-500 font-normal">
              Ingrese sus credenciales institucionales.
            </p>
          </div>
          
          <form className="space-y-4" onSubmit={onSubmit}>
            {/* Campo Correo Institucional */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-slate-700" htmlFor="user-email">
                  Usuario o Correo Institucional
                </label>
                <span className="text-slate-400 font-mono">@udenar.edu.co</span>
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-[19px] pointer-events-none">mail</span>
                <input 
                  className="w-full h-11 pl-10 pr-3.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm placeholder:text-slate-400 focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all outline-none" 
                  id="user-email" 
                  placeholder="usuario@udenar.edu.co" 
                  required 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </div>
            
            {/* Campo Contraseña */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-slate-700" htmlFor="user-password">
                  Contraseña
                </label>
                <a className="text-secondary hover:text-indigo-800 font-medium transition-colors" href="#">
                  ¿Olvidó su contraseña?
                </a>
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-[19px] pointer-events-none">lock</span>
                <input 
                  className="w-full h-11 pl-10 pr-10 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm placeholder:text-slate-400 focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all outline-none" 
                  id="user-password" 
                  placeholder="••••••••••••" 
                  required 
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button 
                  aria-label="Mostrar contraseña" 
                  className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none" 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined text-[19px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center gap-2" role="alert">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{error}</span>
              </div>
            )}
            
            {/* Botón Principal CTA */}
            <button 
              className="w-full h-11 mt-2 rounded-lg bg-secondary hover:bg-indigo-700 active:scale-[0.99] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-75" 
              type="submit"
              disabled={enviando}
            >
              <span>{enviando ? 'Ingresando...' : 'Acceder a la Plataforma'}</span>
              <span className="material-symbols-outlined text-[18px]">
                {enviando ? 'hourglass_empty' : 'arrow_forward'}
              </span>
            </button>
            
            <div className="relative my-4 flex items-center justify-center">
              <div className="w-full h-px bg-slate-200"></div>
            </div>
          </form>
        </div>
        
        {/* Pie de Página Discreto y Minimalista */}
        <div className="w-full pt-6 text-center">
          <p className="text-[12px] text-slate-400 font-normal">
            Universidad de Nariño
          </p>
        </div>
      </div>
    </div>
  )
}
