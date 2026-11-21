import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../App'
import { assistantFictif, imageFictive } from '../ajout/assistant.fictif'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { couverturesFictives } from '../couvertures/stockage.fictif'
import { authFictif } from '../session/auth.fictif'

// jsdom ne sait pas décoder une image : la mesure des couvertures rangées est simulée.
// La fausse adresse porte le chemin de l'image, et le chemin sa largeur (« …/0300….jpg » : 300 px).
vi.mock('../couvertures/mesure', () => ({
  tailleImage: async (source: string | Blob) => {
    const largeur = typeof source === 'string' ? Number(/\/(\d{4})/.exec(source)?.[1] ?? NaN) || null : null
    return largeur === null ? null : { largeur, hauteur: Math.round(largeur * 1.5) }
  },
}))

// jsdom ne sait pas non plus regarder une image : une couverture rangée dont le nom commence par « 0575f » est fausse.
vi.mock('../couvertures/uniformite', async (original) => ({
  ...(await original<typeof import('../couvertures/uniformite')>()),
  estFausseCouverture: async (image: Blob) => (await image.text()).includes('/0575f'),
}))

const IMAGE = imageFictive()
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
    expect(section().getByRole('status')).toHaveTextContent('Recherche terminée.')
    expect(couvertures.deposees).toHaveLength(2)
    expect(depot.appels.ecritures.filter((e) => e.action === 'couverture')).toHaveLength(2)
    // Aucune fiche demandée à l'IA.
    expect(assistant.appels.proposerFiche).toHaveLength(0)
  })

  it('dit quand une couverture trouvée est de petite taille', async () => {
    const assistant = assistantFictif({
      couverture: (demande) =>
        'isbn' in demande && ['9782747024693', '9782351423554'].includes(demande.isbn) ? imageFictive({ largeur: 300, hauteur: 450 }) : IMAGE,
    })
    await ouvrir({ assistant })
    await lancer()
    await laisserPasser(10_000)
    const lignes = within(section().getByRole('list', { name: 'Ce que la recherche a donné' }))
      .getAllByRole('listitem')
      .map((ligne) => ligne.textContent)
    expect(lignes).toEqual([
      'Momo : couverture trouvée, mais de petite taille',
      'Le Prophète : couverture trouvée',
      'Sans ISBN : pas d’ISBN connu, pas cherchée',
      'Vinland Saga : 2 couvertures de tome trouvées sur 2 cherchées, dont 1 de petite taille · 1 tome sans ISBN',
    ])
  })

  it('ne lance pas deux demandes de suite : une pause les sépare', async () => {
    const { assistant } = await ouvrir()
    await lancer()
    await laisserPasser(500)
    expect(assistant.appels.couverture).toHaveLength(1)
    // Le détail défile à l'écran sans être annoncé à chaque œuvre : VoiceOver n'entend que le début et la fin.
    expect(section().getByText(/Recherche : Momo/)).toBeInTheDocument()
    expect(section().getByText(/Recherche : Momo/)).not.toHaveAttribute('role')
    expect(section().getByRole('status')).toHaveTextContent('Recherche en cours')
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

describe('Réglages : remplacer les couvertures de petite taille', () => {
  const MOI = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  /** Un chemin de couverture dont le nom commence par la largeur de l'image (voir la fausse mesure, en haut). */
  const chemin = (largeur: number, nom: string) => `${MOI}/${String(largeur).padStart(4, '0')}${nom}`.padEnd(MOI.length + 33, '0') + '.jpg'
  const ILLUSTREE = () =>
    depotFictif({
      oeuvres: [
        oeuvreFictive({ id: 'momo', titreFr: 'Momo', editions: [{ ...edition('e1', '9782747024693'), couverture: chemin(300, 'a') }], monEdition: 'e1' }),
        oeuvreFictive({ id: 'prophete', titreFr: 'Le Prophète', editions: [{ ...edition('e2', '9782070368228'), couverture: chemin(320, 'b') }], monEdition: 'e2' }),
        oeuvreFictive({ id: 'grande', titreFr: 'Grande', editions: [{ ...edition('e3', '9782072878497'), couverture: chemin(800, 'c') }], monEdition: 'e3' }),
        oeuvreFictive({ id: 'oeuvre', titreFr: 'Sur l’œuvre', couverture: chemin(200, 'd') }),
        oeuvreFictive({ id: 'vinland', titreFr: 'Vinland Saga', estSerie: true, tomes: [{ ...tome(1, '9782351423554'), couverture: chemin(348, 'e') }] }),
      ],
    })
  const remplacer = () => act(async () => fireEvent.click(section().getByRole('button', { name: 'Remplacer les couvertures de petite taille' })))

  it('remplace ce qui peut l’être et montre, œuvre par œuvre, ce qui a été fait', async () => {
    const assistant = assistantFictif({
      couverture: (demande) =>
        'isbn' in demande && demande.isbn === '9782070368228' ? { ok: true, valeur: null } : imageFictive({ largeur: 800, hauteur: 1200 }),
    })
    const { depot, couvertures } = await ouvrir({ depot: ILLUSTREE(), assistant })
    await remplacer()
    await laisserPasser(10_000)

    const lignes = within(section().getByRole('list', { name: 'Ce que le remplacement a donné' }))
      .getAllByRole('listitem')
      .map((ligne) => ligne.textContent)
    expect(lignes).toEqual([
      'Momo : remplacée (300 → 800\u00a0px)',
      'Le Prophète : pas de plus grande image',
      'Sur l’œuvre : sans ISBN, laissée telle quelle',
      'Vinland Saga, tome 1 : remplacée (348 → 800\u00a0px)',
    ])
    expect(section().getByRole('status')).toHaveTextContent('Remplacement terminé.')
    expect(couvertures.deposees).toHaveLength(2)
    expect(depot.appels.ecritures.filter((e) => e.action === 'couverture')).toHaveLength(2)
    expect(assistant.appels.proposerFiche).toHaveLength(0)
  })

  it('dit simplement qu’aucune couverture n’est de petite taille', async () => {
    const depot = depotFictif({ oeuvres: [oeuvreFictive({ id: 'grande', titreFr: 'Grande', couverture: chemin(800, 'c') })] })
    const { assistant } = await ouvrir({ depot })
    await remplacer()
    await laisserPasser(2000)
    expect(section().getByRole('status')).toHaveTextContent('Aucune couverture de petite taille.')
    expect(assistant.appels.couverture).toHaveLength(0)
  })

  it('va au même rythme que la recherche, et s’arrête quand je le demande', async () => {
    const { assistant, couvertures } = await ouvrir({ depot: ILLUSTREE(), assistant: assistantFictif({ couverture: imageFictive({ largeur: 800, hauteur: 1200 }) }) })
    await remplacer()
    await laisserPasser(500)
    expect(assistant.appels.couverture).toHaveLength(1)
    expect(section().getByText(/Recherche d’une plus grande image : Momo/)).toBeInTheDocument()
    // Une seule recherche à la fois : l'autre bouton attend.
    expect(section().queryByRole('button', { name: 'Chercher les couvertures manquantes' })).toHaveAttribute('aria-disabled', 'true')
    await act(async () => fireEvent.click(section().getByRole('button', { name: 'Arrêter' })))
    await laisserPasser(10_000)
    expect(assistant.appels.couverture).toHaveLength(1)
    expect(couvertures.deposees).toHaveLength(1)
    expect(section().getByText(/Remplacement arrêté/)).toBeInTheDocument()
  })

  it('hors connexion, grise le bouton', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    const { assistant } = await ouvrir({ depot: ILLUSTREE() })
    expect(section().getByRole('button', { name: 'Remplacer les couvertures de petite taille' })).toHaveAttribute('aria-disabled', 'true')
    await remplacer()
    await laisserPasser(2000)
    expect(assistant.appels.couverture).toHaveLength(0)
  })
})

describe('Réglages : fausses couvertures', () => {
  const MOI = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const chemin = (largeur: number, nom: string) => `${MOI}/${String(largeur).padStart(4, '0')}${nom}`.padEnd(MOI.length + 33, '0') + '.jpg'
  // L'image rangée « se lit » en son adresse ; une adresse qui contient « faux » est une fausse couverture.
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (adresse) => new Response(String(adresse)))
  })
  afterEach(() => vi.restoreAllMocks())

  const AVEC_FAUSSES = () =>
    depotFictif({
      oeuvres: [
        oeuvreFictive({ id: 'minuit', titreFr: 'La Bibliothèque de minuit', editions: [{ ...edition('e1', '9782253936367'), couverture: chemin(575, 'f') }], monEdition: 'e1' }),
        oeuvreFictive({ id: 'ferme', titreFr: 'La Ferme des animaux', editions: [{ ...edition('e2', '9780140817690'), couverture: chemin(575, 'f') }], monEdition: 'e2' }),
        oeuvreFictive({ id: 'homme', titreFr: 'L’Homme qui plantait des arbres', editions: [{ ...edition('e3', '9782070744619'), couverture: chemin(300, 'a') }], monEdition: 'e3' }),
      ],
    })
  const retirer = () => act(async () => fireEvent.click(section().getByRole('button', { name: 'Retirer les fausses couvertures' })))

  it('retire les fausses couvertures, en cherche une vraie, et dit œuvre par œuvre ce qui a été fait', async () => {
    const assistant = assistantFictif({
      couverture: (demande) => ('isbn' in demande && demande.isbn === '9780140817690' ? imageFictive({ largeur: 800, hauteur: 1200 }) : { ok: true, valeur: null }),
    })
    const { depot } = await ouvrir({ depot: AVEC_FAUSSES(), assistant })
    await retirer()
    await laisserPasser(10_000)
    const lignes = within(section().getByRole('list', { name: 'Ce que la vérification a donné' }))
      .getAllByRole('listitem')
      .map((ligne) => ligne.textContent)
    expect(lignes).toEqual([
      'La Bibliothèque de minuit : fausse couverture retirée, celle d’Ichnos reprend sa place',
      'La Ferme des animaux : fausse couverture remplacée par une vraie',
    ])
    expect(section().getByRole('status')).toHaveTextContent('Vérification terminée.')
    expect(depot.oeuvres().find((o) => o.id === 'minuit')?.editions[0].couverture).toBeNull()
    expect(depot.oeuvres().find((o) => o.id === 'homme')?.editions[0].couverture).toBe(chemin(300, 'a'))
    expect(assistant.appels.proposerFiche).toHaveLength(0)
  })

  it('dit simplement qu’il n’y a aucune fausse couverture', async () => {
    const depot = depotFictif({ oeuvres: [oeuvreFictive({ id: 'homme', titreFr: 'L’Homme qui plantait des arbres', couverture: chemin(300, 'a') })] })
    await ouvrir({ depot })
    await retirer()
    await laisserPasser(2000)
    expect(section().getByRole('status')).toHaveTextContent('Aucune fausse couverture.')
  })
})

describe('Réglages : déconnexion', () => {
  it('efface les couvertures gardées sur l’appareil', async () => {
    const { couvertures, auth } = await ouvrir()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' })))
    await laisserPasser(500)
    expect(auth.appels.deconnecter).toBe(1)
    expect(couvertures.appels.oublier).toBe(1)
  })
})
