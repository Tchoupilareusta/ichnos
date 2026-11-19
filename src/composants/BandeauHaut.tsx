/**
 * Un voile fixe sur la zone de l'heure et de la batterie de l'iPhone : le contenu qui défile
 * passe dessous sans se mêler à l'horloge. Il a la hauteur de la zone de sécurité du haut,
 * donc aucune sur un écran sans encoche. Purement décoratif : ni VoiceOver ni les appuis
 * ne le voient. Il reste sous les panneaux et les fenêtres (<dialog>), qui sont au-dessus de
 * tout, et sous le message « Hors connexion », qui occupe déjà cette zone.
 */
export function BandeauHaut() {
  return (
    <div
      aria-hidden="true"
      data-role="bandeau-haut"
      className="pointer-events-none fixed inset-x-0 top-0 z-[25] backdrop-blur-md"
      style={{ height: 'env(safe-area-inset-top)', background: 'color-mix(in srgb, var(--fond) 82%, transparent)' }}
    />
  )
}
