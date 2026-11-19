// « Chercher d'autres couvertures » : à partir de ce que les trois catalogues répondent pour un
// titre, une courte liste d'éditions qui ont une image, de la plus probable à la moins probable.
//   · Les images ne viennent que de Google Books et d'Open Library (une référence, jamais une adresse).
//   · La BnF ne sert qu'à mieux trier : collection, année, hauteur du livre, rapprochées par l'ISBN.
//   · Aucune image n'est téléchargée ici : l'appli les demande ensuite une à une, et rien n'est
//     gardé sans mon choix.

import type { PropositionCouverture } from './contrat.ts'
import { comparable } from './notice.ts'
import type { NoticeBnf } from './sources/bnf.ts'
import type { VolumeGoogle } from './sources/google.ts'
import type { EditionListee } from './sources/openLibrary.ts'

const PROPOSITIONS_MAX = 8
const TEXTE_MAX = 120
/** Un livre de poche : 18 cm de haut au plus. */
const HAUTEUR_POCHE = 18
/** Les collections de poche courantes, sous leur forme comparable (sans accents, casse ni ponctuation). */
const POCHES = ['folio', 'livre de poche', 'pocket', 'j ai lu', '10 18', 'points', 'gf', 'babel']

export type DemandeCouvertures = { langue: 'fr' | 'en'; isbn?: string; editeur?: string }
export type SourcesCouvertures = { google: VolumeGoogle[]; editions: EditionListee[]; bnf: NoticeBnf[] }

type Candidat = PropositionCouverture & { isbn: string | null; hauteur: number | null; ordre: number }

// Un texte venu d'un catalogue est une donnée : court, sur une ligne, sans caractère de contrôle.
// deno-lint-ignore no-control-regex
const CONTROLE = /[\u0000-\u001f\u007f]+/g
function nettoyer(texte: string | null): string | null {
  const propre = texte?.replace(CONTROLE, ' ').replace(/\s+/g, ' ').trim().slice(0, TEXTE_MAX).trim()
  return propre || null
}

/** Vrai si le texte contient le nom d'une collection de poche, en mots entiers (« GF » n'est pas dans « Gallimard »). */
const nommePoche = (texte: string | null) => {
  const mots = ` ${comparable(texte ?? '')} `
  return POCHES.some((poche) => mots.includes(` ${poche} `))
}

export function proposerCouvertures(demande: DemandeCouvertures, sources: SourcesCouvertures): PropositionCouverture[] {
  const candidats: Candidat[] = []
  for (const volume of sources.google) {
    if (!volume.aCouverture) continue
    candidats.push({
      ref: { source: 'google_books', id: volume.id },
      editeur: nettoyer(volume.editeur),
      collection: null,
      annee: volume.annee,
      langue: volume.langue,
      source: 'google_books',
      isbn: volume.isbn13[0] ?? null,
      hauteur: null,
      ordre: candidats.length,
    })
  }
  for (const edition of sources.editions) {
    if (edition.couverture === null) continue
    candidats.push({
      ref: { source: 'open_library', numero: edition.couverture },
      editeur: nettoyer(edition.editeur),
      collection: nettoyer(edition.collection),
      annee: edition.annee,
      langue: edition.langue,
      source: 'open_library',
      isbn: edition.isbn13,
      hauteur: null,
      ordre: candidats.length,
    })
  }

  // La BnF, rapprochée par l'ISBN : la collection, l'année et la hauteur. Rien d'autre, et aucune image.
  const notices = new Map(sources.bnf.filter((notice) => notice.isbn).map((notice) => [notice.isbn as string, notice]))
  for (const candidat of candidats) {
    const notice = candidat.isbn ? notices.get(candidat.isbn) : undefined
    if (!notice) continue
    candidat.collection ??= nettoyer(notice.collection)
    candidat.annee ??= notice.annee
    candidat.hauteur = notice.hauteur
  }

  // Sans doublon : une même édition (même ISBN) ou une même image n'est proposée qu'une fois.
  const vus = new Set<string>()
  const uniques = candidats.filter((candidat) => {
    const cles = [JSON.stringify(candidat.ref), ...(candidat.isbn ? [`isbn:${candidat.isbn}`] : [])]
    if (cles.some((cle) => vus.has(cle))) return false
    for (const cle of cles) vus.add(cle)
    return true
  })

  const monEditeur = comparable(demande.editeur ?? '')
  const maCollection = comparable((demande.isbn ? notices.get(demande.isbn)?.collection : null) ?? '')
  const rang = (candidat: Candidat): number => {
    if (demande.isbn && candidat.isbn === demande.isbn) return 0
    const memeEditeur = monEditeur !== '' && comparable(candidat.editeur ?? '') === monEditeur
    const memeCollection = maCollection !== '' && comparable(candidat.collection ?? '') === maCollection
    if (memeEditeur || memeCollection) return 1
    if (candidat.langue !== demande.langue) return 4
    const poche = (candidat.hauteur !== null && candidat.hauteur <= HAUTEUR_POCHE) || nommePoche(candidat.collection) || nommePoche(candidat.editeur)
    return poche ? 2 : 3
  }

  return uniques
    .map((candidat) => ({ candidat, rang: rang(candidat) }))
    .sort((a, b) => a.rang - b.rang || (b.candidat.annee ?? -Infinity) - (a.candidat.annee ?? -Infinity) || a.candidat.ordre - b.candidat.ordre)
    .slice(0, PROPOSITIONS_MAX)
    .map(({ candidat }) => ({
      ref: candidat.ref,
      editeur: candidat.editeur,
      collection: candidat.collection,
      annee: candidat.annee,
      langue: candidat.langue,
      source: candidat.source,
    }))
}
