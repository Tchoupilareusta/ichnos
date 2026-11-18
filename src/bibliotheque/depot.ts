/** Une œuvre telle que la liste de la bibliothèque a besoin de la connaître. */
export type OeuvreListee = {
  id: string
  titre: string
  /** L'autre titre (original ou français), s'il diffère. */
  titreSecondaire: string | null
  auteurs: string[]
}

export type EchecLecture = 'reseau' | 'inconnu'

/** « deja » : la bibliothèque contient déjà des œuvres, le catalogue n'est pas installé deux fois. */
export type EchecInstallation = 'reseau' | 'deja' | 'inconnu'

export type Lecture = { ok: true; oeuvres: OeuvreListee[] } | { ok: false; echec: EchecLecture }
export type Installation = { ok: true } | { ok: false; echec: EchecInstallation }

/** Ce que l'appli attend de la base pour la bibliothèque (Supabase en vrai, un faux dans les tests). */
export interface Depot {
  listerOeuvres(): Promise<Lecture>
  /** Installe le catalogue de départ dans une bibliothèque vide. Tout ou rien. */
  installerCatalogue(): Promise<Installation>
}

/** Sans base configurée, rien ne se lit ni ne s'écrit. */
export const DEPOT_ABSENT: Depot = {
  listerOeuvres: async () => ({ ok: false, echec: 'inconnu' }),
  installerCatalogue: async () => ({ ok: false, echec: 'inconnu' }),
}
