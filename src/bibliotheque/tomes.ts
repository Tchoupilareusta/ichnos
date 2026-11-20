import type { ChangementTome, Tome } from './depot'
import { POSSESSIONS, type Possession } from './modele'
import { LECTURES_TOME, type LectureTome } from './suivi'

/** Le choix d'une bulle de la barre d'actions : une possession, ou une lecture. */
export type ChoixTomes = { type: 'possession'; valeur: Possession } | { type: 'lecture'; valeur: LectureTome }

/** Au-delà de ce nombre de tomes qui changent vraiment, une confirmation est demandée. */
export const SEUIL_CONFIRMATION = 10

/** Les bulles de la barre, dans l'ordre demandé : « Lu » d'abord pour la lecture. */
export const BULLES_POSSESSION = POSSESSIONS
export const BULLES_LECTURE: { valeur: LectureTome; libelle: string }[] = (['lu', 'en_cours', 'a_lire'] as const).map(
  (valeur) => LECTURES_TOME.find((l) => l.valeur === valeur)!,
)

export function libelleChoix(choix: ChoixTomes) {
  return choix.type === 'possession'
    ? POSSESSIONS.find((p) => p.valeur === choix.valeur)!.libelle
    : LECTURES_TOME.find((l) => l.valeur === choix.valeur)!.libelle
}

const dejaAinsi = (tome: Tome, choix: ChoixTomes) =>
  choix.type === 'possession' ? tome.possession === choix.valeur : tome.lecture === choix.valeur

/**
 * Ce qu'un choix change vraiment parmi les tomes sélectionnés, et de quoi l'annuler :
 * l'état d'avant de ces mêmes tomes, possession et lecture ensemble.
 */
export function preparerChangement(tomes: Tome[], selection: ReadonlySet<number>, choix: ChoixTomes) {
  const concernes = tomes.filter((t) => selection.has(t.numero) && !dejaAinsi(t, choix))
  const changements: ChangementTome[] = concernes.map((t) =>
    choix.type === 'possession' ? { numero: t.numero, possession: choix.valeur } : { numero: t.numero, lecture: choix.valeur },
  )
  const annulation: ChangementTome[] = concernes.map((t) => ({ numero: t.numero, possession: t.possession, lecture: t.lecture }))
  return { changements, annulation }
}

/**
 * Les tomes après des changements (affichage immédiat, et faux dépôt des tests). Les tomes
 * de l'accueil ne portent que leur lecture : leur possession n'y est pas ajoutée.
 */
export function appliquerChangements<T extends { numero: number; lecture: LectureTome; possession?: Possession }>(
  tomes: T[],
  changements: ChangementTome[],
): T[] {
  const parNumero = new Map(changements.map((c) => [c.numero, c]))
  return tomes.map((t) => {
    const c = parNumero.get(t.numero)
    if (!c) return t
    return {
      ...t,
      lecture: c.lecture ?? t.lecture,
      ...('possession' in t && c.possession ? { possession: c.possession } : {}),
    }
  })
}

const tomes = (n: number) => (n === 1 ? '1 tome' : `${n} tomes`)

/** « 4 tomes sélectionnés » */
export const texteSelection = (n: number) => (n === 1 ? '1 tome sélectionné' : `${n} tomes sélectionnés`)

/** Le message temporaire après un changement, court pour tenir sur une ligne : « 6 tomes : Je l’ai », « Tome 4 : Lu ». */
export const texteApplique = (numeros: number[], choix: ChoixTomes) =>
  `${numeros.length === 1 ? `Tome ${numeros[0]}` : `${numeros.length} tomes`} : ${libelleChoix(choix)}`

/** Quand aucun tome sélectionné ne change (court, pour tenir sur une ligne). */
export const texteRienAChanger = (choix: ChoixTomes) => `Déjà « ${libelleChoix(choix)} » : rien n’a changé.`

/** La confirmation au-delà du seuil : « Changer 12 tomes ? » */
export const titreConfirmation = (n: number) => `Changer ${tomes(n)} ?`
export const texteConfirmation = (n: number, choix: ChoixTomes) =>
  `${n === 1 ? 'Il sera marqué' : 'Ils seront marqués'} « ${libelleChoix(choix)} ». « Annuler » restera possible quelques secondes.`

/**
 * La sélection pendant un glissement du doigt, comme dans Photos : le premier tome touché décide
 * du sens (il n'était pas sélectionné : on sélectionne ; il l'était : on désélectionne). Tous les
 * tomes entre lui et celui sous le doigt, dans l'ordre des numéros, suivent ce sens ; les autres
 * gardent l'état qu'ils avaient avant le geste (revenir en arrière les rend).
 */
export function selectionGlissee(
  numeros: number[],
  avant: ReadonlySet<number>,
  depart: number,
  courant: number,
): Set<number> {
  const selectionner = !avant.has(depart)
  const i = numeros.indexOf(depart)
  const j = numeros.indexOf(courant)
  const resultat = new Set(avant)
  if (i < 0 || j < 0) return resultat
  for (const numero of numeros.slice(Math.min(i, j), Math.max(i, j) + 1)) {
    if (selectionner) resultat.add(numero)
    else resultat.delete(numero)
  }
  return resultat
}

/** Maj + clic : du dernier tome touché jusqu'à celui-ci, tous sélectionnés. */
export function selectionPlage(numeros: number[], avant: ReadonlySet<number>, ancre: number, numero: number): Set<number> {
  return selectionGlissee(numeros, new Set([...avant].filter((n) => n !== ancre)), ancre, numero)
}
