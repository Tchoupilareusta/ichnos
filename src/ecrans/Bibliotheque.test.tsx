import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../App'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { authFictif } from '../session/auth.fictif'

const CATALOGUE = [
  oeuvreFictive({ id: '1', titreFr: 'La Chute', auteurs: [{ nom: 'Albert Camus', role: 'auteur' }] }),
  oeuvreFictive({
    id: '2',
    titreFr: '1984',
    titreOriginal: 'Nineteen Eighty-Four',
    langueOriginale: 'en',
    auteurs: [{ nom: 'George Orwell', role: 'auteur' }],
    editions: [{ id: 'e2', isbn: null, publisher: null, language: 'en', format: null, translator: null, pageCount: null }],
    monEdition: 'e2',
  }),
]

async function ouvrir(faux: ReturnType<typeof depotFictif>) {
  window.location.hash = '#/bibliotheque'
  render(<App auth={authFictif({ compte: { email: 'moi@exemple.test' } }).auth} depot={faux.depot} />)
  await screen.findByRole('heading', { level: 1, name: 'Ma bibliothèque' })
  // Laisse la première lecture de la bibliothèque aboutir.
  await act(async () => {})
}

beforeEach(() => {
  window.location.hash = ''
  window.scrollTo = () => {}
})

describe('bibliothèque vide', () => {
  it('propose d’installer le catalogue de départ ou d’ajouter une œuvre', async () => {
    await ouvrir(depotFictif())
    expect(screen.getByText(/Ma bibliothèque est encore vide\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Installer le catalogue de départ' })).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Ajouter une œuvre' })).toHaveAttribute('href', '#/ajouter')
  })

  it('installe le catalogue puis affiche les œuvres, sans rien compter', async () => {
    const faux = depotFictif({ catalogue: CATALOGUE })
    await ouvrir(faux)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Installer le catalogue de départ' })))

    expect(faux.appels.installerCatalogue).toBe(1)
    expect(await screen.findByText('Le catalogue de départ est installé.')).toBeInTheDocument()
    const liens = within(screen.getByRole('main')).getAllByRole('link', { name: /Camus|Orwell/ })
    expect(liens).toHaveLength(2)
    expect(liens[0]).toHaveTextContent('La Chute')
    expect(liens[0]).toHaveTextContent('Albert Camus')
    expect(liens[0]).toHaveAttribute('href', '#/oeuvre/1')
    // Mon édition est en anglais : le titre original passe en premier.
    expect(liens[1]).toHaveTextContent('Nineteen Eighty-Four')
    expect(screen.queryByRole('button', { name: 'Installer le catalogue de départ' })).not.toBeInTheDocument()
    expect(screen.getByRole('main').textContent).not.toMatch(/\d+ (œuvres|livres)/)
  })

  it('ne lance qu’une installation, même si j’appuie deux fois', async () => {
    const faux = depotFictif({ catalogue: CATALOGUE })
    faux.attente.active = true
    await ouvrir(faux)
    const bouton = screen.getByRole('button', { name: 'Installer le catalogue de départ' })
    await act(async () => fireEvent.click(bouton))
    expect(bouton).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Installation en cours…')).toBeInTheDocument()
    await act(async () => fireEvent.click(bouton))
    expect(faux.appels.installerCatalogue).toBe(1)

    await act(async () => faux.attente.liberer())
    expect(await screen.findByText('Le catalogue de départ est installé.')).toBeInTheDocument()
  })

  it.each([
    ['reseau', 'Pas de connexion à internet : l’installation attendra le retour du réseau.'],
    ['inconnu', 'L’installation n’a pas abouti, et rien n’a été enregistré. Je réessaie dans un instant.'],
  ] as const)('dit ce qui s’est passé quand l’installation échoue (%s)', async (echec, message) => {
    const faux = depotFictif({ installation: { ok: false, echec } })
    await ouvrir(faux)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Installer le catalogue de départ' })))
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    // Rien n'a changé : je peux réessayer.
    expect(screen.getByRole('button', { name: 'Installer le catalogue de départ' })).not.toHaveAttribute('aria-busy')
  })

  it('n’installe rien une seconde fois si la bibliothèque est déjà remplie ailleurs', async () => {
    const faux = depotFictif({ installation: { ok: false, echec: 'deja' } })
    await ouvrir(faux)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Installer le catalogue de départ' })))
    expect(screen.getByRole('alert')).toHaveTextContent('le catalogue n’a pas été installé une seconde fois')
    expect(faux.appels.listerOeuvres).toBe(2)
  })
})

describe('bibliothèque remplie', () => {
  it('affiche les œuvres et ne propose plus le catalogue', async () => {
    await ouvrir(depotFictif({ oeuvres: CATALOGUE }))
    expect(within(screen.getByRole('main')).getAllByRole('link', { name: /Camus|Orwell/ })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Installer le catalogue de départ' })).not.toBeInTheDocument()
    expect(screen.queryByText('Le catalogue de départ est installé.')).not.toBeInTheDocument()
  })
})

describe('bibliothèque injoignable', () => {
  it('l’explique calmement et permet de réessayer', async () => {
    const faux = depotFictif({ lecture: { ok: false, echec: 'reseau' } })
    await ouvrir(faux)
    expect(screen.getByRole('alert')).toHaveTextContent('Pas de connexion à internet : ma bibliothèque s’affichera au retour du réseau.')
    expect(screen.queryByRole('button', { name: 'Installer le catalogue de départ' })).not.toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Réessayer' })))
    expect(faux.appels.listerOeuvres).toBe(2)
  })
})

describe('recherche et filtres', () => {
  const COLLECTION = [
    oeuvreFictive({
      id: 'etr',
      titreFr: 'L’Étranger',
      auteurs: [{ nom: 'Albert Camus', role: 'auteur' }],
      etiquettes: [{ genre: 'theme', nom: 'Absurde', coeur: false }],
      statut: 'envie_de_lire',
    }),
    oeuvreFictive({ id: 'momo', titreFr: 'Momo', auteurs: [{ nom: 'Michael Ende', role: 'auteur' }], possession: 'a_acheter' }),
    oeuvreFictive({
      id: 'vin',
      titreFr: 'Vinland Saga',
      estSerie: true,
      tomes: [
        { numero: 1, titre: null, isbn: null, possession: 'possede' },
        { numero: 2, titre: null, isbn: null, possession: 'a_acheter' },
      ],
    }),
  ]
  const titresAffiches = () =>
    within(screen.getByRole('main'))
      .queryAllByRole('link')
      .map((lien) => lien.getAttribute('href'))
      .filter((href) => href?.startsWith('#/oeuvre/'))

  it('cherche par titre ou auteur, sans accents', async () => {
    await ouvrir(depotFictif({ oeuvres: COLLECTION }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Chercher un titre ou un auteur' }), { target: { value: 'etranger' } })
    expect(titresAffiches()).toEqual(['#/oeuvre/etr'])
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ende' } })
    expect(titresAffiches()).toEqual(['#/oeuvre/momo'])
    expect(window.location.hash).toBe('#/bibliotheque?q=ende')
  })

  it('« Envie de lire » est ma liste d’envies : une pastille toujours visible, qui se retire d’un second appui', async () => {
    await ouvrir(depotFictif({ oeuvres: COLLECTION }))
    const statuts = screen.getByRole('group', { name: 'Statut de lecture' })
    const envies = within(statuts).getByRole('button', { name: 'Envie de lire, ma liste d’envies' })
    fireEvent.click(envies)
    expect(envies).toHaveAttribute('aria-pressed', 'true')
    expect(titresAffiches()).toEqual(['#/oeuvre/etr'])
    expect(window.location.hash).toBe('#/bibliotheque?statut=envie_de_lire')
    // Un autre statut remplace le premier : une seule pastille choisie à la fois.
    fireEvent.click(within(statuts).getByRole('button', { name: 'En cours' }))
    expect(envies).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(within(statuts).getByRole('button', { name: 'En cours' }))
    expect(titresAffiches()).toHaveLength(3)
  })

  it('« À acheter » retrouve aussi la série où il manque des tomes', async () => {
    await ouvrir(depotFictif({ oeuvres: COLLECTION }))
    const possession = screen.getByRole('group', { name: 'Possession' })
    fireEvent.click(within(possession).getByRole('button', { name: 'À acheter' }))
    expect(titresAffiches()).toEqual(['#/oeuvre/momo', '#/oeuvre/vin'])
    fireEvent.click(within(possession).getByRole('button', { name: 'Je l’ai' }))
    expect(titresAffiches()).toEqual(['#/oeuvre/vin'])
    fireEvent.click(within(possession).getByRole('button', { name: 'Je l’ai' }))
    expect(titresAffiches()).toHaveLength(3)
  })

  it('range les filtres du plus utile au moins utile : statut et possession en pastilles, le reste dans une feuille', async () => {
    await ouvrir(depotFictif({ oeuvres: COLLECTION }))
    expect(within(screen.getByRole('main')).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual([
      'Statut de lecture',
      'Possession',
    ])
    expect(
      within(screen.getByRole('group', { name: 'Statut de lecture' }))
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['En cours', 'Envie de lire', 'Terminé', 'À découvrir', 'En pause'])
    const bouton = screen.getByRole('button', { name: 'Filtres' })
    expect(bouton).toHaveAttribute('aria-haspopup', 'dialog')
    fireEvent.click(bouton)
    const feuille = screen.getByRole('dialog', { name: 'Plus de filtres' })
    const champs = within(feuille).getAllByRole('combobox').map((champ) => (champ as HTMLSelectElement).labels?.[0]?.textContent)
    expect(champs).toEqual(['Genre', 'Thème', 'Atmosphère', 'Auteur'])
    // Pas de phrase d'aide : la feuille ne contient que les quatre listes et le bouton.
    expect(feuille.querySelectorAll('p')).toHaveLength(0)
  })

  it('montre les autres filtres choisis, et de quoi tout effacer', async () => {
    await ouvrir(depotFictif({ oeuvres: COLLECTION }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'camus' } })
    fireEvent.click(screen.getByRole('button', { name: 'Filtres' }))
    fireEvent.change(screen.getByLabelText('Thème'), { target: { value: 'Absurde' } })
    fireEvent.click(screen.getByRole('button', { name: 'Voir mes livres' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(titresAffiches()).toEqual(['#/oeuvre/etr'])
    const choisis = screen.getByRole('list', { name: 'Autres filtres choisis' })
    expect(within(choisis).getByRole('button', { name: 'Retirer le filtre Absurde' })).toBeInTheDocument()
    fireEvent.click(within(choisis).getByRole('button', { name: /^Tout effacer/ }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(titresAffiches()).toHaveLength(3)
    expect(screen.queryByRole('list', { name: 'Autres filtres choisis' })).not.toBeInTheDocument()
  })

  it('retrouve les filtres de l’adresse (au retour depuis une fiche)', async () => {
    window.location.hash = '#/bibliotheque?theme=Absurde'
    render(<App auth={authFictif({ compte: { email: 'moi@exemple.test' } }).auth} depot={depotFictif({ oeuvres: COLLECTION }).depot} />)
    await act(async () => {})
    expect(titresAffiches()).toEqual(['#/oeuvre/etr'])
    expect(screen.getByRole('button', { name: 'Retirer le filtre Absurde' })).toBeInTheDocument()
  })

  it('le dit simplement quand ma liste d’envies est vide', async () => {
    await ouvrir(depotFictif({ oeuvres: COLLECTION.filter((o) => o.statut !== 'envie_de_lire') }))
    fireEvent.click(screen.getByRole('button', { name: 'Envie de lire, ma liste d’envies' }))
    expect(screen.getByText(/Ma liste d’envies est vide pour l’instant./)).toBeInTheDocument()
  })

  it('dit calmement quand rien ne correspond, et propose de tout effacer', async () => {
    await ouvrir(depotFictif({ oeuvres: COLLECTION }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } })
    expect(screen.getByText('Rien dans ma bibliothèque ne correspond à cette recherche.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tout effacer' }))
    expect(titresAffiches()).toHaveLength(3)
  })

  it('parle de filtres, pas de recherche, quand ce sont les filtres qui ne donnent rien', async () => {
    await ouvrir(depotFictif({ oeuvres: COLLECTION }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Statut de lecture' })).getByRole('button', { name: 'En pause' }))
    expect(screen.getByText('Rien ne correspond à ces filtres.')).toBeInTheDocument()
  })
})
