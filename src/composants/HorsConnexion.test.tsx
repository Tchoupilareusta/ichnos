import { render, screen } from '@testing-library/react'
import { HorsConnexion } from './HorsConnexion'

const horsLigne = (valeur: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => !valeur })

afterEach(() => horsLigne(false))

describe('bandeau « Hors connexion »', () => {
  it('reste discret tant que l’appareil a une connexion, mais sa zone d’annonce est déjà là', () => {
    horsLigne(false)
    render(<HorsConnexion />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  /**
   * Un élément « sticky » ne reste collé que dans les limites de son parent. jsdom ne calcule pas
   * de mise en page : ce test garde la cause du défaut constaté (le bandeau était « sticky » dans
   * un parent de sa propre hauteur, donc il partait avec la page). Celui qui colle doit être posé
   * directement dans la racine de l'appli, qui a la hauteur de toute la page.
   */
  it('colle en haut de la page : l’élément « sticky » est posé directement dans la racine', () => {
    horsLigne(true)
    const { container } = render(<HorsConnexion />)
    expect(screen.getByText('Hors connexion : tout se consulte, rien ne se modifie.')).toBeInTheDocument()
    const collants = container.querySelectorAll('.sticky')
    expect(collants).toHaveLength(1)
    expect(collants[0].parentElement).toBe(container)
    expect(collants[0]).toHaveClass('top-0')
    // La zone annoncée par VoiceOver reste la même : c'est elle qui colle.
    expect(collants[0]).toBe(screen.getByRole('status'))
  })
})
