import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Combien de temps un message temporaire reste affiché (tant qu'il n'a pas le focus). */
export const DUREE_MESSAGE = 5000

/** Un message temporaire : « Couverture retirée », avec un bouton « Annuler ». `cle` change à chaque nouveau message. */
export type Message = {
  cle: number
  texte: string
  /** Une petite icône devant le texte (l'icône du choix appliqué), décorative. */
  icone?: ReactNode
  annuler?: () => void
  /** Ce que VoiceOver lit pour « Annuler », pour ne pas le confondre avec celui de la barre. */
  nomAnnuler?: string
}

/**
 * Le message temporaire, sur une ligne : l'icône et un texte court à gauche, un vrai bouton
 * « Annuler » à droite. Toujours présent pour VoiceOver (role="status"), il n'a de contenu que
 * quelques secondes. Le temps s'arrête tant que le message a le focus : « Annuler » reste atteignable.
 */
export function MessageTemporaire({ message, effacer }: { message: Message | null; effacer: () => void }) {
  const cadre = useRef<HTMLDivElement>(null)
  const [focus, setFocus] = useState(false)

  useEffect(() => {
    if (!message || focus) return
    const minuterie = setTimeout(effacer, DUREE_MESSAGE)
    return () => clearTimeout(minuterie)
  }, [message, focus, effacer])

  let contenu: ReactNode = null
  if (message) {
    contenu = (
      <span
        className={`flex min-h-12 max-w-full items-center gap-3 rounded-pilule bg-encre py-1 text-[0.9375rem] font-semibold text-fond shadow-forte ${
          message.annuler ? 'pr-1 pl-4' : 'px-5'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {message.icone && (
            <span aria-hidden="true" className="flex shrink-0">
              {message.icone}
            </span>
          )}
          <span className="truncate">{message.texte}</span>
        </span>
        {message.annuler && (
          <button
            type="button"
            aria-label={message.nomAnnuler}
            onClick={() => {
              message.annuler?.()
              effacer()
            }}
            className="flex min-h-11 shrink-0 cursor-pointer items-center rounded-pilule border-0 bg-surface px-4 text-[0.9375rem] font-bold text-encre transition-transform duration-200 active:scale-[0.97]"
          >
            Annuler
          </button>
        )}
      </span>
    )
  }

  return (
    <div
      ref={cadre}
      role="status"
      data-etat={message ? 'ouvert' : 'ferme'}
      onFocus={() => setFocus(true)}
      onBlur={(evenement) => {
        if (!cadre.current?.contains(evenement.relatedTarget as Node)) setFocus(false)
      }}
      className="flex justify-center empty:hidden"
    >
      {contenu}
    </div>
  )
}
