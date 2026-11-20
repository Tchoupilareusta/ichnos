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

﻿describe('série', () => {
  const grille = () => screen.getByRole('list', { name: 'Tomes de Vinland Saga' })
  const tome = (nom: string) => within(grille()).getByRole('button', { name: nom })
  const barre = () => screen.queryByRole('region', { name: 'Actions sur les tomes sélectionnés' })
  const SERIE_LONGUE = {
    ...SERIE,
    tomes: Array.from({ length: 12 }, (_, i) => ({ numero: i + 1, titre: null, isbn: null, possession: 'non_possede' as const, lecture: 'a_lire' as const })),
  }

  it('calcule « J’en ai une partie », mène aux tomes, et montre une légende en deux lignes', async () => {
    await ouvrirFiche(depotFictif({ oeuvres: [SERIE] }), 'vin')
    const resume = screen.getByRole('button', { name: 'Possession : J’en ai une partie. Voir mes tomes' })
    expect(resume).not.toHaveAttribute('aria-haspopup')
    fireEvent.click(resume)
    expect(document.activeElement).toBe(document.getElementById('mes-tomes'))
    expect(within(grille()).getAllByRole('button')).toHaveLength(3)
    expect(screen.getByText('Possession', { selector: 'dt' })).toBeInTheDocument()
    expect(screen.getByText('Lecture', { selector: 'dt' })).toBeInTheDocument()
    expect(screen.getByText('Toucher les tomes à changer, ou glisser le doigt dessus. Appui long : les détails d’un tome.')).toBeInTheDocument()
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
    fireEvent.click(within(barre()!).getByRole('button', { name: 'Annuler la sélection' }))
    expect(barre()).not.toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Navigation principale' })).toHaveLength(2)
  })

  it('applique un choix aux tomes sélectionnés en une écriture, puis « Annuler » remet l’état d’avant', async () => {
    const faux = depotFictif({ oeuvres: [SERIE] })
    await ouvrirFiche(faux, 'vin')
    fireEvent.click(tome('Tome 1, à lire, je l’ai'))
    fireEvent.click(tome('Tome 3, à lire, je ne l’ai pas'))
    await act(async () => fireEvent.click(within(barre()!).getByRole('button', { name: 'Je l’ai' })))
    // Le tome 1 l'est déjà : seul le tome 3 change.
    expect(faux.appels.ecritures).toEqual([{ action: 'reglerTomes', id: 'vin', valeur: [{ numero: 3, possession: 'possede' }] }])
    expect(barre()).not.toBeInTheDocument()
    expect(screen.getByText('1 tome marqué « Je l’ai »')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Tome 3, à lire, je l’ai' })).toBeInTheDocument()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Annuler : 1 tome marqué « Je l’ai »' })))
    expect(faux.appels.ecritures[1]).toEqual({
      action: 'reglerTomes',
      id: 'vin',
      valeur: [{ numero: 3, possession: 'non_possede', lecture: 'a_lire' }],
    })
    expect(await screen.findByRole('button', { name: 'Tome 3, à lire, je ne l’ai pas' })).toBeInTheDocument()
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

  it('dit simplement quand rien ne change, sans « Annuler » ni écriture', async () => {
    const faux = depotFictif({ oeuvres: [SERIE] })
    await ouvrirFiche(faux, 'vin')
    fireEvent.click(tome('Tome 1, à lire, je l’ai'))
    fireEvent.click(within(barre()!).getByRole('button', { name: 'Je l’ai' }))
    expect(screen.getByText('Ce tome est déjà « Je l’ai » : rien n’a changé.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Annuler :/ })).not.toBeInTheDocument()
    expect(faux.appels.ecritures).toHaveLength(0)
  })

  it('« Tout sélectionner », puis Maj + clic et Échap au clavier', async () => {
    await ouvrirFiche(depotFictif({ oeuvres: [SERIE] }), 'vin')
    fireEvent.click(screen.getByRole('button', { name: 'Tout sélectionner' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Tout sélectionner' }))
    fireEvent.click(within(barre()!).getByRole('button', { name: 'Lu' }))
    const dialogue = screen.getByRole('dialog', { name: 'Changer 12 tomes ?' })
    expect(dialogue).toHaveTextContent('Ils seront marqués « Lu ». « Annuler » restera possible quelques secondes.')
    expect(faux.appels.ecritures).toHaveLength(0)
    await act(async () => fireEvent.click(within(dialogue).getByRole('button', { name: 'Changer' })))
    expect(faux.appels.ecritures).toHaveLength(1)
    expect(faux.appels.ecritures[0].valeur).toHaveLength(12)
    expect(screen.getByText('12 tomes marqués « Lu »')).toBeInTheDocument()
  })

  it('ouvre les détails d’un tome depuis la barre, avec son ISBN et « Je l’ai acheté »', async () => {
    const avecIsbn = { ...SERIE, tomes: SERIE.tomes.map((t) => (t.numero === 3 ? { ...t, isbn: '9782351420010' } : t)) }
    await ouvrirFiche(depotFictif({ oeuvres: [avecIsbn] }), 'vin')
    fireEvent.click(tome('Tome 3, à lire, je ne l’ai pas'))
    fireEvent.click(within(barre()!).getByRole('button', { name: 'Détails du tome' }))
    const panneau = screen.getByRole('dialog', { name: 'Tome 3' })
    expect(within(panneau).getByText('978-2-35142-001-0')).toBeInTheDocument()
    expect(within(panneau).getByRole('button', { name: 'Je l’ai acheté' })).toBeInTheDocument()
    // Le panneau ne change plus la lecture ni la possession : c'est le rôle de la barre.
    expect(within(panneau).queryByRole('radio')).not.toBeInTheDocument()
    // Avec deux tomes sélectionnés, « Détails du tome » n'a plus de sens.
    fireEvent.click(within(panneau).getByRole('button', { name: 'Fermer' }))
    fireEvent.click(tome('Tome 1, à lire, je l’ai'))
    expect(within(barre()!).queryByRole('button', { name: 'Détails du tome' })).not.toBeInTheDocument()
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

﻿  describe('gestes au doigt', () => {
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
    const appuyer = (el: Element, x: number, y: number) => fireEvent(el, new FauxPointeur('pointerdown', { bubbles: true, clientX: x, clientY: y, button: 0 }))
    const bouger = (el: Element, x: number, y: number) => {
      sousLeDoigt = el
      fireEvent(el, new FauxPointeur('pointermove', { bubbles: true, clientX: x, clientY: y }))
    }
    const lever = (el: Element) => {
      fireEvent(el, new FauxPointeur('pointerup', { bubbles: true }))
      fireEvent.click(el)
    }

    it('un glissement d’abord horizontal sélectionne les tomes parcourus, sans clic en trop', async () => {
      await ouvrirFiche(depotFictif({ oeuvres: [SERIE] }), 'vin')
      const [t1, t2, t3] = within(grille()).getAllByRole('button')
      appuyer(t1, 10, 10)
      bouger(t1, 22, 12)
      bouger(t2, 60, 12)
      bouger(t3, 110, 14)
      lever(t3)
      expect([t1, t2, t3].map((t) => t.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true'])
      expect(barre()).toHaveTextContent('3 tomes sélectionnés')
    })

    it('un glissement d’abord vertical laisse la page défiler et ne sélectionne rien', async () => {
      await ouvrirFiche(depotFictif({ oeuvres: [SERIE] }), 'vin')
      const [t1, t2] = within(grille()).getAllByRole('button')
      appuyer(t1, 10, 10)
      bouger(t1, 12, 30)
      bouger(t2, 60, 60)
      fireEvent(t2, new FauxPointeur('pointercancel', { bubbles: true }))
      expect(barre()).not.toBeInTheDocument()
    })

    it('un appui long ouvre les détails du tome sans changer la sélection', async () => {
      vi.useFakeTimers()
      await ouvrirFiche(depotFictif({ oeuvres: [SERIE] }), 'vin')
      const t2 = tome('Tome 2, à lire, à acheter')
      appuyer(t2, 10, 10)
      act(() => vi.advanceTimersByTime(500))
      expect(screen.getByRole('dialog', { name: 'Tome 2' })).toBeInTheDocument()
      lever(t2)
      expect(t2).toHaveAttribute('aria-pressed', 'false')
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
    expect(screen.getByText('Je pourrai changer le statut et la possession au retour du réseau.')).toBeInTheDocument()
  })
})

describe('œuvre introuvable', () => {
  it('le dit simplement et propose de revenir à la bibliothèque', async () => {
    await ouvrirFiche(depotFictif(), 'absente')
    expect(screen.getByText('Cette œuvre n’est pas, ou plus, dans ma bibliothèque.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Revenir à ma bibliothèque' })).toHaveAttribute('href', '#/bibliotheque')
  })
})
