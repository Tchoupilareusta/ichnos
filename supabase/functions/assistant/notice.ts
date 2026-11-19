// Rassemble ce que les trois sources ont répondu.
//   · Par ISBN : une notice d'édition, champ par champ, la BnF d'abord, puis Google Books,
//     puis Open Library. Chaque champ garde sa source ; ce qu'aucune ne donne reste vide.
//   · Par titre : une liste d'œuvres (les éditions d'une même œuvre sont regroupées),
//     sans ISBN, éditeur ni pagination.

import type { Champ, Description, Notice, RefCouverture, Resultat, Source } from './contrat.ts'
import type { NoticeBnf } from './sources/bnf.ts'
import type { VolumeGoogle } from './sources/google.ts'
import type { EditionOpenLibrary, OeuvreOpenLibrary } from './sources/openLibrary.ts'

const DESCRIPTION_MAX = 4000
const RESULTATS_MAX = 8

/** Le premier candidat qui a une valeur, avec sa source. */
function choisir<T>(...candidats: [T | null | undefined, Source][]): Champ<T> | null {
  for (const [valeur, source] of candidats) {
    if (valeur !== null && valeur !== undefined && !(Array.isArray(valeur) && valeur.length === 0)) return { valeur, source }
  }
  return null
}

function descriptionsDe(...candidats: [string | null | undefined, Source][]): Description[] {
  return candidats
    .filter((candidat): candidat is [string, Source] => !!candidat[0])
    .map(([texte, source]) => ({ texte: texte.slice(0, DESCRIPTION_MAX), source }))
}

export type SourcesIsbn = {
  bnf: NoticeBnf[]
  google: VolumeGoogle[]
  edition: EditionOpenLibrary | null
  oeuvres: OeuvreOpenLibrary[]
}

/**
 * L'année de première publication donnée par Open Library, seulement si elle se rapporte
 * clairement à l'œuvre originale. Open Library tient parfois une fiche à part pour une
 * traduction ou pour un tome : son année serait alors fausse pour l'œuvre.
 */
function anneeFiable(
  oeuvre: OeuvreOpenLibrary | null,
  contexte: { titreOriginal: string | null; traduction: boolean; tome: boolean },
): number | null {
  if (!oeuvre || oeuvre.annee === null || contexte.tome) return null
  if (contexte.titreOriginal) {
    const memeTitre =
      estLeTitre(oeuvre.titre, comparable(contexte.titreOriginal)) || estLeTitre(contexte.titreOriginal, comparable(oeuvre.titre))
    return memeTitre ? oeuvre.annee : null
  }
  return contexte.traduction ? null : oeuvre.annee
}

export function fusionnerNotice(
  isbn: string,
  sources: SourcesIsbn,
): { trouve: boolean; notice: Notice; descriptions: Description[]; couverture: RefCouverture | null } {
  const bnf = sources.bnf.find((notice) => notice.isbn === isbn) ?? sources.bnf[0] ?? null
  // Google répond parfois avec un autre livre : seul un volume qui porte cet ISBN compte.
  const google = sources.google.find((volume) => volume.isbn13.includes(isbn)) ?? null
  const edition = sources.edition
  const oeuvre = sources.oeuvres[0] ?? null

  const notice: Notice = {
    titre: choisir([bnf?.titre, 'bnf'], [google?.titre, 'google_books'], [edition?.titre, 'open_library']),
    titreOriginal: choisir([bnf?.titreOriginal, 'bnf'], [edition?.titreOriginal, 'open_library']),
    auteurs: choisir([bnf ? auteursAffiches([bnf]) : null, 'bnf'], [google?.auteurs, 'google_books'], [oeuvre?.auteurs, 'open_library']),
    traducteur: choisir([bnf?.traducteur, 'bnf'], [edition?.traducteur, 'open_library']),
    editeur: choisir([bnf?.editeur, 'bnf'], [google?.editeur, 'google_books'], [edition?.editeur, 'open_library']),
    pages: choisir([bnf?.pages, 'bnf'], [google?.pages, 'google_books'], [edition?.pages, 'open_library']),
    langue: choisir([bnf?.langue, 'bnf'], [google?.langue, 'google_books'], [edition?.langue, 'open_library']),
    langueOriginale: choisir([bnf?.langueOriginale, 'bnf'], [edition?.langueOriginale, 'open_library']),
    annee: null,
    tome: choisir([bnf?.tome, 'bnf']),
    manga: google?.manga ?? false,
  }
  notice.annee = choisir([
    anneeFiable(oeuvre, {
      titreOriginal: notice.titreOriginal?.valeur ?? null,
      traduction: notice.traducteur !== null || notice.langueOriginale !== null,
      tome: notice.tome !== null,
    }),
    'open_library',
  ])

  const couverture: RefCouverture | null = google?.aCouverture
    ? { source: 'google_books', id: google.id }
    : edition?.aCouverture
      ? { source: 'open_library', isbn }
      : null

  return {
    trouve: bnf !== null || google !== null || edition !== null,
    notice,
    descriptions: descriptionsDe([bnf?.description, 'bnf'], [google?.description, 'google_books']),
    couverture,
  }
}

// ---------------------------------------------------------------------------
// Recherche par titre
// ---------------------------------------------------------------------------

/** Texte comparable : sans accents, sans majuscules, sans ponctuation. */
export function comparable(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** « Michael Ende » et « Ende, Michael » donnent la même clé. */
const cleAuteur = (nom: string) => comparable(nom).split(' ').sort().join(' ')

/** Vrai si le titre est celui cherché, éventuellement suivi d'un sous-titre. */
function estLeTitre(titre: string | null, cherche: string) {
  if (!titre) return false
  const propre = comparable(titre)
  return propre === cherche || propre.startsWith(`${cherche} `)
}

/** La valeur la plus fréquente d'une liste (la première en cas d'égalité). */
function plusFrequent(valeurs: (string | null)[]): string | null {
  const comptes = new Map<string, number>()
  for (const valeur of valeurs) if (valeur) comptes.set(valeur, (comptes.get(valeur) ?? 0) + 1)
  return [...comptes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

/**
 * Les auteurs à afficher pour des notices de la BnF d'une même œuvre. Pour un auteur unique,
 * la signature imprimée la plus courante (« Fiodor Dostoïevski », de préférence à « Dostoïevski »
 * seul) ; sinon, les noms du catalogue.
 */
function auteursAffiches(notices: NoticeBnf[]): string[] {
  const signatures = notices.filter((n) => n.auteurs.length === 1 && n.signature).map((n) => n.signature as string)
  const completes = signatures.filter((s) => s.includes(' '))
  const signature = plusFrequent(completes.length > 0 ? completes : signatures)
  return signature ? [signature] : (notices[0]?.auteurs ?? [])
}

type Groupe = {
  cle: string
  /** Toutes les écritures connues du nom de l'auteur (catalogue et signatures) : pour y rattacher les autres sources. */
  cles: Set<string>
  bnf: NoticeBnf[]
  google: VolumeGoogle[]
  /** Œuvres d'Open Library au même titre : elles peuvent donner une couverture. */
  oeuvres: OeuvreOpenLibrary[]
  /** Parmi elles, celles dont l'année est celle de l'œuvre originale. */
  datees: OeuvreOpenLibrary[]
}

export type SourcesTitre = { bnf: NoticeBnf[]; google: VolumeGoogle[]; oeuvres: OeuvreOpenLibrary[] }

export function grouperResultats(titre: string, sources: SourcesTitre): Resultat[] {
  const cherche = comparable(titre)
  if (!cherche) return []
  const groupes = new Map<string, Groupe>()
  const groupeDe = (auteur: string) => {
    const cle = cleAuteur(auteur)
    let groupe = groupes.get(cle)
    if (!groupe) {
      groupe = { cle, cles: new Set([cle]), bnf: [], google: [], oeuvres: [], datees: [] }
      groupes.set(cle, groupe)
    }
    return groupe
  }

  // La BnF : les éditions que je peux lire (en français ou en anglais), signées, au bon titre.
  for (const notice of sources.bnf) {
    if (notice.auteurs.length === 0 || !estLeTitre(notice.titre, cherche)) continue
    if (notice.langue !== 'fr' && notice.langue !== 'en') continue
    const groupe = groupeDe(notice.auteurs[0])
    groupe.bnf.push(notice)
    if (notice.signature && notice.auteurs.length === 1) groupe.cles.add(cleAuteur(notice.signature))
  }
  /** Le groupe d'un auteur, quelle que soit l'écriture de son nom. */
  const groupeConnu = (auteur: string) => {
    const cle = cleAuteur(auteur)
    return groupes.get(cle) ?? [...groupes.values()].find((groupe) => groupe.cles.has(cle))
  }
  // Google Books et Open Library complètent un résultat de la BnF ; seuls, ils ne créent
  // un résultat que pour le titre exact (sinon la liste se remplit de titres voisins).
  const exact = (titreCandidat: string | null) => titreCandidat !== null && comparable(titreCandidat) === cherche
  for (const volume of sources.google) {
    if (volume.auteurs.length === 0 || !estLeTitre(volume.titre, cherche)) continue
    const existant = groupeConnu(volume.auteurs[0])
    if (existant || exact(volume.titre)) (existant ?? groupeDe(volume.auteurs[0])).google.push(volume)
  }
  for (const oeuvre of sources.oeuvres) {
    if (oeuvre.auteurs.length === 0) continue
    const existant = groupeConnu(oeuvre.auteurs[0])
    const original = existant ? plusFrequent(existant.bnf.map((n) => n.titreOriginal)) : null
    const traduite = existant ? existant.bnf.some((n) => n.titreOriginal !== null || n.langueOriginale !== null) : false
    const titreOriginal = original !== null && estLeTitre(oeuvre.titre, comparable(original))
    if (!exact(oeuvre.titre) && !titreOriginal) continue
    const groupe = existant ?? groupeDe(oeuvre.auteurs[0])
    groupe.oeuvres.push(oeuvre)
    // L'année n'est celle de l'œuvre que si la fiche porte le titre original, ou si rien ne signale une traduction.
    if (titreOriginal || !traduite) groupe.datees.push(oeuvre)
  }

  const aLeTitreExact = (groupe: Groupe) =>
    [...groupe.bnf.map((n) => n.titre), ...groupe.google.map((v) => v.titre), ...groupe.oeuvres.map((o) => o.titre)].some(exact)

  // Quand la BnF connaît le titre exact, ce que seuls les autres catalogues proposent
  // (études, homonymes, fiches en double) encombrerait la liste.
  const tous = [...groupes.values()]
  const bnfExacte = tous.some((groupe) => groupe.bnf.some((n) => exact(n.titre)))
  return tous
    .filter((groupe) => !bnfExacte || groupe.bnf.length > 0)
    .sort(
      (a, b) =>
        Number(aLeTitreExact(b)) - Number(aLeTitreExact(a)) || b.bnf.length - a.bnf.length || b.google.length - a.google.length,
    )
    .slice(0, RESULTATS_MAX)
    .map((groupe): Resultat => {
      // Le titre le plus court de la BnF : « Momo », plutôt que « Momo ou la Mystérieuse histoire… ».
      const titreBnf = groupe.bnf.map((n) => n.titre as string).sort((a, b) => a.length - b.length)[0]
      const volume = groupe.google[0] ?? null
      const oeuvre = groupe.oeuvres[0] ?? null
      const avecCouverture = groupe.google.find((v) => v.aCouverture)
      const numero = groupe.oeuvres.find((o) => o.couverture !== null)?.couverture ?? null
      // Une série : Open Library connaît surtout ses tomes, dont l'année n'est pas celle de l'œuvre.
      const serie = groupe.bnf.some((n) => n.tome !== null)
      return {
        titre: choisir([titreBnf, 'bnf'], [volume?.titre, 'google_books'], [oeuvre?.titre, 'open_library']) as Champ<string>,
        titreOriginal: choisir([plusFrequent(groupe.bnf.map((n) => n.titreOriginal)), 'bnf']),
        auteurs: choisir([auteursAffiches(groupe.bnf), 'bnf'], [volume?.auteurs, 'google_books'], [oeuvre?.auteurs, 'open_library']),
        langueOriginale: choisir([plusFrequent(groupe.bnf.map((n) => n.langueOriginale)), 'bnf']),
        annee: serie ? null : choisir([groupe.datees.find((o) => o.annee !== null)?.annee, 'open_library']),
        manga: groupe.google.some((v) => v.manga),
        serie,
        descriptions: descriptionsDe(
          [groupe.bnf.find((n) => n.description)?.description, 'bnf'],
          [groupe.google.find((v) => v.description)?.description, 'google_books'],
        ),
        couverture: avecCouverture
          ? { source: 'google_books', id: avecCouverture.id }
          : numero !== null
            ? { source: 'open_library', numero }
            : null,
      }
    })
}

/**
 * Complète un résultat avec ce qu'Open Library sait de l'œuvre sous son titre original :
 * l'année de première publication, et une couverture s'il n'y en avait pas.
 */
export function completerAvecOriginal(resultat: Resultat, oeuvres: OeuvreOpenLibrary[]): Resultat {
  const original = resultat.titreOriginal?.valeur
  if (!original) return resultat
  const auteurs = new Set((resultat.auteurs?.valeur ?? []).map(cleAuteur))
  const oeuvre = oeuvres.find((o) => o.auteurs.some((nom) => auteurs.has(cleAuteur(nom))) && estLeTitre(o.titre, comparable(original)))
  if (!oeuvre) return resultat
  return {
    ...resultat,
    annee: resultat.annee ?? (resultat.serie ? null : choisir([oeuvre.annee, 'open_library'])),
    couverture: resultat.couverture ?? (oeuvre.couverture !== null ? { source: 'open_library', numero: oeuvre.couverture } : null),
  }
}
