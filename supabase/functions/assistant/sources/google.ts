// Google Books (API « volumes »). La clé voyage dans un en-tête, jamais dans l'adresse :
// elle ne peut donc pas se retrouver dans un message d'erreur ou un journal.

import { langueConnue } from './langues.ts'

export type VolumeGoogle = {
  id: string
  titre: string | null
  auteurs: string[]
  editeur: string | null
  pages: number | null
  langue: string | null
  description: string | null
  manga: boolean
  aCouverture: boolean
  isbn13: string[]
}

const BASE = 'https://www.googleapis.com/books/v1/volumes'
const CHAMPS =
  'items(id,volumeInfo(title,authors,publisher,description,industryIdentifiers,pageCount,categories,imageLinks/thumbnail,language))'

export const ID_VOLUME = /^[A-Za-z0-9_-]{6,24}$/

const pourRequete = (texte: string) => texte.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim()

export const adresseGoogleIsbn = (isbn: string) =>
  `${BASE}?q=${encodeURIComponent(`isbn:${isbn}`)}&maxResults=5&printType=books&fields=${encodeURIComponent(CHAMPS)}`

export function adresseGoogleTitre(titre: string, auteur?: string) {
  const requete = [`intitle:"${pourRequete(titre)}"`, auteur ? `inauthor:"${pourRequete(auteur)}"` : ''].filter(Boolean).join(' ')
  return `${BASE}?q=${encodeURIComponent(requete)}&maxResults=10&printType=books&fields=${encodeURIComponent(CHAMPS)}`
}

const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
const texte = (valeur: unknown): string | null => (typeof valeur === 'string' && valeur.trim() ? valeur.trim() : null)
const textes = (valeur: unknown): string[] =>
  Array.isArray(valeur) ? valeur.map(texte).filter((element): element is string => element !== null) : []

/** Les volumes d'une réponse de l'API. Une réponse vide ou illisible donne une liste vide. */
export function lireVolumesGoogle(reponse: unknown): VolumeGoogle[] {
  if (!estObjet(reponse) || !Array.isArray(reponse.items)) return []
  const volumes: VolumeGoogle[] = []
  for (const element of reponse.items) {
    if (!estObjet(element) || typeof element.id !== 'string' || !ID_VOLUME.test(element.id)) continue
    const infos = estObjet(element.volumeInfo) ? element.volumeInfo : {}
    const pages = infos.pageCount
    const identifiants = Array.isArray(infos.industryIdentifiers) ? infos.industryIdentifiers : []
    volumes.push({
      id: element.id,
      titre: texte(infos.title),
      auteurs: textes(infos.authors),
      editeur: texte(infos.publisher),
      // Google met parfois 0 quand il ne sait pas : ce n'est pas une pagination.
      pages: typeof pages === 'number' && Number.isInteger(pages) && pages > 0 && pages < 10000 ? pages : null,
      langue: langueConnue(texte(infos.language)),
      description: texte(infos.description),
      manga: textes(infos.categories).some((categorie) => /manga/i.test(categorie)),
      aCouverture: estObjet(infos.imageLinks) && texte(infos.imageLinks.thumbnail) !== null,
      isbn13: identifiants
        .filter((i): i is Record<string, unknown> => estObjet(i) && i.type === 'ISBN_13')
        .map((i) => texte(i.identifier))
        .filter((isbn): isbn is string => isbn !== null && /^97[89]\d{10}$/.test(isbn)),
    })
  }
  return volumes
}
