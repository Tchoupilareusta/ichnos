import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Bouton } from './Bouton'
import { IconeFermer } from './Icones'

/**
 * Feuille qui monte du bas de l'écran sur iPhone (à portée du pouce), fenêtre centrée sur iPad.
 * Élément <dialog> natif : le focus y reste, Échap et un appui à côté la referment.
 * Son état est porté par data-etat (« ouvert » / « ferme ») pour les animations de l'étape 9.
 * Pour la fermer : un bouton en bas (libelleFermer), ou une croix en haut (comme « Où j'en suis »).
 */
export function Feuille({
  ouvert,
  titre,
  sousTitre,
  fermer,
  libelleFermer,
  children,
}: {
  ouvert: boolean
  titre: string
  sousTitre?: ReactNode
  fermer: () => void
  /** Sans libellé, une croix « Fermer » prend place à droite du titre. */
  libelleFermer?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const refTitre = useRef<HTMLHeadingElement>(null)
  const idTitre = useId()

  useEffect(() => {
    const dialogue = ref.current
    if (!dialogue) return
    if (ouvert && !dialogue.open) {
      dialogue.showModal()
      // Le focus va sur le titre (VoiceOver l'annonce), pas sur le premier champ.
      refTitre.current?.focus()
    }
    if (!ouvert && dialogue.open) dialogue.close()
  }, [ouvert])

  // Quand le contenu change de titre (« Où j'en suis » puis « Mon ressenti »), VoiceOver l'annonce.
  useEffect(() => {
    if (ouvert) refTitre.current?.focus()
  }, [titre, ouvert])

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitre}
      data-etat={ouvert ? 'ouvert' : 'ferme'}
      onCancel={(e) => {
        e.preventDefault()
        fermer()
      }}
      // Un appui sur le voile (le <dialog> lui-même, hors de son contenu) referme la feuille.
      onClick={(e) => e.target === e.currentTarget && fermer()}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-panneau border border-b-0 border-bordure bg-surface p-0 text-encre shadow-forte backdrop:bg-[rgba(20,14,10,0.45)] tablette:m-auto tablette:w-[min(36rem,calc(100vw-4rem))] tablette:rounded-panneau tablette:border-b"
    >
      {ouvert && (
        <div
          className="flex flex-col gap-6 px-6 pt-3 tablette:pt-6"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
        >
          {/* Petite poignée : le signe familier d'une feuille, purement décoratif. */}
          <span aria-hidden="true" className="mx-auto h-1.5 w-10 rounded-pilule bg-bordure tablette:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 ref={refTitre} id={idTitre} tabIndex={-1} className="m-0 font-titre text-[1.5rem] leading-tight outline-none">
                {titre}
              </h2>
              {sousTitre && <p className="m-0 text-sm text-discret">{sousTitre}</p>}
            </div>
            {!libelleFermer && (
              <button
                type="button"
                aria-label="Fermer"
                onClick={fermer}
                className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pilule border border-bordure bg-fond text-encre"
              >
                <IconeFermer taille={18} />
              </button>
            )}
          </div>
          {children}
          {libelleFermer && <Bouton onClick={fermer}>{libelleFermer}</Bouton>}
        </div>
      )}
    </dialog>
  )
}
