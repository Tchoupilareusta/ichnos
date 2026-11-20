// Les tirets d'un ISBN. En base et dans tout ce qui part vers la base ou la fonction serveur,
// un ISBN n'a pas de tirets (isbnCompact). À l'écran, il les porte : 978-2-253-00848-4.
// Leur place dépend de plages attribuées aux pays et aux éditeurs, tenues à jour par la
// bibliothèque isbn3. Hors de ces plages, l'ISBN reste sans tirets : jamais de tirets devinés.

import * as isbn3 from 'isbn3'
import { isbnCompact, isbnValide } from './modele'

/** L'ISBN tel qu'il s'affiche : avec ses tirets si isbn3 sait les placer, sinon tel qu'il est rangé. */
export function isbnAffiche(isbn: string): string {
  const compact = isbnCompact(isbn)
  if (!isbnValide(compact)) return isbn
  // isbn3 rend null (malgré son type) pour un ISBN hors de ses plages.
  return (isbn3.hyphenate(compact) as string | null) ?? compact
}

/** Pour VoiceOver : « 9 7 8 2… », lu chiffre par chiffre, sans les tirets. */
export const isbnEnChiffres = (isbn: string) => [...isbnCompact(isbn)].join(' ')

/** Les caractères d'un ISBN dans une saisie : les chiffres, et un X final après neuf chiffres (ISBN à 10 caractères). */
function garder(saisie: string): { compact: string; rangs: number[] } {
  let compact = ''
  const rangs: number[] = []
  for (let rang = 0; rang < saisie.length; rang++) {
    const caractere = saisie[rang]
    if (caractere >= '0' && caractere <= '9') {
      compact += caractere
      rangs.push(rang)
    }
  }
  // Un X n'est gardé que s'il termine un ISBN à 10 caractères : rien d'autre que des séparateurs après lui.
  const dernier = saisie.search(/[xX][^0-9a-zA-Z]*$/)
  if (dernier !== -1 && compact.length === 9 && rangs.every((rang) => rang < dernier)) {
    compact += 'X'
    rangs.push(dernier)
  }
  return { compact, rangs }
}

/** Le groupe (pays ou langue) au début de `suite`, d'après les plages d'isbn3. */
function groupeDe(prefixe: string, suite: string): { groupe: string; plages: [string, string][] } | 'attente' | null {
  for (let longueur = 1; longueur <= Math.min(5, suite.length); longueur++) {
    const connu = isbn3.groups[`${prefixe}-${suite.slice(0, longueur)}`]
    if (connu) return { groupe: suite.slice(0, longueur), plages: connu.ranges }
  }
  const debut = `${prefixe}-${suite}`
  return suite.length < 5 && Object.keys(isbn3.groups).some((cle) => cle.startsWith(debut)) ? 'attente' : null
}

/** Le nombre de chiffres de l'éditeur, dès que le début saisi suffit à le savoir. */
function longueurEditeur(plages: [string, string][], suite: string): number | 'attente' | null {
  let possible = false
  for (const [debut, fin] of plages) {
    const longueur = debut.length
    if (suite.length >= longueur) {
      const editeur = suite.slice(0, longueur)
      if (editeur >= debut && editeur <= fin) return longueur
    } else if (suite >= debut.slice(0, suite.length) && suite <= fin.slice(0, suite.length)) {
      possible = true
    }
  }
  return possible ? 'attente' : null
}

/**
 * L'ISBN en cours de saisie, avec les tirets que le début saisi permet déjà de placer. Les
 * séparateurs et les lettres collés avec lui sont oubliés. Quand les tirets ne peuvent pas être
 * placés (hors plages, trop de chiffres), les chiffres restent tels quels, sans rien couper.
 */
export function isbnEnSaisie(saisie: string): string {
  const { compact } = garder(saisie)
  const treize = /^97[89]/.test(compact)
  // « 9 » ou « 97 » : peut-être le début de 978, on attend.
  if (!treize && /^9?7?$/.test(compact) && compact.startsWith('9')) return compact
  const prefixe = treize ? compact.slice(0, 3) : '978'
  const corps = treize ? compact.slice(3) : compact
  // Après le préfixe : neuf chiffres (groupe, éditeur, titre) et le caractère de contrôle.
  if (corps.length > 10) return compact
  if (corps === '') return compact
  const tete = treize ? [prefixe] : []

  const groupe = groupeDe(prefixe, corps.slice(0, 9))
  if (groupe === null) return compact
  if (groupe === 'attente') return [...tete, corps].join('-')
  const apresGroupe = corps.slice(groupe.groupe.length)
  if (apresGroupe === '') return [...tete, groupe.groupe].join('-')

  const editeur = longueurEditeur(groupe.plages, apresGroupe.slice(0, 9 - groupe.groupe.length))
  if (editeur === null) return compact
  if (editeur === 'attente') return [...tete, groupe.groupe, apresGroupe].join('-')
  const titre = 9 - groupe.groupe.length - editeur
  const apresEditeur = apresGroupe.slice(editeur)
  const morceaux = [...tete, groupe.groupe, apresGroupe.slice(0, editeur)]
  if (apresEditeur !== '') morceaux.push(apresEditeur.slice(0, titre))
  if (apresEditeur.length > titre) morceaux.push(apresEditeur.slice(titre))
  return morceaux.join('-')
}

/** Où se trouve le curseur dans la forme à tirets, après `nombre` caractères de l'ISBN. */
function curseurApres(affiche: string, nombre: number): number {
  if (nombre <= 0) return 0
  let vus = 0
  for (let rang = 0; rang < affiche.length; rang++) {
    if (affiche[rang] !== '-' && ++vus === nombre) return rang + 1
  }
  return affiche.length
}

/**
 * Ce que devient le champ après une frappe, un collage ou un effacement.
 *   precedent : la valeur d'avant ; brut : le texte du champ tel que le navigateur vient de le
 *   changer ; curseur : sa position dans ce texte ; sens : le sens d'un effacement.
 * Rend l'ISBN sans tirets (pour l'état du formulaire), sa forme à tirets (pour le champ) et la
 * place du curseur, comptée en chiffres et non en caractères. Effacer un tiret efface le chiffre
 * voisin : celui d'avant avec « retour arrière », celui d'après avec « Suppr ».
 */
export function saisirIsbn(precedent: string, brut: string, curseur: number, sens: 'arriere' | 'avant' = 'arriere'): { compact: string; affiche: string; curseur: number } {
  let { compact } = garder(brut)
  const { rangs } = garder(brut)
  let avant = rangs.filter((rang) => rang < curseur).length
  const avantSaisie = garder(precedent).compact
  if (compact === avantSaisie && brut.length < isbnEnSaisie(precedent).length) {
    // Seul un tiret a disparu : c'est un chiffre que je voulais effacer.
    if (sens === 'arriere' && avant > 0) {
      compact = compact.slice(0, avant - 1) + compact.slice(avant)
      avant -= 1
    } else if (sens === 'avant' && avant < compact.length) {
      compact = compact.slice(0, avant) + compact.slice(avant + 1)
    }
  }
  const affiche = isbnEnSaisie(compact)
  return { compact, affiche, curseur: curseurApres(affiche, avant) }
}
