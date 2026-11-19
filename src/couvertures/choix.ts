// Quelle couverture montrer pour une œuvre, et où ranger celle qu'on vient de trouver.
// (docs/reference.md §8 : la couverture typographique reste le dernier recours.)

import { progressionSerie, type LectureTome } from '../bibliotheque/suivi'

/** Les chemins de couverture connus pour une œuvre (dans le stockage privé), null quand il n'y en a pas. */
export type CouverturesOeuvre = {
  estSerie: boolean
  /** Couverture de l'œuvre elle-même. */
  oeuvre: string | null
  /** Couverture de mon édition. */
  monEdition: string | null
  tomes: { numero: number; lecture: LectureTome; couverture: string | null }[]
}

/**
 * Un livre : la couverture de mon édition, sinon celle de l'œuvre.
 * Une série : le tome où j'en suis, sinon le tome 1, sinon le premier tome illustré, sinon celle de l'œuvre.
 * Rien de tout cela : null, et la couverture typographique s'affiche.
 */
export function couvertureAffichee(c: CouverturesOeuvre): string | null {
  if (!c.estSerie) return c.monEdition ?? c.oeuvre
  const duTome = (numero: number | null) => c.tomes.find((t) => t.numero === numero)?.couverture ?? null
  const premiereTrouvee = [...c.tomes].sort((a, b) => a.numero - b.numero).find((t) => t.couverture)?.couverture ?? null
  return duTome(progressionSerie(c.tomes).position) ?? duTome(1) ?? premiereTrouvee ?? c.oeuvre
}

/** Où une couverture est rangée : sur l'œuvre, sur une de ses éditions, ou sur un de ses tomes. */
export type CibleCouverture = { type: 'oeuvre' } | { type: 'edition'; edition: string } | { type: 'tome'; numero: number }

/**
 * Où ranger une couverture trouvée. Celle d'un tome va sur le tome. Celle d'une édition va
 * sur cette édition si c'est la mienne (c'est elle qui s'affiche) ; sinon sur l'œuvre.
 */
export function cibleCouverture(trouvee: { edition: string | null; monEdition: string | null; tome?: number | null }): CibleCouverture {
  if (trouvee.tome) return { type: 'tome', numero: trouvee.tome }
  if (trouvee.edition && trouvee.edition === trouvee.monEdition) return { type: 'edition', edition: trouvee.edition }
  return { type: 'oeuvre' }
}
