import { useState } from 'react'
import { useAdresseCouverture } from '../bibliotheque/requetes'
import { couleurDesBords, fondAdouci } from './fond'
import { echelleTitre, teinteDe } from './palette'

type Props = {
  titre: string
  /** Affiché seulement sur les grandes couvertures (fiche). */
  auteur?: string | null
  /** Identifiant de l'œuvre : il fixe la teinte. */
  graine: string
  /** Chemin de l'image dans mon stockage privé, si une couverture a été trouvée. */
  chemin?: string | null
  /** Adresse d'une image pas encore rangée (aperçu pendant l'ajout). */
  apercu?: string | null
  className?: string
}

/**
 * Couverture d'une œuvre. La couverture typographique est toujours là, jamais de case vide ;
 * quand une image existe, elle vient se poser par-dessus, entière : le cadre garde son format 2:3
 * (grille régulière), et un fond tiré des bords de l'image remplit les bandes qu'elle laisse.
 * Toujours décorative (aria-hidden) : le titre est déjà dit à côté. Le texte suit la largeur de
 * la couverture (unités cqi) sans jamais descendre sous 11 px. L'état est porté par data-etat
 * pour les animations de l'étape 9.
 */
export function Couverture({ titre, auteur, graine, chemin, apercu, className = '' }: Props) {
  const { fond, texte } = teinteDe(graine)
  const rangee = useAdresseCouverture(chemin)
  const adresse = apercu ?? rangee
  // L'image n'apparaît qu'une fois chargée ; si elle ne se charge pas, la couverture typographique reste.
  const [chargee, setChargee] = useState<{ adresse: string; fond: string } | null>(null)
  const [illisible, setIllisible] = useState<string | null>(null)
  const visible = adresse !== null && illisible !== adresse
  const posee = visible && chargee?.adresse === adresse
  return (
    <div
      aria-hidden="true"
      data-etat={posee ? 'image' : 'typographique'}
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
      {visible && (
        // Le fond couvre toute la couverture typographique : son texte ne paraît pas dans les bandes.
        <div
          data-role="fond-image"
          className={`absolute inset-0 transition-opacity duration-300 ease-out motion-reduce:transition-none ${posee ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: posee ? chargee.fond : 'var(--surface)' }}
        >
          <img
            src={adresse}
            alt=""
            decoding="async"
            onLoad={(evenement) => setChargee({ adresse, fond: fondAdouci(couleurDesBords(evenement.currentTarget)) })}
            onError={() => setIllisible(adresse)}
            className="size-full object-contain object-center"
          />
        </div>
      )}
    </div>
  )
}
