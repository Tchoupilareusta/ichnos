// Les six envies (§7.3) : pour chacune, son filtre, son « accord » (à quel point une œuvre y
// correspond) et les poids du score. Les étiquettes sont reconnues par leur nom : si je renomme
// « Dystopie » dans mes réglages, l'envie « Remets mes idées en question » ne la reconnaît plus
// (limite connue de la version 1).
import { normaliser, type Forme } from '../bibliotheque/modele'
import type { Envie, OeuvreIdee } from './modele'

// Les noms d'étiquettes dont dépendent les envies et l'alternance : un seul endroit.
export const GENRES = {
  philosophique: 'Roman philosophique',
  existentiel: 'Littérature existentielle',
  philosophie: 'Philosophie',
  spiritualite: 'Spiritualité',
  dystopie: 'Dystopie',
  critiqueSociale: 'Critique sociale',
  humaniste: 'Récit humaniste',
} as const

export const ATMOSPHERES = {
  douce: 'Douce',
  chaleureuse: 'Chaleureuse',
  sereine: 'Sereine',
  introspective: 'Introspective',
  derangeante: 'Dérangeante',
} as const

/** Pour le test qui vérifie que ces noms existent bien dans mon vocabulaire. */
export const ETIQUETTES_DES_ENVIES = { genres: Object.values(GENRES) as string[], atmospheres: Object.values(ATMOSPHERES) as string[] }

// Comparaison tolérante (majuscules, accents, apostrophes), gardée en mémoire : elle sert beaucoup.
const normes = new Map<string, string>()
export function norme(nom: string): string {
  let n = normes.get(nom)
  if (n === undefined) {
    n = normaliser(nom)
    normes.set(nom, n)
  }
  return n
}

const porte = (liste: string[], nom: string) => liste.some((element) => norme(element) === norme(nom))
export const aGenre = (o: OeuvreIdee, ...noms: string[]) => noms.some((nom) => porte(o.genres, nom))
export const aAtmosphere = (o: OeuvreIdee, ...noms: string[]) => noms.some((nom) => porte(o.atmospheres, nom))
const combien = (liste: string[], noms: string[]) => noms.filter((nom) => porte(liste, nom)).length

/** Les atmosphères qui font une lecture réconfortante. */
export const ATMOSPHERES_DOUCES: string[] = [ATMOSPHERES.douce, ATMOSPHERES.chaleureuse, ATMOSPHERES.sereine]
/** Les genres qui font une réflexion philosophique, du plus net au moins net. */
export const GENRES_PHILOSOPHIQUES: string[] = [GENRES.philosophique, GENRES.existentiel, GENRES.philosophie, GENRES.spiritualite]
export const GENRES_QUI_DERANGENT: string[] = [GENRES.dystopie, GENRES.critiqueSociale]

const FORMES_BREVES: Forme[] = ['conte', 'nouvelle', 'roman_court']

/** Les poids des composantes du score : leur somme vaut 1. */
export type Poids = { accord: number; affinite: number; contraste: number; envie: number; disponibilite: number; hasard: number }

export type Regle = {
  /** L'œuvre entre-t-elle dans cette envie ? Jamais contourné pour « remplir ». */
  filtre: (o: OeuvreIdee) => boolean
  /** De 0 à 1 : à quel point elle y correspond. */
  accord: (o: OeuvreIdee) => number
  poids: Poids
  /** Ce que coûte la ressemblance avec une proposition déjà retenue, et le fait d'être de la même famille. */
  variete: { ressemblance: number; famille: number }
  /** Contraste minimal avec mes dernières lectures (« Changer d'univers »). */
  seuilContraste?: number
}

const POIDS_A_FILTRE: Poids = { accord: 0.25, affinite: 0.25, contraste: 0.2, envie: 0.1, disponibilite: 0.05, hasard: 0.15 }
const VARIETE_FORTE = { ressemblance: 0.35, famille: 0.2 }
const VARIETE_DOUCE = { ressemblance: 0.25, famille: 0.08 }

export const REGLES: Record<Envie, Regle> = {
  // Aucun filtre, variété maximale, davantage de hasard.
  surprise: {
    filtre: () => true,
    accord: () => 0,
    poids: { accord: 0, affinite: 0.3, contraste: 0.25, envie: 0.1, disponibilite: 0.05, hasard: 0.3 },
    variete: VARIETE_FORTE,
  },
  // Tonalité lumineuse, et atmosphère douce ou récit humaniste.
  reconfortant: {
    filtre: (o) => (o.tonalite ?? 0) >= 4 && (aAtmosphere(o, ...ATMOSPHERES_DOUCES) || aGenre(o, GENRES.humaniste)),
    accord: (o) =>
      0.4 * (o.tonalite === 5 ? 1 : 0.5) + 0.4 * Math.min(1, combien(o.atmospheres, ATMOSPHERES_DOUCES) / 2) + 0.2 * (o.exigence !== null && o.exigence <= 2 ? 1 : 0),
    poids: POIDS_A_FILTRE,
    variete: VARIETE_DOUCE,
  },
  // Existentiel, moral ou introspectif.
  philosophique: {
    filtre: (o) => aGenre(o, ...GENRES_PHILOSOPHIQUES) || aAtmosphere(o, ATMOSPHERES.introspective),
    accord: (o) =>
      Math.min(
        1,
        0.6 * combien(o.genres, [GENRES.philosophique, GENRES.existentiel, GENRES.philosophie]) +
          (aAtmosphere(o, ATMOSPHERES.introspective) ? 0.4 : 0) +
          (aGenre(o, GENRES.spiritualite) ? 0.3 : 0),
      ),
    poids: POIDS_A_FILTRE,
    variete: VARIETE_DOUCE,
  },
  // Dystopie, critique sociale, littérature dérangeante.
  remise_en_question: {
    filtre: (o) => aGenre(o, ...GENRES_QUI_DERANGENT) || aAtmosphere(o, ATMOSPHERES.derangeante),
    accord: (o) => Math.min(1, 0.6 * combien(o.genres, GENRES_QUI_DERANGENT) + (aAtmosphere(o, ATMOSPHERES.derangeante) ? 0.4 : 0)),
    poids: POIDS_A_FILTRE,
    variete: VARIETE_DOUCE,
  },
  // Longueur courte, conte, nouvelle, roman court. Jamais une série : 29 tomes ne font pas une lecture courte.
  lecture_courte: {
    filtre: (o) => !o.estSerie && (o.longueur === 'court' || FORMES_BREVES.includes(o.forme)),
    accord: (o) => (o.longueur === 'court' ? 0.7 : 0) + (o.forme === 'conte' || o.forme === 'nouvelle' ? 0.3 : 0.15),
    poids: POIDS_A_FILTRE,
    variete: VARIETE_DOUCE,
  },
  // Écart maximal avec mes trois dernières lectures : pas de filtre d'étiquette, mais un contraste minimal.
  changer_d_univers: {
    filtre: () => true,
    accord: () => 0,
    poids: { accord: 0, affinite: 0.15, contraste: 0.6, envie: 0.1, disponibilite: 0.05, hasard: 0.1 },
    variete: VARIETE_FORTE,
    seuilContraste: 0.5,
  },
}
