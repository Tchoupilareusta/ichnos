// De ce que l'assistant a trouvé au formulaire : préremplissage, proposition de l'IA, doublons.
// Règle d'or, comme partout : ce qu'aucune source ne donne reste vide, et rien de ce que
// j'ai déjà écrit n'est remplacé.

import type { OeuvreListee } from '../bibliotheque/depot'
import { ajusterTomes, etatVide, ligneAuteur, ligneEdition, type EtatFormulaire } from '../bibliotheque/formulaire'
import { normaliser } from '../bibliotheque/modele'
import type { Champ, Description, FicheProposee, Notice, OeuvrePourFiche, Resultat, Source } from './assistant'

/** Les champs du formulaire dont on sait d'où vient la valeur. */
export type CleProvenance =
  | 'titreFr'
  | 'titreOriginal'
  | 'langueOriginale'
  | 'annee'
  | 'auteurs'
  | 'editeur'
  | 'langue'
  | 'traducteur'
  | 'pages'
  | 'tomes'
export type Provenance = Partial<Record<CleProvenance, Source>>

export type Prerempli = {
  etat: EtatFormulaire
  /** La source de chaque champ rempli : affichée sous le champ pendant l'ajout, jamais enregistrée. */
  provenance: Provenance
  /** Numéro du tome, quand l'ISBN saisi est celui d'un tome de série. */
  tome: number | null
}

const NOMS_SOURCES: Record<Source, string> = { bnf: 'la BnF', google_books: 'Google Books', open_library: 'Open Library' }
export const libelleSource = (source: Source) => NOMS_SOURCES[source]

/** Note la valeur d'un champ et sa source ; un champ absent ne laisse aucune trace. */
function noter<T>(provenance: Provenance, cle: CleProvenance, champ: Champ<T> | null): T | null {
  if (!champ) return null
  provenance[cle] = champ.source
  return champ.valeur
}

const lignesAuteurs = (noms: string[] | null) => (noms && noms.length > 0 ? noms.map((nom) => ligneAuteur(nom)) : [ligneAuteur()])

/** Ajout par ISBN : l'œuvre et l'édition exacte de mon exemplaire. */
export function depuisNotice(notice: Notice, isbn: string): Prerempli {
  const provenance: Provenance = {}
  const etat = etatVide()
  etat.titreFr = noter(provenance, 'titreFr', notice.titre) ?? ''
  etat.titreOriginal = noter(provenance, 'titreOriginal', notice.titreOriginal) ?? ''
  etat.langueOriginale = noter(provenance, 'langueOriginale', notice.langueOriginale) ?? ''
  etat.annee = String(noter(provenance, 'annee', notice.annee) ?? '')
  etat.auteurs = lignesAuteurs(noter(provenance, 'auteurs', notice.auteurs))
  // « Manga » seulement si une source le dit ; sinon la forme reste à choisir.
  if (notice.manga) etat.forme = 'manga'

  const tome = notice.tome?.valeur ?? null
  const edition = ligneEdition()
  edition.publisher = noter(provenance, 'editeur', notice.editeur) ?? ''
  edition.language = noter(provenance, 'langue', notice.langue) ?? ''
  edition.translator = noter(provenance, 'traducteur', notice.traducteur) ?? ''

  if (tome === null) {
    edition.isbn = isbn
    edition.pageCount = String(noter(provenance, 'pages', notice.pages) ?? '')
  } else {
    // L'ISBN d'un tome : c'est la série qu'on ajoute. L'ISBN (et le nombre de pages) sont ceux du tome.
    etat.estSerie = true
    etat.tomes = ajusterTomes([], tome).map((ligne) => (ligne.numero === tome ? { ...ligne, isbn } : ligne))
    provenance.tomes = notice.tome?.source
  }
  etat.editions = [edition]
  etat.mienne = edition.cle
  return { etat, provenance, tome }
}

/** Ajout par titre : la fiche commune à toutes les éditions, sans ISBN, éditeur ni pagination. */
export function depuisResultat(resultat: Resultat): Prerempli {
  const provenance: Provenance = {}
  const etat = etatVide()
  etat.titreFr = noter(provenance, 'titreFr', resultat.titre) ?? ''
  etat.titreOriginal = noter(provenance, 'titreOriginal', resultat.titreOriginal) ?? ''
  etat.langueOriginale = noter(provenance, 'langueOriginale', resultat.langueOriginale) ?? ''
  etat.annee = String(noter(provenance, 'annee', resultat.annee) ?? '')
  etat.auteurs = lignesAuteurs(noter(provenance, 'auteurs', resultat.auteurs))
  if (resultat.manga) etat.forme = 'manga'
  // Une série : son nombre de tomes n'est donné par aucune source, il reste à saisir.
  etat.estSerie = resultat.serie
  return { etat, provenance, tome: null }
}

/**
 * Ce qui part vers l'IA : le titre, l'auteur, l'année, la langue d'origine et les descriptions
 * des catalogues. Rien d'autre : ni édition, ni traducteur, ni ce que j'ai écrit.
 */
export function pourFiche(etat: EtatFormulaire, descriptions: Description[]): OeuvrePourFiche {
  const oeuvre: OeuvrePourFiche = {
    titre: etat.titreFr.trim(),
    auteurs: etat.auteurs.filter((a) => a.role === 'auteur' && a.nom.trim()).map((a) => a.nom.trim()),
    descriptions,
  }
  if (etat.titreOriginal.trim()) oeuvre.titreOriginal = etat.titreOriginal.trim()
  if (/^-?\d{1,4}$/.test(etat.annee.trim())) oeuvre.annee = Number(etat.annee.trim())
  if (/^[a-z]{2,3}$/.test(etat.langueOriginale)) oeuvre.langueOriginale = etat.langueOriginale
  return oeuvre
}

export type ChampPropose = 'synopsis' | 'etiquettes' | 'tonalite' | 'exigence' | 'longueur'

/**
 * Verse la proposition de l'IA dans le formulaire : seulement dans les champs encore vides.
 * Les thèmes nouveaux n'y entrent pas : ils restent proposés à part, un par un.
 */
export function appliquerProposition(etat: EtatFormulaire, fiche: FicheProposee): { etat: EtatFormulaire; remplis: ChampPropose[] } {
  const remplis: ChampPropose[] = []
  const suite = { ...etat }

  if (fiche.synopsis && !etat.synopsis.trim()) {
    suite.synopsis = fiche.synopsis
    remplis.push('synopsis')
  }

  const proposees = [
    ...fiche.genres.map((nom) => ({ genre: 'genre' as const, nom })),
    ...fiche.themes.map((nom) => ({ genre: 'theme' as const, nom })),
    ...fiche.atmospheres.map((nom) => ({ genre: 'atmosphere' as const, nom })),
  ]
  const nouvelles = proposees.filter((p) => !etat.etiquettes.some((e) => e.genre === p.genre && e.nom === p.nom))
  if (nouvelles.length > 0) {
    suite.etiquettes = [...etat.etiquettes, ...nouvelles]
    remplis.push('etiquettes')
  }

  if (fiche.tonalite !== null && etat.tonalite === null) {
    suite.tonalite = fiche.tonalite
    remplis.push('tonalite')
  }
  if (fiche.exigence !== null && etat.exigence === null) {
    suite.exigence = fiche.exigence
    remplis.push('exigence')
  }
  if (fiche.longueur !== null && etat.longueur === null) {
    suite.longueur = fiche.longueur
    remplis.push('longueur')
  }
  return remplis.length > 0 ? { etat: suite, remplis } : { etat, remplis }
}

// ---------------------------------------------------------------------------
// Doublons : « cette œuvre est peut-être déjà dans ma bibliothèque »
// ---------------------------------------------------------------------------

/** Un titre comparable : sans accents, casse, ponctuation ni article de tête. */
export function cleTitre(titre: string): string {
  return normaliser(titre)
    .replace(/^(l'|le |la |les |un |une |des |the |a |an )/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Nombre de lettres à changer pour passer d'un mot à l'autre (distance de Levenshtein). */
function distance(a: string, b: string): number {
  let ligne = Array.from({ length: b.length + 1 }, (_, rang) => rang)
  for (let i = 1; i <= a.length; i++) {
    const suivante = [i]
    for (let j = 1; j <= b.length; j++) {
      suivante[j] = Math.min(ligne[j] + 1, suivante[j - 1] + 1, ligne[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    ligne = suivante
  }
  return ligne[b.length]
}

/** Même titre, ou une ou deux lettres d'écart quand le titre est assez long pour que ce soit une faute de frappe. */
export function titresProches(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  return Math.min(a.length, b.length) >= 8 && Math.abs(a.length - b.length) <= 2 && distance(a, b) <= 2
}

const motsDesAuteurs = (auteurs: string[]) =>
  new Set(
    auteurs
      .flatMap((nom) => normaliser(nom).split(/[^a-z0-9]+/))
      .filter((mot) => mot.length >= 3),
  )

/**
 * Les œuvres de ma bibliothèque au titre très proche. Si les auteurs sont connus des deux
 * côtés et n'ont aucun nom en commun, ce sont deux œuvres différentes : pas d'alerte.
 */
export function doublonsProches(titre: string, auteurs: string[], oeuvres: OeuvreListee[]): OeuvreListee[] {
  const cherche = cleTitre(titre)
  if (!cherche) return []
  const mots = motsDesAuteurs(auteurs)
  return oeuvres.filter((oeuvre) => {
    const titres = [oeuvre.titre, oeuvre.titreSecondaire].filter((t): t is string => !!t).map(cleTitre)
    if (!titres.some((t) => titresProches(t, cherche))) return false
    const siens = motsDesAuteurs(oeuvre.auteurs)
    if (mots.size === 0 || siens.size === 0) return true
    return [...mots].some((mot) => siens.has(mot))
  })
}
