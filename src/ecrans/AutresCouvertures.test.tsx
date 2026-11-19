import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../App'
import type { Assistant, ImageTrouvee, PropositionCouverture, Reponse } from '../ajout/assistant'
import { assistantFictif, imageFictive } from '../ajout/assistant.fictif'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { couverturesFictives } from '../couvertures/stockage.fictif'
import { authFictif } from '../session/auth.fictif'

const edition = (id: string, champs: Record<string, unknown> = {}) => ({
  id,
  isbn: '9782070360024',
  publisher: 'Gallimard',
  language: 'fr',
  format: 'Folio',
  translator: null,
  pageCount: null,
  ...champs,
})
const ETRANGER = () =>
  oeuvreFictive({
    id: 'etr',
    titreFr: 'L’Étranger',
    auteurs: [
      { nom: 'Albert Camus', role: 'auteur' },
      { nom: 'Un préfacier', role: 'auteur' },
    ],
    editions: [edition('e1')],
    monEdition: 'e1',
  })
const SANS_EDITION = () => oeuvreFictive({ id: 'conte', titreFr: 'Un conte' })
const EN_ANGLAIS = () =>
  oeuvreFictive({ id: 'orwell', titreFr: '1984', titreOriginal: 'Nineteen Eighty-Four', langueOriginale: 'en', editions: [edition('e9', { isbn: null, publisher: 'Penguin', language: 'en' })], monEdition: 'e9' })
const SERIE = () =>
  oeuvreFictive({ id: 'vag', titreFr: 'Vagabond', estSerie: true, tomes: [{ numero: 1, titre: null, isbn: null, possession: 'non_possede', lecture: 'a_lire' }] })

const proposition = (rang: number, champs: Partial<PropositionCouverture> = {}): PropositionCouverture => ({
  ref: { source: 'open_library', numero: 1000 + rang },
  editeur: 'Gallimard',
  collection: 'Folio',
  annee: 2000 + rang,
  langue: 'fr',
  source: 'open_library',
  ...champs,
})
const numeroDe = (demande: unknown) => (demande as { ref?: { numero?: number } }).ref?.numero ?? 0

type Monde = { assistant?: Assistant; depot?: ReturnType<typeof depotFictif>; couvertures?: ReturnType<typeof couverturesFictives> }

async function ouvrir(hash: string, monde: Monde = {}) {
  const depot = monde.depot ?? depotFictif({ oeuvres: [ETRANGER(), SANS_EDITION(), EN_ANGLAIS(), SERIE()] })
  const couvertures = monde.couvertures ?? couverturesFictives()
  window.location.hash = hash
  render(
    <App
      auth={authFictif({ compte: { email: 'moi@exemple.test' } }).auth}
      depot={depot.depot}
      assistant={monde.assistant ?? assistantFictif().assistant}
      couvertures={couvertures.couvertures}
    />,
  )
  await act(async () => {})
  return { depot, couvertures }
}

const attendre = () => act(async () => void (await new Promise((suite) => setTimeout(suite, 0))))
const section = () => within(screen.getByRole('region', { name: 'Couverture' }))
const panneau = () => within(screen.getByRole('dialog', { name: 'Chercher d’autres couvertures' }))
const choix = () => within(panneau().getByRole('list', { name: 'Couvertures proposées' })).getAllByRole('button')
const rangees = (depot: ReturnType<typeof depotFictif>) =>
  depot.appels.ecritures.filter((e) => e.action === 'couverture').map((e) => [e.id, (e.valeur as { cible: unknown }).cible])

async function chercherAutres() {
  await act(async () => fireEvent.click(section().getByRole('button', { name: 'Chercher d’autres couvertures' })))
  await attendre()
  await attendre()
}

beforeEach(() => {
  window.location.hash = ''
  window.scrollTo = () => {}
  Element.prototype.scrollIntoView = () => {}
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
  let adresses = 0
  URL.createObjectURL = () => `blob:proposee/${++adresses}`
  URL.revokeObjectURL = () => {}
})

describe('« Chercher d’autres couvertures »', () => {
  const trouve = (propositions: PropositionCouverture[], image: (demande: unknown) => Reponse<ImageTrouvee | null> = () => imageFictive()) =>
    assistantFictif({ autres: { ok: true, valeur: propositions }, couverture: image })

  it('se trouve dans « Modifier », pour un livre comme pour une série, mais pas dans le panneau d’un tome', async () => {
    await ouvrir('#/oeuvre/vag/modifier')
    expect(section().getByRole('button', { name: 'Chercher d’autres couvertures' })).toHaveAttribute('aria-haspopup', 'dialog')
    window.location.hash = '#/oeuvre/vag'
    await act(async () => window.dispatchEvent(new HashChangeEvent('hashchange')))
    fireEvent.click(within(screen.getByRole('list', { name: 'Tomes de Vagabond' })).getByRole('button', { name: /^Tome 1 / }))
    expect(within(screen.getByRole('dialog', { name: 'Tome 1' })).queryByRole('button', { name: 'Chercher d’autres couvertures' })).not.toBeInTheDocument()
  })

  it('cherche avec le titre et le premier auteur, la langue et ce qu’on sait de mon édition', async () => {
    const faux = trouve([proposition(1)])
    await ouvrir('#/oeuvre/etr/modifier', { assistant: faux.assistant })
    await chercherAutres()
    expect(panneau().getByLabelText('Titre')).toHaveValue('L’Étranger')
    expect(panneau().getByLabelText('Auteur')).toHaveValue('Albert Camus')
    expect(faux.appels.autresCouvertures).toEqual([{ titre: 'L’Étranger', auteur: 'Albert Camus', langue: 'fr', isbn: '9782070360024', editeur: 'Gallimard' }])
    // Ni IA, ni autre recherche.
    expect(faux.appels.proposerFiche).toHaveLength(0)
    expect(faux.appels.chercherIsbn).toHaveLength(0)
  })

  it('cherche en anglais quand mon édition est en anglais, et n’envoie que ce qui est connu', async () => {
    const faux = trouve([])
    await ouvrir('#/oeuvre/orwell/modifier', { assistant: faux.assistant })
    await chercherAutres()
    expect(faux.appels.autresCouvertures).toEqual([{ titre: '1984', langue: 'en', editeur: 'Penguin' }])
  })

  it('me laisse corriger la recherche et la relancer', async () => {
    const faux = trouve([proposition(1)])
    await ouvrir('#/oeuvre/conte/modifier', { assistant: faux.assistant })
    await chercherAutres()
    fireEvent.change(panneau().getByLabelText('Titre'), { target: { value: 'Contes du jour et de la nuit' } })
    fireEvent.change(panneau().getByLabelText('Auteur'), { target: { value: 'Maupassant' } })
    await act(async () => fireEvent.click(panneau().getByRole('button', { name: 'Chercher' })))
    await attendre()
    expect(faux.appels.autresCouvertures).toEqual([
      { titre: 'Un conte', langue: 'fr' },
      { titre: 'Contes du jour et de la nuit', auteur: 'Maupassant', langue: 'fr' },
    ])
  })

  it('montre chaque couverture avec son éditeur, sa collection et son année, et dit quand elle est de petite taille', async () => {
    const faux = trouve(
      [proposition(1), proposition(2, { editeur: 'Hatier', collection: null, annee: null }), proposition(3, { editeur: null, collection: null, annee: 1957 })],
      (demande) => (numeroDe(demande) === 1002 ? imageFictive({ largeur: 300, hauteur: 450 }) : imageFictive()),
    )
    await ouvrir('#/oeuvre/etr/modifier', { assistant: faux.assistant })
    await chercherAutres()
    expect(choix().map((bouton) => bouton.querySelector('[data-role="legende"]')?.textContent)).toEqual(['Gallimard · Folio · 2001', 'Hatier · petite taille', '1957'])
    expect(choix()[1]).toHaveAccessibleName('Couverture : Hatier, de petite taille')
    // Une fois les images arrivées, VoiceOver entend combien il y en a.
    expect(panneau().getByRole('status')).toHaveTextContent('3 couvertures proposées.')
    // Chaque image est demandée par sa référence, à l'action « couverture » qui existe déjà.
    expect(faux.appels.couverture).toEqual([
      { ref: { source: 'open_library', numero: 1001 } },
      { ref: { source: 'open_library', numero: 1002 } },
      { ref: { source: 'open_library', numero: 1003 } },
    ])
  })

  it('fait disparaître les propositions dont l’image n’arrive pas', async () => {
    const faux = trouve([proposition(1), proposition(2), proposition(3)], (demande) =>
      numeroDe(demande) === 1002 ? { ok: true, valeur: null } : numeroDe(demande) === 1003 ? { ok: false, echec: 'indisponible' } : imageFictive(),
    )
    await ouvrir('#/oeuvre/etr/modifier', { assistant: faux.assistant })
    await chercherAutres()
    expect(choix()).toHaveLength(1)
    expect(panneau().getByRole('status')).toHaveTextContent('1 couverture proposée.')
  })

  it('ne demande jamais plus de trois images à la fois', async () => {
    const base = assistantFictif({ autres: { ok: true, valeur: Array.from({ length: 8 }, (_, rang) => proposition(rang + 1)) } })
    let enCours = 0
    let maximum = 0
    const liberations: (() => void)[] = []
    const assistant: Assistant = {
      ...base.assistant,
      couverture: async () => {
        maximum = Math.max(maximum, ++enCours)
        await new Promise<void>((suite) => liberations.push(suite))
        enCours--
        return imageFictive()
      },
    }
    await ouvrir('#/oeuvre/etr/modifier', { assistant })
    await chercherAutres()
    expect(enCours).toBe(3)
    while (liberations.length > 0) {
      liberations.shift()?.()
      await attendre()
    }
    expect(maximum).toBe(3)
    expect(choix()).toHaveLength(8)
  })

  it('ne garde rien sans mon choix : je touche une image, puis « Garder cette couverture »', async () => {
    const faux = trouve([proposition(1), proposition(2)])
    const { depot, couvertures } = await ouvrir('#/oeuvre/etr/modifier', { assistant: faux.assistant })
    await chercherAutres()
    expect(couvertures.deposees).toHaveLength(0)
    expect(depot.appels.ecritures).toHaveLength(0)
    const garder = panneau().getByRole('button', { name: 'Garder cette couverture' })
    expect(garder).toHaveAttribute('aria-disabled', 'true')
    await act(async () => fireEvent.click(garder))
    expect(couvertures.deposees).toHaveLength(0)

    const [premiere, seconde] = choix()
    expect(premiere).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(seconde)
    expect(choix()[1]).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(premiere)
    expect(choix().map((bouton) => bouton.getAttribute('aria-pressed'))).toEqual(['true', 'false'])

    await act(async () => fireEvent.click(panneau().getByRole('button', { name: 'Garder cette couverture' })))
    await attendre()
    expect(couvertures.deposees).toHaveLength(1)
    // Rangée là où elle s'affiche : sur mon édition.
    expect(rangees(depot)).toEqual([['etr', { type: 'edition', edition: 'e1' }]])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(section().getByRole('status')).toHaveTextContent('La nouvelle couverture est en place.')
  })

  it('pour une série, range la couverture gardée sur la série elle-même', async () => {
    const faux = trouve([proposition(1)])
    const { depot } = await ouvrir('#/oeuvre/vag/modifier', { assistant: faux.assistant })
    await chercherAutres()
    fireEvent.click(choix()[0])
    await act(async () => fireEvent.click(panneau().getByRole('button', { name: 'Garder cette couverture' })))
    await attendre()
    expect(rangees(depot)).toEqual([['vag', { type: 'oeuvre' }]])
  })

  it('« Aucune ne convient » referme sans rien garder', async () => {
    const faux = trouve([proposition(1)])
    const { depot, couvertures } = await ouvrir('#/oeuvre/etr/modifier', { assistant: faux.assistant })
    await chercherAutres()
    await act(async () => fireEvent.click(panneau().getByRole('button', { name: 'Aucune ne convient' })))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(couvertures.deposees).toHaveLength(0)
    expect(depot.appels.ecritures).toHaveLength(0)
  })

  it('dit simplement quand rien n’a été trouvé, ou quand la recherche ne répond pas', async () => {
    await ouvrir('#/oeuvre/etr/modifier', { assistant: trouve([]).assistant })
    await chercherAutres()
    expect(panneau().getByText(/Aucune autre couverture trouvée/)).toBeInTheDocument()
    expect(panneau().queryByRole('button', { name: 'Garder cette couverture' })).not.toBeInTheDocument()
  })

  it('reste calme quand la recherche automatique ne répond pas', async () => {
    await ouvrir('#/oeuvre/etr/modifier', { assistant: assistantFictif().assistant })
    await chercherAutres()
    expect(panneau().getByRole('alert')).toHaveTextContent(/La recherche automatique ne répond pas pour le moment/)
  })

  it('dit calmement quand la couverture n’a pas pu être rangée, et garde le panneau ouvert', async () => {
    const faux = trouve([proposition(1)])
    await ouvrir('#/oeuvre/etr/modifier', { assistant: faux.assistant, couvertures: couverturesFictives({ depot: { ok: false, echec: 'reseau' } }) })
    await chercherAutres()
    fireEvent.click(choix()[0])
    await act(async () => fireEvent.click(panneau().getByRole('button', { name: 'Garder cette couverture' })))
    await attendre()
    expect(panneau().getByRole('alert')).toHaveTextContent('Pas de connexion à internet : la couverture n’a pas été rangée.')
  })

  it('hors connexion, le bouton est grisé', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    const faux = trouve([proposition(1)])
    await ouvrir('#/oeuvre/etr/modifier', { assistant: faux.assistant })
    const bouton = section().getByRole('button', { name: 'Chercher d’autres couvertures' })
    expect(bouton).toHaveAttribute('aria-disabled', 'true')
    await act(async () => fireEvent.click(bouton))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(faux.appels.autresCouvertures).toHaveLength(0)
  })
})
