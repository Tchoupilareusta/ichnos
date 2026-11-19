import type { PossessionAffichee, Statut } from '../bibliotheque/modele'
import { Svg } from './Icones'

// Icônes dessinées pour Ichnos. Toujours accompagnées de leur mot, et cachées à VoiceOver
// (aria-hidden) : c'est le mot qui est lu.
//
// Statuts : un même livre, dans cinq états.
//   En cours       — le livre ouvert, je suis dedans
//   Envie de lire  — un cœur sur la couverture
//   Terminé        — une coche sur la couverture
//   À découvrir    — une étincelle de neuf sur la couverture
//   En pause       — le livre ouvert, posé à l'envers, comme on le laisse sur une table

const COUVERTURE = (
  <>
    <path d="M6 4.5h10.5a1.5 1.5 0 0 1 1.5 1.5v13.5H7.5A1.5 1.5 0 0 1 6 18z" />
    <path d="M6 18a1.5 1.5 0 0 1 1.5-1.5H18" />
  </>
)

const DESSINS: Record<Statut, React.ReactNode> = {
  en_cours: (
    <>
      <path d="M12 6.5c-1.8-1.3-4.3-1.8-7.5-1.5v12.5c3.2-.3 5.7.2 7.5 1.5 1.8-1.3 4.3-1.8 7.5-1.5V5c-3.2-.3-5.7.2-7.5 1.5z" />
      <path d="M12 6.5V19" />
    </>
  ),
  envie_de_lire: (
    <>
      {COUVERTURE}
      <path d="M12 13.2l-2.1-2a1.25 1.25 0 0 1 2.1-1.5 1.25 1.25 0 0 1 2.1 1.5z" />
    </>
  ),
  termine: (
    <>
      {COUVERTURE}
      <path d="M9.6 10.6l1.7 1.7 3.2-3.4" />
    </>
  ),
  a_decouvrir: (
    <>
      {COUVERTURE}
      <path d="M12 7.6l.65 1.75 1.75.65-1.75.65L12 12.4l-.65-1.75L9.6 10l1.75-.65z" />
    </>
  ),
  en_pause: (
    <>
      <path d="M3 18.5 12 7.5l9 11" />
      <path d="M6.8 18.5 12 12l5.2 6.5" />
      <path d="M2 20.5h20" />
    </>
  ),
}

export function IconeStatut({ statut, taille = 20 }: { statut: Statut; taille?: number }) {
  return <Svg taille={taille}>{DESSINS[statut]}</Svg>
}

/** Le livre seul, sans marque : la bulle « Statut » avant qu'un statut soit choisi. */
export function IconeLivre({ taille = 20 }: { taille?: number }) {
  return <Svg taille={taille}>{COUVERTURE}</Svg>
}

/** Un cercle et son point : la bulle « Possession » avant qu'une possession soit choisie. */
export function IconePossessionGenerique({ taille = 16 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="shrink-0">
      <circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="8" r="2.4" fill="currentColor" />
    </svg>
  )
}

/**
 * Possession : le code de la grille des tomes. Plein = je l'ai, pointillé = à acheter,
 * vide = je ne l'ai pas, à moitié plein = j'en ai une partie.
 */
export function IconePossession({ possession, taille = 16 }: { possession: PossessionAffichee; taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="shrink-0">
      {possession === 'possede' ? (
        <circle cx="8" cy="8" r="6" fill="currentColor" />
      ) : (
        <circle
          cx="8"
          cy="8"
          r="5.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeDasharray={possession === 'a_acheter' ? '2.2 2' : undefined}
        />
      )}
      {possession === 'partielle' && <path d="M8 2.4a5.6 5.6 0 0 1 0 11.2z" fill="currentColor" />}
    </svg>
  )
}
