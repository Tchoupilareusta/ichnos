import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../App'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { authFictif } from '../session/auth.fictif'

const SIDDHARTHA = oeuvreFictive({
  id: 'sid',
  titreFr: 'Siddhartha',
  titreOriginal: 'Siddhartha',
  langueOriginale: 'de',
  annee: 1922,
  forme: 'roman_court',
  synopsis: 'Un fils de brahmane cherche par lui-même.',
  longueur: 'court',
  auteurs: [{ nom: 'Hermann Hesse', role: 'auteur' }],
  etiquettes: [
    { genre: 'theme', nom: 'Sagesse', coeur: false },
    { genre: 'theme', nom: 'Paix intérieure', coeur: true },
    { genre: 'atmosphere', nom: 'Contemplative', coeur: false },
    { genre: 'atmosphere', nom: 'Lumineuse', coeur: false },
  ],
  editions: [
    { id: 'e1', isbn: '9782253012184', publisher: 'Le Livre de Poche', language: 'fr', format: 'poche', translator: 'Joseph Delage', pageCount: null },
    { id: 'e2', isbn: null, publisher: 'Penguin', language: 'en', format: null, translator: null, pageCount: null },
  ],
  monEdition: 'e1',
})

const SERIE = oeuvreFictive({
  id: 'vin',
  titreFr: 'Vinland Saga',
  forme: 'manga',
  estSerie: true,
  auteurs: [{ nom: 'Makoto Yukimura', role: 'auteur' }],
  tomes: [
    { numero: 1, titre: null, isbn: null, possession: 'possede', lecture: 'a_lire' },
    { numero: 2, titre: null, isbn: null, possession: 'a_acheter', lecture: 'a_lire' },
    { numero: 3, titre: null, isbn: null, possession: 'non_possede', lecture: 'a_lire' },
  ],
  medias: [{ id: 'm1', type: 'anime', titre: null, saisons: 2, episodes: 48, episodesVus: null, statut: 'a_voir' }],
})

async function ouvrirFiche(faux: ReturnType<typeof depotFictif>, id: string) {
  window.location.hash = `#/oeuvre/${id}`
  render(<App auth={authFictif({ compte: { email: 'moi@exemple.test' } }).auth} depot={faux.depot} />)
  await act(async () => {})
}

const choisirDansMenu = async (nomBouton: RegExp, choix: string) => {
  fireEvent.click(screen.getByRole('button', { name: nomBouton }))
  await act(async () => fireEvent.click(screen.getByRole('menuitemradio', { name: choix })))
}

beforeEach(() => {
  window.location.hash = ''
  Element.prototype.scrollIntoView = () => {}
  window.scrollTo = () => {}
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
})

describe('fiche d’une œuvre', () => {
  it('montre titres, auteur, thèmes en liste, résumé et la ligne genre · longueur · atmosphère', async () => {
    await ouvrirFiche(depotFictif({ oeuvres: [SIDDHARTHA] }), 'sid')
    expect(screen.getByRole('heading', { level: 1, name: 'Siddhartha' })).toBeInTheDocument()
    expect(screen.getByText('Hermann Hesse', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('1922')).toBeInTheDocument()
    const themes = screen.getByRole('list', { name: 'Thèmes' })
    expect(within(themes).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Sagesse', 'Paix intérieure'])
    expect(within(themes).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Un fils de brahmane cherche par lui-même.')).toBeInTheDocument()
    expect(
      screen.getByText('Roman court · lecture courte · traduit de l’allemand · contemplative, lumineuse'),
    ).toBeInTheDocument()
    expect(document.title).toBe('Siddhartha · Ichnos')
  })

  it('présente statut et possession en menus, à la première personne', async () => {
    const faux = depotFictif({ oeuvres: [SIDDHARTHA] })
    await ouvrirFiche(faux, 'sid')
    const statut = screen.getByRole('button', { name: 'Statut de lecture : À découvrir. Changer' })
    expect(statut).toHaveAttribute('aria-haspopup', 'menu')
    await choisirDansMenu(/Statut de lecture/, 'Envie de lire')
    expect(faux.appels.ecritures).toContainEqual({ action: 'statut', id: 'sid', valeur: 'envie_de_lire' })
    expect(await screen.findByRole('button', { name: 'Statut de lecture : Envie de lire. Changer' })).toBeInTheDocument()

    await choisirDansMenu(/Possession : Je ne l’ai pas/, 'Je l’ai')
    expect(faux.appels.ecritures).toContainEqual({ action: 'possession', id: 'sid', valeur: 'possede' })
    expect(await screen.findByRole('button', { name: 'Possession : Je l’ai. Changer' })).toBeInTheDocument()
  })

  it('montre mon édition et permet d’en changer ; en anglais, le titre original passe en premier', async () => {
    const faux = depotFictif({
      oeuvres: [{ ...SIDDHARTHA, titreFr: 'Siddhartha (fr)', langueOriginale: 'en', titreOriginal: 'Siddhartha (en)' }],
    })
    await ouvrirFiche(faux, 'sid')
    expect(screen.getByRole('heading', { level: 1, name: 'Siddhartha (fr)' })).toBeInTheDocument()
    // Mon édition tient en une ligne ; traduction et ISBN se déplient.
    expect(screen.getByText('Le Livre de Poche · poche · français')).toBeInTheDocument()
    expect(screen.getByText('Détails').closest('details')).toHaveTextContent('Joseph Delage')
    // L'ISBN s'affiche avec ses tirets ; VoiceOver le lit chiffre par chiffre, sans les tirets.
    const isbn = screen.getByText('978-2-253-01218-4')
    expect(isbn).toHaveAttribute('aria-hidden', 'true')
    expect(isbn.parentElement).toHaveTextContent('9 7 8 2 2 5 3 0 1 2 1 8 4')
    await choisirDansMenu(/Mon édition : Le Livre de Poche/, 'Penguin · anglais')
    expect(faux.appels.ecritures).toContainEqual({ action: 'monEdition', id: 'sid', valeur: 'e2' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Siddhartha (en)' })).toBeInTheDocument()
  })

  it('ne montre pas un champ d’édition inconnu', async () => {
    await ouvrirFiche(depotFictif({ oeuvres: [SIDDHARTHA] }), 'sid')
    expect(screen.queryByText(/pages/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /édition/ })).not.toBeInTheDocument()
  })
})

describe('série', () => {
  const grille = () => screen.getByRole('list', { name: 'Tomes de Vinland Saga' })
  const tome = (nom: string) => within(grille()).getByRole('button', { name: nom })
  const barre = () => screen.queryByRole('region', { name: 'Actions sur les tomes sélectionnés' })
  const SERIE_LONGUE = {
    ...SERIE,
    tomes: Array.from({ length: 12 }, (_, i) => ({ numero: i + 1, titre: null, isbn: null, possession: 'non_possede' as const, lecture: 'a_lire' as const })),
  }

  it('calcule « J’en ai une partie », mène aux tomes ; une ligne d’aide au-dessus de la grille, la légende dessous', async () => {
    await ouvrirFiche(depotFictif({ oeuvres: [SERIE] }), 'vin')
    const resume = screen.getByRole('button', { name: 'Possession : J’en ai une partie. Voir mes tomes' })
    expect(resume).not.toHaveAttribute('aria-haspopup')
    fireEvent.click(resume)
    expect(document.activeElement).toBe(document.getElementById('mes-tomes'))
    expect(within(grille()).getAllByRole('button')).toHaveLength(3)
    const aide = screen.getByText('Toucher ou glisser pour sélectionner.')
    const legende = screen.getByText('Possession', { selector: 'dt' })
    expect(screen.getByText('Lecture', { selector: 'dt' })).toBeInTheDocument()
    expect(screen.getByText('Appui long sur un tome : ses détails.')).toBeInTheDocument()
    // L'aide vient avant la grille, la légende après.
    expect(aide.compareDocumentPosition(grille()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(grille().compareDocumentPosition(legende) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // « Tout sélectionner » n'a de sens qu'une fois la sélection commencée : il est dans le menu.
    expect(screen.queryByRole('button', { name: 'Tout sélectionner' })).not.toBeInTheDocument()
    // Plus de menu « Tous les tomes » ni de lien « Changer plusieurs tomes ».
    expect(screen.queryByRole('button', { name: /Tous les tomes/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Changer plusieurs tomes' })).not.toBeInTheDocument()
  })

  it('sélectionne d’abord, d’un toucher : la barre d’actions prend la place de la barre du bas', async () => {
    await ouvrirFiche(depotFictif({ oeuvres: [SERIE] }), 'vin')
    expect(screen.getAllByRole('navigation', { name: 'Navigation principale' })).toHaveLength(2)
    const tome3 = tome('Tome 3, à lire, je ne l’ai pas')
    expect(tome3).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(tome3)
    expect(tome3).toHaveAttribute('aria-pressed', 'true')
    expect(barre()).toHaveTextContent('1 tome sélectionné')
    expect(screen.getByText('1 tome sélectionné. Actions en bas de l’écran.')).toBeInTheDocument()
    // La barre latérale de l'iPad reste ; la barre du bas de l'iPhone laisse la place.
    expect(screen.getAllByRole('navigation', { name: 'Navigation principale' })).toHaveLength(1)
    fireEvent.click(tome('Tome 1, à lire, je l’ai'))
    expect(barre()).toHaveTextContent('2 tomes sélectionnés')
    // Toucher à nouveau désélectionne.
    fireEvent.click(tome3)
    expect(tome3).toHaveAttribute('aria-pressed', 'false')
    // La croix du menu annule la sélection.
    fireEvent.click(within(barre()!).getByRole('button', { name: 'Annuler la sélection' }))
    expect(barre()).not.toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Navigation principale' })).toHaveLength(2)
    // Ni « Détails du tome » ni grand bouton « Annuler la sélection » dans le menu.
    fireEvent.click(tome3)
    expect(within(barre()!).queryByRole('button', { name: 'Détails du tome' })).not.toBeInTheDocument()
    expect(within(barre()!).getAllByRole('button', { name: /Annuler/ })).toHaveLength(1)
  })

  it('un toucher ailleurs que sur la grille et le menu vide la sélection', async () => {
    await ouvrirFiche(depotFictif({ oeuvres: [SERIE] }), 'vin')
    fireEvent.click(tome('Tome 2, à lire, à acheter'))
    // Toucher dans le menu ne la vide pas.
    fireEvent.click(within(barre()!).getByText('1 tome sélectionné'))
    expect(barre()).toBeInTheDocument()
    fireEvent.click(screen.getByRole('heading', { level: 1, name: 'Vinland Saga' }))
    expect(barre()).not.toBeInTheDocument()
    expect(tome('Tome 2, à lire, à acheter')).toHaveAttribute('aria-pressed', 'false')
  })

  it('applique un choix en une écriture ; la sélection reste, le choix s’allume, et « Annuler » remet l’état d’avant', async () => {
    const faux = depotFictif({ oeuvres: [SERIE] })
    await ouvrirFiche(faux, 'vin')
    fireEvent.click(tome('Tome 1, à lire, je l’ai'))
    fireEvent.click(tome('Tome 3, à lire, je ne l’ai pas'))
    // Possessions mélangées : rien n'est mis en avant dans ce groupe ; la lecture, commune, l'est.
    const possession = within(barre()!).getByRole('group', { name: 'Possession' })
    expect(within(possession).queryByRole('button', { name: /choisi/ })).not.toBeInTheDocument()
    expect(within(barre()!).getByRole('button', { name: 'À lire, choisi' })).toBeInTheDocument()
    await act(async () => fireEvent.click(within(barre()!).getByRole('button', { name: 'Je l’ai' })))
    // Le tome 1 l'est déjà : seul le tome 3 change.
    expect(faux.appels.ecritures).toEqual([{ action: 'reglerTomes', id: 'vin', valeur: [{ numero: 3, possession: 'possede' }] }])
    // La sélection reste, le menu aussi, et le choix s'allume tout de suite.
    expect(barre()).toHaveTextContent('2 tomes sélectionnés')
    expect(within(barre()!).getByRole('button', { name: 'Je l’ai, choisi' })).toBeInTheDocument()
    // Le message est dans le menu, avec un vrai bouton « Annuler ».
    expect(within(barre()!).getByText('Tome 3 : Je l’ai')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Tome 3, à lire, je l’ai' })).toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Annuler : Tome 3, Je l’ai' })))
    expect(faux.appels.ecritures[1]).toEqual({
      action: 'reglerTomes',
      id: 'vin',
      valeur: [{ numero: 3, possession: 'non_possede', lecture: 'a_lire' }],
    })
    expect(await screen.findByRole('button', { name: 'Tome 3, à lire, je ne l’ai pas' })).toBeInTheDocument()
    // L'état revient, et la mise en avant suit.
    expect(within(possession).queryByRole('button', { name: /choisi/ })).not.toBeInTheDocument()
  })

  it('enchaîne « Je l’ai » puis « Lu » sur les mêmes tomes, sans les resélectionner', async () => {
    const faux = depotFictif({ oeuvres: [SERIE] })
    await ouvrirFiche(faux, 'vin')
    fireEvent.click(tome('Tome 2, à lire, à acheter'))
    fireEvent.click(tome('Tome 3, à lire, je ne l’ai pas'))
    await act(async () => fireEvent.click(within(barre()!).getByRole('button', { name: 'Je l’ai' })))
    await act(async () => fireEvent.click(within(barre()!).getByRole('button', { name: 'Lu' })))
    expect(faux.appels.ecritures).toEqual([
      { action: 'reglerTomes', id: 'vin', valeur: [{ numero: 2, possession: 'possede' }, { numero: 3, possession: 'possede' }] },
      { action: 'reglerTomes', id: 'vin', valeur: [{ numero: 2, lecture: 'lu' }, { numero: 3, lecture: 'lu' }] },
    ])
    // La mise en avant suit la fiche publiée par TanStack Query (setTimeout) : l'attendre.
    expect(await within(barre()!).findByRole('button', { name: 'Lu, choisi' })).toBeInTheDocument()
    expect(within(barre()!).getByRole('button', { name: 'Je l’ai, choisi' })).toBeInTheDocument()
    expect(within(barre()!).getByText('2 tomes : Lu')).toBeInTheDocument()
    // La croix vide la sélection et emporte le message.
    fireEvent.click(within(barre()!).getByRole('button', { name: 'Annuler la sélection' }))
    expect(barre()).not.toBeInTheDocument()
    expect(screen.queryByText('2 tomes : Lu')).not.toBeInTheDocument()
  })

  it('applique « En cours » tel quel, sans cascade', async () => {
    const faux = depotFictif({ oeuvres: [SERIE] })
    await ouvrirFiche(faux, 'vin')
    fireEvent.click(tome('Tome 2, à lire, à acheter'))
    fireEvent.click(tome('Tome 3, à lire, je ne l’ai pas'))
    await act(async () => fireEvent.click(within(barre()!).getByRole('button', { name: 'En cours' })))
    expect(faux.appels.ecritures).toEqual([
      { action: 'reglerTomes', id: 'vin', valeur: [{ numero: 2, lecture: 'en_cours' }, { numero: 3, lecture: 'en_cours' }] },
    ])
    expect(await screen.findByRole('button', { name: 'Tome 1, à lire, je l’ai' })).toBeInTheDocument()
  })

  it('le choix déjà mis en avant ne change rien, et le dit sans « Annuler »', async () => {
    const faux = depotFictif({ oeuvres: [SERIE] })
    await ouvrirFiche(faux, 'vin')
    fireEvent.click(tome('Tome 1, à lire, je l’ai'))
    fireEvent.click(within(barre()!).getByRole('button', { name: 'Je l’ai, choisi' }))
    expect(screen.getByText('Déjà « Je l’ai » : rien n’a changé.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Annuler :/ })).not.toBeInTheDocument()
    expect(faux.appels.ecritures).toHaveLength(0)
  })

  it('« Tout sélectionner » dans le menu, puis Maj + clic et Échap au clavier', async () => {
    await ouvrirFiche(depotFictif({ oeuvres: [SERIE] }), 'vin')
    fireEvent.click(tome('Tome 2, à lire, à acheter'))
    fireEvent.click(within(barre()!).getByRole('button', { name: 'Tout sélectionner' }))
    expect(barre()).toHaveTextContent('3 tomes sélectionnés')
    expect(within(barre()!).queryByRole('button', { name: 'Tout sélectionner' })).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(barre()).not.toBeInTheDocument()
    fireEvent.click(tome('Tome 1, à lire, je l’ai'))
    fireEvent.click(tome('Tome 3, à lire, je ne l’ai pas'), { shiftKey: true })
    expect(barre()).toHaveTextContent('3 tomes sélectionnés')
  })

  it('demande confirmation au-delà de dix tomes qui changent vraiment', async () => {
    const faux = depotFictif({ oeuvres: [SERIE_LONGUE] })
    await ouvrirFiche(faux, 'vin')
    fireEvent.click(within(grille()).getAllByRole('button')[0])
    fireEvent.click(within(barre()!).getByRole('button', { name: 'Tout sélectionner' }))
    fireEvent.click(within(barre()!).getByRole('button', { name: 'Lu' }))
    const dialogue = screen.getByRole('dialog', { name: 'Changer 12 tomes ?' })
    expect(dialogue).toHaveTextContent('Ils seront marqués « Lu ». « Annuler » restera possible quelques secondes.')
    expect(faux.appels.ecritures).toHaveLength(0)
    await act(async () => fireEvent.click(within(dialogue).getByRole('button', { name: 'Changer' })))
    expect(faux.appels.ecritures).toHaveLength(1)
    expect(faux.appels.ecritures[0].valeur).toHaveLength(12)
    expect(screen.getByText('12 tomes : Lu')).toBeInTheDocument()
  })

  it('ouvre les détails d’un tome au clavier (touche I), avec son ISBN et « Je l’ai acheté »', async () => {
    const avecIsbn = { ...SERIE, tomes: SERIE.tomes.map((t) => (t.numero === 3 ? { ...t, isbn: '9782351420010' } : t)) }
    await ouvrirFiche(depotFictif({ oeuvres: [avecIsbn] }), 'vin')
    const tome3 = tome('Tome 3, à lire, je ne l’ai pas')
    expect(tome3).toHaveAttribute('aria-keyshortcuts', 'I')
    fireEvent.keyDown(tome3, { key: 'i' })
    const panneau = screen.getByRole('dialog', { name: 'Tome 3' })
    expect(within(panneau).getByText('978-2-35142-001-0')).toBeInTheDocument()
    expect(within(panneau).getByRole('button', { name: 'Je l’ai acheté' })).toBeInTheDocument()
    // Le panneau ne change plus la lecture ni la possession : c'est le rôle de la barre.
    expect(within(panneau).queryByRole('radio')).not.toBeInTheDocument()
    // Ouvrir les détails ne change pas la sélection.
    expect(tome3).toHaveAttribute('aria-pressed', 'false')
  })

  it('hors connexion : la sélection reste possible, les bulles sont grisées', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    const faux = depotFictif({ oeuvres: [SERIE] })
    await ouvrirFiche(faux, 'vin')
    fireEvent.click(tome('Tome 3, à lire, je ne l’ai pas'))
    const bulle = within(barre()!).getByRole('button', { name: 'Je l’ai' })
    expect(bulle).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(bulle)
    expect(faux.appels.ecritures).toHaveLength(0)
    expect(barre()).toHaveTextContent('Hors connexion : les tomes pourront changer au retour du réseau.')
  })

  describe('gestes', () => {
    // jsdom n'a ni PointerEvent ni elementFromPoint : un petit équivalent suffit pour ces tests.
    class FauxPointeur extends MouseEvent {
      pointerId: number
      pointerType: string
      constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 1
        this.pointerType = init.pointerType ?? 'touch'
      }
    }
    let sousLeDoigt: Element | null = null
    beforeEach(() => {
      vi.stubGlobal('PointerEvent', FauxPointeur)
      document.elementFromPoint = () => sousLeDoigt
    })
    afterEach(() => {
      vi.unstubAllGlobals()
      vi.useRealTimers()
    })

    /*
     * Ce que Safari envoie sur iPhone : au toucher, pointerdown puis touchstart. Dès qu'il prend le
     * geste pour un défilement, il cesse d'envoyer les événements de pointeur, sans toujours envoyer
     * pointercancel ; les touchmove, eux, continuent. Les gestes au doigt ne doivent donc compter que
     * sur les événements tactiles. fireEvent rend false quand l'événement a été empêché (preventDefault).
     */
    const poser = (el: Element, x: number, y: number) => {
      fireEvent(el, new FauxPointeur('pointerdown', { bubbles: true, clientX: x, clientY: y, button: 0 }))
      return fireEvent.touchStart(el, { touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] })
    }
    const glisser = (depart: Element, sous: Element, x: number, y: number) => {
      sousLeDoigt = sous
      return fireEvent.touchMove(depart, { touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] })
    }
    const lever = (depart: Element, x: number, y: number) =>
      fireEvent.touchEnd(depart, { touches: [], changedTouches: [{ clientX: x, clientY: y }] })

    it('au doigt, un glissement vertical annule l’appui long, même quand Safari cesse d’envoyer les événements de pointeur', async () => {
      vi.useFakeTimers()
      await ouvrirFiche(depotFictif({ oeuvres: [SERIE] }), 'vin')
      const [t1, t2] = within(grille()).getAllByRole('button')
      poser(t1, 10, 10)
      // Ni pointermove ni pointercancel : seuls les touchmove arrivent.
      expect(glisser(t1, t1, 11, 22)).toBe(true)
      glisser(t1, t2, 12, 60)
      act(() => vi.advanceTimersByTime(800))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      lever(t1, 12, 60)
      expect(barre()).not.toBeInTheDocument()
    })

    it('au doigt, un glissement d’abord horizontal sélectionne les tomes parcourus, sans laisser la page défiler', async () => {
      vi.useFakeTimers()
      await ouvrirFiche(depotFictif({ oeuvres: [SERIE] }), 'vin')
      const [t1, t2, t3] = within(grille()).getAllByRole('button')
      poser(t1, 10, 10)
      // Dès que le geste penche vers l'horizontale, la page ne défile plus.
      expect(glisser(t1, t1, 14, 11)).toBe(false)
      expect(glisser(t1, t1, 22, 12)).toBe(false)
      glisser(t1, t2, 70, 14)
      glisser(t1, t3, 130, 40)
      // Pendant le glissement, rien ne couvre la grille.
      expect(barre()).not.toBeInTheDocument()
      act(() => vi.advanceTimersByTime(800))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(lever(t1, 130, 40)).toBe(false)
      fireEvent.click(grille())
      expect([t1, t2, t3].map((t) => t.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true'])
      // Le doigt levé, le menu apparaît.
      expect(barre()).toHaveTextContent('3 tomes sélectionnés')
    })

    it('au doigt, un appui immobile d’une demi-seconde ouvre les détails sans changer la sélection', async () => {
      vi.useFakeTimers()
      await ouvrirFiche(depotFictif({ oeuvres: [SERIE] }), 'vin')
      const t2 = tome('Tome 2, à lire, à acheter')
      poser(t2, 10, 10)
      glisser(t2, t2, 13, 12) // un léger tremblement ne l'annule pas
      act(() => vi.advanceTimersByTime(500))
      expect(screen.getByRole('dialog', { name: 'Tome 2' })).toBeInTheDocument()
      // Le doigt levé ne devient pas un clic (il fermerait le panneau).
      expect(lever(t2, 13, 12)).toBe(false)
      expect(t2).toHaveAttribute('aria-pressed', 'false')
    })

    it('au doigt, un toucher sélectionne le tome au moment où le doigt se lève', async () => {
      vi.useFakeTimers()
      await ouvrirFiche(depotFictif({ oeuvres: [SERIE] }), 'vin')
      const t3 = tome('Tome 3, à lire, je ne l’ai pas')
      poser(t3, 10, 10)
      expect(lever(t3, 10, 10)).toBe(true)
      fireEvent.click(t3)
      expect(t3).toHaveAttribute('aria-pressed', 'true')
      act(() => vi.advanceTimersByTime(800))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('à la souris, tout glissement sélectionne', async () => {
      await ouvrirFiche(depotFictif({ oeuvres: [SERIE] }), 'vin')
      const [t1, t2, t3] = within(grille()).getAllByRole('button')
      const souris = (type: string, el: Element, x: number, y: number) =>
        fireEvent(el, new FauxPointeur(type, { bubbles: true, clientX: x, clientY: y, button: 0, pointerType: 'mouse' }))
      souris('pointerdown', t1, 10, 10)
      sousLeDoigt = t2
      souris('pointermove', t1, 12, 40)
      sousLeDoigt = t3
      souris('pointermove', t1, 110, 40)
      souris('pointerup', t3, 110, 40)
      fireEvent.click(grille())
      expect([t1, t2, t3].map((t) => t.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true'])
    })
  })

  it('montre le média associé', async () => {
    await ouvrirFiche(depotFictif({ oeuvres: [SERIE] }), 'vin')
    expect(screen.getByText('Anime · 2 saisons · 48 épisodes')).toBeInTheDocument()
  })
})
describe('suppression', () => {
  it('ne se fait plus depuis la fiche, qui se termine sur l’œuvre', async () => {
    await ouvrirFiche(depotFictif({ oeuvres: [SIDDHARTHA] }), 'sid')
    expect(screen.queryByRole('button', { name: /Supprimer/ })).not.toBeInTheDocument()
  })
})

describe('hors connexion', () => {
  it('laisse consulter la fiche mais grise les modifications, avec un mot d’explication', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    const faux = depotFictif({ oeuvres: [SIDDHARTHA] })
    await ouvrirFiche(faux, 'sid')
    expect(screen.getByRole('heading', { level: 1, name: 'Siddhartha' })).toBeInTheDocument()
    const statut = screen.getByRole('button', { name: /Statut de lecture/ })
    expect(statut).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(statut)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByText('Le statut et la possession pourront changer au retour du réseau.')).toBeInTheDocument()
  })
})

describe('œuvre introuvable', () => {
  it('le dit simplement et propose de revenir à la bibliothèque', async () => {
    await ouvrirFiche(depotFictif(), 'absente')
    expect(screen.getByText('Cette œuvre n’est pas, ou plus, dans ma bibliothèque.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Revenir à ma bibliothèque' })).toHaveAttribute('href', '#/bibliotheque')
  })
})
