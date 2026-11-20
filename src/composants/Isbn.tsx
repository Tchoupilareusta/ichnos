import { useLayoutEffect, useReducer, useRef, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { isbnAffiche, isbnEnChiffres, isbnEnSaisie, saisirIsbn } from '../bibliotheque/isbn'
import { ChampTexte } from './Champs'

/**
 * Un ISBN affiché : avec ses tirets pour l'œil, et chiffre par chiffre pour VoiceOver, qui lirait
 * sinon « neuf cent soixante-dix-huit tiret deux… ».
 */
export function Isbn({ valeur }: { valeur: string }) {
  return (
    <span className="tabular-nums">
      <span aria-hidden="true">{isbnAffiche(valeur)}</span>
      <span className="sr-only">{isbnEnChiffres(valeur)}</span>
    </span>
  )
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'inputMode'> & {
  libelle: ReactNode
  aide?: ReactNode
  erreur?: string | null
  /** L'ISBN, avec ou sans tirets : le champ le montre toujours avec ceux qu'il sait placer. */
  value: string
  /** L'ISBN saisi, toujours sans tirets : c'est sous cette forme qu'il part vers la base. */
  surChange: (isbn: string) => void
  ref?: Ref<HTMLInputElement>
}

/**
 * Le champ de saisie d'un ISBN : clavier numérique, tirets placés au fil de la frappe dès que le
 * début saisi le permet, collage avec ou sans tirets. Le curseur reste à sa place logique (compté
 * en chiffres), et effacer un tiret efface le chiffre voisin.
 */
export function ChampIsbn({ value, surChange, ref, ...champ }: Props) {
  const interne = useRef<HTMLInputElement | null>(null)
  /** Où remettre le curseur une fois le champ redessiné avec ses tirets. */
  const curseurVoulu = useRef<number | null>(null)
  const [, redessiner] = useReducer((tour: number) => tour + 1, 0)

  useLayoutEffect(() => {
    const element = interne.current
    const place = curseurVoulu.current
    curseurVoulu.current = null
    if (!element || place === null || document.activeElement !== element) return
    element.setSelectionRange(place, place)
  })

  return (
    <ChampTexte
      {...champ}
      ref={(element) => {
        interne.current = element
        if (typeof ref === 'function') ref(element)
        else if (ref) ref.current = element
      }}
      inputMode="numeric"
      value={isbnEnSaisie(value)}
      onChange={(evenement) => {
        const element = evenement.currentTarget
        const natif = evenement.nativeEvent as InputEvent
        const sens = natif.inputType === 'deleteContentForward' ? 'avant' : 'arriere'
        const suite = saisirIsbn(value, element.value, element.selectionStart ?? element.value.length, sens)
        curseurVoulu.current = suite.curseur
        surChange(suite.compact)
        // Même si la valeur ne change pas (une lettre tapée par erreur), le champ est redessiné et le curseur replacé.
        redessiner()
      }}
    />
  )
}
