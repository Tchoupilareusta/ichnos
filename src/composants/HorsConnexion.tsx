import { useEnLigne } from '../navigation/useEnLigne'

/**
 * Bandeau discret quand l'appareil n'a plus de connexion. Il reste collé en haut de l'écran
 * pendant que la page défile : c'est la zone d'annonce elle-même qui est « sticky », posée
 * directement dans la racine de l'appli (un élément « sticky » ne colle que dans les limites de
 * son parent ; dans un parent de sa propre hauteur, il partirait avec la page). Vide, elle n'a
 * aucune hauteur.
 */
export function HorsConnexion() {
  const enLigne = useEnLigne()
  return (
    <div role="status" aria-live="polite" className="sticky top-0 z-30">
      {!enLigne && (
        <p
          className="m-0 bg-accent-doux px-6 pb-2 text-center text-sm font-semibold text-accent-texte"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
        >
          Hors connexion : tout se consulte, rien ne se modifie.
        </p>
      )}
    </div>
  )
}
