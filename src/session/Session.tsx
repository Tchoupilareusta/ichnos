import { createContext, useContext, useEffect, useState } from 'react'
import type { Auth, Compte } from './auth'

export type EtatSession = { statut: 'chargement' } | { statut: 'deconnecte' } | { statut: 'connecte'; compte: Compte }

const etatDe = (compte: Compte | null): EtatSession => (compte ? { statut: 'connecte', compte } : { statut: 'deconnecte' })

/** Suit la session : en cours de lecture, déconnecté, ou connecté avec un compte. */
export function useEtatSession(auth: Auth): EtatSession {
  const [etat, setEtat] = useState<EtatSession>({ statut: 'chargement' })

  useEffect(() => {
    let actif = true
    const arreter = auth.surChangement((compte) => setEtat(etatDe(compte)))
    auth.compteActuel().then(
      (compte) => actif && setEtat(etatDe(compte)),
      () => actif && setEtat({ statut: 'deconnecte' }),
    )
    return () => {
      actif = false
      arreter()
    }
  }, [auth])

  return etat
}

const ContexteSession = createContext<{ auth: Auth; compte: Compte } | null>(null)

export const FournisseurSession = ContexteSession.Provider

/** Le compte connecté et le service de connexion, pour les écrans de l'appli. */
export function useSession() {
  const session = useContext(ContexteSession)
  if (!session) throw new Error('useSession doit être utilisé dans l’appli connectée')
  return session
}
