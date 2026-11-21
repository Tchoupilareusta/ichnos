// Le score d'une œuvre candidate (§7.2) : affinité, contraste, accord avec l'envie, envie,
// disponibilité et hasard doux. Calcul pur : ni base, ni écran, ni horloge cachée.
import { ATMOSPHERES_DOUCES, GENRES, REGLES, aAtmosphere, aGenre, norme } from './envies'
import { hasard } from './hasard'
import type { Envie, OeuvreIdee } from './modele'

export const JOUR = 86_400_000
/** Une lecture terminée compte comme « récente » pendant six mois. */
const SIX_MOIS = 183 * JOUR
/** La plus récente de mes dernières lectures compte pleinement, la deuxième à 60 %, la troisième à 30 %. */
const POIDS_DES_RECENTES = [1, 0.6, 0.3]
/** Le coup de pouce de l'alternance indicative (§7.5) : jamais une règle. */
const COUP_DE_POUCE = 0.15
/** Un livre « En pause » n'insiste pas : sa note est un peu réduite. */
const RETENUE_PAUSE = 0.8
const NEUTRE = 0.5

// ---------------------------------------------------------------------------
// Mes dernières lectures
// ---------------------------------------------------------------------------

/**
 * Au plus trois : mes lectures « En cours » (à la date où j'y ai touché) et mes lectures
 * « Terminé » dont la date de fin est connue et a moins de six mois. La plus récente d'abord.
 * Un livre terminé sans date (lu autrefois) n'est pas une lecture récente.
 */
export function dernieresLectures(oeuvres: OeuvreIdee[], maintenant: Date): OeuvreIdee[] {
  const instant = maintenant.getTime()
  const datees: { oeuvre: OeuvreIdee; date: number }[] = []
  for (const oeuvre of oeuvres) {
    if (oeuvre.statut === 'en_cours') {
      const date = oeuvre.toucheeLe ? Date.parse(oeuvre.toucheeLe) : NaN
      datees.push({ oeuvre, date: Number.isNaN(date) ? 0 : date })
    } else if (oeuvre.statut === 'termine' && oeuvre.finieLe) {
      const date = Date.parse(oeuvre.finieLe)
      // Une journée de marge : une date de fin « aujourd'hui » ne doit pas passer pour future.
      if (!Number.isNaN(date) && date <= instant + JOUR && instant - date < SIX_MOIS) datees.push({ oeuvre, date })
    }
  }
  return datees
    .sort((a, b) => b.date - a.date || (a.oeuvre.id < b.oeuvre.id ? -1 : 1))
    .slice(0, POIDS_DES_RECENTES.length)
    .map((d) => d.oeuvre)
}

// ---------------------------------------------------------------------------
// Alternance indicative (§7.5)
// ---------------------------------------------------------------------------

/** Les cinq familles, dans l'ordre du cahier des charges. */
export const FAMILLES = ['philosophique', 'reconfortant', 'existentiel', 'social', 'autre'] as const
export type Famille = (typeof FAMILLES)[number]

/** La famille d'une œuvre, d'après ses étiquettes : le genre d'abord, la douceur ensuite. */
export function familleDe(o: OeuvreIdee): Famille {
  if (aGenre(o, GENRES.dystopie, GENRES.critiqueSociale)) return 'social'
  if (aGenre(o, GENRES.existentiel)) return 'existentiel'
  if (aGenre(o, GENRES.philosophique, GENRES.philosophie) || o.forme === 'philosophie') return 'philosophique'
  if ((o.tonalite ?? 0) >= 4 && (aAtmosphere(o, ...ATMOSPHERES_DOUCES) || aGenre(o, GENRES.humaniste))) return 'reconfortant'
  return 'autre'
}

const familleSuivante = (famille: Famille): Famille => FAMILLES[(FAMILLES.indexOf(famille) + 1) % FAMILLES.length]

// ---------------------------------------------------------------------------
// Contexte : ce que ma bibliothèque dit de moi, calculé une fois par demande
// ---------------------------------------------------------------------------

export type Contexte = {
  /** Mes dernières lectures, la plus récente d'abord. */
  recentes: OeuvreIdee[]
  /** Les œuvres dont le ressenti est « M'a marqué », « Beau moment » ou « À relire un jour ». */
  aimees: OeuvreIdee[]
  /** Les œuvres dont le ressenti est « Pas pour moi, pas maintenant ». */
  ecartees: OeuvreIdee[]
  /** La famille qui suit celle de ma dernière lecture, ou null sans lecture récente. */
  suivante: Famille | null
  /** Combien d'œuvres de ma bibliothèque portent chaque genre : sert à nommer le genre qui distingue une œuvre. */
  frequenceDesGenres: Map<string, number>
}

export function contexteDe(oeuvres: OeuvreIdee[], maintenant: Date): Contexte {
  const parId = (a: OeuvreIdee, b: OeuvreIdee) => (a.id < b.id ? -1 : 1)
  const recentes = dernieresLectures(oeuvres, maintenant)
  const frequenceDesGenres = new Map<string, number>()
  for (const o of oeuvres) for (const genre of new Set(o.genres.map(norme))) frequenceDesGenres.set(genre, (frequenceDesGenres.get(genre) ?? 0) + 1)
  return {
    frequenceDesGenres,
    recentes,
    aimees: oeuvres.filter((o) => o.appreciation === 'marque' || o.appreciation === 'beau_moment' || o.appreciation === 'a_relire').sort(parId),
    ecartees: oeuvres.filter((o) => o.appreciation === 'pas_pour_moi').sort(parId),
    suivante: recentes.length > 0 ? familleSuivante(familleDe(recentes[0])) : null,
  }
}

/**
 * Le genre qui distingue le mieux une œuvre : le plus rare dans ma bibliothèque (« Dystopie »
 * plutôt que « Classique », que beaucoup d'œuvres portent). À égalité, le premier.
 */
export function genreDistinctif(o: OeuvreIdee, contexte: Contexte): string | null {
  let choisi: string | null = null
  let rarete = Infinity
  for (const genre of o.genres) {
    const frequence = contexte.frequenceDesGenres.get(norme(genre)) ?? 0
    if (frequence < rarete) {
      choisi = genre
      rarete = frequence
    }
  }
  return choisi
}

// ---------------------------------------------------------------------------
// Composantes
// ---------------------------------------------------------------------------

/** Part d'étiquettes communes (0 : rien en commun, 1 : les mêmes). Vide : on ne sait pas. */
export function ressemblanceDe(a: string[], b: string[]): number | null {
  if (a.length === 0 || b.length === 0) return null
  const dansA = new Set(a.map(norme))
  const dansB = new Set(b.map(norme))
  let communs = 0
  for (const nom of dansA) if (dansB.has(nom)) communs++
  return communs / (dansA.size + dansB.size - communs)
}

const difference = (a: string[], b: string[]) => {
  const ressemblance = ressemblanceDe(a, b)
  return ressemblance === null ? NEUTRE : 1 - ressemblance
}

/** Écart de tonalité, de 0 (la même) à 1 (de 1 à 5). Inconnue : neutre. */
export const ecartDeTonalite = (a: number | null, b: number | null) => (a === null || b === null ? NEUTRE : Math.abs(a - b) / 4)

const borner = (x: number) => Math.max(0, Math.min(1, x))
const porteLeTheme = (o: OeuvreIdee, theme: string) => o.themes.some((t) => norme(t.nom) === norme(theme))

/**
 * Affinité : 60 % la part de ses thèmes qui sont des thèmes de cœur, 40 % ses thèmes en commun
 * avec les œuvres que j'ai aimées. « Pas pour moi, pas maintenant » retire un peu (20 % au plus),
 * sans jamais écarter une œuvre. (La part, et non le nombre : sinon la moitié du catalogue
 * atteint la note maximale.)
 */
function affiniteDe(o: OeuvreIdee, contexte: Contexte): number {
  if (o.themes.length === 0) return 0
  const partCoeur = o.themes.filter((t) => t.coeur).length / o.themes.length
  let aimes = 0
  let ecartes = 0
  for (const theme of o.themes) {
    aimes += Math.min(1, 0.5 * contexte.aimees.filter((autre) => autre.id !== o.id && porteLeTheme(autre, theme.nom)).length)
    ecartes += 0.5 * contexte.ecartees.filter((autre) => autre.id !== o.id && porteLeTheme(autre, theme.nom)).length
  }
  return borner(0.6 * partCoeur + 0.4 * Math.min(1, aimes / 2) - 0.2 * Math.min(1, ecartes / 2))
}

/**
 * Contraste avec mes dernières lectures : 50 % l'écart de tonalité, 25 % les genres différents,
 * 25 % les atmosphères différentes, plus le coup de pouce de l'alternance. Sans lecture récente :
 * neutre pour tout le monde.
 */
function contrasteDe(o: OeuvreIdee, contexte: Contexte): number {
  if (contexte.recentes.length === 0) return NEUTRE
  let somme = 0
  let poids = 0
  contexte.recentes.forEach((recente, rang) => {
    const ecart = 0.5 * ecartDeTonalite(o.tonalite, recente.tonalite) + 0.25 * difference(o.genres, recente.genres) + 0.25 * difference(o.atmospheres, recente.atmospheres)
    somme += POIDS_DES_RECENTES[rang] * ecart
    poids += POIDS_DES_RECENTES[rang]
  })
  return borner(somme / poids + (familleDe(o) === contexte.suivante ? COUP_DE_POUCE : 0))
}

// ---------------------------------------------------------------------------
// La note
// ---------------------------------------------------------------------------

/** La note d'une œuvre pour une envie, avec ses raisons : c'est d'elles que la phrase est tirée. Jamais affichée. */
export type Note = {
  oeuvre: OeuvreIdee
  score: number
  accord: number
  affinite: number
  contraste: number
  envie: number
  disponibilite: number
  hasard: number
  /** Sa tonalité moins celle de ma dernière lecture (positif : plus lumineux), ou null si on ne sait pas. */
  ecartTon: number | null
}

export function noter(o: OeuvreIdee, envie: Envie, graine: string, contexte: Contexte): Note {
  const { poids, accord: accordDe } = REGLES[envie]
  const accord = accordDe(o)
  const affinite = affiniteDe(o, contexte)
  const contraste = contrasteDe(o, contexte)
  const enEnvie = o.statut === 'envie_de_lire' ? 1 : 0
  // Pour une série, « J'en ai une partie » suffit : je peux commencer.
  const disponibilite = o.possession === 'possede' || o.possession === 'partielle' ? 1 : 0
  const tirage = hasard(graine, o.id)
  const brut =
    poids.accord * accord +
    poids.affinite * affinite +
    poids.contraste * contraste +
    poids.envie * enEnvie +
    poids.disponibilite * disponibilite +
    poids.hasard * tirage
  const derniere = contexte.recentes[0]
  return {
    oeuvre: o,
    score: o.statut === 'en_pause' ? brut * RETENUE_PAUSE : brut,
    accord,
    affinite,
    contraste,
    envie: enEnvie,
    disponibilite,
    hasard: tirage,
    ecartTon: derniere && o.tonalite !== null && derniere.tonalite !== null ? o.tonalite - derniere.tonalite : null,
  }
}
