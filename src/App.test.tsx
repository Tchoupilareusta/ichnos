import { act, render, screen, within } from '@testing-library/react'
import { App } from './App'

function aller(hash: string) {
  act(() => {
    window.location.hash = hash
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

describe('squelette', () => {
  beforeEach(() => {
    window.location.hash = ''
    window.scrollTo = () => {}
  })

  it('affiche l’accueil et marque l’onglet actif', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'En ce moment' })).toBeInTheDocument()
    const [barreLaterale, barreDuBas] = screen.getAllByRole('navigation', { name: 'Navigation principale' })
    expect(within(barreDuBas).getByRole('link', { name: 'Accueil' })).toHaveAttribute('aria-current', 'page')
    expect(within(barreLaterale).getByRole('link', { name: 'Accueil' })).toHaveAttribute('aria-current', 'page')
    expect(within(barreDuBas).getByRole('link', { name: 'Ajouter une œuvre' })).toHaveAttribute('href', '#/ajouter')
  })

  it('« Aller au contenu » place le focus sur le contenu sans changer d’écran', () => {
    render(<App />)
    Element.prototype.scrollIntoView = () => {}
    act(() => screen.getByRole('link', { name: 'Aller au contenu' }).click())
    expect(document.activeElement).toBe(screen.getByRole('main'))
    expect(window.location.hash).toBe('')
  })

  it('change d’écran quand l’adresse change', () => {
    render(<App />)
    aller('#/decouvrir')
    expect(screen.getByRole('heading', { level: 1, name: 'Découvrir' })).toBeInTheDocument()
    expect(document.title).toBe('Découvrir · Ichnos')
    aller('#/bibliotheque')
    expect(screen.getByText('Ma bibliothèque est encore vide.')).toBeInTheDocument()
    aller('#/reglages')
    expect(screen.getByRole('radio', { name: 'Comme l’appareil' })).toBeChecked()
  })
})
