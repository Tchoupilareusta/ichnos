import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../App'
import { assistantFictif, imageFictive, noticeFictive, reponseIsbnFictive, reponseTitreFictive, resultatFictif } from '../ajout/assistant.fictif'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { couverturesFictives } from '../couvertures/stockage.fictif'
import { authFictif } from '../session/auth.fictif'

// Quand aucune couverture n'est trouvée pour un ISBN : « Prendre une photo de mon exemplaire »,
// puis « Chercher d'autres couvertures ». La lecture de la photo et son redressement sont simulés
// (jsdom n'a ni toile de dessin ni décodeur d'image) : les deux images rendues se reconnaissent à leur poids.
const ORIGINE = new Blob(['couleurs-d-origine'], { type: 'image/jpeg' })
const AMELIOREE = new Blob(['lumiere-corrigee-un-peu-plus-lourde'], { type: 'image/jpeg' })
vi.mock('../couvertures/photo', async (original) => ({
  ...(await original<typeof import('../couvertures/photo')>()),
  lireImage: async () => ({ ok: true, image: { source: {}, largeur: 3000, hauteur: 4000, apercu: 'blob:photo', liberer: () => {} } }),
}))
vi.mock('../couvertures/redressement/index.ts', () => ({
  trouverCoins: () => ({ coins: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 4000 }, { x: 0, y: 4000 }], trouve: false }),
  redresser: async () => ({ origine: ORIGINE, amelioree: AMELIOREE, largeur: 750, hauteur: 1200 }),
}))

const ISBN = '9782253008484'
const PHOTO = 'Prendre une photo de mon exemplaire'
const AUTRES = 'Chercher d’autres couvertures'
const SANS_IMAGE = { ok: true as const, valeur: null }
const REF = { source: 'open_library' as const, isbn: ISBN }

const SIDDHARTHA = () =>
  oeuvreFictive({ id: 'sid', titreFr: 'Siddhartha', auteurs: [{ nom: 'Hermann Hesse', role: 'auteur' }], statut: 'envie_de_lire', possession: 'a_acheter' })
const SIDDHARTHA_RANGE = () =>
  oeuvreFictive({
    id: 'sid',
    titreFr: 'Siddhartha',
    auteurs: [{ nom: 'Hermann Hesse', role: 'auteur' }],
    editions: [{ id: 'e1', isbn: null, publisher: 'Grasset', language: 'fr', format: null, translator: null, pageCount: null, couverture: null }],
    monEdition: 'e1',
  })
const SERIE = () =>
  oeuvreFictive({
    id: 'vin',
    titreFr: 'Vinland Saga',
    forme: 'manga',
    estSerie: true,
    tomes: [
      { numero: 1, titre: null, isbn: null, possession: 'possede', lecture: 'lu' },
      { numero: 2, titre: null, isbn: null, possession: 'a_acheter', lecture: 'a_lire' },
    ],
  })
const NOTICE = noticeFictive({
  titre: { valeur: 'Siddhartha', source: 'bnf' },
  auteurs: { valeur: ['Hermann Hesse'], source: 'bnf' },
  editeur: { valeur: 'Le Livre de Poche', source: 'bnf' },
  langue: { valeur: 'fr', source: 'bnf' },
})
const TOME_2 = noticeFictive({ titre: { valeur: 'Vinland saga', source: 'bnf' }, editeur: { valeur: 'Kurokawa', source: 'bnf' }, tome: { valeur: 2, source: 'bnf' } })
const PROPOSITIONS = [{ ref: { source: 'open_library' as const, numero: 9001 }, editeur: 'Grasset', collection: null, annee: 2011, langue: 'fr', source: 'open_library' as const }]
const AUTRE_EDITION = new Blob(['couverture-d-une-autre-edition'], { type: 'image/jpeg' })

/** Les catalogues connaissent le livre, mais aucun n'a de couverture pour cet ISBN. */
const sansCouverture = (notice = NOTICE) =>
  assistantFictif({
    isbn: reponseIsbnFictive({ notice, couverture: REF }),
    couverture: (demande) => ('ref' in demande && 'numero' in demande.ref ? imageFictive({ image: AUTRE_EDITION }) : SANS_IMAGE),
    autres: { ok: true, valeur: PROPOSITIONS },
  })

type Monde = { depot?: ReturnType<typeof depotFictif>; assistant?: ReturnType<typeof assistantFictif>; couvertures?: ReturnType<typeof couverturesFictives> }

async function ouvrir(hash: string, monde: Monde = {}) {
  const depot = monde.depot ?? depotFictif({ oeuvres: [SIDDHARTHA(), SERIE()] })
  const assistant = monde.assistant ?? sansCouverture()
  const couvertures = monde.couvertures ?? couverturesFictives()
  window.location.hash = hash
  render(
    <App auth={authFictif({ compte: { email: 'moi@exemple.test' } }).auth} depot={depot.depot} assistant={assistant.assistant} couvertures={couvertures.couvertures} />,
  )
  await act(async () => {})
  return { depot, assistant, couvertures }
}

const attendre = async () => {
  for (let tour = 0; tour < 4; tour++) await act(async () => void (await new Promise((suite) => setTimeout(suite, 0))))
}
const cliquer = async (nom: string | RegExp, racine: ReturnType<typeof within> = screen) => {
  await act(async () => fireEvent.click(racine.getByRole('button', { name: nom })))
  await attendre()
}
const achats = (depot: ReturnType<typeof depotFictif>) => depot.appels.ecritures.filter((e) => e.action === 'achat')
const rangees = (depot: ReturnType<typeof depotFictif>) =>
  depot.appels.ecritures.filter((e) => e.action === 'couverture').map((e) => [e.id, (e.valeur as { cible: unknown; chemin: unknown }).cible])
const apercu = () => within(screen.getByRole('region', { name: 'Couverture' }))

/** Le champ de fichier de la photo de mon exemplaire : celui de la zone « Couverture ». */
const champPhoto = () => screen.getByRole('region', { name: 'Couverture' }).querySelector('input[type="file"]') as HTMLInputElement

/** Je prends la photo, je la redresse, je la valide. */
async function prendreLaPhoto() {
  const champ = champPhoto()
  const clics = vi.spyOn(champ, 'click').mockImplementation(() => {})
  await cliquer(PHOTO)
  expect(clics).toHaveBeenCalledTimes(1)
  // L'appareil photo directement, pas la photothèque.
  expect(champ).toHaveAttribute('capture', 'environment')
  await act(async () => fireEvent.change(champ, { target: { files: [new File(['x'], 'photo.jpg', { type: 'image/jpeg' })] } }))
  await attendre()
  await cliquer('Redresser')
  await cliquer('Valider')
}

async function acheter(isbn = ISBN) {
  await cliquer('Je l’ai acheté')
  fireEvent.change(screen.getByLabelText('ISBN à 13 chiffres de mon exemplaire'), { target: { value: isbn } })
  await cliquer('Chercher ce livre')
}

beforeEach(() => {
  window.location.hash = ''
  window.scrollTo = () => {}
  Element.prototype.scrollIntoView = () => {}
  localStorage.clear()
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
  URL.createObjectURL = (image: Blob | MediaSource) => `blob:${(image as Blob).size}`
  URL.revokeObjectURL = () => {}
})

describe('« Je l’ai acheté » sans couverture trouvée', () => {
  it('propose la photo de mon exemplaire, puis d’autres couvertures, empilées', async () => {
    await ouvrir('#/oeuvre/sid')
    await acheter()
    expect(apercu().getByText('Pas de couverture trouvée : celle d’Ichnos s’affichera.')).toBeInTheDocument()
    const choix = within(apercu().getByRole('group', { name: 'Trouver une couverture' }))
    expect(choix.getAllByRole('button').map((b) => b.textContent)).toEqual([PHOTO, AUTRES])
    // Règle des panneaux : boutons empilés, pleine largeur.
    expect(apercu().getByRole('group', { name: 'Trouver une couverture' })).toHaveClass('flex-col', 'basis-full')
    // Le conseil de lumière, les premières fois.
    expect(apercu().getByText(/Lumière douce, sans flash/)).toBeInTheDocument()
  })

  it('ne propose rien de tel quand une couverture est trouvée', async () => {
    await ouvrir('#/oeuvre/sid', { assistant: assistantFictif({ isbn: reponseIsbnFictive({ notice: NOTICE, couverture: REF }), couverture: imageFictive() }) })
    await acheter()
    expect(apercu().getByText('Couverture trouvée sur Open Library.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: PHOTO })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: AUTRES })).not.toBeInTheDocument()
  })

  it('la photo validée est montrée, mais rangée seulement avec « C’est mon exemplaire », sur l’édition achetée', async () => {
    const { depot, couvertures } = await ouvrir('#/oeuvre/sid')
    await acheter()
    await prendreLaPhoto()
    expect(apercu().getByText('La photo de mon exemplaire sera gardée.')).toBeInTheDocument()
    expect(couvertures.deposees).toHaveLength(0)
    expect(achats(depot)).toHaveLength(0)

    await cliquer('C’est mon exemplaire')
    expect(couvertures.deposees).toHaveLength(1)
    expect(couvertures.deposees[0].image).toBe(AMELIOREE)
    expect(achats(depot)).toEqual([{ action: 'achat', id: 'sid', valeur: { isbn: ISBN, publisher: 'Le Livre de Poche', language: 'fr', couverture: couvertures.deposees[0].chemin } }])
  })

  it('je peux ne pas garder la photo : rien n’est rangé', async () => {
    const { depot, couvertures } = await ouvrir('#/oeuvre/sid')
    await acheter()
    await prendreLaPhoto()
    await cliquer('Ne pas la garder')
    // Les deux choix reviennent.
    expect(screen.getByRole('button', { name: PHOTO })).toBeInTheDocument()
    await cliquer('C’est mon exemplaire')
    expect(couvertures.deposees).toHaveLength(0)
    expect(achats(depot)).toEqual([{ action: 'achat', id: 'sid', valeur: { isbn: ISBN, publisher: 'Le Livre de Poche', language: 'fr' } }])
  })

  it('« Chercher d’autres couvertures » part du titre et de l’auteur, et la couverture gardée suit l’achat', async () => {
    const { assistant, couvertures } = await ouvrir('#/oeuvre/sid')
    await acheter()
    await cliquer(AUTRES)
    expect(assistant.appels.autresCouvertures).toEqual([{ titre: 'Siddhartha', auteur: 'Hermann Hesse', langue: 'fr', isbn: ISBN, editeur: 'Le Livre de Poche' }])
    const autres = within(screen.getByRole('dialog', { name: AUTRES }))
    fireEvent.click(within(autres.getByRole('list', { name: 'Couvertures proposées' })).getAllByRole('button')[0])
    await cliquer('Garder cette couverture', autres)
    expect(apercu().getByText('La couverture d’une autre édition sera gardée.')).toBeInTheDocument()
    expect(couvertures.deposees).toHaveLength(0)
    await cliquer('C’est mon exemplaire')
    expect(couvertures.deposees[0].image).toBe(AUTRE_EDITION)
  })

  it('pour un tome, seule la photo est proposée, et elle va sur ce tome', async () => {
    const { depot, couvertures } = await ouvrir('#/oeuvre/vin', { assistant: sansCouverture(TOME_2) })
    fireEvent.keyDown(within(screen.getByRole('list', { name: 'Tomes de Vinland Saga' })).getByRole('button', { name: /^Tome 2,/ }), { key: 'i' })
    await acheter('9782351423561')
    expect(screen.getByRole('button', { name: PHOTO })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: AUTRES })).not.toBeInTheDocument()
    await prendreLaPhoto()
    await cliquer('C’est mon exemplaire')
    expect(achats(depot)).toEqual([{ action: 'achat', id: 'vin', valeur: { isbn: '9782351423561', tome: 2, couverture: couvertures.deposees[0].chemin } }])
  })

  it('quand aucun catalogue ne connaît l’ISBN, la photo est proposée aussi', async () => {
    const assistant = assistantFictif({ isbn: reponseIsbnFictive({ trouve: false, notice: noticeFictive() }), autres: { ok: true, valeur: [] } })
    const { depot, couvertures } = await ouvrir('#/oeuvre/sid', { assistant })
    await acheter()
    expect(screen.getByRole('dialog', { name: 'ISBN inconnu des catalogues' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: AUTRES })).toBeInTheDocument()
    await prendreLaPhoto()
    await cliquer('Noter cet ISBN quand même')
    expect(achats(depot)).toEqual([{ action: 'achat', id: 'sid', valeur: { isbn: ISBN, couverture: couvertures.deposees[0].chemin } }])
  })

  it('quand la recherche ne répond pas, seule la photo est proposée', async () => {
    await ouvrir('#/oeuvre/sid', { assistant: assistantFictif() })
    await acheter()
    expect(screen.getByRole('dialog', { name: 'Recherche indisponible' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: PHOTO })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: AUTRES })).not.toBeInTheDocument()
  })

  it('hors connexion, les deux boutons sont grisés, avec une phrase calme', async () => {
    await ouvrir('#/oeuvre/sid')
    await acheter()
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    await act(async () => void window.dispatchEvent(new Event('offline')))
    expect(screen.getByRole('button', { name: PHOTO })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: AUTRES })).toHaveAttribute('aria-disabled', 'true')
    expect(apercu().getByText('Hors connexion : une image ne pourrait pas être rangée. Attendre le retour du réseau.')).toBeInTheDocument()
    const clics = vi.spyOn(champPhoto(), 'click').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: PHOTO }))
    expect(clics).not.toHaveBeenCalled()
  })
})

describe('« Chercher cette édition » sans couverture trouvée', () => {
  async function chercherEdition() {
    const monde = await ouvrir('#/oeuvre/sid/modifier', { depot: depotFictif({ oeuvres: [SIDDHARTHA_RANGE()] }) })
    fireEvent.change(screen.getByLabelText('ISBN'), { target: { value: ISBN } })
    await cliquer('Chercher cette édition')
    return { ...monde, panneau: within(screen.getByRole('dialog', { name: 'Ce qui a été trouvé' })) }
  }

  it('propose la photo de mon exemplaire, puis d’autres couvertures', async () => {
    const { panneau } = await chercherEdition()
    expect(within(panneau.getByRole('group', { name: 'Trouver une couverture' })).getAllByRole('button').map((b) => b.textContent)).toEqual([PHOTO, AUTRES])
  })

  it('la photo suit « Appliquer à mon édition », et n’est rangée qu’avec « Enregistrer »', async () => {
    const { depot, couvertures, panneau } = await chercherEdition()
    const champ = panneau.getByRole('region', { name: 'Couverture' }).querySelector('input[type="file"]') as HTMLInputElement
    vi.spyOn(champ, 'click').mockImplementation(() => {})
    await cliquer(PHOTO, panneau)
    await act(async () => fireEvent.change(champ, { target: { files: [new File(['x'], 'photo.jpg', { type: 'image/jpeg' })] } }))
    await attendre()
    await cliquer('Redresser')
    await cliquer('Valider')
    expect(panneau.getByText('La photo de mon exemplaire sera gardée.')).toBeInTheDocument()
    await cliquer('Appliquer à mon édition', panneau)
    expect(couvertures.deposees).toHaveLength(0)
    await cliquer('Enregistrer')
    expect(couvertures.deposees[0].image).toBe(AMELIOREE)
    expect(rangees(depot)).toEqual([['sid', { type: 'edition', edition: 'e1' }]])
  })
})

describe('« Ajouter » par ISBN sans couverture trouvée', () => {
  async function ajouter(assistant = sansCouverture()) {
    const monde = await ouvrir('#/ajouter', { depot: depotFictif(), assistant })
    fireEvent.change(screen.getByLabelText('ISBN à 13 chiffres'), { target: { value: ISBN } })
    await cliquer('Chercher ce livre')
    return monde
  }

  it('propose la photo de mon exemplaire, puis d’autres couvertures', async () => {
    await ajouter()
    expect(within(apercu().getByRole('group', { name: 'Trouver une couverture' })).getAllByRole('button').map((b) => b.textContent)).toEqual([PHOTO, AUTRES])
  })

  it('la photo est rangée à la validation de la fiche, sur mon édition', async () => {
    const { depot, couvertures } = await ajouter()
    await prendreLaPhoto()
    expect(apercu().getByText('La photo de mon exemplaire sera gardée.')).toBeInTheDocument()
    expect(couvertures.deposees).toHaveLength(0)
    await cliquer('Enregistrer')
    expect(couvertures.deposees).toHaveLength(1)
    expect(couvertures.deposees[0].image).toBe(AMELIOREE)
    expect(rangees(depot)).toEqual([['nouvelle-1', { type: 'edition', edition: expect.any(String) }]])
  })

  it('« Chercher d’autres couvertures » cherche avec le titre et l’auteur saisis', async () => {
    const { assistant } = await ajouter()
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Siddhartha, un poème indien' } })
    await cliquer(AUTRES)
    expect(assistant.appels.autresCouvertures).toEqual([{ titre: 'Siddhartha, un poème indien', auteur: 'Hermann Hesse', langue: 'fr', isbn: ISBN, editeur: 'Le Livre de Poche' }])
  })

  it('pour l’ISBN d’un tome, seule la photo est proposée, et elle va sur ce tome', async () => {
    const { depot } = await ajouter(sansCouverture(TOME_2))
    expect(screen.getByRole('button', { name: PHOTO })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: AUTRES })).not.toBeInTheDocument()
    await prendreLaPhoto()
    await cliquer('Enregistrer')
    expect(rangees(depot)).toEqual([['nouvelle-1', { type: 'tome', numero: 2 }]])
  })

  it('par le titre seul, sans exemplaire en main, rien de tel n’est proposé', async () => {
    const assistant = assistantFictif({ titre: reponseTitreFictive([resultatFictif({ titre: 'Siddhartha', auteurs: { valeur: ['Hermann Hesse'], source: 'bnf' } })]) })
    await ouvrir('#/ajouter', { depot: depotFictif(), assistant })
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Siddhartha' } })
    await cliquer('Chercher cette œuvre')
    await cliquer(/Siddhartha, de Hermann Hesse/)
    expect(screen.getByRole('region', { name: 'Couverture' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: PHOTO })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: AUTRES })).not.toBeInTheDocument()
  })
})
