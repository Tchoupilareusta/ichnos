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
}

export type Edition = {
  id: string
  isbn: string | null
  publisher: string | null
  language: string | null
  format: string | null
  translator: string | null
  pageCount: number | null
}

export type Tome = {
  numero: number
  titre: string | null
  isbn: string | null
  possession: Possession
}

export type Media = {
  id: string
  type: TypeMedia
  titre: string | null
  saisons: number | null
  episodes: number | null
  /** Avancement : jamais modifié par la fiche (suivi à l'étape 5). */
  episodesVus: number | null
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
  auteurs: { nom: string; role: Role }[]
  etiquettes: Etiquette[]
  editions: Edition[]
  tomes: Tome[]
  medias: Media[]
  statut: Statut
  /** Possession enregistrée pour l'œuvre ; pour une série, l'écran la calcule à partir des tomes. */
  possession: Possession
  monEdition: string | null
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

export type Lecture = { ok: true; oeuvres: OeuvreListee[] } | { ok: false; echec: EchecLecture }
export type LectureFiche = { ok: true; oeuvre: OeuvreDetaillee } | { ok: false; echec: EchecFiche }
export type LectureVocabulaire = { ok: true; vocabulaire: Vocabulaire } | { ok: false; echec: EchecLecture }
export type Installation = { ok: true } | { ok: false; echec: EchecInstallation }
export type Ecriture = { ok: true } | { ok: false; echec: EchecEcriture }
export type Enregistrement = { ok: true; id: string } | { ok: false; echec: EchecEcriture }

/** Les tomes visés par un changement de possession : tous, ou une plage (« les tomes 1 à 8 »). */
export type ChoixTomes = 'tous' | { de: number; a: number }

/** Ce que l'appli attend de la base pour la bibliothèque (Supabase en vrai, un faux dans les tests). */
export interface Depot {
  listerOeuvres(): Promise<Lecture>
  lireOeuvre(id: string): Promise<LectureFiche>
  lireVocabulaire(): Promise<LectureVocabulaire>
  /** Crée (sans id) ou modifie une œuvre. Tout ou rien. */
  enregistrerOeuvre(fiche: FicheEnvoi): Promise<Enregistrement>
  changerStatut(id: string, statut: Statut): Promise<Ecriture>
  /** Possession d'une œuvre qui n'est pas une série. */
  changerPossession(id: string, possession: Possession): Promise<Ecriture>
  changerPossessionTomes(id: string, tomes: ChoixTomes, possession: Possession): Promise<Ecriture>
  changerMonEdition(id: string, edition: string | null): Promise<Ecriture>
  supprimerOeuvre(id: string): Promise<Ecriture>
  /** Installe le catalogue de départ dans une bibliothèque vide. Tout ou rien. */
  installerCatalogue(): Promise<Installation>
}

const absent = async () => ({ ok: false as const, echec: 'inconnu' as const })

/** Sans base configurée, rien ne se lit ni ne s'écrit. */
export const DEPOT_ABSENT: Depot = {
  listerOeuvres: absent,
  lireOeuvre: absent,
  lireVocabulaire: absent,
  enregistrerOeuvre: absent,
  changerStatut: absent,
  changerPossession: absent,
  changerPossessionTomes: absent,
  changerMonEdition: absent,
  supprimerOeuvre: absent,
  installerCatalogue: absent,
}
