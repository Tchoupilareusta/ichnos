import { useState } from 'react'
import { useAdresseCouverture } from '../bibliotheque/requetes'
import { cadrageDe, placer, type Cadrage } from './cadrage'
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

/** Le liseré et l'ombre d'un livre : ils suivent la forme de ce qui est montré. */
const OMBRE = 'inset 0 0 0 1px rgba(255,255,255,0.1), 0 8px 22px var(--ombre-forte)'
const FONDU = 'transition-opacity duration-300 ease-out motion-reduce:transition-none'

/**
 * Couverture d'une œuvre, dans une case au format 5:8 (celui des poches français), toujours la
 * même pour que la grille reste régulière. La couverture typographique est toujours là, jamais de
 * case vide ; quand une image existe, elle vient par-dessus (cadrage.ts) : proche du format de la
 * case, elle la remplit ; sinon elle est posée en bas, à sa vraie forme, comme un livre sur une
 * étagère, sans bande colorée autour : le reste de la case laisse voir le fond de l'appli.
 * Toujours décorative (aria-hidden) : le titre est déjà dit à côté. Le texte suit la largeur de
 * la couverture (unités cqi) sans jamais descendre sous 11 px. L'état est porté par data-etat
 * (« typographique », « image », « etagere ») pour les animations de l'étape 9.
 */
export function Couverture({ titre, auteur, graine, chemin, apercu, className = '' }: Props) {
  const { fond, texte } = teinteDe(graine)
  const rangee = useAdresseCouverture(chemin)
  const adresse = apercu ?? rangee
  // L'image n'apparaît qu'une fois chargée et mesurée ; si elle ne se charge pas, la couverture typographique reste.
  const [chargee, setChargee] = useState<{ adresse: string; cadrage: Cadrage | null } | null>(null)
  const [illisible, setIllisible] = useState<string | null>(null)
  const visible = adresse !== null && illisible !== adresse
  const posee = visible && chargee?.adresse === adresse
  const cadrage = posee ? chargee.cadrage : null
  const etagere = cadrage?.mode === 'etagere'
  // Une image qu'on n'a pas su mesurer remplit la case, sans déformation (« cover »).
  const place = cadrage ? placer(cadrage) : null
  const livre = place?.livre ?? { largeur: 100, hauteur: 100 }
  return (
    <div
      aria-hidden="true"
      data-etat={!posee ? 'typographique' : etagere ? 'etagere' : 'image'}
      className={`relative aspect-[5/8] ${className}`}
      style={{ containerType: 'inline-size' }}
    >
      <div
        data-role="typographique"
        className={`absolute inset-0 overflow-hidden rounded-couverture ${FONDU} ${etagere ? 'opacity-0' : 'opacity-100'}`}
        style={{ background: fond, color: texte, boxShadow: OMBRE }}
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
      {visible && (
        // Le livre : posé en bas de la case et centré. Il coupe ce qui dépasse de la partie montrée.
        <div
          data-role="livre"
          className={`absolute bottom-0 overflow-hidden rounded-couverture ${FONDU} ${posee ? 'opacity-100' : 'opacity-0'}`}
          style={{
            width: `${livre.largeur}%`,
            height: `${livre.hauteur}%`,
            left: `${(100 - livre.largeur) / 2}%`,
            background: 'var(--surface)',
            boxShadow: OMBRE,
          }}
        >
          <img
            src={adresse}
            alt=""
            decoding="async"
            onLoad={(evenement) => {
              const image = evenement.currentTarget
              void cadrageDe(image).then((mesure) => setChargee({ adresse, cadrage: mesure }))
            }}
            onError={() => setIllisible(adresse)}
            className={place ? 'absolute max-w-none' : 'size-full object-cover object-center'}
            style={
              place
                ? { width: `${place.image.largeur}%`, height: `${place.image.hauteur}%`, left: `${place.image.gauche}%`, top: `${place.image.haut}%` }
                : undefined
            }
          />
        </div>
      )}
    </div>
  )
}
