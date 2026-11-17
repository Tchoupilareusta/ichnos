import type { SupabaseClient } from '@supabase/supabase-js'
import type { Auth, Compte, Echec, Resultat } from './auth'

/** La seule partie du client Supabase dont la connexion a besoin. */
export type ClientAuth = Pick<SupabaseClient, 'auth'>

type ErreurAuth = { status?: number; code?: string; name?: string }

const estSansReseau = (erreur: ErreurAuth) => erreur.name === 'AuthRetryableFetchError' || erreur.status === 0
const estTropRapproche = (erreur: ErreurAuth) => erreur.status === 429 || (erreur.code ?? '').includes('rate_limit')

const echec = (raison: Echec): Resultat => ({ ok: false, echec: raison })
const REUSSI: Resultat = { ok: true }

const compteDe = (session: { user: { email?: string } } | null): Compte | null =>
  session?.user.email ? { email: session.user.email } : null

/**
 * Connexion par e-mail et mot de passe, sur Supabase. L'appli ne crée jamais de compte
 * et n'envoie aucun e-mail : le compte et son mot de passe se gèrent depuis Supabase.
 * `lireMemoire` rend la session gardée sur l'appareil (texte JSON), pour la consultation hors connexion.
 */
export function creerAuthSupabase(client: ClientAuth, lireMemoire: () => string | null): Auth {
  const compteMemorise = (): Compte | null => {
    try {
      return compteDe(JSON.parse(lireMemoire() ?? 'null'))
    } catch {
      return null
    }
  }

  return {
    async compteActuel() {
      const { data, error } = await client.auth.getSession()
      if (data.session) return compteDe(data.session)
      // Sans réseau, la session ne peut pas être renouvelée : on garde le compte connu de l'appareil.
      // La base, elle, continue d'exiger une session valable pour chaque lecture ou écriture.
      if (error && estSansReseau(error)) return compteMemorise()
      return null
    },

    surChangement(suite) {
      const { data } = client.auth.onAuthStateChange((evenement, session) => {
        if (evenement === 'INITIAL_SESSION') return
        suite(compteDe(session))
      })
      return () => data.subscription.unsubscribe()
    },

    async seConnecter(email, motDePasse) {
      // Le mot de passe part tel quel : un espace peut en faire partie.
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password: motDePasse })
      if (!error) return REUSSI
      if (estSansReseau(error)) return echec('reseau')
      if (estTropRapproche(error)) return echec('trop')
      if ((error.status ?? 0) >= 500) return echec('inconnu')
      // Supabase répond de la même façon pour une adresse inconnue et pour un mauvais mot de passe.
      return echec('identifiants')
    },

    async deconnecter() {
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (!error) return REUSSI
      return echec(estSansReseau(error) ? 'reseau' : 'inconnu')
    },
  }
}
