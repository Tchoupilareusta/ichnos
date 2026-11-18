import { echelleTitre, teinteDe } from './palette'

type Props = {
  titre: string
  /** Affiché seulement sur les grandes couvertures (fiche). */
  auteur?: string | null
  /** Identifiant de l'œuvre : il fixe la teinte. */
  graine: string
  className?: string
}

/**
 * Couverture typographique générée. Toujours décorative (aria-hidden) : le titre est
 * déjà dit à côté. Le texte suit la largeur de la couverture (unités cqi) sans
 * jamais descendre sous 11 px.
 */
export function Couverture({ titre, auteur, graine, className = '' }: Props) {
  const { fond, texte } = teinteDe(graine)
  return (
    <div
      aria-hidden="true"
      className={`relative aspect-[2/3] overflow-hidden rounded-couverture ${className}`}
      style={{
        containerType: 'inline-size',
        background: fond,
        color: texte,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1), 0 8px 22px var(--ombre-forte)',
      }}
    >
      <div className="absolute inset-0 flex flex-col justify-between" style={{ padding: '11cqi' }}>
        <div
          lang="fr"
          className="font-titre font-medium hyphens-auto"
          style={{
            fontSize: `max(11px, ${echelleTitre(titre)}cqi)`,
            lineHeight: 1.12,
            overflowWrap: 'break-word',
          }}
        >
          {titre}
        </div>
        {auteur && (
          <div className="flex flex-col" style={{ gap: '5cqi' }}>
            <div style={{ height: 1, width: '20cqi', background: 'currentColor', opacity: 0.4 }} />
            <div className="font-bold uppercase" style={{ fontSize: 'max(11px, 6.2cqi)', letterSpacing: '0.06em', lineHeight: 1.25 }}>
              {auteur}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
