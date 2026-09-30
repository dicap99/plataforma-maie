// Cifra de titular: etiqueta · valor · detalle opcional.
export default function StatTile({ etiqueta, valor, detalle }) {
  return (
    <article className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
      <p className="text-label-sm font-semibold uppercase text-on-surface-variant">{etiqueta}</p>
      <p className="mt-1 font-display text-headline-lg text-primary">{valor}</p>
      {detalle && <p className="mt-1 text-body-sm text-on-surface-variant">{detalle}</p>}
    </article>
  )
}
