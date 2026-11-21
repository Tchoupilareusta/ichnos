// Recommandations (docs/reference.md §7) : le vocabulaire commun à l'algorithme, au dépôt et aux écrans.
import type { Forme, Longueur, PossessionAffichee, Statut } from '../bibliotheque/modele'
import type { Appreciation } from '../bibliotheque/suivi'

/** Les six envies de « Mon envie du moment ». Les codes sont ceux de la table recommendation_log. */
export type Envie = 'surprise' | 'reconfortant' | 'philosophique' | 'remise_en_question' | 'lecture_courte' | 'changer_d_univers'

/** Dans l'ordre du sélecteur (§7.3). */
export const ENVIES: { valeur: Envie; libelle: string }[] = [
  { valeur: 'surprise', libelle: 'Surprends-moi' },
  { valeur: 'reconfortant', libelle: 'Quelque chose de réconfortant' },
  { valeur: 'philosophique', libelle: 'Une réflexion philosophique' },
  { valeur: 'remise_en_question', libelle: 'Remets mes idées en question' },
  { valeur: 'lecture_courte', libelle: 'Une lecture courte' },
  { valeur: 'changer_d_univers', libelle: 'Changer d’univers' },
]

export const estEnvie = (valeur: string | null | undefined): valeur is Envie => ENVIES.some((e) => e.valeur === valeur)
export const libelleEnvie = (envie: Envie) => ENVIES.find((e) => e.valeur === envie)?.libelle ?? ''

/** Une œuvre telle que l'algorithme a besoin de la connaître. Rien ici n'est affiché en chiffres. */
export type OeuvreIdee = {
  id: string
  /** Le titre affiché (français, ou original si mon édition est en anglais). */
  titre: string
  auteurs: string[]
  forme: Forme
  /** 1 (sombre) à 5 (lumineux) ; vide si je ne l'ai pas renseignée. */
  tonalite: number | null
  /** 1 (très facile) à 5 (exigeante). */
  exigence: number | null
  longueur: Longueur | null
  estSerie: boolean
  genres: string[]
  /** `coeur` : un thème qui compte pour moi (tags.is_interest). */
  themes: { nom: string; coeur: boolean }[]
  atmospheres: string[]
  statut: Statut
  possession: PossessionAffichee
  appreciation: Appreciation | null
  /** La dernière fois que j'ai touché à cette lecture (date et heure ISO) : sert pour « En cours ». */
  toucheeLe: string | null
  /** La date de fin, si elle est connue (AAAA-MM-JJ) : sert pour « Terminé ». */
  finieLe: string | null
  /** Chemin de la couverture à montrer, ou null. */
  couverture: string | null
}

/** Une idée mise de côté par « Pas maintenant », et depuis quand (date et heure ISO, donnée par la base). */
export type MiseDeCote = { oeuvre: string; depuis: string }

/** « Pas maintenant » met une idée de côté trois semaines (§7.2). */
export const JOURS_DE_COTE = 21

/** Tout ce que l'algorithme lit : ma bibliothèque et mes idées mises de côté. */
export type Idees = { oeuvres: OeuvreIdee[]; deCote: MiseDeCote[] }
