// Open Library (sans clé) : la fiche d'une édition par son ISBN, et la recherche d'œuvres.
// Ses « descriptions » sont trop souvent fantaisistes : on ne les lit pas.

import { langueDepuisTroisLettres } from './langues.ts'

export type EditionOpenLibrary = {
  titre: string | null
  editeur: string | null
  pages: number | null
  langue: string | null
  traducteur: string | null
  langueOriginale: string | null
  titreOriginal: string | null
  /**
   * Numéro de la couverture de cette édition (la première de sa fiche), ou null. À ne pas confondre
   * avec celui que rend la recherche, qui est la couverture de l'œuvre : souvent une autre édition.
   */
  couverture: number | null
}

export type OeuvreOpenLibrary = { titre: string; auteurs: string[]; annee: number | null; couverture: number | null }

/** Une édition d'une œuvre, telle que la liste d'Open Library la donne. Ce qui manque est null. */
export type EditionListee = {
  /** Numéro de la couverture de cette édition, ou null si elle n'en a pas. */
  couverture: number | null
  isbn13: string | null
  editeur: string | null
  collection: string | null
  annee: number | null
  langue: string | null
}

const CHAMPS_RECHERCHE = 'key,title,author_name,first_publish_year,cover_i'

export const adresseOpenLibraryEdition = (isbn: string) => `https://openlibrary.org/isbn/${isbn}.json`

export const adresseOpenLibraryIsbn = (isbn: string) =>
  `https://openlibrary.org/search.json?isbn=${isbn}&fields=${CHAMPS_RECHERCHE}&limit=1`

export function adresseOpenLibraryTitre(titre: string, auteur?: string) {
  const parametres = new URLSearchParams({ title: titre, fields: CHAMPS_RECHERCHE, limit: '10' })
  if (auteur) parametres.set('author', auteur)
  return `https://openlibrary.org/search.json?${parametres}`
}

/** Les éditions d'une œuvre (deux cents au plus : une œuvre connue en a des centaines, en toutes langues). */
export const adresseOpenLibraryEditions = (cle: string) => `https://openlibrary.org/works/${cle}/editions.json?limit=200`

const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
const texte = (valeur: unknown): string | null => (typeof valeur === 'string' && valeur.trim() ? valeur.trim() : null)
const liste = (valeur: unknown): unknown[] => (Array.isArray(valeur) ? valeur : [])

/** « /languages/fre » donne « fr ». */
const langueDe = (valeur: unknown): string | null => {
  const cle = estObjet(liste(valeur)[0]) ? texte((liste(valeur)[0] as Record<string, unknown>).key) : null
  return langueDepuisTroisLettres(cle?.split('/').pop())
}

export function lireEditionOpenLibrary(reponse: unknown): EditionOpenLibrary | null {
  if (!estObjet(reponse) || !texte(reponse.title)) return null
  const pages = reponse.number_of_pages
  const traducteur = liste(reponse.contributors)
    .filter((c): c is Record<string, unknown> => estObjet(c) && typeof c.role === 'string' && /translat|traduc/i.test(c.role))
    .map((c) => texte(c.name))[0]
  return {
    titre: texte(reponse.title),
    editeur: texte(liste(reponse.publishers)[0]),
    pages: typeof pages === 'number' && Number.isInteger(pages) && pages > 0 && pages < 10000 ? pages : null,
    langue: langueDe(reponse.languages),
    traducteur: traducteur ?? null,
    langueOriginale: langueDe(reponse.translated_from),
    titreOriginal: texte(reponse.translation_of),
    couverture: numeroCouverture(reponse.covers),
  }
}

const numeroCouverture = (valeur: unknown): number | null =>
  liste(valeur).find((numero): numero is number => typeof numero === 'number' && Number.isInteger(numero) && numero > 0) ?? null

/**
 * Les clés des œuvres d'une recherche (« OL1230613W »). Une clé entre dans une adresse :
 * tout ce qui ne ressemble pas exactement à une clé d'œuvre est écarté.
 */
export function lireClesOeuvres(reponse: unknown): string[] {
  if (!estObjet(reponse)) return []
  return liste(reponse.docs)
    .map((doc) => (estObjet(doc) ? /^\/works\/(OL\d{1,12}W)$/.exec(texte(doc.key) ?? '')?.[1] : undefined))
    .filter((cle): cle is string => cle !== undefined)
}

export function lireEditionsOpenLibrary(reponse: unknown): EditionListee[] {
  if (!estObjet(reponse)) return []
  const editions: EditionListee[] = []
  for (const entree of liste(reponse.entries)) {
    if (!estObjet(entree)) continue
    const annee = /\b(1[4-9]\d\d|20\d\d)\b/.exec(texte(entree.publish_date) ?? '')?.[1]
    editions.push({
      couverture: numeroCouverture(entree.covers),
      isbn13: liste(entree.isbn_13).map(texte).find((isbn): isbn is string => isbn !== null && /^97[89]\d{10}$/.test(isbn)) ?? null,
      editeur: texte(liste(entree.publishers)[0]),
      collection: texte(liste(entree.series)[0])?.replace(/^collection\s+/i, '').trim() || null,
      annee: annee ? Number(annee) : null,
      langue: langueDe(entree.languages),
    })
  }
  return editions
}

export function lireRechercheOpenLibrary(reponse: unknown): OeuvreOpenLibrary[] {
  if (!estObjet(reponse)) return []
  const oeuvres: OeuvreOpenLibrary[] = []
  for (const doc of liste(reponse.docs)) {
    if (!estObjet(doc)) continue
    const titre = texte(doc.title)
    if (!titre) continue
    const annee = doc.first_publish_year
    const couverture = doc.cover_i
    oeuvres.push({
      titre,
      // « Michael Ende (1929-1995) » : les dates accolées au nom ne font pas partie du nom.
      auteurs: liste(doc.author_name)
        .map((nom) => texte(nom)?.replace(/[\s,]*\(?\b\d{4}\s*-\s*(\d{4}|\.{2,4})?\)?\s*$/, '').trim() || null)
        .filter((nom): nom is string => nom !== null),
      annee: typeof annee === 'number' && Number.isInteger(annee) && annee > -3000 && annee <= 2100 ? annee : null,
      couverture: typeof couverture === 'number' && Number.isInteger(couverture) && couverture > 0 ? couverture : null,
    })
  }
  return oeuvres
}
