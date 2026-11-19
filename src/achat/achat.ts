// « Je l'ai acheté » : ce qui part vers la base, et la vérification du titre trouvé.

import type { Notice } from '../ajout/assistant'
import { cleTitre, titresProches } from '../ajout/preremplir'
import type { Achat } from '../bibliotheque/depot'

/**
 * Le titre trouvé par les catalogues ressemble-t-il à l'un des titres connus de l'œuvre (français,
 * original) ? Comparaison tolérante : casse, accents, article, faute de frappe, sous-titre en plus.
 * Sans titre à comparer d'un côté ou de l'autre, rien à signaler.
 */
export function titreRessemble(trouve: string, connus: (string | null | undefined)[]): boolean {
  const cherche = cleTitre(trouve)
  const titres = connus.map((titre) => cleTitre(titre ?? '')).filter(Boolean)
  if (!cherche || titres.length === 0) return true
  return titres.some((titre) => titresProches(titre, cherche) || cherche.startsWith(`${titre} `) || titre.startsWith(`${cherche} `))
}

/**
 * L'achat envoyé à la fonction noter_achat. Seulement ce qu'une source donne : un champ inconnu
 * n'est pas envoyé, et reste vide. Pour un tome : son ISBN, son numéro et sa couverture, rien d'autre.
 */
export function preparerAchat(donnees: { isbn: string; notice: Notice | null; tome: number | null; couverture: string | null }): Achat {
  const { isbn, notice, tome, couverture } = donnees
  const achat: Achat = { isbn }
  if (tome !== null) achat.tome = tome
  else if (notice) {
    if (notice.editeur) achat.publisher = notice.editeur.valeur
    if (notice.langue) achat.language = notice.langue.valeur
    if (notice.traducteur) achat.translator = notice.traducteur.valeur
    if (notice.pages) achat.page_count = notice.pages.valeur
  }
  if (couverture) achat.couverture = couverture
  return achat
}
