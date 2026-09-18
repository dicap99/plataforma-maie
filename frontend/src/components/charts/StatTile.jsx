// Cifra de titular: etiqueta · valor · detalle opcional.
export default function StatTile({ etiqueta, valor, detalle }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{etiqueta}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-800">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-slate-500">{detalle}</p>}
    </article>
  )
}
