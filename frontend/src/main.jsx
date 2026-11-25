import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import LimiteErrores from './components/common/LimiteErrores.jsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Último recurso fuera del layout (login, rutas sin menú) */}
    <LimiteErrores completo>
      <App />
    </LimiteErrores>
  </React.StrictMode>,
)
