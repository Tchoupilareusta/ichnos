import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Bouton } from './Bouton'

/**
 * Fenêtre de confirmation, pour un geste qui change beaucoup de choses ou qui ne se défait pas.
 * Élément <dialog> natif : le focus y reste enfermé et Échap la referme.
 */
export function Dialogue({
  ouvert,
  titre,
  children,
  confirmer,
  annuler = 'Annuler',
  onConfirmer,
  onAnnuler,
  occupe = false,
}: {
  ouvert: boolean
  titre: string
  children?: ReactNode
  confirmer: string
  annuler?: string
  onConfirmer: () => void
  onAnnuler: () => void
  occupe?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const idTitre = useId()
  const idTexte = useId()

  useEffect(() => {
    const dialogue = ref.current
    if (!dialogue) return
    if (ouvert && !dialogue.open) dialogue.showModal()
    if (!ouvert && dialogue.open) dialogue.close()
  }, [ouvert])

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitre}
      aria-describedby={children ? idTexte : undefined}
      onCancel={(e) => {
        e.preventDefault()
        if (!occupe) onAnnuler()
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-panneau border border-bordure bg-surface p-0 text-encre shadow-forte backdrop:bg-[rgba(20,14,10,0.45)]"
    >
      {ouvert && (
        <div className="flex flex-col gap-4 p-6">
          <h2 id={idTitre} className="m-0 font-titre text-[1.5rem] leading-tight">
            {titre}
          </h2>
          {children && (
            <div id={idTexte} className="text-base leading-relaxed">
              {children}
            </div>
          )}
          {/* Comme dans les panneaux : empilés, pleine largeur, l'action principale en haut. */}
          <div className="mt-2 flex flex-col gap-3">
            <Bouton onClick={onConfirmer} occupe={occupe}>
              {confirmer}
            </Bouton>
            <Bouton variante="secondaire" onClick={onAnnuler} occupe={occupe} autoFocus>
              {annuler}
            </Bouton>
          </div>
        </div>
      )}
    </dialog>
  )
}
