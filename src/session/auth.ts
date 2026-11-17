/** Le compte connecté, tel que l'appli a besoin de le connaître. */
export type Compte = { email: string }

/** Pourquoi une demande n'a pas abouti. */
export type Echec = 'code' | 'trop' | 'reseau' | 'inconnu'

export type Resultat = { ok: true } | { ok: false; echec: Echec }

/** Ce que l'appli attend du service de connexion (Supabase en vrai, un faux dans les tests). */
export interface Auth {
  compteActuel(): Promise<Compte | null>
  /** Prévient à chaque connexion ou déconnexion. Rend la fonction qui arrête l'écoute. */
  surChangement(suite: (compte: Compte | null) => void): () => void
  demanderCode(email: string): Promise<Resultat>
  verifierCode(email: string, code: string): Promise<Resultat>
  deconnecter(): Promise<Resultat>
}
