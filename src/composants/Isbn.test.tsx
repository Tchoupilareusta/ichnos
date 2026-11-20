import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { ChampIsbn, Isbn } from './Isbn'

describe('Isbn (affichage)', () => {
  it('montre les tirets, et fait lire les chiffres un à un, sans les tirets', () => {
    const { container } = render(<Isbn valeur="9782253008484" />)
    const visible = container.querySelector('[aria-hidden="true"]')
    expect(visible).toHaveTextContent('978-2-253-00848-4')
    // Ce que VoiceOver lit : le texte hors de la partie masquée.
    const lu = container.querySelector('.sr-only')
    expect(lu).toHaveTextContent('9 7 8 2 2 5 3 0 0 8 4 8 4')
    expect(lu?.closest('[aria-hidden="true"]')).toBeNull()
  })
})

function Essai({ depart = '', surValeur }: { depart?: string; surValeur?: (valeur: string) => void }) {
  const [valeur, setValeur] = useState(depart)
  return (
    <ChampIsbn
      libelle="ISBN"
      value={valeur}
      surChange={(nouvelle) => {
        setValeur(nouvelle)
        surValeur?.(nouvelle)
      }}
    />
  )
}

/** Comme le navigateur : le texte du champ change, le curseur se place, puis l'événement part. */
function ecrire(champ: HTMLInputElement, texte: string, curseur = texte.length, inputType = 'insertText') {
  fireEvent.input(champ, { target: { value: texte, selectionStart: curseur, selectionEnd: curseur }, inputType })
}

describe('ChampIsbn (saisie)', () => {
  it('garde le clavier numérique', () => {
    render(<Essai />)
    expect(screen.getByLabelText('ISBN')).toHaveAttribute('inputmode', 'numeric')
  })

  it('montre avec ses tirets un ISBN rangé sans tirets', () => {
    render(<Essai depart="9782253008484" />)
    expect(screen.getByLabelText('ISBN')).toHaveValue('978-2-253-00848-4')
  })

  it('place les tirets au fil de la frappe, et rend une valeur sans tirets', () => {
    const recues: string[] = []
    render(<Essai surValeur={(v) => recues.push(v)} />)
    const champ = screen.getByLabelText<HTMLInputElement>('ISBN')
    let texte = ''
    for (const chiffre of '9782070360024') {
      texte = champ.value + chiffre
      ecrire(champ, texte)
    }
    expect(champ).toHaveValue('978-2-07-036002-4')
    expect(recues.at(-1)).toBe('9782070360024')
    expect(recues.every((valeur) => !valeur.includes('-'))).toBe(true)
  })

  it('accepte un ISBN collé avec des espaces ou des tirets', () => {
    const recues: string[] = []
    render(<Essai surValeur={(v) => recues.push(v)} />)
    const champ = screen.getByLabelText<HTMLInputElement>('ISBN')
    ecrire(champ, '978 2 253 00848 4', 17, 'insertFromPaste')
    expect(champ).toHaveValue('978-2-253-00848-4')
    expect(recues).toEqual(['9782253008484'])
  })

  it('laisse le curseur à sa place quand je corrige un chiffre au milieu', () => {
    render(<Essai depart="9782070360024" />)
    const champ = screen.getByLabelText<HTMLInputElement>('ISBN')
    champ.focus()
    // J'efface le « 3 » de « 978-2-07-03|6002-4 » : le curseur reste entre 0 et 6.
    ecrire(champ, '978-2-07-06002-4', 10, 'deleteContentBackward')
    // Douze chiffres : le dernier tiret attend le treizième.
    expect(champ).toHaveValue('978-2-07-060024')
    expect(champ.selectionStart).toBe(10)
  })

  it('effacer un tiret efface le chiffre d’avant', () => {
    const recues: string[] = []
    render(<Essai depart="978207" surValeur={(v) => recues.push(v)} />)
    const champ = screen.getByLabelText<HTMLInputElement>('ISBN')
    champ.focus()
    expect(champ).toHaveValue('978-2-07')
    ecrire(champ, '978-207', 5, 'deleteContentBackward')
    expect(recues).toEqual(['97807'])
    expect(champ).toHaveValue('978-0-7')
    expect(champ.selectionStart).toBe(3)
  })

  it('ne garde pas une lettre tapée par erreur', () => {
    render(<Essai depart="978" />)
    const champ = screen.getByLabelText<HTMLInputElement>('ISBN')
    ecrire(champ, '978a')
    expect(champ).toHaveValue('978')
  })
})
