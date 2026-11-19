import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../App'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import type { Cadre } from '../couvertures/photo'
import { couverturesFictives } from '../couvertures/stockage.fictif'
import { authFictif } from '../session/auth.fictif'

// jsdom n'a ni toile de dessin ni décodeur d'image : la lecture et le recadrage de la photo sont
// simulés (la vraie logique est testée dans photo.test.ts). Le cadre demandé voyage dans l'image rendue.
const recadrages: Cadre[] = []
vi.mock('../couvertures/photo', async (original) => ({
  ...(await original<typeof import('../couvertures/photo')>()),
  lireImage: async (fichier: File) =>
    fichier.name === 'abimee.jpg'
      ? { ok: false, echec: 'illisible' }
      : { ok: true, image: { source: {}, largeur: 3000, hauteur: 4000, apercu: 'blob:photo', liberer: () => {} } },
  recadrer: async (_image: unknown, cadre: Cadre) => {
    recadrages.push(cadre)
    return new Blob(['photo-recadree'], { type: 'image/jpeg' })
  },
}))

const CHEMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef.jpg'
const edition = (id: string, couverture: string | null = null) => ({ id, isbn: null, publisher: 'Bayard', language: 'fr', format: null, translator: null, pageCount: null, couverture })
const MOMO = () => oeuvreFictive({ id: 'momo', titreFr: 'Momo', editions: [edition('e1')], monEdition: 'e1' })
const SANS_EDITION = () => oeuvreFictive({ id: 'conte', titreFr: 'Un conte' })
const SERIE = () =>
  oeuvreFictive({
    id: 'vin',
    titreFr: 'Vinland Saga',
    estSerie: true,
    tomes: [
      { numero: 1, titre: null, isbn: null, possession: 'possede', lecture: 'lu', couverture: CHEMIN },
      { numero: 2, titre: null, isbn: null, possession: 'possede', lecture: 'a_lire' },
    ],
  })

const photo = (nom = 'photo.jpg', type = 'image/jpeg', taille = 2_000_000) => {
  const fichier = new File(['x'], nom, { type })
  Object.defineProperty(fichier, 'size', { value: taille })
  return fichier
}

async function ouvrir(hash: string, options: { depot?: ReturnType<typeof depotFictif>; couvertures?: ReturnType<typeof couverturesFictives> } = {}) {
  const depot = options.depot ?? depotFictif({ oeuvres: [MOMO(), SANS_EDITION(), SERIE()] })
  const couvertures = options.couvertures ?? couverturesFictives()
  window.location.hash = hash
  const { container } = render(
    <App auth={authFictif({ compte: { email: 'moi@exemple.test' } }).auth} depot={depot.depot} couvertures={couvertures.couvertures} />,
  )
  await act(async () => {})
  return { depot, couvertures, container }
}

const attendre = () => act(async () => void (await new Promise((suite) => setTimeout(suite, 0))))
const section = () => within(screen.getByRole('region', { name: 'Couverture' }))
const champFichier = (racine: ParentNode = document) => racine.querySelector('input[type="file"]') as HTMLInputElement
const rangees = (depot: ReturnType<typeof depotFictif>) =>
  depot.appels.ecritures.filter((e) => e.action === 'couverture').map((e) => [e.id, (e.valeur as { cible: unknown }).cible])

async function choisir(fichier: File, racine: ParentNode = document) {
  await act(async () => fireEvent.change(champFichier(racine), { target: { files: [fichier] } }))
  await attendre()
}
const garder = async () => {
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Garder cette image' })))
  await attendre()
}

beforeEach(() => {
  recadrages.length = 0
  window.location.hash = ''
  window.scrollTo = () => {}
  Element.prototype.scrollIntoView = () => {}
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
})

describe('« Modifier » : la section Couverture', () => {
  it('est toujours là, même sans couverture, avec « Choisir une image »', async () => {
    await ouvrir('#/oeuvre/conte/modifier')
    expect(section().getByRole('heading', { level: 2, name: 'Couverture' })).toBeInTheDocument()
    expect(section().getByRole('button', { name: 'Choisir une image' })).toBeInTheDocument()
    // Rien à retirer tant qu'il n'y a que la couverture d'Ichnos.
    expect(section().queryByRole('button', { name: 'Retirer cette couverture' })).not.toBeInTheDocument()
  })

  it('ouvre le choix de l’iPhone : photothèque, appareil photo ou fichiers (sans imposer l’appareil photo)', async () => {
    await ouvrir('#/oeuvre/conte/modifier')
    const champ = champFichier()
    expect(champ).toHaveAttribute('accept', 'image/*')
    expect(champ).not.toHaveAttribute('capture')
    const clics = vi.spyOn(champ, 'click').mockImplementation(() => {})
    fireEvent.click(section().getByRole('button', { name: 'Choisir une image' }))
    expect(clics).toHaveBeenCalledTimes(1)
  })

  it('n’existe pas pendant l’ajout d’une œuvre nouvelle', async () => {
    await ouvrir('#/ajouter?mode=manuel')
    expect(screen.queryByRole('button', { name: 'Choisir une image' })).not.toBeInTheDocument()
  })
})

describe('choisir une image', () => {
  it('montre la photo entière dans un panneau de recadrage, sans rien enregistrer encore', async () => {
    const { depot, couvertures } = await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    const panneau = within(screen.getByRole('dialog', { name: 'Recadrer l’image' }))
    expect(panneau.getByRole('button', { name: 'Garder cette image' })).toBeInTheDocument()
    expect(panneau.getByRole('button', { name: 'Image entière' })).toBeInTheDocument()
    expect(panneau.getByText(/Je fais glisser les coins/)).toBeInTheDocument()
    expect(couvertures.deposees).toHaveLength(0)
    expect(depot.appels.ecritures).toHaveLength(0)
  })

  it('garde l’image entière par défaut, et la range sur mon édition : c’est elle qui s’affiche', async () => {
    const { depot, couvertures } = await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    await garder()
    expect(recadrages).toEqual([{ x: 0, y: 0, largeur: 3000, hauteur: 4000 }])
    expect(couvertures.deposees).toHaveLength(1)
    expect(couvertures.deposees[0].image.type).toBe('image/jpeg')
    expect(rangees(depot)).toEqual([['momo', { type: 'edition', edition: 'e1' }]])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(section().getByRole('status')).toHaveTextContent('La nouvelle couverture est en place.')
    // Une couverture est là : je peux maintenant la retirer.
    expect(await section().findByRole('button', { name: 'Retirer cette couverture' })).toBeInTheDocument()
  })

  it('sans édition à moi, la range sur l’œuvre', async () => {
    const { depot } = await ouvrir('#/oeuvre/conte/modifier')
    await choisir(photo())
    await garder()
    expect(rangees(depot)).toEqual([['conte', { type: 'oeuvre' }]])
  })

  it('pour une série, la range sur la série elle-même, et dit quand elle s’affiche', async () => {
    const { depot } = await ouvrir('#/oeuvre/vin/modifier')
    expect(section().getByText(/s’affiche tant qu’aucun tome n’a sa couverture/)).toBeInTheDocument()
    await choisir(photo())
    await garder()
    expect(rangees(depot)).toEqual([['vin', { type: 'oeuvre' }]])
  })

  it('recadre librement en faisant glisser un coin, et « Image entière » revient au départ', async () => {
    await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    // La photo (3000 × 4000) est affichée sur 300 × 400 : un pixel d'écran vaut dix pixels d'image.
    const zone = screen.getByTestId('zone-recadrage')
    zone.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 400, right: 300, bottom: 400, x: 0, y: 0, toJSON: () => ({}) })
    const coin = screen.getByTestId('coin-haut-gauche')
    fireEvent.pointerDown(coin, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(coin, { pointerId: 1, clientX: 30, clientY: 50 })
    fireEvent.pointerUp(coin, { pointerId: 1, clientX: 30, clientY: 50 })
    const bas = screen.getByTestId('coin-bas-droite')
    fireEvent.pointerDown(bas, { pointerId: 1, clientX: 300, clientY: 400 })
    fireEvent.pointerMove(bas, { pointerId: 1, clientX: 280, clientY: 300 })
    fireEvent.pointerUp(bas, { pointerId: 1, clientX: 280, clientY: 300 })
    await garder()
    expect(recadrages[0]).toEqual({ x: 300, y: 500, largeur: 2500, hauteur: 2500 })

    await choisir(photo('autre.jpg'))
    const coin2 = screen.getByTestId('coin-haut-gauche')
    screen.getByTestId('zone-recadrage').getBoundingClientRect = zone.getBoundingClientRect
    fireEvent.pointerDown(coin2, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(coin2, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerUp(coin2, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.click(screen.getByRole('button', { name: 'Image entière' }))
    await garder()
    expect(recadrages[1]).toEqual({ x: 0, y: 0, largeur: 3000, hauteur: 4000 })
  })

  it('les poignées sont assez grandes pour le doigt, et ne gênent ni le défilement ni VoiceOver', async () => {
    await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    for (const nom of ['haut-gauche', 'haut-droite', 'bas-gauche', 'bas-droite']) {
      const coin = screen.getByTestId(`coin-${nom}`)
      // 44 px au moins (size-11), le geste reste dans la poignée (touch-action: none).
      expect(coin).toHaveClass('size-11', 'touch-none')
      expect(coin).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('je peux refermer le panneau sans rien garder', async () => {
    const { depot, couvertures } = await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    await act(async () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fermer' })))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(couvertures.deposees).toHaveLength(0)
    expect(depot.appels.ecritures).toHaveLength(0)
  })

  it('refuse ce qui n’est pas une image, un fichier démesuré, ou une image illisible, avec une phrase calme', async () => {
    const { couvertures } = await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo('contrat.pdf', 'application/pdf'))
    expect(section().getByRole('alert')).toHaveTextContent('Ce fichier n’est pas une image.')
    await choisir(photo('enorme.jpg', 'image/jpeg', 31 * 1024 * 1024))
    expect(section().getByRole('alert')).toHaveTextContent('Cette image est trop lourde (plus de 30 Mo).')
    await choisir(photo('abimee.jpg'))
    expect(section().getByRole('alert')).toHaveTextContent('Cette image n’a pas pu être lue.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(couvertures.deposees).toHaveLength(0)
  })

  it('dit calmement quand la couverture n’a pas pu être rangée, et garde le panneau ouvert', async () => {
    const { depot } = await ouvrir('#/oeuvre/momo/modifier', { couvertures: couverturesFictives({ depot: { ok: false, echec: 'reseau' } }) })
    await choisir(photo())
    await garder()
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Pas de connexion à internet : la couverture n’a pas été rangée.')
    expect(depot.appels.ecritures).toHaveLength(0)
  })

  it('hors connexion, le bouton est grisé, avec un mot d’explication', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    await ouvrir('#/oeuvre/conte/modifier')
    const bouton = section().getByRole('button', { name: 'Choisir une image' })
    expect(bouton).toHaveAttribute('aria-disabled', 'true')
    const clics = vi.spyOn(champFichier(), 'click').mockImplementation(() => {})
    fireEvent.click(bouton)
    expect(clics).not.toHaveBeenCalled()
    expect(section().getByText(/Je pourrai changer la couverture au retour du réseau/)).toBeInTheDocument()
  })
})

describe('choisir une image pour un tome', () => {
  it('depuis le panneau du tome, range la photo sur ce tome', async () => {
    const { depot } = await ouvrir('#/oeuvre/vin')
    fireEvent.click(within(screen.getByRole('list', { name: 'Tomes de Vinland Saga' })).getByRole('button', { name: /^Tome 2 / }))
    const panneau = screen.getByRole('dialog', { name: 'Tome 2' })
    expect(within(panneau).getByRole('button', { name: 'Choisir une image' })).toBeInTheDocument()
    await choisir(photo(), panneau)
    await garder()
    expect(rangees(depot)).toEqual([['vin', { type: 'tome', numero: 2 }]])
    // On revient au panneau du tome, qui reste ouvert.
    expect(screen.getByRole('dialog', { name: 'Tome 2' })).toBeInTheDocument()
  })
})
