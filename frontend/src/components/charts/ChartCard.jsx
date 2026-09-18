// Contenedor estándar para figuras/gráficas (estilizado con utilidades Tailwind).
export default function ChartCard({ titulo, subtitulo, children, altura = 'h-72' }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-3">
        <h3 className="text-base font-semibold text-slate-800">{titulo}</h3>
        {subtitulo && <p className="text-sm text-slate-500">{subtitulo}</p>}
      </header>
      <div className={`w-full ${altura}`}>{children}</div>
    </section>
  )
}
