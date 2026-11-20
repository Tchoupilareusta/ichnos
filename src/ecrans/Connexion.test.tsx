import { fireEvent, render, screen } from '@testing-library/react'
import { Connexion } from './Connexion'
import { authFictif } from '../session/auth.fictif'
import type { Resultat } from '../session/auth'

const MOT_DE_PASSE = ' mot de passe d’essai '

const champEmail = () => screen.getByLabelText('Mon adresse e-mail') as HTMLInputElement
const champMotDePasse = () => screen.getByLabelText('Mon mot de passe') as HTMLInputElement
const bouton = () => screen.getByRole('button', { name: 'Ouvrir ma bibliothèque' })

function ouvrir(connexion?: Resultat) {
  const faux = authFictif({ connexion })
  render(<Connexion auth={faux.auth} />)
  return faux
}

function remplir(email: string, motDePasse: string) {
  fireEvent.change(champEmail(), { target: { value: email } })
  fireEvent.change(champMotDePasse(), { target: { value: motDePasse } })
}

describe('connexion par e-mail et mot de passe', () => {
  it('est un vrai formulaire que Bitwarden sait remplir', () => {
    ouvrir()
    expect(screen.getByRole('heading', { level: 1, name: 'Ichnos' })).toBeInTheDocument()

    const formulaire = champEmail().closest('form')
    expect(formulaire).not.toBeNull()
    expect(formulaire).toContainElement(champMotDePasse())
    expect(formulaire).toContainElement(bouton())
    expect(bouton()).toHaveAttribute('type', 'submit')

    expect(champEmail()).toHaveAttribute('type', 'email')
    expect(champEmail()).toHaveAttribute('name', 'email')
    expect(champEmail()).toHaveAttribute('autocomplete', 'email')
    expect(champMotDePasse()).toHaveAttribute('type', 'password')
    expect(champMotDePasse()).toHaveAttribute('name', 'password')
    expect(champMotDePasse()).toHaveAttribute('autocomplete', 'current-password')
  })

  it('ne propose ni inscription ni « mot de passe oublié »', () => {
    ouvrir()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByText(/oublié|inscri|créer/i)).not.toBeInTheDocument()
  })

  it('envoie l’adresse nettoyée et le mot de passe tel quel', async () => {
    const { appels } = ouvrir()
    remplir('  moi@exemple.test ', MOT_DE_PASSE)
    fireEvent.click(bouton())
    await screen.findByRole('button', { name: 'Ouvrir ma bibliothèque' })
    expect(appels.seConnecter).toEqual([{ email: 'moi@exemple.test', motDePasse: MOT_DE_PASSE }])
  })

  it('se valide aussi avec la touche Entrée', async () => {
    const { appels } = ouvrir()
    remplir('moi@exemple.test', MOT_DE_PASSE)
    fireEvent.submit(champEmail().closest('form')!)
    await screen.findByRole('button', { name: 'Ouvrir ma bibliothèque' })
    expect(appels.seConnecter).toHaveLength(1)
  })

  it('lit ce qu’un gestionnaire de mots de passe a écrit dans les champs sans prévenir la page', async () => {
    const { appels } = ouvrir()
    champEmail().value = 'moi@exemple.test'
    champMotDePasse().value = MOT_DE_PASSE
    fireEvent.click(bouton())
    await screen.findByRole('button', { name: 'Ouvrir ma bibliothèque' })
    expect(appels.seConnecter).toEqual([{ email: 'moi@exemple.test', motDePasse: MOT_DE_PASSE }])
  })

  it('n’envoie rien sans adresse', () => {
    const { appels } = ouvrir()
    fireEvent.change(champMotDePasse(), { target: { value: MOT_DE_PASSE } })
    fireEvent.click(bouton())
    expect(appels.seConnecter).toEqual([])
    expect(screen.getByRole('alert')).toHaveTextContent('Indiquer d’abord mon adresse e-mail.')
    expect(champEmail()).toHaveAttribute('aria-invalid', 'true')
    expect(champEmail()).toHaveFocus()
  })

  it('n’envoie rien sans mot de passe', () => {
    const { appels } = ouvrir()
    fireEvent.change(champEmail(), { target: { value: 'moi@exemple.test' } })
    fireEvent.click(bouton())
    expect(appels.seConnecter).toEqual([])
    expect(screen.getByRole('alert')).toHaveTextContent('Indiquer aussi mon mot de passe.')
    expect(champMotDePasse()).toHaveAttribute('aria-invalid', 'true')
    expect(champMotDePasse()).toHaveFocus()
  })

  it('refuse de mauvais identifiants sans dire lequel est faux', async () => {
    ouvrir({ ok: false, echec: 'identifiants' })
    remplir('moi@exemple.test', 'faux')
    fireEvent.click(bouton())
    expect(await screen.findByRole('alert')).toHaveTextContent('L’adresse ou le mot de passe ne correspond pas.')
    expect(champEmail()).toHaveValue('moi@exemple.test')
    expect(champMotDePasse()).toHaveValue('')
    expect(champMotDePasse()).toHaveFocus()
    expect(champEmail()).toHaveAttribute('aria-invalid', 'true')
    expect(champMotDePasse()).toHaveAttribute('aria-invalid', 'true')
  })

  it('explique quand les essais sont trop rapprochés', async () => {
    ouvrir({ ok: false, echec: 'trop' })
    remplir('moi@exemple.test', MOT_DE_PASSE)
    fireEvent.click(bouton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop d’essais d’affilée')
  })

  it('explique quand le réseau manque, sans effacer le mot de passe', async () => {
    ouvrir({ ok: false, echec: 'reseau' })
    remplir('moi@exemple.test', MOT_DE_PASSE)
    fireEvent.click(bouton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Pas de connexion à internet')
    expect(champMotDePasse()).toHaveValue(MOT_DE_PASSE)
  })
})
