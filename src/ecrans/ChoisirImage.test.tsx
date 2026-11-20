import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../App'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { CONSEIL_PHOTO } from '../couvertures/conseil'
import type { Quad } from '../couvertures/redressement/geometrie.ts'
import { couverturesFictives } from '../couvertures/stockage.fictif'
import { authFictif } from '../session/auth.fictif'

// jsdom n'a ni toile de dessin ni décodeur d'image : la lecture de la photo, la détection des coins
// et le redressement sont simulés (la vraie logique est testée dans photo.test.ts et dans
// couvertures/redressement). Les coins demandés sont retenus ; les deux images rendues se
// reconnaissent à leur poids.
const ENTIERE: Quad = [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 4000 }, { x: 0, y: 4000 }]
const LIVRE: Quad = [{ x: 600, y: 800 }, { x: 2400, y: 900 }, { x: 2500, y: 3400 }, { x: 500, y: 3300 }]
const ORIGINE = new Blob(['couleurs-d-origine'], { type: 'image/jpeg' })
const AMELIOREE = new Blob(['lumiere-corrigee-un-peu-plus-lourde'], { type: 'image/jpeg' })
const redressements: Quad[] = []
const monde: { trouves: Quad | null; echec: boolean } = { trouves: null, echec: false }

vi.mock('../couvertures/photo', async (original) => ({
  ...(await original<typeof import('../couvertures/photo')>()),
  lireImage: async (fichier: File) =>
    fichier.name === 'abimee.jpg'
      ? { ok: false, echec: 'illisible' }
      : { ok: true, image: { source: {}, largeur: 3000, hauteur: 4000, apercu: 'blob:photo', liberer: () => {} } },
}))
vi.mock('../couvertures/redressement/index.ts', () => ({
  trouverCoins: () => (monde.trouves ? { coins: monde.trouves, trouve: true } : { coins: ENTIERE, trouve: false }),
  redresser: async (_photo: unknown, coins: Quad) => {
    redressements.push(coins)
    return monde.echec ? null : { origine: ORIGINE, amelioree: AMELIOREE, largeur: 750, hauteur: 1200 }
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
const cliquer = async (nom: string) => {
  await act(async () => fireEvent.click(screen.getByRole('button', { name: nom })))
  await attendre()
}
/** Les deux temps du panneau : « Redresser », puis « Valider ». */
const garder = async () => {
  await cliquer('Redresser')
  await cliquer('Valider')
}
/** La photo (3000 × 4000) est affichée sur 300 × 400 : un point d'écran vaut dix points de la photo. */
const mesurerZone = () => {
  screen.getByTestId('zone-redressement').getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 400, right: 300, bottom: 400, x: 0, y: 0, toJSON: () => ({}) })
}
const coin = (nom: string) => screen.getByRole('button', { name: nom })
function glisser(nom: string, de: [number, number], vers: [number, number]) {
  const poignee = coin(nom)
  fireEvent.pointerDown(poignee, { pointerId: 1, clientX: de[0], clientY: de[1] })
  fireEvent.pointerMove(poignee, { pointerId: 1, clientX: vers[0], clientY: vers[1] })
  fireEvent.pointerUp(poignee, { pointerId: 1, clientX: vers[0], clientY: vers[1] })
}

beforeEach(() => {
  redressements.length = 0
  monde.trouves = null
  monde.echec = false
  localStorage.clear()
  URL.createObjectURL = (image: Blob | MediaSource) => `blob:${(image as Blob).size}`
  URL.revokeObjectURL = () => {}
  window.location.hash = ''
  window.scrollTo = () => {}
  Element.prototype.scrollIntoView = () => {}
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
})

const menu = (nom: string) => {
  fireEvent.click(section().getByRole('button', { name: 'Changer la couverture' }))
  fireEvent.click(screen.getByRole('menuitem', { name: nom }))
}
const enregistrer = async () => {
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' })))
  await attendre()
}

describe('« Modifier » : la section Couverture', () => {
  it('est toujours là, même sans couverture, avec « Changer la couverture »', async () => {
    await ouvrir('#/oeuvre/conte/modifier')
    expect(section().getByRole('button', { name: 'Changer la couverture' })).toBeInTheDocument()
    // Rien à retirer tant qu'il n'y a que la couverture d'Ichnos.
    expect(section().queryByRole('button', { name: 'Retirer la couverture' })).not.toBeInTheDocument()
  })

  it('« Choisir dans mes photos » laisse l’iPhone proposer photothèque, appareil photo ou fichiers', async () => {
    await ouvrir('#/oeuvre/conte/modifier')
    const champ = champFichier()
    expect(champ).toHaveAttribute('accept', 'image/*')
    const clics = vi.spyOn(champ, 'click').mockImplementation(() => {})
    menu('Choisir dans mes photos')
    expect(clics).toHaveBeenCalledTimes(1)
    expect(champ).not.toHaveAttribute('capture')
  })

  it('« Prendre une photo » ouvre directement l’appareil photo', async () => {
    await ouvrir('#/oeuvre/conte/modifier')
    const champ = champFichier()
    const clics = vi.spyOn(champ, 'click').mockImplementation(() => {})
    menu('Prendre une photo')
    expect(clics).toHaveBeenCalledTimes(1)
    expect(champ).toHaveAttribute('capture', 'environment')
  })

  it('n’existe pas pendant l’ajout d’une œuvre nouvelle', async () => {
    await ouvrir('#/ajouter?mode=manuel')
    expect(screen.queryByRole('button', { name: 'Changer la couverture' })).not.toBeInTheDocument()
  })
})

describe('choisir une image', () => {
  it('montre la photo dans le panneau « Redresser la photo », sans rien enregistrer encore', async () => {
    const { depot, couvertures } = await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    const panneau = within(screen.getByRole('dialog', { name: 'Redresser la photo' }))
    expect(panneau.getByText(/Placer les quatre coins/)).toBeInTheDocument()
    expect(panneau.getByRole('img', { name: 'La photo choisie' })).toBeInTheDocument()
    // Les boutons du panneau : l'action principale en haut, les autres en dessous.
    expect(panneau.getAllByRole('button').map((b) => b.textContent).slice(-3)).toEqual(['Redresser', 'Image entière', 'Reprendre la photo'])
    expect(couvertures.deposees).toHaveLength(0)
    expect(depot.appels.ecritures).toHaveLength(0)
  })

  it('place les coins sur le livre trouvé, et le dit', async () => {
    monde.trouves = LIVRE
    await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    expect(screen.getByRole('status', { name: 'Détection du livre' })).toHaveTextContent('Les coins sont placés sur le livre. Les ajuster si besoin.')
    await cliquer('Redresser')
    expect(redressements).toEqual([LIVRE])
  })

  it('si le livre n’est pas trouvé, part de la photo entière et le dit calmement', async () => {
    await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    expect(screen.getByRole('status', { name: 'Détection du livre' })).toHaveTextContent('Livre introuvable sur la photo : placer les coins à la main.')
    await cliquer('Redresser')
    expect(redressements).toEqual([ENTIERE])
  })

  it('après « Redresser », montre la couverture droite, avec la lumière corrigée, avant de valider', async () => {
    const { couvertures } = await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    await cliquer('Redresser')
    const panneau = within(screen.getByRole('dialog', { name: 'Vérifier la couverture' }))
    expect(panneau.getByRole('img', { name: 'La couverture redressée' })).toHaveAttribute('src', `blob:${AMELIOREE.size}`)
    // « Reprendre la photo » est toujours là, à côté de « Valider ».
    expect(panneau.getAllByRole('button').map((b) => b.textContent).slice(-3)).toEqual(['Valider', 'Revoir les coins', 'Reprendre la photo'])
    expect(couvertures.deposees).toHaveLength(0)
  })

  it('garde par défaut l’image à la lumière corrigée : affichée tout de suite, rangée sur mon édition seulement avec « Enregistrer »', async () => {
    const { depot, couvertures } = await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    await garder()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // À l'écran, avec sa croix ; rien n'est encore envoyé.
    expect(section().getByRole('button', { name: 'Retirer la couverture' })).toBeInTheDocument()
    expect(couvertures.deposees).toHaveLength(0)
    expect(rangees(depot)).toEqual([])

    await enregistrer()
    expect(couvertures.deposees).toHaveLength(1)
    expect(couvertures.deposees[0].image).toBe(AMELIOREE)
    expect(rangees(depot)).toEqual([['momo', { type: 'edition', edition: 'e1' }]])
  })

  it('« Couleurs d’origine » retire la correction de lumière, et c’est cette image qui est gardée', async () => {
    const { couvertures } = await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    await cliquer('Redresser')
    const interrupteur = screen.getByRole('switch', { name: 'Couleurs d’origine' })
    expect(interrupteur).not.toBeChecked()
    fireEvent.click(interrupteur)
    expect(interrupteur).toBeChecked()
    expect(screen.getByRole('img', { name: 'La couverture redressée' })).toHaveAttribute('src', `blob:${ORIGINE.size}`)
    await cliquer('Valider')
    await enregistrer()
    expect(couvertures.deposees[0].image).toBe(ORIGINE)
  })

  it('« Revoir les coins » revient à la photo, les coins là où je les avais mis', async () => {
    monde.trouves = LIVRE
    await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    await cliquer('Redresser')
    await cliquer('Revoir les coins')
    expect(screen.getByRole('dialog', { name: 'Redresser la photo' })).toBeInTheDocument()
    await cliquer('Redresser')
    expect(redressements).toEqual([LIVRE, LIVRE])
  })

  it('« Reprendre la photo » rouvre l’appareil photo, aux deux temps du panneau', async () => {
    await ouvrir('#/oeuvre/conte/modifier')
    const champ = champFichier()
    const clics = vi.spyOn(champ, 'click').mockImplementation(() => {})
    menu('Prendre une photo')
    await choisir(photo())
    await cliquer('Reprendre la photo')
    expect(clics).toHaveBeenCalledTimes(2)
    expect(champ).toHaveAttribute('capture', 'environment')
    // La photo d'avant est abandonnée : le panneau se referme en attendant la nouvelle.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await choisir(photo('seconde.jpg'))
    await cliquer('Redresser')
    await cliquer('Reprendre la photo')
    expect(clics).toHaveBeenCalledTimes(3)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('une image gardée puis abandonnée n’est jamais envoyée', async () => {
    const { couvertures } = await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    await garder()
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    await act(async () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Abandonner' })))
    expect(couvertures.deposees).toHaveLength(0)
  })

  it('sans édition à moi, la range sur l’œuvre', async () => {
    const { depot } = await ouvrir('#/oeuvre/conte/modifier')
    await choisir(photo())
    await garder()
    await enregistrer()
    expect(rangees(depot)).toEqual([['conte', { type: 'oeuvre' }]])
  })

  it('pour une série, la range sur la série elle-même, et dit quand elle s’affiche', async () => {
    const { depot } = await ouvrir('#/oeuvre/vin/modifier')
    expect(section().getByText(/s’affiche tant qu’aucun tome n’a la sienne/)).toBeInTheDocument()
    await choisir(photo())
    await garder()
    await enregistrer()
    expect(rangees(depot)).toEqual([['vin', { type: 'oeuvre' }]])
  })

  it('chaque coin se déplace seul, au doigt, et « Image entière » les remet aux coins de la photo', async () => {
    await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    mesurerZone()
    glisser('Coin en haut à gauche', [0, 0], [30, 50])
    glisser('Coin en bas à droite', [300, 400], [280, 300])
    await cliquer('Redresser')
    // Un quadrilatère libre : les deux autres coins n'ont pas bougé.
    expect(redressements[0]).toEqual([{ x: 300, y: 500 }, { x: 3000, y: 0 }, { x: 2800, y: 3000 }, { x: 0, y: 4000 }])

    await cliquer('Revoir les coins')
    fireEvent.click(screen.getByRole('button', { name: 'Image entière' }))
    await cliquer('Redresser')
    expect(redressements[1]).toEqual(ENTIERE)
  })

  it('un coin ne sort jamais de la photo', async () => {
    await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    mesurerZone()
    glisser('Coin en haut à droite', [300, 0], [900, -200])
    await cliquer('Redresser')
    expect(redressements[0][1]).toEqual({ x: 3000, y: 0 })
  })

  it('une loupe suit le coin pendant le geste, pour viser sous le doigt', async () => {
    await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    mesurerZone()
    expect(screen.queryByTestId('loupe')).not.toBeInTheDocument()
    const poignee = coin('Coin en bas à gauche')
    fireEvent.pointerDown(poignee, { pointerId: 1, clientX: 0, clientY: 400 })
    fireEvent.pointerMove(poignee, { pointerId: 1, clientX: 60, clientY: 340 })
    const loupe = screen.getByTestId('loupe')
    // Décorative, et elle ne capte pas le geste.
    expect(loupe).toHaveAttribute('aria-hidden', 'true')
    expect(loupe).toHaveClass('pointer-events-none')
    // Elle montre la photo agrandie, centrée sur le coin (60, 340 à l'écran).
    expect(loupe.style.backgroundImage).toContain('blob:photo')
    expect(loupe.style.backgroundSize).toBe('750px 1000px')
    expect(loupe.style.backgroundPosition).toBe('-98px -798px')
    // Au-dessus du doigt, qui cache le coin : son centre est 84 px plus haut.
    expect(loupe.style.top).toBe('204px')
    // Tout en haut du panneau, la place manque : elle passe en dessous.
    fireEvent.pointerMove(poignee, { pointerId: 1, clientX: 60, clientY: 20 })
    expect(screen.getByTestId('loupe').style.top).toBe('52px')
    // Quand le panneau laisse de la place au-dessus de la photo (ici 200 px), elle y déborde plutôt que de passer sous le doigt.
    const fenetre = screen.getByRole('dialog', { name: 'Redresser la photo' })
    fenetre.getBoundingClientRect = () => ({ left: 0, top: -200, width: 393, height: 800, right: 393, bottom: 600, x: 0, y: -200, toJSON: () => ({}) })
    fireEvent.pointerMove(poignee, { pointerId: 1, clientX: 60, clientY: 21 })
    expect(screen.getByTestId('loupe').style.top).toBe('-115px')
    fireEvent.pointerUp(poignee, { pointerId: 1, clientX: 60, clientY: 340 })
    expect(screen.queryByTestId('loupe')).not.toBeInTheDocument()
  })

  it('un geste interrompu (appel, notification) ne laisse pas le coin accroché au pointeur', async () => {
    await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    mesurerZone()
    const poignee = coin('Coin en haut à gauche')
    fireEvent.pointerDown(poignee, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(poignee, { pointerId: 1, clientX: 30, clientY: 30 })
    // Le système reprend le geste sans « pointerup » : la poignée perd le pointeur.
    fireEvent.lostPointerCapture(poignee, { pointerId: 1 })
    fireEvent.pointerMove(poignee, { pointerId: 1, clientX: 150, clientY: 200 })
    expect(screen.queryByTestId('loupe')).not.toBeInTheDocument()
    await cliquer('Redresser')
    expect(redressements[0][0]).toEqual({ x: 300, y: 300 })
  })

  it('chaque coin a un nom pour VoiceOver, et se déplace aux flèches du clavier', async () => {
    await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    const noms = ['Coin en haut à gauche', 'Coin en haut à droite', 'Coin en bas à droite', 'Coin en bas à gauche']
    for (const nom of noms) {
      // 44 px au moins (size-11) ; le geste reste dans la poignée (touch-action: none).
      expect(coin(nom)).toHaveClass('size-11', 'touch-none')
      expect(coin(nom)).toHaveAccessibleDescription(/flèches du clavier/)
    }
    // Un pas : un demi-centième du grand côté (20 points sur 4000). Avec Maj : cinq fois plus.
    fireEvent.keyDown(coin('Coin en haut à gauche'), { key: 'ArrowRight' })
    fireEvent.keyDown(coin('Coin en haut à gauche'), { key: 'ArrowDown' })
    fireEvent.keyDown(coin('Coin en haut à gauche'), { key: 'ArrowDown' })
    fireEvent.keyDown(coin('Coin en bas à droite'), { key: 'ArrowLeft', shiftKey: true })
    fireEvent.keyDown(coin('Coin en bas à droite'), { key: 'ArrowUp' })
    await cliquer('Redresser')
    expect(redressements[0]).toEqual([{ x: 20, y: 40 }, { x: 3000, y: 0 }, { x: 2900, y: 3980 }, { x: 0, y: 4000 }])
  })

  it('si ces coins ne permettent pas de redresser, le dit et reste sur la photo', async () => {
    monde.echec = true
    await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    await cliquer('Redresser')
    const panneau = within(screen.getByRole('dialog', { name: 'Redresser la photo' }))
    expect(panneau.getByRole('alert')).toHaveTextContent('L’image n’a pas pu être redressée. Replacer les coins, ou reprendre la photo.')
  })

  it('garde le conseil de lumière à portée, replié, près de « Reprendre la photo »', async () => {
    await ouvrir('#/oeuvre/momo/modifier')
    await choisir(photo())
    const conseil = screen.getByText('Conseils pour la photo').closest('details')
    expect(conseil).not.toHaveAttribute('open')
    expect(conseil).toHaveTextContent(CONSEIL_PHOTO)
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

  it('si la couverture n’a pas pu être rangée, « Modifier » reste ouvert et le dit', async () => {
    const { depot } = await ouvrir('#/oeuvre/momo/modifier', { couvertures: couverturesFictives({ depot: { ok: false, echec: 'reseau' } }) })
    await choisir(photo())
    await garder()
    await enregistrer()
    expect(rangees(depot)).toEqual([])
    expect(screen.getAllByRole('alert').some((a) => /La fiche est enregistrée, mais pas la couverture/.test(a.textContent ?? ''))).toBe(true)
    expect(window.location.hash).toBe('#/oeuvre/momo/modifier')
  })

  it('hors connexion, le menu est grisé, avec un mot d’explication', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    await ouvrir('#/oeuvre/conte/modifier')
    const bouton = section().getByRole('button', { name: 'Changer la couverture' })
    expect(bouton).toHaveAttribute('aria-disabled', 'true')
    const clics = vi.spyOn(champFichier(), 'click').mockImplementation(() => {})
    fireEvent.click(bouton)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(clics).not.toHaveBeenCalled()
    expect(section().getByText(/La couverture pourra changer au retour du réseau/)).toBeInTheDocument()
  })
})

describe('choisir une image pour un tome', () => {
  const ouvrirTome = async () => {
    const monde = await ouvrir('#/oeuvre/vin')
    fireEvent.click(within(screen.getByRole('list', { name: 'Tomes de Vinland Saga' })).getByRole('button', { name: /^Tome 2,/ })); fireEvent.click(screen.getByRole('button', { name: 'Détails du tome' }))
    return { ...monde, panneau: screen.getByRole('dialog', { name: 'Tome 2' }) }
  }

  it('depuis le panneau du tome, range la photo sur ce tome', async () => {
    const { depot, couvertures, panneau } = await ouvrirTome()
    expect(within(panneau).getByRole('button', { name: 'Choisir une image' })).toBeInTheDocument()
    await choisir(photo(), panneau)
    await garder()
    expect(couvertures.deposees[0].image).toBe(AMELIOREE)
    expect(rangees(depot)).toEqual([['vin', { type: 'tome', numero: 2 }]])
    // On revient au panneau du tome, qui reste ouvert.
    expect(screen.getByRole('dialog', { name: 'Tome 2' })).toBeInTheDocument()
  })

  it('le conseil de lumière s’affiche sous le bouton les trois premières fois, puis se fait oublier', async () => {
    const { panneau } = await ouvrirTome()
    expect(within(panneau).getByText(CONSEIL_PHOTO)).toBeInTheDocument()
    for (const nom of ['une.jpg', 'deux.jpg', 'trois.jpg']) {
      await choisir(photo(nom), panneau)
      await act(async () => fireEvent.click(within(screen.getByRole('dialog', { name: 'Redresser la photo' })).getByRole('button', { name: 'Fermer' })))
    }
    expect(within(panneau).queryByText(CONSEIL_PHOTO)).not.toBeInTheDocument()
  })
})
