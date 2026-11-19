import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../App'
import { assistantFictif } from '../ajout/assistant.fictif'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { couverturesFictives } from '../couvertures/stockage.fictif'
import { authFictif } from '../session/auth.fictif'

const IMAGE = { ok: true as const, valeur: { image: new Blob(['image'], { type: 'image/jpeg' }), source: 'open_library' as const } }
const edition = (id: string, isbn: string | null) => ({ id, isbn, publisher: null, language: null, format: null, translator: null, pageCount: null })
const tome = (numero: number, isbn: string | null) => ({ numero, titre: null, isbn, possession: 'non_possede' as const, lecture: 'a_lire' as const })

const BIBLIOTHEQUE = () =>
  depotFictif({
    oeuvres: [
      oeuvreFictive({ id: 'momo', titreFr: 'Momo', editions: [edition('e1', '9782747024693')], monEdition: 'e1' }),
      oeuvreFictive({ id: 'prophete', titreFr: 'Le Prophète', editions: [edition('e2', '9782070368228')], monEdition: 'e2' }),
      oeuvreFictive({ id: 'sans', titreFr: 'Sans ISBN', editions: [edition('e3', null)], monEdition: 'e3' }),
      oeuvreFictive({ id: 'vinland', titreFr: 'Vinland Saga', estSerie: true, tomes: [tome(1, '9782351423554'), tome(2, '9782351423561'), tome(3, null)] }),
    ],
  })

type Monde = { depot?: ReturnType<typeof depotFictif>; assistant?: ReturnType<typeof assistantFictif>; couvertures?: ReturnType<typeof couverturesFictives> }

async function ouvrir(monde: Monde = {}) {
  const depot = monde.depot ?? BIBLIOTHEQUE()
  const assistant = monde.assistant ?? assistantFictif({ couverture: IMAGE })
  const couvertures = monde.couvertures ?? couverturesFictives()
  const faux = authFictif({ compte: { email: 'moi@exemple.test' } })
  window.location.hash = '#/reglages'
  render(<App auth={faux.auth} depot={depot.depot} assistant={assistant.assistant} couvertures={couvertures.couvertures} />)
  await act(async () => {})
  return { depot, assistant, couvertures, auth: faux }
}

/** Fait passer le temps : les pauses entre deux demandes s'écoulent, les réponses arrivent. */
const laisserPasser = async (millisecondes: number) => {
  for (let ecoule = 0; ecoule < millisecondes; ecoule += 500) await act(async () => void (await vi.advanceTimersByTimeAsync(500)))
}

const section = () => within(screen.getByRole('region', { name: 'Couvertures' }))
const lancer = () => act(async () => fireEvent.click(section().getByRole('button', { name: 'Chercher les couvertures manquantes' })))

beforeEach(() => {
  vi.useFakeTimers()
  window.location.hash = ''
  window.scrollTo = () => {}
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
})
afterEach(() => vi.useRealTimers())

describe('Réglages : couvertures manquantes', () => {
  it('cherche les couvertures une par une et montre, œuvre par œuvre, ce qui a été trouvé ou non', async () => {
    const assistant = assistantFictif({
      couverture: (demande) => ('isbn' in demande && ['9782070368228', '9782351423561'].includes(demande.isbn) ? { ok: true, valeur: null } : IMAGE),
    })
    const { depot, couvertures } = await ouvrir({ assistant })
    await lancer()
    await laisserPasser(10_000)

    const lignes = within(section().getByRole('list', { name: 'Ce que la recherche a donné' }))
      .getAllByRole('listitem')
      .map((ligne) => ligne.textContent)
    expect(lignes).toEqual([
      'Momo : couverture trouvée',
      'Le Prophète : pas de couverture trouvée',
      'Sans ISBN : pas d’ISBN connu, pas cherchée',
      'Vinland Saga : 1 couverture de tome trouvée sur 2 cherchées · 1 tome sans ISBN',
    ])
    expect(section().getByText('Recherche terminée.')).toBeInTheDocument()
    expect(couvertures.deposees).toHaveLength(2)
    expect(depot.appels.ecritures.filter((e) => e.action === 'couverture')).toHaveLength(2)
    // Aucune fiche demandée à l'IA.
    expect(assistant.appels.proposerFiche).toHaveLength(0)
  })

  it('ne lance pas deux demandes de suite : une pause les sépare', async () => {
    const { assistant } = await ouvrir()
    await lancer()
    await laisserPasser(500)
    expect(assistant.appels.couverture).toHaveLength(1)
    expect(section().getByRole('status')).toHaveTextContent('Je cherche : Momo')
    await laisserPasser(1500)
    expect(assistant.appels.couverture).toHaveLength(2)
  })

  it('s’arrête quand je le demande, et garde ce qui est déjà rangé', async () => {
    const { assistant, couvertures } = await ouvrir()
    await lancer()
    await laisserPasser(500)
    await act(async () => fireEvent.click(section().getByRole('button', { name: 'Arrêter la recherche' })))
    await laisserPasser(10_000)
    expect(assistant.appels.couverture).toHaveLength(1)
    expect(couvertures.deposees).toHaveLength(1)
    expect(section().getByText(/Recherche arrêtée/)).toBeInTheDocument()
    expect(section().getByRole('button', { name: 'Chercher les couvertures manquantes' })).toBeInTheDocument()
  })

  it('dit simplement que tout a déjà sa couverture', async () => {
    const depot = depotFictif({ oeuvres: [oeuvreFictive({ id: 'a', titreFr: 'Illustrée', couverture: 'moi/x.jpg' })] })
    const { assistant } = await ouvrir({ depot })
    await lancer()
    await laisserPasser(1000)
    expect(section().getByText('Tout a déjà sa couverture.')).toBeInTheDocument()
    expect(assistant.appels.couverture).toHaveLength(0)
  })

  it('reste calme si la recherche automatique ne répond pas', async () => {
    await ouvrir({ assistant: assistantFictif() })
    await lancer()
    await laisserPasser(1000)
    expect(section().getByText(/La recherche automatique ne répond pas pour le moment/)).toBeInTheDocument()
  })

  it('hors connexion, grise le bouton et explique pourquoi', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    const { assistant } = await ouvrir()
    expect(section().getByRole('button', { name: 'Chercher les couvertures manquantes' })).toHaveAttribute('aria-disabled', 'true')
    expect(section().getByText(/Hors connexion : la recherche attendra le retour du réseau/)).toBeInTheDocument()
    await lancer()
    await laisserPasser(2000)
    expect(assistant.appels.couverture).toHaveLength(0)
  })
})

describe('Réglages : déconnexion', () => {
  it('efface les couvertures gardées sur l’appareil', async () => {
    const { couvertures, auth } = await ouvrir()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Me déconnecter' })))
    await laisserPasser(500)
    expect(auth.appels.deconnecter).toBe(1)
    expect(couvertures.appels.oublier).toBe(1)
  })
})
