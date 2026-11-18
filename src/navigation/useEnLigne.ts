import { useSyncExternalStore } from 'react'

function abonner(suite: () => void) {
  window.addEventListener('online', suite)
  window.addEventListener('offline', suite)
  return () => {
    window.removeEventListener('online', suite)
    window.removeEventListener('offline', suite)
  }
}

/** Vrai quand l'appareil a une connexion. Hors connexion, on consulte mais on ne modifie pas. */
export function useEnLigne(): boolean {
  return useSyncExternalStore(abonner, () => navigator.onLine, () => true)
}
