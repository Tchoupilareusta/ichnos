import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from '../App'
import type { Etiquette, OeuvreDetaillee } from '../bibliotheque/depot'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { authFictif } from '../session/auth.fictif'

// L'écran Découvrir (docs/reference.md §5 et §7) : le sélecteur des envies, trois idées, « Pas
// maintenant » et son « Annuler », « Commencer » avec sa confirmation, « D'autres idées », les
// états vides et hors connexion. L'algorithme lui-même est testé dans src/recommandations.

const genre = (nom: string): Etiquette => ({ genre: 'genre', nom, coeur: false })
const theme = (nom: string, coeur = false): Etiquette => ({ genre: 'theme', nom, coeur })
const atmosphere = (nom: string): Etiquette => ({ genre: 'atmosphere', nom, coeur: false })

/** Cinq œuvres d'auteurs, de genres et de tons différents : la variété ne les écarte pas. */
function bibliotheque(etats: Record<string, Partial<OeuvreDetaillee>> = {}): OeuvreDetaillee[] {
  const oeuvre = (id: string, titreFr: string, auteur: string, tonalite: number, etiquettes: Etiquette[], longueur: 'court' | 'moyen' | 'long' = 'moyen') =>
    oeuvreFictive({
      id,
      titreFr,
      tonalite,
      longueur,
      auteurs: [{ nom: auteur, role: 'auteur' }],
      etiquettes,
      ...etats[id],
    })
  return [
    oeuvre('momo', 'Momo', 'Michael Ende', 5, [genre('Conte philosophique'), theme('Rapport au temps', true), atmosphere('Douce')], 'court'),
    oeuvre('sid', 'Siddhartha', 'Hermann Hesse', 4, [genre('Roman philosophique'), theme('Quête de sens', true), atmosphere('Sereine')], 'court'),
    oeuvre('1984', 'Le Meilleur des mondes', 'Aldous Huxley', 1, [genre('Dystopie'), theme('Liberté'), atmosphere('Oppressante')]),
    oeuvre('chute', 'La Chute', 'Albert Camus', 2, [genre('Littérature existentielle'), theme('Culpabilité'), atmosphere('Introspective')]),
    oeuvre('vinland', 'Vinland Saga', 'Makoto Yukimura', 3, [genre('Manga'), theme('Violence'), atmosphere('Épique')], 'long'),
  ]
}

function ouvrir({ oeuvres = bibliotheque(), adresse = '#/decouvrir', ecriture }: { oeuvres?: OeuvreDetaillee[]; adresse?: string; ecriture?: { ok: false; echec: 'reseau' } } = {}) {
  window.location.hash = adresse
  const faux = depotFictif({ oeuvres, ecriture })
  render(<App auth={authFictif({ compte: { email: 'moi@exemple.test' } }).auth} depot={faux.depot} />)
  return faux
}

const cartes = () => screen.queryAllByRole('link', { name: /^Voir la fiche de / })
const titres = () => cartes().map((lien) => lien.getAttribute('aria-label')!.replace('Voir la fiche de ', ''))
const enLigne = (valeur: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => valeur })

beforeEach(() => {
  window.location.hash = ''
  enLigne(true)
})

describe('Découvrir : mon envie du moment', () => {
  it('ouvre sur « Surprends-moi » et propose les six envies dans un menu', async () => {
    ouvrir()
    const selecteur = await screen.findByRole('button', { name: 'Mon envie du moment : Surprends-moi. Changer' })
    expect(selecteur).toHaveAttribute('aria-haspopup', 'menu')
    fireEvent.click(selecteur)
    const menu = screen.getByRole('menu', { name: 'Mon envie du moment' })
    expect(within(menu).getAllByRole('menuitemradio').map((choix) => choix.textContent)).toEqual([
      'Surprends-moi',
      'Quelque chose de réconfortant',
      'Une réflexion philosophique',
      'Remets mes idées en question',
      'Une lecture courte',
      'Changer d’univers',
    ])
  })

  it('porte l’envie choisie dans l’adresse, pour que le retour arrière fonctionne', async () => {
    ouvrir()
    fireEvent.click(await screen.findByRole('button', { name: /^Mon envie du moment/ }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Une lecture courte' }))
    expect(window.location.hash).toBe('#/decouvrir?envie=lecture_courte')
    expect(await screen.findByRole('button', { name: 'Mon envie du moment : Une lecture courte. Changer' })).toBeInTheDocument()
    await waitFor(() => expect(titres().sort()).toEqual(['Momo', 'Siddhartha']))
  })
})

describe('Découvrir : les idées', () => {
  it('montre trois idées, chacune un lien vers sa fiche, avec sa phrase et ses deux boutons nommés', async () => {
    ouvrir()
    await waitFor(() => expect(cartes()).toHaveLength(3))
    for (const titre of titres()) {
      expect(screen.getByRole('button', { name: `Commencer ${titre}` })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: `Pas maintenant pour ${titre}` })).toBeInTheDocument()
    }
    const liste = screen.getByRole('list', { name: 'Idées de lecture' })
    // Aucun chiffre, aucun score à l'écran.
    expect(liste.textContent).not.toMatch(/\d/)
    expect(screen.getByText('« Pas maintenant » met l’idée de côté quelques semaines. Rien d’autre ne change.')).toBeInTheDocument()
  })

  it('« Pas maintenant » met l’idée de côté, la remplace à sa place, et « Annuler » la remet', async () => {
    const faux = ouvrir()
    await waitFor(() => expect(cartes()).toHaveLength(3))
    const avant = titres()
    fireEvent.click(screen.getByRole('button', { name: `Pas maintenant pour ${avant[1]}` }))

    await waitFor(() => expect(faux.appels.ecritures).toContainEqual({ action: 'ideeDeCote', id: expect.any(String), valeur: 'surprise' }))
    const apres = titres()
    expect(apres).toHaveLength(3)
    expect(apres).not.toContain(avant[1])
    expect([apres[0], apres[2]]).toEqual([avant[0], avant[2]])
    expect(screen.getByText('Idée mise de côté')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: `Annuler : reprendre ${avant[1]}` }))
    await waitFor(() => expect(titres()).toEqual(avant))
    expect(faux.appels.ecritures.at(-1)).toMatchObject({ action: 'ideeReprise' })
    expect(faux.deCote()).toEqual([])
  })

  it('« Pas maintenant » qui échoue remet l’idée et le dit', async () => {
    ouvrir({ ecriture: { ok: false, echec: 'reseau' } })
    await waitFor(() => expect(cartes()).toHaveLength(3))
    const avant = titres()
    fireEvent.click(screen.getByRole('button', { name: `Pas maintenant pour ${avant[0]}` }))
    expect(await screen.findByText('L’idée n’a pas pu être mise de côté.')).toBeInTheDocument()
    expect(titres()).toEqual(avant)
  })

  it('« Commencer » demande une confirmation, puis laisse une ligne calme « En cours. »', async () => {
    const faux = ouvrir()
    await waitFor(() => expect(cartes()).toHaveLength(3))
    const [premier] = titres()

    fireEvent.click(screen.getByRole('button', { name: `Commencer ${premier}` }))
    const dialogue = screen.getByRole('dialog', { name: `Commencer ${premier} ?` })
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Pas tout de suite' }))
    expect(faux.appels.ecritures).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: `Commencer ${premier}` }))
    fireEvent.click(within(screen.getByRole('dialog', { name: `Commencer ${premier} ?` })).getByRole('button', { name: 'Oui, commencer' }))
    await waitFor(() => expect(faux.appels.ecritures).toEqual([{ action: 'statut', id: expect.any(String), valeur: 'en_cours' }]))
    expect(await screen.findByText('En cours.')).toBeInTheDocument()
    // La ligne reste à sa place même une fois les idées relues : l'œuvre n'est plus candidate.
    await waitFor(() => expect(faux.oeuvres().find((o) => o.titreFr === premier)?.statut).toBe('en_cours'))
    expect(screen.getByText('En cours.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `Commencer ${premier}` })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: `Voir la fiche de ${premier}` })).toHaveLength(1)
  })

  it('garde la phrase des cartes voisines quand une idée est commencée', async () => {
    const faux = ouvrir()
    await waitFor(() => expect(cartes()).toHaveLength(3))
    const phrases = () => cartes().map((lien) => lien.querySelector('[id$="-phrase"]')?.textContent)
    const [premier] = titres()
    const avant = phrases().slice(1)
    fireEvent.click(screen.getByRole('button', { name: `Commencer ${premier}` }))
    fireEvent.click(within(screen.getByRole('dialog', { name: `Commencer ${premier} ?` })).getByRole('button', { name: 'Oui, commencer' }))
    await waitFor(() => expect(faux.oeuvres().find((o) => o.titreFr === premier)?.statut).toBe('en_cours'))
    await screen.findByText('En cours.')
    // Laisser les idées se relire avec la nouvelle « dernière lecture ».
    await act(() => new Promise((fin) => setTimeout(fin, 50)))
    expect(phrases().slice(1)).toEqual(avant)
  })

  it('dit « Reprendre » pour un livre en pause, jamais en premier', async () => {
    ouvrir({ oeuvres: bibliotheque({ chute: { statut: 'en_pause' }, momo: { statut: 'termine' }, sid: { statut: 'termine' }, '1984': { statut: 'termine' } }) })
    await waitFor(() => expect(titres()).toEqual(['Vinland Saga', 'La Chute']))
    expect(screen.getByRole('button', { name: 'Reprendre La Chute' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commencer Vinland Saga' })).toBeInTheDocument()
  })

  it('« D’autres idées » montre celles pas encore vues, puis « Revoir depuis le début »', async () => {
    ouvrir()
    await waitFor(() => expect(cartes()).toHaveLength(3))
    const premiere = titres()
    fireEvent.click(screen.getByRole('button', { name: 'D’autres idées' }))
    await waitFor(() => expect(titres()).toHaveLength(2))
    const seconde = titres()
    expect(seconde.filter((t) => premiere.includes(t))).toEqual([])
    expect(screen.getByText('Toutes les idées pour cette envie ont été vues.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Revoir depuis le début' }))
    await waitFor(() => expect(titres()).toEqual(premiere))
  })
})

describe('Découvrir : états vides', () => {
  it('bibliothèque vide : la phrase d’attente, sans bouton', async () => {
    ouvrir({ oeuvres: [] })
    expect(
      await screen.findByText('Dès que ma bibliothèque aura quelques œuvres à découvrir, des idées selon mon humeur apparaîtront ici.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'D’autres idées' })).not.toBeInTheDocument()
  })

  it('tout est lu ou en cours : le dit, et propose d’ajouter une œuvre', async () => {
    const lues = Object.fromEntries(['momo', 'sid', '1984', 'chute', 'vinland'].map((id) => [id, { statut: 'termine' as const }]))
    ouvrir({ oeuvres: bibliotheque(lues) })
    expect(await screen.findByText('Tout ce qui est dans ma bibliothèque est lu ou en cours.')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Ajouter une œuvre' })).toHaveAttribute('href', '#/ajouter')
  })

  it('deux idées seulement : les deux, et la phrase calme, sans compléter', async () => {
    ouvrir({ adresse: '#/decouvrir?envie=lecture_courte' })
    expect(await screen.findByText('Deux idées seulement pour cette envie, pour l’instant.')).toBeInTheDocument()
    expect(cartes()).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'D’autres idées' })).not.toBeInTheDocument()
  })

  it('aucune idée pour cette envie : la phrase, le sélecteur juste au-dessus, pas de bouton', async () => {
    ouvrir({ oeuvres: bibliotheque({ momo: { statut: 'termine' }, sid: { statut: 'termine' } }), adresse: '#/decouvrir?envie=lecture_courte' })
    expect(await screen.findByText('Aucune idée pour cette envie pour l’instant.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Mon envie du moment/ })).toBeInTheDocument()
    expect(cartes()).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /autres idées|depuis le début/ })).not.toBeInTheDocument()
  })

  it('« Changer d’univers » sans lecture récente : le dit', async () => {
    ouvrir({ adresse: '#/decouvrir?envie=changer_d_univers' })
    expect(await screen.findByText('Cette envie part de mes dernières lectures : rien de récent pour l’instant.')).toBeInTheDocument()
  })

  it('une envie inconnue dans l’adresse revient à « Surprends-moi »', async () => {
    ouvrir({ adresse: '#/decouvrir?envie=nimporte' })
    expect(await screen.findByRole('button', { name: 'Mon envie du moment : Surprends-moi. Changer' })).toBeInTheDocument()
  })
})

describe('Découvrir hors connexion', () => {
  it('montre les idées, grise « Commencer » et « Pas maintenant », et garde « D’autres idées »', async () => {
    const faux = ouvrir()
    await waitFor(() => expect(cartes()).toHaveLength(3))
    act(() => {
      enLigne(false)
      window.dispatchEvent(new Event('offline'))
    })
    const [premier] = titres()
    const commencer = screen.getByRole('button', { name: `Commencer ${premier}` })
    const pasMaintenant = screen.getByRole('button', { name: `Pas maintenant pour ${premier}` })
    expect(commencer).toHaveAttribute('aria-disabled', 'true')
    expect(pasMaintenant).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(commencer)
    fireEvent.click(pasMaintenant)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(faux.appels.ecritures).toEqual([])
    expect(screen.getByText('Hors connexion : ces choix reviendront avec le réseau.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'D’autres idées' }))
    await waitFor(() => expect(titres()).toHaveLength(2))
  })
})

describe('Découvrir : mise en page des cartes', () => {
  // jsdom ne calcule pas de mise en page : ces tests gardent les causes des défauts vus sur iPhone
  // (couverture étirée à la hauteur du texte, titres coupés au milieu d'un mot sans tiret).
  it('garde la couverture à sa largeur fixe, alignée en haut, et coupe les titres à la française', async () => {
    ouvrir()
    await waitFor(() => expect(cartes()).toHaveLength(3))
    for (const lien of cartes()) {
      const couverture = lien.querySelector('[data-etat]')!
      expect(couverture).toHaveClass('self-start', 'shrink-0', 'aspect-[5/8]')
      expect(couverture.className).toMatch(/w-\[\d+px\]/)
      const titre = lien.querySelector('h3')!
      expect(titre).toHaveClass('coupure-francaise')
      expect(titre.className).not.toMatch(/anywhere|break-all/)
    }
  })

  it('met « Commencer » et « Pas maintenant » sur une seule ligne', async () => {
    ouvrir()
    await waitFor(() => expect(cartes()).toHaveLength(3))
    const rang = screen.getAllByRole('button', { name: /^Commencer / })[0].parentElement!
    expect(rang).toHaveClass('flex')
    expect(rang).not.toHaveClass('flex-wrap')
  })
})

describe('Découvrir : titre cité dans la phrase', () => {
  it('met en italique le titre de l’œuvre citée, et le reste de la phrase en romain', async () => {
    const ilYA = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString()
    // Le Meilleur des mondes, sombre, terminé il y a deux jours : les lumineuses le citent.
    ouvrir({
      oeuvres: bibliotheque({
        '1984': {
          statut: 'termine',
          historique: [
            { type: 'commence', valeur: null, date: ilYA(10), precision: 'jour' },
            { type: 'termine', valeur: null, date: ilYA(2), precision: 'jour' },
          ],
        },
      }),
    })
    await waitFor(() => expect(cartes().length).toBeGreaterThan(0))
    const cites = [...document.querySelectorAll('[data-idee] cite')]
    expect(cites.length).toBeGreaterThan(0)
    for (const cite of cites) {
      expect(cite).toHaveTextContent('Le Meilleur des mondes')
      expect(cite).toHaveClass('italic')
      expect(cite.parentElement?.textContent).toMatch(/après Le Meilleur des mondes/)
    }
  })
})
