import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from '../App'
import type { OeuvreDetaillee } from '../bibliotheque/depot'
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

describe('accueil : une idée pour la suite', () => {
  const idee = (id: string, titreFr: string, auteur: string, tonalite: number, genre: string, champs: Partial<Parameters<typeof oeuvreFictive>[0]> = {}) =>
    oeuvreFictive({
      id,
      titreFr,
      tonalite,
      auteurs: [{ nom: auteur, role: 'auteur' }],
      etiquettes: [{ genre: 'genre', nom: genre, coeur: false }],
      ...champs,
    })

  function ouvrir(oeuvres: OeuvreDetaillee[]) {
    window.location.hash = '#/'
    const faux = depotFictif({ oeuvres })
    render(<App auth={authFictif({ compte: { email: 'moi@exemple.test' } }).auth} depot={faux.depot} />)
    return faux
  }

  it('propose une seule idée, qui mène à sa fiche, puis « Selon mon envie du moment »', async () => {
    ouvrir([idee('momo', 'Momo', 'Michael Ende', 5, 'Conte'), idee('sid', 'Siddhartha', 'Hermann Hesse', 4, 'Roman philosophique')])
    const section = await screen.findByRole('region', { name: 'Une idée pour la suite' })
    expect(within(section).getAllByRole('link', { name: /^Voir la fiche de / })).toHaveLength(1)
    expect(within(section).getByRole('link', { name: 'Selon mon envie du moment' })).toHaveAttribute('href', '#/decouvrir')
    // Une ligne de lien discrète, pas une seconde pilule à côté du bouton « Une autre idée ».
    const lien = within(section).getByRole('link', { name: 'Selon mon envie du moment' })
    expect(lien.className).not.toMatch(/(^|s)(border|bg-surface|bg-accent)(s|$)/)
    expect(lien).toHaveClass('text-accent-texte')
    // L'accueil reste léger : ni « Commencer » ni « Pas maintenant ».
    expect(within(section).queryByRole('button', { name: /Commencer|Pas maintenant/ })).not.toBeInTheDocument()
  })

  it('« Une autre idée » montre la suivante sans rien écrire, puis revient à la première', async () => {
    const faux = ouvrir([idee('momo', 'Momo', 'Michael Ende', 5, 'Conte'), idee('sid', 'Siddhartha', 'Hermann Hesse', 4, 'Roman philosophique')])
    const section = await screen.findByRole('region', { name: 'Une idée pour la suite' })
    const lien = () => within(section).getByRole('link', { name: /^Voir la fiche de / }).getAttribute('aria-label')
    const premiere = lien()
    fireEvent.click(within(section).getByRole('button', { name: 'Une autre idée' }))
    await waitFor(() => expect(lien()).not.toBe(premiere))
    fireEvent.click(within(section).getByRole('button', { name: 'Une autre idée' }))
    await waitFor(() => expect(lien()).toBe(premiere))
    expect(faux.appels.ecritures).toEqual([])
  })

  it('ne propose jamais un livre en pause ici', async () => {
    ouvrir([idee('gai', 'Le Gai Savoir', 'Friedrich Nietzsche', 3, 'Philosophie', { statut: 'en_pause' })])
    await screen.findByRole('link', { name: 'Selon mon envie du moment' })
    expect(screen.queryByRole('region', { name: 'Une idée pour la suite' })).not.toBeInTheDocument()
  })

  it('sans idée à proposer, la section n’apparaît pas ; « Selon mon envie du moment » reste', async () => {
    ouvrir([idee('momo', 'Momo', 'Michael Ende', 5, 'Conte', { statut: 'termine' })])
    expect(await screen.findByRole('link', { name: 'Selon mon envie du moment' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Une idée pour la suite' })).not.toBeInTheDocument()
    expect(screen.queryByText('Une idée pour la suite')).not.toBeInTheDocument()
  })

  it('n’élargit pas la page : aucun texte caché hors d’un cadre positionné', async () => {
    ouvrir([lecture(1), lecture(2), idee('momo', 'Momo', 'Michael Ende', 5, 'Conte')])
    await screen.findByRole('region', { name: 'Une idée pour la suite' })
    expect(textesCachesQuiDebordent(document)).toEqual([])
  })
})
