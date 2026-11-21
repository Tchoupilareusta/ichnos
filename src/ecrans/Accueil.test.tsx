import { render, screen } from '@testing-library/react'
import { App } from '../App'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { authFictif } from '../session/auth.fictif'

/**
 * La page ne doit jamais être plus large que l'écran. jsdom ne calcule pas de mise en page : on ne
 * peut donc pas y mesurer la largeur du document. Ce test garde la cause du débordement constaté
 * sur iPhone : un texte réservé à VoiceOver (« sr-only », en position absolue) placé dans une zone
 * qui défile sur le côté, sans ancêtre positionné dans cette zone. Il échappe alors au cadre de la
 * zone, reste là où la carte se trouve hors de l'écran, et élargit toute la page.
 */
const POSITIONNE = /(^|\s)(relative|absolute|fixed|sticky)(\s|$)/

function textesCachesQuiDebordent(racine: ParentNode): Element[] {
  return [...racine.querySelectorAll('.sr-only')].filter((texte) => {
    const zone = texte.closest('[class*="overflow-x-auto"]')
    if (!zone) return false
    for (let parent = texte.parentElement; parent; parent = parent.parentElement) {
      if (POSITIONNE.test(parent.className)) return false
      if (parent === zone) break
    }
    return true
  })
}

const lecture = (rang: number) =>
  oeuvreFictive({
    id: `o${rang}`,
    titreFr: `Lecture ${rang}`,
    statut: 'en_cours',
    unite: 'page',
    position: 10 * rang,
    total: 200,
  })

async function ouvrirAccueil() {
  window.location.hash = '#/'
  const faux = depotFictif({ oeuvres: [1, 2, 3, 4, 5].map(lecture) })
  render(<App auth={authFictif({ compte: { email: 'moi@exemple.test' } }).auth} depot={faux.depot} />)
  return screen.findByRole('list', { name: 'Mes lectures en cours' })
}

beforeEach(() => {
  window.location.hash = ''
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
})

describe('accueil : la page ne dépasse pas la largeur de l’écran', () => {
  it('garde dans le carrousel les textes réservés à VoiceOver, même pour les cartes hors de l’écran', async () => {
    const carrousel = await ouvrirAccueil()
    // Contre-épreuve : les textes cachés sont bien là (« Page 50 sur 200 »), sinon le test ne prouverait rien.
    expect(carrousel.querySelectorAll('.sr-only')).toHaveLength(5)
    expect(textesCachesQuiDebordent(document)).toEqual([])
  })

  it('fait défiler le carrousel dans son cadre, sans entraîner la page', async () => {
    const carrousel = await ouvrirAccueil()
    expect(carrousel).toHaveClass('overflow-x-auto', 'overscroll-x-contain')
  })
})
