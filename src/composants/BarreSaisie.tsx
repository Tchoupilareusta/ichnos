import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bouton } from './Bouton'

/** Combien de temps un message temporaire reste affiché (tant qu'il n'a pas le focus). */
export const DUREE_MESSAGE = 5000

/** Un message temporaire : « Couverture retirée · Annuler ». `cle` change à chaque nouveau message. */
export type Message = { cle: number; texte: string; annuler?: () => void; /** Ce que VoiceOver lit pour « Annuler », pour ne pas le confondre avec celui de la barre. */ nomAnnuler?: string }

/**
 * Pendant une saisie, à la place de la barre de navigation : « Annuler » et « Enregistrer », fixes,
 * à portée de pouce, au-dessus de l'indicateur d'accueil. Juste au-dessus, un message temporaire
 * apparaît quelques secondes après un geste qui se défait (retirer ou changer la couverture).
 */
export function BarreSaisie({
  formulaire,
  occupe,
  enregistrement,
  annuler,
  message,
  effacerMessage,
}: {
  /** L'identifiant du formulaire que « Enregistrer » envoie. */
  formulaire: string
  occupe: boolean
  /** Le libellé pendant l'enregistrement. */
  enregistrement: boolean
  annuler: () => void
  message: Message | null
  effacerMessage: () => void
}) {
  return (
    <div
      className="fixed z-30 flex flex-col items-stretch gap-2.5 left-[calc(env(safe-area-inset-left)+1rem)] right-[calc(env(safe-area-inset-right)+1rem)] bottom-[max(env(safe-area-inset-bottom),1rem)] tablette:right-auto tablette:left-1/2 tablette:w-[28rem] tablette:-translate-x-1/2"
    >
      <MessageTemporaire message={message} effacer={effacerMessage} />
      <div role="group" aria-label="Enregistrer ou annuler" className="flex items-center gap-2 rounded-pilule border border-bordure bg-surface p-2 shadow-forte">
        <Bouton variante="secondaire" onClick={annuler} className="min-h-12 flex-1 px-4">
          Annuler
        </Bouton>
        <Bouton type="submit" form={formulaire} occupe={occupe} className="min-h-12 flex-[1.6] px-4">
          {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
        </Bouton>
      </div>
    </div>
  )
}

/**
 * Le message temporaire. Toujours présent pour VoiceOver (role="status"), il n'a de contenu que
 * quelques secondes. Le temps s'arrête tant que le message a le focus : « Annuler » reste atteignable.
 */
function MessageTemporaire({ message, effacer }: { message: Message | null; effacer: () => void }) {
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
