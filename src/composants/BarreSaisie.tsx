import { Bouton } from './Bouton'
import { MessageTemporaire, type Message } from './MessageTemporaire'

export { DUREE_MESSAGE, type Message } from './MessageTemporaire'

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
