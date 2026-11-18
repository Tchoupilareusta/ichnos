import { useEnLigne } from '../navigation/useEnLigne'

/** Bandeau discret quand l'appareil n'a plus de connexion. */
export function HorsConnexion() {
  const enLigne = useEnLigne()
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
