import { fireEvent, render, screen } from '@testing-library/react'
import { Connexion } from './Connexion'
import { authFictif } from '../session/auth.fictif'

function saisir(champ: HTMLElement, valeur: string) {
  fireEvent.change(champ, { target: { value: valeur } })
}

async function allerAuCode(auth: ReturnType<typeof authFictif>['auth']) {
  render(<Connexion auth={auth} />)
  saisir(screen.getByLabelText('Mon adresse e-mail'), 'moi@exemple.test')
  fireEvent.click(screen.getByRole('button', { name: 'Recevoir mon code' }))
  return screen.findByLabelText('Code reçu par e-mail')
}

describe('connexion par code', () => {
  it('demande d’abord l’adresse e-mail', () => {
    render(<Connexion auth={authFictif().auth} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Ichnos' })).toBeInTheDocument()
    const champ = screen.getByLabelText('Mon adresse e-mail')
    expect(champ).toHaveAttribute('type', 'email')
    expect(champ).toHaveAttribute('autocomplete', 'email')
    expect(screen.queryByLabelText('Code reçu par e-mail')).not.toBeInTheDocument()
  })

  it('envoie le code puis place le curseur dans le champ du code', async () => {
    const { auth, appels } = authFictif()
    const champCode = await allerAuCode(auth)
    expect(appels.demanderCode).toEqual(['moi@exemple.test'])
    expect(champCode).toHaveFocus()
    expect(champCode).toHaveAttribute('autocomplete', 'one-time-code')
    expect(champCode).toHaveAttribute('inputmode', 'numeric')
  })

  it('n’envoie rien sans adresse', () => {
    const { auth, appels } = authFictif()
    render(<Connexion auth={auth} />)
    fireEvent.click(screen.getByRole('button', { name: 'Recevoir mon code' }))
    expect(appels.demanderCode).toEqual([])
    expect(screen.getByRole('alert')).toHaveTextContent('J’indique d’abord mon adresse e-mail.')
    expect(screen.getByLabelText('Mon adresse e-mail')).toHaveAttribute('aria-invalid', 'true')
  })

  it('explique quand les demandes sont trop rapprochées', async () => {
    const { auth } = authFictif({ demande: { ok: false, echec: 'trop' } })
    render(<Connexion auth={auth} />)
    saisir(screen.getByLabelText('Mon adresse e-mail'), 'moi@exemple.test')
    fireEvent.click(screen.getByRole('button', { name: 'Recevoir mon code' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de demandes d’affilée')
    expect(screen.queryByLabelText('Code reçu par e-mail')).not.toBeInTheDocument()
  })

  it('ne garde que les six chiffres du code', async () => {
    const { auth, appels } = authFictif()
    const champCode = await allerAuCode(auth)
    saisir(champCode, '12 34-56 78')
    expect(champCode).toHaveValue('123456')
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir ma bibliothèque' }))
    await screen.findByRole('button', { name: 'Ouvrir ma bibliothèque' })
    expect(appels.verifierCode).toEqual([{ email: 'moi@exemple.test', code: '123456' }])
  })

  it('attend un code complet avant de vérifier', async () => {
    const { auth, appels } = authFictif()
    const champCode = await allerAuCode(auth)
    saisir(champCode, '123')
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir ma bibliothèque' }))
    expect(appels.verifierCode).toEqual([])
    expect(screen.getByRole('alert')).toHaveTextContent('Le code compte 6 chiffres.')
  })

  it('explique quand le code est faux ou expiré', async () => {
    const { auth } = authFictif({ verification: { ok: false, echec: 'code' } })
    const champCode = await allerAuCode(auth)
    saisir(champCode, '000000')
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir ma bibliothèque' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce code n’est pas le bon, ou il a expiré.')
    expect(champCode).toHaveAttribute('aria-invalid', 'true')
  })

  it('permet de revenir à l’adresse', async () => {
    const { auth } = authFictif()
    await allerAuCode(auth)
    fireEvent.click(screen.getByRole('button', { name: 'Changer d’adresse ou redemander un code' }))
    expect(screen.getByLabelText('Mon adresse e-mail')).toHaveValue('moi@exemple.test')
    expect(screen.getByLabelText('Mon adresse e-mail')).toHaveFocus()
  })
})
