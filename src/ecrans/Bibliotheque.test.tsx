import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../App'
import { depotFictif } from '../bibliotheque/depot.fictif'
import { authFictif } from '../session/auth.fictif'

const CATALOGUE = [
  { id: '1', titre: 'La Chute', titreSecondaire: null, auteurs: ['Albert Camus'] },
  { id: '2', titre: 'Nineteen Eighty-Four', titreSecondaire: '1984', auteurs: ['George Orwell'] },
]

async function ouvrir(faux: ReturnType<typeof depotFictif>) {
  window.location.hash = '#/bibliotheque'
  render(<App auth={authFictif({ compte: { email: 'moi@exemple.test' } }).auth} depot={faux.depot} />)
  await screen.findByRole('heading', { level: 1, name: 'Ma bibliothèque' })
  // Laisse la première lecture de la bibliothèque aboutir.
  await act(async () => {})
}

beforeEach(() => {
  window.location.hash = ''
  window.scrollTo = () => {}
})

describe('bibliothèque vide', () => {
  it('propose d’installer le catalogue de départ ou d’ajouter une œuvre', async () => {
    await ouvrir(depotFictif())
    expect(screen.getByText(/Ma bibliothèque est encore vide\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Installer le catalogue de départ' })).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Ajouter une œuvre' })).toHaveAttribute('href', '#/ajouter')
  })

  it('installe le catalogue puis affiche les œuvres, sans rien compter', async () => {
    const faux = depotFictif({ catalogue: CATALOGUE })
    await ouvrir(faux)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Installer le catalogue de départ' })))

    expect(faux.appels.installerCatalogue).toBe(1)
    expect(screen.getByText('Le catalogue de départ est installé.')).toBeInTheDocument()
    const lignes = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(lignes).toHaveLength(2)
    expect(lignes[0]).toHaveTextContent('La Chute')
    expect(lignes[0]).toHaveTextContent('Albert Camus')
    expect(lignes[1]).toHaveTextContent('Nineteen Eighty-Four')
    expect(lignes[1]).toHaveTextContent('1984')
    expect(screen.queryByRole('button', { name: 'Installer le catalogue de départ' })).not.toBeInTheDocument()
    expect(screen.getByRole('main').textContent).not.toMatch(/\d+ (œuvres|livres)/)
  })

  it('ne lance qu’une installation, même si j’appuie deux fois', async () => {
    const faux = depotFictif({ catalogue: CATALOGUE })
    faux.attente.active = true
    await ouvrir(faux)
    const bouton = screen.getByRole('button', { name: 'Installer le catalogue de départ' })
    await act(async () => fireEvent.click(bouton))
    expect(bouton).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Installation en cours…')).toBeInTheDocument()
    await act(async () => fireEvent.click(bouton))
    expect(faux.appels.installerCatalogue).toBe(1)

    await act(async () => faux.attente.liberer())
    expect(await screen.findByText('Le catalogue de départ est installé.')).toBeInTheDocument()
  })

  it.each([
    ['reseau', 'Pas de connexion à internet : l’installation attendra le retour du réseau.'],
    ['inconnu', 'L’installation n’a pas abouti, et rien n’a été enregistré. Je réessaie dans un instant.'],
  ] as const)('dit ce qui s’est passé quand l’installation échoue (%s)', async (echec, message) => {
    const faux = depotFictif({ installation: { ok: false, echec } })
    await ouvrir(faux)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Installer le catalogue de départ' })))
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    // Rien n'a changé : je peux réessayer.
    expect(screen.getByRole('button', { name: 'Installer le catalogue de départ' })).not.toHaveAttribute('aria-busy')
  })

  it('n’installe rien une seconde fois si la bibliothèque est déjà remplie ailleurs', async () => {
    const faux = depotFictif({ installation: { ok: false, echec: 'deja' } })
    await ouvrir(faux)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Installer le catalogue de départ' })))
    expect(screen.getByRole('alert')).toHaveTextContent('le catalogue n’a pas été installé une seconde fois')
    expect(faux.appels.listerOeuvres).toBe(2)
  })
})

describe('bibliothèque remplie', () => {
  it('affiche les œuvres et ne propose plus le catalogue', async () => {
    await ouvrir(depotFictif({ oeuvres: CATALOGUE }))
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Installer le catalogue de départ' })).not.toBeInTheDocument()
    expect(screen.queryByText('Le catalogue de départ est installé.')).not.toBeInTheDocument()
  })
})

describe('bibliothèque injoignable', () => {
  it('l’explique calmement et permet de réessayer', async () => {
    const faux = depotFictif({ lecture: { ok: false, echec: 'reseau' } })
    await ouvrir(faux)
    expect(screen.getByRole('alert')).toHaveTextContent('Pas de connexion à internet : ma bibliothèque s’affichera au retour du réseau.')
    expect(screen.queryByRole('button', { name: 'Installer le catalogue de départ' })).not.toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Réessayer' })))
    expect(faux.appels.listerOeuvres).toBe(2)
  })
})
