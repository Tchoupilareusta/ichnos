import type { Auth, Compte, Resultat } from './auth'

/** Faux service de connexion pour les tests : aucun réseau, tout est en mémoire. */
export function authFictif(depart: { compte?: Compte | null; demande?: Resultat; verification?: Resultat } = {}) {
  let compte = depart.compte ?? null
  const ecouteurs = new Set<(compte: Compte | null) => void>()
  const prevenir = () => ecouteurs.forEach((suite) => suite(compte))

  const appels = {
    demanderCode: [] as string[],
    verifierCode: [] as { email: string; code: string }[],
    deconnecter: 0,
  }

  const auth: Auth = {
    compteActuel: async () => compte,
    surChangement(suite) {
      ecouteurs.add(suite)
      return () => ecouteurs.delete(suite)
    },
    async demanderCode(email) {
      appels.demanderCode.push(email)
      return depart.demande ?? { ok: true }
    },
    async verifierCode(email, code) {
      appels.verifierCode.push({ email, code })
      const resultat = depart.verification ?? { ok: true }
      if (resultat.ok) {
        compte = { email }
        prevenir()
      }
      return resultat
    },
    async deconnecter() {
      appels.deconnecter += 1
      compte = null
      prevenir()
      return { ok: true }
    },
  }

  return { auth, appels }
}
