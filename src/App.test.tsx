import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from './App'
import { depotFictif } from './bibliotheque/depot.fictif'
import { authFictif } from './session/auth.fictif'

const MOI = { email: 'moi@exemple.test' }

function aller(hash: string) {
  act(() => {
    window.location.hash = hash
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

async function ouvrirConnecte() {
  const faux = authFictif({ compte: MOI })
  render(<App auth={faux.auth} depot={depotFictif().depot} />)
  await screen.findByRole('main')
  return faux
}

beforeEach(() => {
  window.location.hash = ''
  window.scrollTo = () => {}
})

describe('squelette', () => {
  it('affiche l’accueil et marque l’onglet actif', async () => {
    await ouvrirConnecte()
    expect(screen.getByRole('heading', { level: 1, name: 'En ce moment' })).toBeInTheDocument()
    const [barreLaterale, barreDuBas] = screen.getAllByRole('navigation', { name: 'Navigation principale' })
    expect(within(barreDuBas).getByRole('link', { name: 'Accueil' })).toHaveAttribute('aria-current', 'page')
    expect(within(barreLaterale).getByRole('link', { name: 'Accueil' })).toHaveAttribute('aria-current', 'page')
    expect(within(barreDuBas).getByRole('link', { name: 'Ajouter une œuvre' })).toHaveAttribute('href', '#/ajouter')
  })

  it('« Aller au contenu » place le focus sur le contenu sans changer d’écran', async () => {
    await ouvrirConnecte()
    Element.prototype.scrollIntoView = () => {}
    act(() => screen.getByRole('link', { name: 'Aller au contenu' }).click())
    expect(document.activeElement).toBe(screen.getByRole('main'))
    expect(window.location.hash).toBe('')
  })

  it('change d’écran quand l’adresse change', async () => {
    await ouvrirConnecte()
    aller('#/decouvrir')
    expect(screen.getByRole('heading', { level: 1, name: 'Découvrir' })).toBeInTheDocument()
    expect(document.title).toBe('Découvrir · Ichnos')
    aller('#/bibliotheque')
    expect(await screen.findByText(/Ma bibliothèque est encore vide./)).toBeInTheDocument()
    aller('#/reglages')
    expect(screen.getByRole('radio', { name: 'Comme l’appareil' })).toBeChecked()
  })
})

describe('zone du haut (heure et batterie de l’iPhone)', () => {
  const bandeau = () => document.querySelector<HTMLElement>('[data-role="bandeau-haut"]')

  it('pose un bandeau fixe de la hauteur de la zone de sécurité, sur tous les écrans', async () => {
    await ouvrirConnecte()
    expect(bandeau()).toHaveClass('fixed', 'top-0')
    // Sans encoche, la zone de sécurité vaut 0 : le bandeau n'a aucune hauteur, rien ne change.
    expect(bandeau()?.getAttribute('style')).toContain('env(safe-area-inset-top)')
    aller('#/reglages')
    expect(bandeau()).toBeInTheDocument()
  })

  it('ne gêne ni VoiceOver ni les appuis', async () => {
    await ouvrirConnecte()
    expect(bandeau()).toHaveAttribute('aria-hidden', 'true')
    expect(bandeau()).toHaveClass('pointer-events-none')
  })

  it('est aussi là sur l’écran de connexion', async () => {
    render(<App auth={authFictif().auth} />)
    await screen.findByLabelText('Mon adresse e-mail')
    expect(bandeau()).toBeInTheDocument()
  })
})

describe('accès réservé', () => {
  it('sans connexion, ne montre que l’écran de connexion', async () => {
    render(<App auth={authFictif().auth} />)
    expect(await screen.findByLabelText('Mon adresse e-mail')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(document.title).toBe('Connexion · Ichnos')
  })

  it('sans connexion, une adresse directe ne donne accès à rien', async () => {
    window.location.hash = '#/bibliotheque'
    render(<App auth={authFictif().auth} />)
    expect(await screen.findByLabelText('Mon adresse e-mail')).toBeInTheDocument()
    expect(screen.queryByText('Ma bibliothèque est encore vide.')).not.toBeInTheDocument()
  })

  it('ouvre la bibliothèque une fois les identifiants acceptés', async () => {
    render(<App auth={authFictif().auth} />)
    fireEvent.change(await screen.findByLabelText('Mon adresse e-mail'), { target: { value: MOI.email } })
    fireEvent.change(screen.getByLabelText('Mon mot de passe'), { target: { value: 'mot de passe d’essai' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir ma bibliothèque' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'En ce moment' })).toBeInTheDocument()
  })

  it('les réglages montrent mon compte et permettent de me déconnecter', async () => {
    const { appels } = await ouvrirConnecte()
    aller('#/reglages')
    expect(screen.getByText(MOI.email)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Me déconnecter' }))
    expect(await screen.findByLabelText('Mon adresse e-mail')).toBeInTheDocument()
    expect(appels.deconnecter).toBe(1)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('prévient quand la connexion à Supabase n’est pas configurée', () => {
    render(<App auth={null} />)
    expect(screen.getByText('La connexion à ma bibliothèque n’est pas encore configurée.')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})
