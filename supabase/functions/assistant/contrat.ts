// Le contrat entre l'appli et la fonction serveur « assistant » : ce que l'appli demande,
// ce que la fonction répond. Ce fichier ne contient que des types et des constantes,
// sans aucune dépendance : l'appli (src/) et la fonction le lisent tous les deux.

/** D'où vient une information. Rien n'est jamais rempli sans source. */
export type Source = 'bnf' | 'google_books' | 'open_library'

/** Une valeur trouvée, avec la source qui la donne. */
export type Champ<T> = { valeur: T; source: Source }

/** Ce qu'une source a répondu : trouvé, rien trouvé, en panne, ou pas configurée (clé absente). */
export type EtatSource = 'ok' | 'rien' | 'panne' | 'non_configure'
export type EtatSources = Record<Source, EtatSource>

/** Un texte de présentation venu d'un catalogue public. Sert seulement à préparer la fiche. */
export type Description = { texte: string; source: Source }

/** Où aller chercher une image de couverture. Jamais une adresse : la fonction construit l'adresse elle-même. */
export type RefCouverture =
  | { source: 'google_books'; id: string }
  | { source: 'open_library'; isbn: string }
  | { source: 'open_library'; numero: number }

/** Une édition trouvée par son ISBN. Un champ qu'aucune source ne donne est null. */
export type Notice = {
  titre: Champ<string> | null
  titreOriginal: Champ<string> | null
  auteurs: Champ<string[]> | null
  traducteur: Champ<string> | null
  editeur: Champ<string> | null
  pages: Champ<number> | null
  /** Langue de l'édition, code à deux lettres (« fr », « en »). */
  langue: Champ<string> | null
  langueOriginale: Champ<string> | null
  /** Année de première publication de l'œuvre. */
  annee: Champ<number> | null
  /** Numéro du tome, quand l'ISBN est celui d'un tome de série. */
  tome: Champ<number> | null
  /** Vrai seulement si une source classe l'ouvrage parmi les mangas. */
  manga: boolean
}

/** Une œuvre trouvée par son titre : ce qui est commun à toutes ses éditions. */
export type Resultat = {
  titre: Champ<string>
  titreOriginal: Champ<string> | null
  auteurs: Champ<string[]> | null
  langueOriginale: Champ<string> | null
  annee: Champ<number> | null
  manga: boolean
  /** Vrai si la BnF range l'œuvre en tomes numérotés. */
  serie: boolean
  descriptions: Description[]
  couverture: RefCouverture | null
}

/** Ce que l'appli envoie pour préparer une fiche : uniquement des données bibliographiques publiques. */
export type OeuvrePourFiche = {
  titre: string
  titreOriginal?: string
  auteurs: string[]
  annee?: number
  langueOriginale?: string
  descriptions: Description[]
}

export type Demande =
  | { action: 'chercher_isbn'; isbn: string }
  | { action: 'chercher_titre'; titre: string; auteur?: string }
  | { action: 'couverture'; ref: RefCouverture }
  | { action: 'couverture'; isbn: string }
  | { action: 'fiche'; oeuvre: OeuvrePourFiche }

export type ReponseIsbn = {
  trouve: boolean
  notice: Notice
  descriptions: Description[]
  couverture: RefCouverture | null
  sources: EtatSources
}

export type ReponseTitre = { resultats: Resultat[]; sources: EtatSources }

export type TypeImage = 'image/jpeg' | 'image/png' | 'image/webp'
/** Largeur et hauteur en pixels, lues dans le fichier ; null quand on ne sait pas les lire (WebP). */
export type ReponseCouverture =
  | { trouve: false }
  | { trouve: true; source: Source; image: { type: TypeImage; base64: string }; largeur: number | null; hauteur: number | null }

/**
 * En dessous de cette largeur, une couverture est « de petite taille » : la fiche l'affiche sur
 * près de 200 points, soit 600 pixels sur un iPhone. La fonction cherche alors plus grand ailleurs.
 */
export const LARGEUR_PETITE = 450

/**
 * La proposition de l'IA. Elle ne contient jamais de donnée bibliographique
 * (année, éditeur, traducteur, ISBN, pages, nombre de tomes) : la fonction le garantit.
 */
export type FicheProposee = {
  synopsis: string | null
  genres: string[]
  themes: string[]
  atmospheres: string[]
  /** Thèmes absents de mon vocabulaire, proposés à part. */
  themesNouveaux: string[]
  tonalite: number | null
  exigence: number | null
  longueur: 'court' | 'moyen' | 'long' | null
}

export const CLES_FICHE = [
  'synopsis',
  'genres',
  'themes',
  'atmospheres',
  'themesNouveaux',
  'tonalite',
  'exigence',
  'longueur',
] as const satisfies readonly (keyof FicheProposee)[]

/**
 * Pourquoi la fonction a refusé ou échoué.
 *   origine : appel venu d'un autre site ; connexion : pas de compte connecté ;
 *   entree : demande mal formée ; limite : trop d'appels à l'IA aujourd'hui ;
 *   non_configure : clé absente côté serveur ; ia : l'IA n'a pas répondu ou a refusé ;
 *   panne : un service ne répond pas.
 */
export type CodeErreur = 'origine' | 'methode' | 'connexion' | 'entree' | 'limite' | 'non_configure' | 'ia' | 'panne'
export type ReponseErreur = { erreur: CodeErreur }

/** Nombre d'appels à l'IA permis par compte sur 24 heures (en plus de la limite de dépense chez Anthropic). */
export const LIMITE_IA_PAR_JOUR = 30

/** Les seuls sites autorisés à appeler la fonction : le site publié et l'aperçu local. */
export const ORIGINES_AUTORISEES = ['https://tchoupilareusta.github.io', 'http://localhost:5173', 'http://localhost:4173'] as const
