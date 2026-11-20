import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Combien de temps un message temporaire reste affiché (tant qu'il n'a pas le focus). */
export const DUREE_MESSAGE = 5000

/** Un message temporaire : « Couverture retirée · Annuler ». `cle` change à chaque nouveau message. */
export type Message = { cle: number; texte: string; annuler?: () => void; /** Ce que VoiceOver lit pour « Annuler », pour ne pas le confondre avec celui de la barre. */ nomAnnuler?: string }

/**
 * Le message temporaire. Toujours présent pour VoiceOver (role="status"), il n'a de contenu que
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
      <span className="flex min-h-11 items-center gap-2 rounded-pilule bg-encre px-5 text-[0.9375rem] font-semibold text-fond shadow-forte">
        <span>{message.texte}</span>
        {message.annuler && (
          <>
            <span aria-hidden="true" className="opacity-60">
              ·
            </span>
            <button
              type="button"
              aria-label={message.nomAnnuler}
              onClick={() => {
                message.annuler?.()
                effacer()
              }}
              className="flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 font-bold text-fond underline decoration-1 underline-offset-4"
            >
              Annuler
            </button>
          </>
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
