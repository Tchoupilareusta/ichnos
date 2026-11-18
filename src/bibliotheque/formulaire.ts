// Le formulaire d'ajout et de modification d'une œuvre, sans l'écran : état, validation,
// et conversion vers la fiche qu'attend la fonction enregistrer_oeuvre de la base.
// Règle d'or : rien n'est jamais complété ni deviné. Un champ laissé vide reste vide.

import type { FicheEnvoi, OeuvreDetaillee } from './depot'
import { isbnCompact, isbnValide, type Forme, type GenreEtiquette, type Longueur, type Role, type TypeMedia } from './modele'

let compteur = 0
/** Clé locale d'une ligne (auteur, édition, média) pour React ; jamais envoyée à la base. */
const nouvelleCle = () => `ligne-${++compteur}`

export type LigneAuteur = { cle: string; nom: string; role: Role }
export type LigneEdition = {
  cle: string
  id?: string
  publisher: string
  format: string
  language: string
  translator: string
  isbn: string
  pageCount: string
}
export type LigneTome = { numero: number; titre: string; isbn: string }
export type LigneMedia = {
  cle: string
  id?: string
  type: TypeMedia
  titre: string
  saisons: string
  episodes: string
  /** Avancement déjà noté : le total d'épisodes ne peut pas descendre en dessous. */
  episodesVus: number | null
}

export type EtatFormulaire = {
  titreFr: string
  titreOriginal: string
  langueOriginale: string
  annee: string
  forme: Forme
  synopsis: string
  tonalite: number | null
  exigence: number | null
  longueur: Longueur | null
  estSerie: boolean
  auteurs: LigneAuteur[]
  etiquettes: { genre: GenreEtiquette; nom: string }[]
  editions: LigneEdition[]
  /** Clé de l'édition qui est la mienne, ou null. */
  mienne: string | null
  tomes: LigneTome[]
  medias: LigneMedia[]
}

export const ligneAuteur = (nom = '', role: Role = 'auteur'): LigneAuteur => ({ cle: nouvelleCle(), nom, role })

export const ligneEdition = (): LigneEdition => ({
  cle: nouvelleCle(),
  publisher: '',
  format: '',
  language: '',
  translator: '',
  isbn: '',
  pageCount: '',
})

export const ligneMedia = (): LigneMedia => ({
  cle: nouvelleCle(),
  type: 'anime',
  titre: '',
  saisons: '',
  episodes: '',
  episodesVus: null,
})

export function etatVide(): EtatFormulaire {
  return {
    titreFr: '',
    titreOriginal: '',
    langueOriginale: '',
    annee: '',
    forme: 'roman',
    synopsis: '',
    tonalite: null,
    exigence: null,
    longueur: null,
    estSerie: false,
    auteurs: [ligneAuteur()],
    etiquettes: [],
    editions: [],
    mienne: null,
    tomes: [],
    medias: [],
  }
}

const texte = (valeur: string | number | null | undefined) => (valeur === null || valeur === undefined ? '' : String(valeur))

export function etatDepuisOeuvre(oeuvre: OeuvreDetaillee): EtatFormulaire {
  const editions = oeuvre.editions.map((e) => ({
    cle: nouvelleCle(),
    id: e.id,
    publisher: texte(e.publisher),
    format: texte(e.format),
    language: texte(e.language),
    translator: texte(e.translator),
    isbn: texte(e.isbn),
    pageCount: texte(e.pageCount),
  }))
  return {
    titreFr: oeuvre.titreFr,
    titreOriginal: texte(oeuvre.titreOriginal),
    langueOriginale: texte(oeuvre.langueOriginale),
    annee: texte(oeuvre.annee),
    forme: oeuvre.forme,
    synopsis: texte(oeuvre.synopsis),
    tonalite: oeuvre.tonalite,
    exigence: oeuvre.exigence,
    longueur: oeuvre.longueur,
    estSerie: oeuvre.estSerie,
    auteurs: oeuvre.auteurs.length > 0 ? oeuvre.auteurs.map((a) => ligneAuteur(a.nom, a.role)) : [ligneAuteur()],
    etiquettes: oeuvre.etiquettes.map((e) => ({ genre: e.genre, nom: e.nom })),
    editions,
    mienne: editions[oeuvre.editions.findIndex((e) => e.id === oeuvre.monEdition)]?.cle ?? null,
    tomes: oeuvre.tomes.map((t) => ({ numero: t.numero, titre: texte(t.titre), isbn: texte(t.isbn) })),
    medias: oeuvre.medias.map((m) => ({
      cle: nouvelleCle(),
      id: m.id,
      type: m.type,
      titre: texte(m.titre),
      saisons: texte(m.saisons),
      episodes: texte(m.episodes),
      episodesVus: m.episodesVus,
    })),
  }
}

/** Change le nombre de tomes : les tomes gardés conservent leur titre et leur ISBN ; on ajoute ou retire à la fin. */
export function ajusterTomes(tomes: LigneTome[], nombre: number): LigneTome[] {
  if (nombre <= tomes.length) return tomes.slice(0, Math.max(0, nombre))
  const suivant = tomes.length > 0 ? Math.max(...tomes.map((t) => t.numero)) + 1 : 1
  const ajoutes = Array.from({ length: nombre - tomes.length }, (_, rang) => ({ numero: suivant + rang, titre: '', isbn: '' }))
  return [...tomes, ...ajoutes]
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Erreurs par champ. La clé reprend l'identifiant du champ dans l'écran. */
export type Erreurs = Record<string, string>

export const idChamp = {
  titreFr: 'champ-titre-fr',
  annee: 'champ-annee',
  nombreTomes: 'champ-nombre-tomes',
  isbnEdition: (cle: string) => `champ-isbn-${cle}`,
  pagesEdition: (cle: string) => `champ-pages-${cle}`,
  isbnTome: (numero: number) => `champ-isbn-tome-${numero}`,
  saisons: (cle: string) => `champ-saisons-${cle}`,
  episodes: (cle: string) => `champ-episodes-${cle}`,
}

const ENTIER = /^\d+$/

export function valider(etat: EtatFormulaire): Erreurs {
  const erreurs: Erreurs = {}
  if (!etat.titreFr.trim()) erreurs[idChamp.titreFr] = 'Le titre en français est nécessaire pour retrouver l’œuvre.'

  const annee = etat.annee.trim()
  if (annee && (!/^-?\d+$/.test(annee) || Number(annee) < -3000 || Number(annee) > 2100))
    erreurs[idChamp.annee] = 'Une année en chiffres, par exemple 1922. Pour l’Antiquité : -50.'

  for (const edition of etat.editions) {
    if (edition.isbn.trim() && !isbnValide(edition.isbn))
      erreurs[idChamp.isbnEdition(edition.cle)] = 'Cet ISBN ne semble pas juste : 10 ou 13 chiffres, à vérifier sur le livre.'
    const pages = edition.pageCount.trim()
    if (pages && (!ENTIER.test(pages) || Number(pages) === 0)) erreurs[idChamp.pagesEdition(edition.cle)] = 'Un nombre de pages, en chiffres.'
  }

  for (const tome of etat.tomes) {
    if (tome.isbn.trim() && !isbnValide(tome.isbn)) erreurs[idChamp.isbnTome(tome.numero)] = `L’ISBN du tome ${tome.numero} ne semble pas juste.`
  }

  for (const media of etat.medias) {
    const saisons = media.saisons.trim()
    if (saisons && (!ENTIER.test(saisons) || Number(saisons) === 0 || Number(saisons) > 32767))
      erreurs[idChamp.saisons(media.cle)] = 'Un nombre de saisons, en chiffres.'
    const episodes = media.episodes.trim()
    if (episodes && (!ENTIER.test(episodes) || Number(episodes) === 0)) erreurs[idChamp.episodes(media.cle)] = 'Un nombre d’épisodes, en chiffres.'
    else if (episodes && media.episodesVus !== null && Number(episodes) < media.episodesVus)
      erreurs[idChamp.episodes(media.cle)] = `J’ai déjà vu ${media.episodesVus} épisodes : le total ne peut pas être plus petit.`
  }
  return erreurs
}

// ---------------------------------------------------------------------------
// Conversion vers la fonction de la base
// ---------------------------------------------------------------------------

const ouVide = (valeur: string) => valeur.trim() || null
const nombreOuVide = (valeur: string) => (valeur.trim() ? Number(valeur.trim()) : null)

/** La fiche complète, prête pour enregistrer_oeuvre. À n'appeler qu'après une validation sans erreur. */
export function versEnvoi(etat: EtatFormulaire, id?: string): FicheEnvoi {
  const vus = new Set<string>()
  const auteurs = etat.auteurs
    .map((a) => ({ name: a.nom.trim(), role: a.role }))
    .filter((a) => {
      const cle = `${a.name}|${a.role}`
      if (!a.name || vus.has(cle)) return false
      vus.add(cle)
      return true
    })

  return {
    ...(id ? { id } : {}),
    title_fr: etat.titreFr.trim(),
    title_original: ouVide(etat.titreOriginal),
    original_language: ouVide(etat.langueOriginale),
    first_published_year: nombreOuVide(etat.annee),
    form: etat.forme,
    synopsis: ouVide(etat.synopsis),
    tone: etat.tonalite,
    density: etat.exigence,
    length: etat.longueur,
    is_series: etat.estSerie,
    authors: auteurs,
    tags: etat.etiquettes.map((e) => ({ kind: e.genre, name: e.nom.trim() })).filter((e) => e.name),
    editions: etat.editions.map((e) => ({
      ...(e.id ? { id: e.id } : {}),
      isbn: e.isbn.trim() ? isbnCompact(e.isbn) : null,
      publisher: ouVide(e.publisher),
      language: ouVide(e.language),
      format: ouVide(e.format),
      translator: ouVide(e.translator),
      page_count: nombreOuVide(e.pageCount),
      mienne: e.cle === etat.mienne,
    })),
    // Une œuvre qui n'est pas une série n'a pas de tomes : la base le refuserait.
    volumes: etat.estSerie
      ? etat.tomes.map((t) => ({ number: t.numero, title: ouVide(t.titre), isbn: t.isbn.trim() ? isbnCompact(t.isbn) : null }))
      : [],
    media: etat.medias.map((m) => ({
      ...(m.id ? { id: m.id } : {}),
      kind: m.type,
      title: ouVide(m.titre),
      seasons: nombreOuVide(m.saisons),
      episodes_total: nombreOuVide(m.episodes),
    })),
  }
}
