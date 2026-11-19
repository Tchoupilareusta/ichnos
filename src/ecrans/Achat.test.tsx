import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../App'
import { assistantFictif, imageFictive, noticeFictive, reponseIsbnFictive } from '../ajout/assistant.fictif'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { couverturesFictives } from '../couvertures/stockage.fictif'
import { authFictif } from '../session/auth.fictif'

const ISBN = '9782070360024'
const REF = { source: 'open_library' as const, numero: 15166217 }

const ETRANGER = () =>
  oeuvreFictive({
    id: 'etr',
    titreFr: 'L’Étranger',
    auteurs: [{ nom: 'Albert Camus', role: 'auteur' }],
    synopsis: 'Un homme, un soleil, un procès.',
    statut: 'envie_de_lire',
    possession: 'a_acheter',
  })
const PESTE = () =>
  oeuvreFictive({
    id: 'peste',
    titreFr: 'La Peste',
    editions: [{ id: 'p1', isbn: '9782070360420', publisher: 'Gallimard', language: 'fr', format: null, translator: null, pageCount: null }],
  })
const SERIE = () =>
  oeuvreFictive({
    id: 'vin',
    titreFr: 'Vinland Saga',
    forme: 'manga',
    estSerie: true,
    tomes: [
      { numero: 1, titre: null, isbn: '9782351423554', possession: 'possede', lecture: 'lu' },
      { numero: 2, titre: null, isbn: '9782351423561', possession: 'a_acheter', lecture: 'en_cours' },
      { numero: 3, titre: null, isbn: null, possession: 'non_possede', lecture: 'a_lire' },
    ],
  })

const NOTICE = noticeFictive({
  titre: { valeur: 'L’étranger', source: 'bnf' },
  auteurs: { valeur: ['Albert Camus'], source: 'bnf' },
  editeur: { valeur: 'Gallimard', source: 'bnf' },
  pages: { valeur: 186, source: 'google_books' },
  langue: { valeur: 'fr', source: 'bnf' },
})
const trouve = (notice = NOTICE, image = imageFictive()) =>
  assistantFictif({ isbn: reponseIsbnFictive({ notice, couverture: REF }), couverture: image })

type Monde = { depot?: ReturnType<typeof depotFictif>; assistant?: ReturnType<typeof assistantFictif>; couvertures?: ReturnType<typeof couverturesFictives> }

async function ouvrirFiche(id: string, monde: Monde = {}) {
  const depot = monde.depot ?? depotFictif({ oeuvres: [ETRANGER(), PESTE(), SERIE()] })
  const assistant = monde.assistant ?? trouve()
  const couvertures = monde.couvertures ?? couverturesFictives()
  window.location.hash = `#/oeuvre/${id}`
  render(
    <App
      auth={authFictif({ compte: { email: 'moi@exemple.test' } }).auth}
      depot={depot.depot}
      assistant={assistant.assistant}
      couvertures={couvertures.couvertures}
    />,
  )
  await act(async () => {})
  return { depot, assistant, couvertures }
}

const attendre = () => act(async () => void (await new Promise((suite) => setTimeout(suite, 0))))
const panneau = () => within(screen.getByRole('dialog'))
const achats = (depot: ReturnType<typeof depotFictif>) => depot.appels.ecritures.filter((e) => e.action === 'achat')

async function saisirIsbn(isbn: string) {
  fireEvent.change(panneau().getByLabelText('ISBN à 13 chiffres de mon exemplaire'), { target: { value: isbn } })
  await act(async () => fireEvent.click(panneau().getByRole('button', { name: 'Chercher ce livre' })))
  await attendre()
}

async function ouvrirAchat() {
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Je l’ai acheté' })))
}

async function ouvrirAchatDuTome(numero: number) {
  fireEvent.click(within(screen.getByRole('list', { name: 'Tomes de Vinland Saga' })).getByRole('button', { name: new RegExp(`^Tome ${numero} `) }))
  await act(async () => fireEvent.click(panneau().getByRole('button', { name: 'Je l’ai acheté' })))
}

const valider = async (nom = 'C’est mon exemplaire') => {
  await act(async () => fireEvent.click(panneau().getByRole('button', { name: nom })))
  await attendre()
}

beforeEach(() => {
  window.location.hash = ''
  window.scrollTo = () => {}
  Element.prototype.scrollIntoView = () => {}
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
  URL.createObjectURL = () => 'blob:apercu'
  URL.revokeObjectURL = () => {}
})

describe('« Je l’ai acheté » : un livre', () => {
  it('propose l’action près de la possession, pour un livre que je n’ai pas encore', async () => {
    await ouvrirFiche('etr')
    expect(screen.getByRole('button', { name: 'Je l’ai acheté' })).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('ne la propose pas pour un livre que j’ai déjà, ni sur la fiche d’une série', async () => {
    const depot = depotFictif({ oeuvres: [{ ...ETRANGER(), possession: 'possede' }, SERIE()] })
    await ouvrirFiche('etr', { depot })
    expect(screen.queryByRole('button', { name: 'Je l’ai acheté' })).not.toBeInTheDocument()
  })

  it('demande l’ISBN de mon exemplaire, avec le même champ que l’ajout automatique', async () => {
    await ouvrirFiche('etr')
    await ouvrirAchat()
    expect(screen.getByRole('dialog', { name: 'Je l’ai acheté' })).toBeInTheDocument()
    const champ = panneau().getByLabelText('ISBN à 13 chiffres de mon exemplaire')
    expect(champ).toHaveAttribute('inputmode', 'numeric')
    expect(champ).toHaveAccessibleDescription(/Tirets et espaces acceptés/)
  })

  it('refuse un ISBN faux sans rien chercher', async () => {
    const { assistant, depot } = await ouvrirFiche('etr')
    await ouvrirAchat()
    await saisirIsbn('9782070360025')
    expect(panneau().getByLabelText('ISBN à 13 chiffres de mon exemplaire')).toHaveAccessibleDescription(/Cet ISBN ne semble pas juste/)
    await saisirIsbn('2070360024')
    expect(panneau().getByLabelText('ISBN à 13 chiffres de mon exemplaire')).toHaveAccessibleDescription(/Il me faut l’ISBN à 13 chiffres/)
    expect(assistant.appels.chercherIsbn).toHaveLength(0)
    expect(achats(depot)).toHaveLength(0)
  })

  it('montre ce qui a été trouvé, avec la source de chaque information, sans rien enregistrer', async () => {
    const { assistant, depot, couvertures } = await ouvrirFiche('etr')
    await ouvrirAchat()
    await saisirIsbn('978-2-07-036002-4')
    expect(assistant.appels.chercherIsbn).toEqual([ISBN])
    expect(screen.getByRole('dialog', { name: 'Ce qui a été trouvé' })).toBeInTheDocument()
    const trouvees = panneau().getByRole('list', { name: 'Ce que disent les catalogues' })
    expect(within(trouvees).getAllByRole('listitem').map((ligne) => ligne.textContent)).toEqual([
      'Éditeur : Gallimard, d’après la BnF',
      'Pages : 186, d’après Google Books',
      'Langue : français, d’après la BnF',
    ])
    // La couverture de cette édition, cherchée par l'ISBN dans les deux sources.
    expect(assistant.appels.couverture).toEqual([{ isbn: ISBN }])
    expect(panneau().getByText('Couverture trouvée sur Open Library.')).toBeInTheDocument()
    expect(achats(depot)).toHaveLength(0)
    expect(couvertures.deposees).toHaveLength(0)
  })

  it('à la validation, range la couverture puis note l’achat en un seul appel', async () => {
    const { depot, couvertures } = await ouvrirFiche('etr')
    await ouvrirAchat()
    await saisirIsbn(ISBN)
    await valider()
    expect(couvertures.deposees).toHaveLength(1)
    expect(achats(depot)).toEqual([
      { action: 'achat', id: 'etr', valeur: { isbn: ISBN, publisher: 'Gallimard', language: 'fr', page_count: 186, couverture: couvertures.deposees[0].chemin } },
    ])
    // Aucune autre écriture : ni statut, ni possession à part, ni édition à part.
    expect(depot.appels.ecritures).toHaveLength(1)
    expect(depot.appels.enregistrerOeuvre).toHaveLength(0)
  })

  it('après la validation, la fiche montre « Je l’ai » et mon édition, et VoiceOver l’annonce', async () => {
    await ouvrirFiche('etr')
    await ouvrirAchat()
    await saisirIsbn(ISBN)
    await valider()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Possession : Je l’ai. Changer' })).toBeInTheDocument()
    expect(screen.getByText(/Gallimard · français · 186 pages/)).toBeInTheDocument()
    expect(screen.getByText('C’est noté : j’ai « L’Étranger », avec l’ISBN de mon exemplaire.')).toHaveAttribute('role', 'status')
    // Le statut de lecture n'a pas bougé, et l'action n'a plus lieu d'être.
    expect(screen.getByRole('button', { name: /Statut de lecture : Envie de lire/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Je l’ai acheté' })).not.toBeInTheDocument()
    // Le bouton qui avait ouvert le panneau n'existe plus : le focus va sur la confirmation, pas au début de la page.
    expect(document.activeElement).toBe(screen.getByText(/^C’est noté/))
  })

  it('me laisse ne pas garder la couverture trouvée', async () => {
    const { depot, couvertures } = await ouvrirFiche('etr')
    await ouvrirAchat()
    await saisirIsbn(ISBN)
    fireEvent.click(panneau().getByRole('button', { name: 'Ne pas garder cette couverture' }))
    await valider()
    expect(couvertures.deposees).toHaveLength(0)
    expect(achats(depot)[0].valeur).toEqual({ isbn: ISBN, publisher: 'Gallimard', language: 'fr', page_count: 186 })
  })

  it('dit quand la couverture trouvée est de petite taille', async () => {
    await ouvrirFiche('etr', { assistant: trouve(NOTICE, imageFictive({ largeur: 300, hauteur: 450 })) })
    await ouvrirAchat()
    await saisirIsbn(ISBN)
    expect(panneau().getByText('Couverture trouvée sur Open Library, de petite taille.')).toBeInTheDocument()
  })

  it('sans couverture trouvée, le dit et note l’achat sans image', async () => {
    const assistant = assistantFictif({ isbn: reponseIsbnFictive({ notice: NOTICE, couverture: null }) })
    const { depot } = await ouvrirFiche('etr', { assistant })
    await ouvrirAchat()
    await saisirIsbn(ISBN)
    expect(panneau().getByText(/Pas de couverture trouvée/)).toBeInTheDocument()
    expect(assistant.appels.couverture).toHaveLength(0)
    await valider()
    expect(achats(depot)[0].valeur).toEqual({ isbn: ISBN, publisher: 'Gallimard', language: 'fr', page_count: 186 })
  })

  it('me prévient si le livre trouvé ne semble pas être cette œuvre, sans m’empêcher de continuer', async () => {
    const autre = noticeFictive({ titre: { valeur: 'La Chute', source: 'bnf' }, editeur: { valeur: 'Gallimard', source: 'bnf' } })
    const { depot } = await ouvrirFiche('etr', { assistant: trouve(autre) })
    await ouvrirAchat()
    await saisirIsbn(ISBN)
    expect(panneau().getByText('Ce livre semble être « La Chute ». Je vérifie l’ISBN.')).toBeInTheDocument()
    await valider()
    expect(achats(depot)).toHaveLength(1)
  })

  it('ne prévient pas quand le titre trouvé est bien celui de l’œuvre', async () => {
    await ouvrirFiche('etr')
    await ouvrirAchat()
    await saisirIsbn(ISBN)
    expect(panneau().queryByText(/Ce livre semble être/)).not.toBeInTheDocument()
  })

  it('si l’ISBN est celui d’une autre de mes œuvres, le dit avec un lien vers sa fiche et n’enregistre rien', async () => {
    const { depot, assistant } = await ouvrirFiche('etr')
    await ouvrirAchat()
    await saisirIsbn('9782070360420')
    expect(screen.getByRole('dialog', { name: 'Déjà dans ma bibliothèque' })).toBeInTheDocument()
    expect(panneau().getByText('Cet ISBN est celui de « La Peste », déjà dans ma bibliothèque. Rien n’est enregistré.')).toBeInTheDocument()
    expect(panneau().getByRole('link', { name: 'Ouvrir sa fiche : La Peste' })).toHaveAttribute('href', '#/oeuvre/peste')
    expect(panneau().queryByRole('button', { name: 'C’est mon exemplaire' })).not.toBeInTheDocument()
    // Inutile d'interroger les catalogues pour un ISBN déjà rangé ailleurs.
    expect(assistant.appels.chercherIsbn).toHaveLength(0)
    expect(achats(depot)).toHaveLength(0)
  })

  it('si aucun catalogue ne connaît l’ISBN, propose de le noter quand même', async () => {
    const assistant = assistantFictif({ isbn: reponseIsbnFictive({ trouve: false, notice: noticeFictive() }) })
    const { depot } = await ouvrirFiche('etr', { assistant })
    await ouvrirAchat()
    await saisirIsbn(ISBN)
    expect(panneau().getByText(/Aucun catalogue ne connaît cet ISBN/)).toBeInTheDocument()
    // Le titre du panneau le dit aussi : c'est lui que VoiceOver annonce quand l'étape change.
    expect(screen.getByRole('dialog', { name: 'ISBN inconnu des catalogues' })).toBeInTheDocument()
    await valider('Noter cet ISBN quand même')
    expect(achats(depot)).toEqual([{ action: 'achat', id: 'etr', valeur: { isbn: ISBN } }])
    expect(await screen.findByRole('button', { name: 'Possession : Je l’ai. Changer' })).toBeInTheDocument()
  })

  it('si la recherche automatique ne répond pas, reste calme et laisse noter l’ISBN seul', async () => {
    const { depot } = await ouvrirFiche('etr', { assistant: assistantFictif() })
    await ouvrirAchat()
    await saisirIsbn(ISBN)
    expect(panneau().getByText(/La recherche automatique ne répond pas pour le moment/)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Recherche indisponible' })).toBeInTheDocument()
    await valider('Noter cet ISBN quand même')
    expect(achats(depot)).toEqual([{ action: 'achat', id: 'etr', valeur: { isbn: ISBN } }])
  })

  it('me laisse changer d’ISBN avant de valider', async () => {
    const { depot } = await ouvrirFiche('etr')
    await ouvrirAchat()
    await saisirIsbn(ISBN)
    fireEvent.click(panneau().getByRole('button', { name: 'Changer d’ISBN' }))
    expect(panneau().getByLabelText('ISBN à 13 chiffres de mon exemplaire')).toHaveValue(ISBN)
    expect(achats(depot)).toHaveLength(0)
  })

  it('dit calmement quand la base refuse, et garde le panneau ouvert', async () => {
    const depot = depotFictif({ oeuvres: [ETRANGER()], ecriture: { ok: false, echec: 'reseau' } })
    await ouvrirFiche('etr', { depot })
    await ouvrirAchat()
    await saisirIsbn(ISBN)
    await valider()
    expect(panneau().getByRole('alert')).toHaveTextContent('Pas de connexion à internet : l’achat n’a pas été noté.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('hors connexion, grise l’action', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    await ouvrirFiche('etr')
    const action = screen.getByRole('button', { name: 'Je l’ai acheté' })
    expect(action).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(action)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('« Je l’ai acheté » : un tome', () => {
  const TOME_2 = noticeFictive({
    titre: { valeur: 'Vinland saga', source: 'bnf' },
    editeur: { valeur: 'Kurokawa', source: 'bnf' },
    tome: { valeur: 2, source: 'bnf' },
  })

  it('propose l’action dans le panneau d’un tome que je n’ai pas, pas dans celui d’un tome que j’ai', async () => {
    await ouvrirFiche('vin')
    const tomes = within(screen.getByRole('list', { name: 'Tomes de Vinland Saga' }))
    fireEvent.click(tomes.getByRole('button', { name: /^Tome 1 / }))
    expect(panneau().queryByRole('button', { name: 'Je l’ai acheté' })).not.toBeInTheDocument()
    await act(async () => fireEvent.click(panneau().getByRole('button', { name: 'Fermer' })))
    fireEvent.click(tomes.getByRole('button', { name: /^Tome 2 / }))
    expect(panneau().getByRole('button', { name: 'Je l’ai acheté' })).toBeInTheDocument()
  })

  it('note l’ISBN de mon exemplaire, « Je l’ai » et la couverture sur ce tome, sans toucher à sa lecture', async () => {
    const { depot, couvertures } = await ouvrirFiche('vin', { assistant: trouve(TOME_2) })
    await ouvrirAchatDuTome(2)
    expect(screen.getByRole('dialog', { name: 'Je l’ai acheté' })).toHaveTextContent('Vinland Saga, tome 2')
    await saisirIsbn('9791032705544')
    await valider()
    expect(achats(depot)).toEqual([{ action: 'achat', id: 'vin', valeur: { isbn: '9791032705544', tome: 2, couverture: couvertures.deposees[0].chemin } }])
    const tomes = within(screen.getByRole('list', { name: 'Tomes de Vinland Saga' }))
    expect(await tomes.findByRole('button', { name: 'Tome 2 : en cours, je l’ai. Changer' })).toBeInTheDocument()
    expect(screen.getByText('C’est noté : j’ai le tome 2 de « Vinland Saga », avec l’ISBN de mon exemplaire.')).toHaveAttribute('role', 'status')
  })

  it('accepte l’ISBN que le tome porte déjà', async () => {
    const { depot } = await ouvrirFiche('vin', { assistant: trouve(TOME_2) })
    await ouvrirAchatDuTome(2)
    await saisirIsbn('9782351423561')
    await valider()
    expect(achats(depot)).toHaveLength(1)
  })

  it('refuse l’ISBN d’un autre tome de la série, en disant lequel', async () => {
    const { depot } = await ouvrirFiche('vin')
    await ouvrirAchatDuTome(2)
    await saisirIsbn('9782351423554')
    expect(panneau().getByText('Cet ISBN est déjà celui du tome 1. Rien n’est enregistré.')).toBeInTheDocument()
    expect(panneau().queryByRole('button', { name: 'C’est mon exemplaire' })).not.toBeInTheDocument()
    expect(achats(depot)).toHaveLength(0)
  })

  it('me prévient si le livre trouvé semble être un autre tome', async () => {
    const tome5 = noticeFictive({ titre: { valeur: 'Vinland saga', source: 'bnf' }, tome: { valeur: 5, source: 'bnf' } })
    await ouvrirFiche('vin', { assistant: trouve(tome5) })
    await ouvrirAchatDuTome(3)
    await saisirIsbn('9791032705544')
    expect(panneau().getByText('Ce livre semble être le tome 5. Je vérifie l’ISBN.')).toBeInTheDocument()
    expect(panneau().getByRole('button', { name: 'C’est mon exemplaire' })).toBeInTheDocument()
  })
})
