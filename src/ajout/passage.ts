// Ce que l'écran « Ajouter » confie au formulaire, le temps de passer d'un écran à l'autre.
// Tout reste en mémoire : rien n'est enregistré tant que je n'ai pas validé le formulaire.

import type { Description, RefCouverture } from './assistant'
import type { Prerempli } from './preremplir'

/** Une fiche préparée par la recherche automatique, pour une œuvre nouvelle. */
export type Apport = Prerempli & {
  /** Où trouver la couverture, si un catalogue en a une. */
  couverture: RefCouverture | null
  /** Les présentations des catalogues : elles servent à l'IA, jamais à remplir un champ. */
  descriptions: Description[]
}

/** Une édition trouvée par son ISBN, à ajouter à la fiche d'une œuvre déjà dans ma bibliothèque. */
export type EditionAAjouter = {
  oeuvre: string
  edition: { publisher: string; language: string; translator: string; isbn: string; pageCount: string }
  /** Quand l'ISBN est celui d'un tome : il va sur ce tome, pas sur une édition. */
  tome: number | null
}

let enAttente: EditionAAjouter | null = null

export const confierEdition = (edition: EditionAAjouter) => {
  enAttente = edition
}

/** L'édition confiée pour cette œuvre, s'il y en a une. Elle reste disponible jusqu'à `oublierEdition`. */
export const editionConfiee = (oeuvre: string): EditionAAjouter | null => (enAttente?.oeuvre === oeuvre ? enAttente : null)

export const oublierEdition = () => {
  enAttente = null
}
