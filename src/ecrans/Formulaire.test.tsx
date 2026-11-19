import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../App'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { authFictif } from '../session/auth.fictif'

async function ouvrir(faux: ReturnType<typeof depotFictif>, hash: string) {
  window.location.hash = hash
  render(<App auth={authFictif({ compte: { email: 'moi@exemple.test' } }).auth} depot={faux.depot} />)
  await act(async () => {})
}

const enregistrer = () => act(async () => fireEvent.click(within(screen.getByRole('main')).getAllByRole('button', { name: 'Enregistrer' })[1]))

beforeEach(() => {
  window.location.hash = ''
  window.scrollTo = () => {}
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
})

describe('ajout d’une œuvre', () => {
  it('enregistre la fiche saisie puis ouvre directement sa fiche', async () => {
    const faux = depotFictif({
      oeuvres: [oeuvreFictive({ id: 'x', titreFr: 'Autre', etiquettes: [{ genre: 'theme', nom: 'Temps', coeur: true }] })],
    })
    await ouvrir(faux, '#/ajouter?mode=manuel')
    expect(screen.getByRole('heading', { level: 1, name: 'Ajouter une œuvre' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Titre en français'), { target: { value: 'Momo' } })
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Michael Ende' } })
    fireEvent.change(screen.getByLabelText('Langue d’origine'), { target: { value: 'de' } })
    // Une étiquette déjà connue garde son écriture exacte.
    fireEvent.change(screen.getByLabelText('Thèmes'), { target: { value: 'temps' } })
    fireEvent.click(within(screen.getByLabelText('Thèmes').parentElement!).getByRole('button', { name: 'Ajouter' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Lumineuse' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une édition' }))
    fireEvent.change(screen.getByLabelText('Éditeur'), { target: { value: 'Le Livre de Poche' } })
    await enregistrer()

    expect(faux.appels.enregistrerOeuvre).toHaveLength(1)
    expect(faux.appels.enregistrerOeuvre[0]).toMatchObject({
      title_fr: 'Momo',
      original_language: 'de',
      title_original: null,
      tone: 5,
      density: null,
      authors: [{ name: 'Michael Ende', role: 'auteur' }],
      tags: [{ kind: 'theme', name: 'Temps' }],
      editions: [{ publisher: 'Le Livre de Poche', isbn: null, page_count: null, mienne: true }],
    })
    expect(faux.appels.enregistrerOeuvre[0]).not.toHaveProperty('id')
    await act(async () => {})
    expect(window.location.hash).toBe('#/oeuvre/nouvelle-1')
    expect(await screen.findByRole('heading', { level: 1, name: 'Momo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Statut de lecture : À découvrir. Changer' })).toBeInTheDocument()
  })

  it('signale les champs à revoir et n’envoie rien', async () => {
    const faux = depotFictif()
    await ouvrir(faux, '#/ajouter?mode=manuel')
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une édition' }))
    fireEvent.change(screen.getByLabelText('ISBN'), { target: { value: '978-2-07-036002-5' } })
    await enregistrer()
    expect(faux.appels.enregistrerOeuvre).toHaveLength(0)
    expect(screen.getByLabelText('Titre en français')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Titre en français')).toHaveFocus()
    expect(screen.getByLabelText('ISBN')).toHaveAccessibleDescription(/Cet ISBN ne semble pas juste/)
    expect(screen.getAllByRole('alert').some((a) => a.textContent === 'Quelques champs sont à revoir avant d’enregistrer.')).toBe(true)
  })

  it('garde la saisie et l’explique quand la base refuse', async () => {
    const faux = depotFictif({ ecriture: { ok: false, echec: 'reseau' } })
    await ouvrir(faux, '#/ajouter?mode=manuel')
    fireEvent.change(screen.getByLabelText('Titre en français'), { target: { value: 'Momo' } })
    await enregistrer()
    expect(screen.getAllByRole('alert').some((a) => /rien n’a été enregistré/.test(a.textContent ?? ''))).toBe(true)
    expect(screen.getByLabelText('Titre en français')).toHaveValue('Momo')
    expect(window.location.hash).toBe('#/ajouter?mode=manuel')
  })

  it('n’enregistre pas hors connexion', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    const faux = depotFictif()
    await ouvrir(faux, '#/ajouter?mode=manuel')
    fireEvent.change(screen.getByLabelText('Titre en français'), { target: { value: 'Momo' } })
    await enregistrer()
    expect(faux.appels.enregistrerOeuvre).toHaveLength(0)
    expect(screen.getByText('Hors connexion : je peux préparer la fiche, et l’enregistrer au retour du réseau.')).toBeInTheDocument()
  })

  it('demande avant d’abandonner une saisie', async () => {
    await ouvrir(depotFictif(), '#/ajouter?mode=manuel')
    fireEvent.change(screen.getByLabelText('Titre en français'), { target: { value: 'Momo' } })
    fireEvent.click(within(screen.getByRole('main')).getAllByRole('button', { name: 'Annuler' })[0])
    expect(screen.getByRole('dialog', { name: 'Abandonner mes modifications ?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continuer la saisie' }))
    expect(screen.getByLabelText('Titre en français')).toHaveValue('Momo')
  })
})

describe('modification d’une œuvre', () => {
  it('reprend la fiche et n’envoie que l’œuvre visée, sans toucher au statut', async () => {
    const faux = depotFictif({
      oeuvres: [
        oeuvreFictive({
          id: 'vin',
          titreFr: 'Vinland Saga',
          forme: 'manga',
          estSerie: true,
          statut: 'en_cours',
          auteurs: [{ nom: 'Makoto Yukimura', role: 'auteur' }],
          tomes: [
            { numero: 1, titre: null, isbn: null, possession: 'possede', lecture: 'a_lire' },
            { numero: 2, titre: null, isbn: null, possession: 'non_possede', lecture: 'a_lire' },
          ],
        }),
      ],
    })
    await ouvrir(faux, '#/oeuvre/vin/modifier')
    expect(screen.getByRole('heading', { level: 1, name: 'Modifier la fiche' })).toBeInTheDocument()
    expect(screen.getByLabelText('Titre en français')).toHaveValue('Vinland Saga')
    expect(screen.getByLabelText('Nombre de tomes')).toHaveValue('2')

    fireEvent.change(screen.getByLabelText('Nombre de tomes'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Titre en français'), { target: { value: 'Vinland Saga (édition)' } })
    await enregistrer()
    const envoi = faux.appels.enregistrerOeuvre[0]
    expect(envoi).toMatchObject({ id: 'vin', title_fr: 'Vinland Saga (édition)', is_series: true })
    expect(envoi.volumes.map((v) => v.number)).toEqual([1, 2, 3, 4])
    expect(envoi).not.toHaveProperty('reading_status')
    // Les tomes gardés conservent leur possession.
    expect(faux.oeuvres()[0].tomes[0].possession).toBe('possede')
    expect(faux.oeuvres()[0].statut).toBe('en_cours')
  })

  it('supprime l’œuvre depuis son bas de page, après confirmation, puis ouvre la bibliothèque', async () => {
    const faux = depotFictif({ oeuvres: [oeuvreFictive({ id: 'sid', titreFr: 'Siddhartha' })] })
    await ouvrir(faux, '#/oeuvre/sid/modifier')
    const bouton = screen.getByRole('button', { name: 'Supprimer cette œuvre de ma bibliothèque' })
    fireEvent.click(bouton)
    const dialogue = screen.getByRole('dialog', { name: 'Supprimer « Siddhartha » ?' })
    expect(dialogue).toHaveTextContent('Ce geste ne se défait pas.')
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Garder' }))
    expect(faux.appels.ecritures).toHaveLength(0)

    fireEvent.click(bouton)
    await act(async () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' })))
    expect(faux.appels.ecritures).toEqual([{ action: 'suppression', id: 'sid', valeur: undefined }])
    expect(faux.oeuvres()).toHaveLength(0)
    await act(async () => {})
    expect(window.location.hash).toBe('#/bibliotheque')
  })

  it('ne propose pas de supprimer une œuvre qu’on est en train d’ajouter', async () => {
    await ouvrir(depotFictif(), '#/ajouter?mode=manuel')
    expect(screen.queryByRole('button', { name: /Supprimer/ })).not.toBeInTheDocument()
  })

  it('grise la suppression hors connexion', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    await ouvrir(depotFictif({ oeuvres: [oeuvreFictive({ id: 'sid', titreFr: 'Siddhartha' })] }), '#/oeuvre/sid/modifier')
    const bouton = screen.getByRole('button', { name: 'Supprimer cette œuvre de ma bibliothèque' })
    expect(bouton).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(bouton)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('prévient quand des tomes vont être retirés', async () => {
    const faux = depotFictif({
      oeuvres: [
        oeuvreFictive({
          id: 'vin',
          titreFr: 'Vinland Saga',
          estSerie: true,
          tomes: [1, 2, 3].map((numero) => ({ numero, titre: null, isbn: null, possession: 'possede' as const, lecture: 'a_lire' as const })),
        }),
      ],
    })
    await ouvrir(faux, '#/oeuvre/vin/modifier')
    fireEvent.change(screen.getByLabelText('Nombre de tomes'), { target: { value: '1' } })
    expect(screen.getByText('Les tomes 2 à 3 seront retirés, avec ce que j’avais noté sur leur possession.')).toBeInTheDocument()
  })
})

describe('couverture rangée', () => {
  const CHEMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef.jpg'
  const illustree = () =>
    depotFictif({
      oeuvres: [
        oeuvreFictive({
          id: 'momo',
          titreFr: 'Momo',
          editions: [{ id: 'e1', isbn: null, publisher: 'Bayard', language: 'fr', format: null, translator: null, pageCount: null, couverture: CHEMIN }],
          monEdition: 'e1',
        }),
      ],
    })

  it('dans « Modifier », permet de retirer la couverture : celle d’Ichnos reprend sa place', async () => {
    const faux = illustree()
    await ouvrir(faux, '#/oeuvre/momo/modifier')
    const section = within(screen.getByRole('region', { name: 'Couverture' }))
    await act(async () => fireEvent.click(section.getByRole('button', { name: 'Retirer cette couverture' })))
    await act(async () => {})
    expect(faux.appels.ecritures).toContainEqual({ action: 'couverture', id: 'momo', valeur: { cible: { type: 'edition', edition: 'e1' }, chemin: null } })
    expect(faux.oeuvres()[0].editions[0].couverture).toBeNull()
  })

  it('ne propose rien à retirer quand l’œuvre n’a que la couverture d’Ichnos', async () => {
    await ouvrir(depotFictif({ oeuvres: [oeuvreFictive({ id: 'momo', titreFr: 'Momo' })] }), '#/oeuvre/momo/modifier')
    expect(screen.queryByRole('button', { name: 'Retirer cette couverture' })).not.toBeInTheDocument()
  })

  it('hors connexion, le retrait est grisé', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    const faux = illustree()
    await ouvrir(faux, '#/oeuvre/momo/modifier')
    const bouton = screen.getByRole('button', { name: 'Retirer cette couverture' })
    expect(bouton).toHaveAttribute('aria-disabled', 'true')
    await act(async () => fireEvent.click(bouton))
    expect(faux.appels.ecritures).toHaveLength(0)
  })
})
