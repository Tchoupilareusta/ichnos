import { useEffect, useState } from 'react'

/** Bandeau discret quand l'appareil n'a plus de connexion. */
export function HorsConnexion() {
  const [enLigne, setEnLigne] = useState(() => navigator.onLine)

  useEffect(() => {
    const maj = () => setEnLigne(navigator.onLine)
    window.addEventListener('online', maj)
    window.addEventListener('offline', maj)
    return () => {
      window.removeEventListener('online', maj)
      window.removeEventListener('offline', maj)
    }
  }, [])

  return (
    <div role="status" aria-live="polite">
      {!enLigne && (
        <p
          className="sticky top-0 z-30 m-0 bg-accent-doux px-6 pb-2 text-center text-sm font-semibold text-accent-texte"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
        >
          Hors connexion : je peux consulter, mais pas modifier.
        </p>
      )}
    </div>
  )
}
