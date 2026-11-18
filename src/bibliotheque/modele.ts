// Le vocabulaire de la bibliothèque : valeurs codées de la base (docs/reference.md §6),
// libellés affichés, et règles de calcul qui ne dépendent ni de la base ni de l'écran.

export type Statut = 'en_cours' | 'envie_de_lire' | 'termine' | 'a_decouvrir' | 'en_pause'
export type Possession = 'possede' | 'a_acheter' | 'non_possede'
/** Possession affichée : pour une série, « partielle » quand je n'ai qu'une partie des tomes. */
export type PossessionAffichee = Possession | 'partielle'
export type Forme = 'roman' | 'roman_court' | 'nouvelle' | 'conte' | 'poesie' | 'essai' | 'philosophie' | 'manga' | 'autre'
export type Longueur = 'court' | 'moyen' | 'long'
export type GenreEtiquette = 'genre' | 'theme' | 'atmosphere'
export type Role = 'auteur' | 'traducteur' | 'illustrateur'
export type TypeMedia = 'anime' | 'film' | 'serie' | 'autre'

/** Cinq statuts, du plus utile au moins utile : cet ordre vaut partout (menus, filtres, listes). */
export const STATUTS: { valeur: Statut; libelle: string }[] = [
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'envie_de_lire', libelle: 'Envie de lire' },
  { valeur: 'termine', libelle: 'Terminé' },
  { valeur: 'a_decouvrir', libelle: 'À découvrir' },
  { valeur: 'en_pause', libelle: 'En pause' },
]

export const POSSESSIONS: { valeur: Possession; libelle: string }[] = [
  { valeur: 'possede', libelle: 'Je l’ai' },
  { valeur: 'a_acheter', libelle: 'À acheter' },
  { valeur: 'non_possede', libelle: 'Je ne l’ai pas' },
]

export const FORMES: { valeur: Forme; libelle: string }[] = [
  { valeur: 'roman', libelle: 'Roman' },
  { valeur: 'roman_court', libelle: 'Roman court' },
  { valeur: 'nouvelle', libelle: 'Nouvelles' },
  { valeur: 'conte', libelle: 'Conte' },
  { valeur: 'poesie', libelle: 'Poésie' },
  { valeur: 'essai', libelle: 'Essai' },
  { valeur: 'philosophie', libelle: 'Philosophie' },
  { valeur: 'manga', libelle: 'Manga' },
  { valeur: 'autre', libelle: 'Autre' },
]

export const LONGUEURS: { valeur: Longueur; libelle: string; detail: string }[] = [
  { valeur: 'court', libelle: 'Courte', detail: 'lecture courte' },
  { valeur: 'moyen', libelle: 'Moyenne', detail: 'longueur moyenne' },
  { valeur: 'long', libelle: 'Longue', detail: 'lecture longue' },
]

export const ROLES: { valeur: Role; libelle: string }[] = [
  { valeur: 'auteur', libelle: 'Auteur' },
  { valeur: 'traducteur', libelle: 'Traduction' },
  { valeur: 'illustrateur', libelle: 'Illustrations' },
]

export const TYPES_MEDIA: { valeur: TypeMedia; libelle: string }[] = [
  { valeur: 'anime', libelle: 'Anime' },
  { valeur: 'film', libelle: 'Film' },
  { valeur: 'serie', libelle: 'Série' },
  { valeur: 'autre', libelle: 'Autre' },
]

export const GENRES_ETIQUETTES: { valeur: GenreEtiquette; libelle: string; pluriel: string }[] = [
  { valeur: 'genre', libelle: 'Genre', pluriel: 'Genres' },
  { valeur: 'theme', libelle: 'Thème', pluriel: 'Thèmes' },
  { valeur: 'atmosphere', libelle: 'Atmosphère', pluriel: 'Atmosphères' },
]

const libelleDe = <T extends string>(liste: { valeur: T; libelle: string }[], valeur: T | null | undefined) =>
  liste.find((element) => element.valeur === valeur)?.libelle ?? ''

export const libelleStatut = (statut: Statut) => libelleDe(STATUTS, statut)
export const libelleForme = (forme: Forme) => libelleDe(FORMES, forme)
export const libelleTypeMedia = (type: TypeMedia) => libelleDe(TYPES_MEDIA, type)
export function libellePossession(possession: PossessionAffichee) {
  return possession === 'partielle' ? 'J’en ai une partie' : libelleDe(POSSESSIONS, possession)
}

// ---------------------------------------------------------------------------
// Possession d'une série (docs/reference.md §6.2)
// ---------------------------------------------------------------------------

/**
 * Pour une série, la possession se calcule à partir des tomes. Sans tome connu,
 * c'est la possession enregistrée pour l'œuvre qui compte.
 */
export function possessionAffichee(possessionOeuvre: Possession, estSerie: boolean, tomes: Possession[]): PossessionAffichee {
  if (!estSerie || tomes.length === 0) return possessionOeuvre
  const possedes = tomes.filter((tome) => tome === 'possede').length
  if (possedes === tomes.length) return 'possede'
  if (possedes > 0) return 'partielle'
  return tomes.includes('a_acheter') ? 'a_acheter' : 'non_possede'
}

/**
 * Les possessions sous lesquelles une œuvre se retrouve dans les filtres. Une série
 * apparaît dans « Je l'ai » dès qu'un tome est possédé, et dans « À acheter » dès
 * qu'un tome est à acheter : on retrouve ainsi les séries où il manque des tomes.
 */
export function possessionsFiltrables(possessionOeuvre: Possession, estSerie: boolean, tomes: Possession[]): Possession[] {
  if (!estSerie || tomes.length === 0) return [possessionOeuvre]
  return POSSESSIONS.map((p) => p.valeur).filter((valeur) => tomes.includes(valeur))
}

// ---------------------------------------------------------------------------
// Recherche et filtres
// ---------------------------------------------------------------------------

/** Texte comparable : sans accents, sans majuscules, sans ponctuation typographique. */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/Œ/g, 'OE')
    .replace(/Æ/g, 'AE')
    .toLocaleLowerCase('fr')
    .replace(/[’'`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export type OeuvreFiltrable = {
  titres: string[]
  auteurs: string[]
  genres: string[]
  themes: string[]
  atmospheres: string[]
  statut: Statut
  possessions: Possession[]
}

export type Filtres = {
  recherche: string
  auteur: string | null
  genre: string | null
  theme: string | null
  atmosphere: string | null
  statut: Statut | null
  possession: Possession | null
}

export const FILTRES_VIDES: Filtres = {
  recherche: '',
  auteur: null,
  genre: null,
  theme: null,
  atmosphere: null,
  statut: null,
  possession: null,
}

/** Chaque mot cherché doit se trouver dans un titre ou un nom d'auteur. */
export function correspond(oeuvre: OeuvreFiltrable, filtres: Filtres): boolean {
  const mots = normaliser(filtres.recherche).split(' ').filter(Boolean)
  if (mots.length > 0) {
    const botte = normaliser([...oeuvre.titres, ...oeuvre.auteurs].join(' '))
    if (!mots.every((mot) => botte.includes(mot))) return false
  }
  if (filtres.auteur && !oeuvre.auteurs.includes(filtres.auteur)) return false
  if (filtres.genre && !oeuvre.genres.includes(filtres.genre)) return false
  if (filtres.theme && !oeuvre.themes.includes(filtres.theme)) return false
  if (filtres.atmosphere && !oeuvre.atmospheres.includes(filtres.atmosphere)) return false
  if (filtres.statut && oeuvre.statut !== filtres.statut) return false
  if (filtres.possession && !oeuvre.possessions.includes(filtres.possession)) return false
  return true
}

const CLES_FILTRES = ['statut', 'possession', 'genre', 'theme', 'atmosphere', 'auteur'] as const

/** Les filtres vivent dans l'adresse (« #/bibliotheque?statut=envie_de_lire ») : « Retour » les retrouve. */
export function filtresDepuisParametres(parametres: URLSearchParams): Filtres {
  const statut = parametres.get('statut')
  const possession = parametres.get('possession')
  return {
    recherche: parametres.get('q') ?? '',
    auteur: parametres.get('auteur'),
    genre: parametres.get('genre'),
    theme: parametres.get('theme'),
    atmosphere: parametres.get('atmosphere'),
    statut: STATUTS.some((s) => s.valeur === statut) ? (statut as Statut) : null,
    possession: POSSESSIONS.some((p) => p.valeur === possession) ? (possession as Possession) : null,
  }
}

export function parametresDepuisFiltres(filtres: Filtres): URLSearchParams {
  const parametres = new URLSearchParams()
  if (filtres.recherche.trim()) parametres.set('q', filtres.recherche)
  for (const cle of CLES_FILTRES) {
    const valeur = filtres[cle]
    if (valeur) parametres.set(cle, valeur)
  }
  return parametres
}

/** Tri à la française : « L’Étranger » se range avec les E, « 1984 » avant les lettres. */
export function comparerTitres(a: string, b: string): number {
  const sansArticle = (titre: string) => titre.replace(/^(l’|l'|le |la |les |un |une |des )/i, '')
  return sansArticle(a).localeCompare(sansArticle(b), 'fr', { numeric: true, sensitivity: 'base' })
}

// ---------------------------------------------------------------------------
// ISBN
// ---------------------------------------------------------------------------

/** L'ISBN tel que la base l'enregistre : sans tirets ni espaces, X final en majuscule. */
export const isbnCompact = (saisie: string) => saisie.replace(/[\s-]/g, '').toUpperCase()

/** Vrai si l'ISBN (10 ou 13 caractères) a la bonne forme et le bon chiffre de contrôle. */
export function isbnValide(saisie: string): boolean {
  const isbn = isbnCompact(saisie)
  if (/^97[89]\d{10}$/.test(isbn)) {
    const somme = [...isbn].reduce((total, chiffre, rang) => total + Number(chiffre) * (rang % 2 === 0 ? 1 : 3), 0)
    return somme % 10 === 0
  }
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const somme = [...isbn].reduce((total, caractere, rang) => total + (caractere === 'X' ? 10 : Number(caractere)) * (10 - rang), 0)
    return somme % 11 === 0
  }
  return false
}

