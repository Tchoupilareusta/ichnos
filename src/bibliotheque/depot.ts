import type {
  Forme,
  GenreEtiquette,
  Longueur,
  Possession,
  PossessionAffichee,
  Role,
  Statut,
  TypeMedia,
} from './modele'
import {
  progressionLivre,
  progressionSerie,
  type Appreciation,
  type Evenement,
  type LectureTome,
  type PrecisionDate,
  type Progression,
  type StatutMedia,
  type Unite,
} from './suivi'
import type { CibleCouverture } from '../couvertures/choix'

/** Une œuvre telle que la grille de la bibliothèque a besoin de la connaître. */
export type OeuvreListee = {
  id: string
  titre: string
  /** L'autre titre (original ou français), s'il diffère. */
  titreSecondaire: string | null
  auteurs: string[]
  genres: string[]
  themes: string[]
  atmospheres: string[]
  statut: Statut
  possession: PossessionAffichee
  /** Les possessions sous lesquelles l'œuvre se retrouve dans les filtres (§6.2). */
  possessionsFiltrables: Possession[]
  /** Chemin de la couverture à montrer (stockage privé), ou null : la couverture typographique s'affiche. */
  couverture: string | null
}

export type Edition = {
  id: string
  isbn: string | null
  publisher: string | null
  language: string | null
  format: string | null
  translator: string | null
  pageCount: number | null
  /** Chemin de la couverture de cette édition, s'il y en a une. */
  couverture?: string | null
}

export type Tome = {
  numero: number
  titre: string | null
  isbn: string | null
  possession: Possession
  lecture: LectureTome
  /** Chemin de la couverture de ce tome, s'il y en a une. */
  couverture?: string | null
}

export type Media = {
  id: string
  type: TypeMedia
  titre: string | null
  saisons: number | null
  episodes: number | null
  /** Avancement : jamais modifié par le formulaire, seulement par le suivi de la fiche. */
  episodesVus: number | null
  statut: StatutMedia
}

export type Etiquette = { genre: GenreEtiquette; nom: string; coeur: boolean }

/** Tout ce que la fiche d'une œuvre affiche, et tout ce que son formulaire modifie. */
export type OeuvreDetaillee = {
  id: string
  titreFr: string
  titreOriginal: string | null
  langueOriginale: string | null
  annee: number | null
  forme: Forme
  synopsis: string | null
  tonalite: number | null
  exigence: number | null
  longueur: Longueur | null
  estSerie: boolean
  /** Chemin de la couverture de l'œuvre elle-même, s'il y en a une. */
  couverture?: string | null
  auteurs: { nom: string; role: Role }[]
  etiquettes: Etiquette[]
  editions: Edition[]
  tomes: Tome[]
  medias: Media[]
  statut: Statut
  /** Possession enregistrée pour l'œuvre ; pour une série, l'écran la calcule à partir des tomes. */
  possession: Possession
  monEdition: string | null
  /** Unité choisie (vide tant que je n'ai rien choisi : l'appli propose alors « page »). Ignorée pour une série. */
  unite: Unite | null
  position: number | null
  total: number | null
  appreciation: Appreciation | null
  /** Historique discret, du plus ancien au plus récent. */
  historique: Evenement[]
}

/** Une lecture en cours, telle que l'accueil la montre. */
export type EnCours = {
  id: string
  titre: string
  auteurs: string[]
  estSerie: boolean
  unite: Unite | null
  position: number | null
  total: number | null
  /** Nombre de pages de mon édition, s'il est connu. */
  pagesEdition: number | null
  tomes: { numero: number; lecture: LectureTome }[]
  /** Mon ressenti déjà choisi (une relecture le garde). */
  appreciation: Appreciation | null
  /** Chemin de la couverture à montrer, ou null. */
  couverture: string | null
}

/** Où j'en suis : pour une série, tiré des tomes ; sinon dans l'unité choisie. */
export function progressionDe(x: Pick<EnCours, 'estSerie' | 'unite' | 'position' | 'total' | 'pagesEdition' | 'tomes'>): Progression {
  return x.estSerie ? progressionSerie(x.tomes) : progressionLivre(x.unite, x.position, x.total, x.pagesEdition)
}

/** La couverture à montrer pour une fiche : mon édition ou l'œuvre ; pour une série, le tome où j'en suis. */
export function couverturesDeLaFiche(oeuvre: OeuvreDetaillee) {
  return {
    estSerie: oeuvre.estSerie,
    oeuvre: oeuvre.couverture ?? null,
    monEdition: oeuvre.editions.find((e) => e.id === oeuvre.monEdition)?.couverture ?? null,
    tomes: oeuvre.tomes.map((t) => ({ numero: t.numero, lecture: t.lecture, couverture: t.couverture ?? null })),
  }
}

/** Les mêmes informations, lues sur la fiche. */
export function suiviDeLaFiche(oeuvre: OeuvreDetaillee) {
  const edition = oeuvre.editions.find((e) => e.id === oeuvre.monEdition)
  return {
    estSerie: oeuvre.estSerie,
    unite: oeuvre.unite,
    position: oeuvre.position,
    total: oeuvre.total,
    pagesEdition: edition?.pageCount ?? null,
    tomes: oeuvre.tomes.map((t) => ({ numero: t.numero, lecture: t.lecture })),
  }
}

/** Mon vocabulaire : pour proposer les étiquettes et les auteurs déjà connus dans le formulaire. */
export type Vocabulaire = { etiquettes: Etiquette[]; auteurs: string[] }

/** La fiche envoyée à la fonction enregistrer_oeuvre de la base (supabase/migrations). */
export type FicheEnvoi = {
  id?: string
  title_fr: string
  title_original: string | null
  original_language: string | null
  first_published_year: number | null
  form: Forme
  synopsis: string | null
  tone: number | null
  density: number | null
  length: Longueur | null
  is_series: boolean
  authors: { name: string; role: Role }[]
  tags: { kind: GenreEtiquette; name: string }[]
  editions: {
    id?: string
    isbn: string | null
    publisher: string | null
    language: string | null
    format: string | null
    translator: string | null
    page_count: number | null
    mienne: boolean
  }[]
  volumes: { number: number; title: string | null; isbn: string | null }[]
  media: { id?: string; kind: TypeMedia; title: string | null; seasons: number | null; episodes_total: number | null }[]
}

export type EchecLecture = 'reseau' | 'inconnu'
/** « introuvable » : l'œuvre n'existe pas (ou plus) dans ma bibliothèque. */
export type EchecFiche = EchecLecture | 'introuvable'
/** « invalide » : la base a refusé une valeur (le formulaire l'aurait normalement signalée avant). */
export type EchecEcriture = 'reseau' | 'introuvable' | 'invalide' | 'inconnu'

/** « deja » : la bibliothèque contient déjà des œuvres, le catalogue n'est pas installé deux fois. */
export type EchecInstallation = 'reseau' | 'deja' | 'inconnu'

/** Une œuvre ou un tome sans couverture : l'ISBN qui permet de la chercher, et l'endroit où la ranger. */
export type ManqueCouverture = { oeuvre: string; titre: string; tome: number | null; isbn: string | null; cible: CibleCouverture }
export type LectureManques = { ok: true; manques: ManqueCouverture[] } | { ok: false; echec: EchecLecture }
/**
 * Une couverture rangée : son chemin, l'endroit où elle est rangée, et l'ISBN de l'édition ou du
 * tome qui la porte (null pour une couverture rangée sur l'œuvre : aucune édition précise).
 */
export type CouvertureRangee = { oeuvre: string; titre: string; tome: number | null; chemin: string; isbn: string | null; cible: CibleCouverture }
export type LectureCouvertures = { ok: true; couvertures: CouvertureRangee[] } | { ok: false; echec: EchecLecture }
/** L'œuvre de ma bibliothèque qui porte déjà un ISBN (et le tome, si c'est celui d'un tome). */
export type RechercheIsbn = { ok: true; trouve: { id: string; tome: number | null } | null } | { ok: false; echec: EchecLecture }

export type Lecture = { ok: true; oeuvres: OeuvreListee[] } | { ok: false; echec: EchecLecture }
export type LectureEnCours = { ok: true; lectures: EnCours[] } | { ok: false; echec: EchecLecture }
export type LectureFiche = { ok: true; oeuvre: OeuvreDetaillee } | { ok: false; echec: EchecFiche }
export type LectureVocabulaire = { ok: true; vocabulaire: Vocabulaire } | { ok: false; echec: EchecLecture }
export type Installation = { ok: true } | { ok: false; echec: EchecInstallation }
export type Ecriture = { ok: true } | { ok: false; echec: EchecEcriture }
export type Enregistrement = { ok: true; id: string } | { ok: false; echec: EchecEcriture }

/**
 * « Je l'ai acheté » : l'ISBN de mon exemplaire et ce que les catalogues en disent, envoyés à la
 * fonction noter_achat de la base. `tome` pour un tome de série ; `couverture` : le chemin d'une
 * image déjà rangée, si j'en garde une.
 */
export type Achat = {
  isbn: string
  publisher?: string | null
  language?: string | null
  format?: string | null
  translator?: string | null
  page_count?: number | null
  tome?: number
  couverture?: string | null
}
/** « isbn_ailleurs » : cet ISBN est déjà celui d'une autre de mes œuvres, ou d'un autre tome de la série. */
export type EchecAchat = EchecEcriture | 'isbn_ailleurs'
/** L'édition devenue la mienne (null pour un tome). */
export type NoteAchat = { ok: true; edition: string | null } | { ok: false; echec: EchecAchat }

/** Les tomes visés par un changement de possession : tous, ou une plage (« les tomes 1 à 8 »). */
export type ChoixTomes = 'tous' | { de: number; a: number }

/** Ce que l'appli attend de la base pour la bibliothèque (Supabase en vrai, un faux dans les tests). */
export interface Depot {
  listerOeuvres(): Promise<Lecture>
  /** Mes lectures « En cours », la plus récemment touchée d'abord. */
  listerEnCours(): Promise<LectureEnCours>
  lireOeuvre(id: string): Promise<LectureFiche>
  lireVocabulaire(): Promise<LectureVocabulaire>
  /** Crée (sans id) ou modifie une œuvre. Tout ou rien. */
  enregistrerOeuvre(fiche: FicheEnvoi): Promise<Enregistrement>
  /** Statut, dates et historique, en tout ou rien (fonction changer_statut). */
  changerStatut(id: string, statut: Statut): Promise<Ecriture>
  /** Position, ou tome courant d'une série, et sa trace (fonction noter_progression). Vide : efface la position. */
  noterProgression(id: string, valeur: number | null): Promise<Ecriture>
  /** Change l'unité et son total ; la position repart de zéro, car elle ne veut plus rien dire. */
  changerUnite(id: string, unite: Unite, total: number | null): Promise<Ecriture>
  changerTotal(id: string, total: number | null): Promise<Ecriture>
  /** Date de fin de la dernière lecture, au jour, au mois ou à l'année près ; vide pour la retirer. */
  daterFin(id: string, date: string | null, precision: PrecisionDate): Promise<Ecriture>
  changerAppreciation(id: string, appreciation: Appreciation | null): Promise<Ecriture>
  changerLectureTomes(id: string, tomes: ChoixTomes, lecture: LectureTome): Promise<Ecriture>
  changerMedia(id: string, media: string, valeurs: { vus?: number | null; statut?: StatutMedia }): Promise<Ecriture>
  /** Possession d'une œuvre qui n'est pas une série. */
  changerPossession(id: string, possession: Possession): Promise<Ecriture>
  changerPossessionTomes(id: string, tomes: ChoixTomes, possession: Possession): Promise<Ecriture>
  changerMonEdition(id: string, edition: string | null): Promise<Ecriture>
  /** « Je l'ai acheté » : mon édition (ou le tome), son ISBN, sa couverture et la possession, en tout ou rien (fonction noter_achat). */
  noterAchat(id: string, achat: Achat): Promise<NoteAchat>
  supprimerOeuvre(id: string): Promise<Ecriture>
  /** Range le chemin d'une couverture sur l'œuvre, une de ses éditions ou un de ses tomes ; null la retire. */
  definirCouverture(id: string, cible: CibleCouverture, chemin: string | null): Promise<Ecriture>
  /** Cet ISBN est-il déjà dans ma bibliothèque (édition ou tome) ? */
  trouverParIsbn(isbn: string): Promise<RechercheIsbn>
  /** Tout ce qui n'a pas encore de couverture, par ordre de titre. */
  listerSansCouverture(): Promise<LectureManques>
  /** Toutes les couvertures rangées (œuvres, éditions, tomes), par ordre de titre. */
  listerCouvertures(): Promise<LectureCouvertures>
  /** Installe le catalogue de départ dans une bibliothèque vide. Tout ou rien. */
  installerCatalogue(): Promise<Installation>
}

const absent = async () => ({ ok: false as const, echec: 'inconnu' as const })

/** Sans base configurée, rien ne se lit ni ne s'écrit. */
export const DEPOT_ABSENT: Depot = {
  listerOeuvres: absent,
  listerEnCours: absent,
  lireOeuvre: absent,
  lireVocabulaire: absent,
  enregistrerOeuvre: absent,
  changerStatut: absent,
  noterProgression: absent,
  changerUnite: absent,
  changerTotal: absent,
  daterFin: absent,
  changerAppreciation: absent,
  changerLectureTomes: absent,
  changerMedia: absent,
  changerPossession: absent,
  changerPossessionTomes: absent,
  changerMonEdition: absent,
  noterAchat: absent,
  supprimerOeuvre: absent,
  definirCouverture: absent,
  trouverParIsbn: absent,
  listerSansCouverture: absent,
  listerCouvertures: absent,
  installerCatalogue: absent,
}
