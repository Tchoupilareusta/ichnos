import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../App'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { authFictif } from '../session/auth.fictif'
import { texteConfirmationTomes, titreConfirmationTomes } from '../bibliotheque/tomes'

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
    { numero: 1, titre: null, isbn: null, possession: 'possede' },
    { numero: 2, titre: null, isbn: null, possession: 'a_acheter' },
    { numero: 3, titre: null, isbn: null, possession: 'non_possede' },
  ],
  medias: [{ id: 'm1', type: 'anime', titre: null, saisons: 2, episodes: 48, episodesVus: null }],
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
  it('calcule « J’en ai une partie » et change un tome à la fois', async () => {
    const faux = depotFictif({ oeuvres: [SERIE] })
    await ouvrirFiche(faux, 'vin')
    // Une série se règle tome par tome : la pastille résume et mène aux tomes, sans menu.
    const resume = screen.getByRole('button', { name: 'Possession : J’en ai une partie. Voir mes tomes' })
    expect(resume).not.toHaveAttribute('aria-haspopup')
    fireEvent.click(resume)
    expect(document.activeElement).toBe(document.getElementById('mes-tomes'))
    const tomes = screen.getByRole('list', { name: 'Tomes de Vinland Saga' })
    expect(within(tomes).getAllByRole('button')).toHaveLength(3)
    await choisirDansMenu(/^Tome 3 : Je ne l’ai pas/, 'Je l’ai')
    expect(faux.appels.ecritures).toContainEqual({ action: 'possessionTomes', id: 'vin', valeur: { choix: { de: 3, a: 3 }, possession: 'possede' } })
  })

  it('demande confirmation avant de changer tous les tomes, en disant combien vont changer', async () => {
    const faux = depotFictif({ oeuvres: [SERIE] })
    await ouvrirFiche(faux, 'vin')
    await choisirDansMenu(/^Tous les tomes/, 'Je l’ai')
    const dialogue = screen.getByRole('dialog', { name: 'Marquer les 3 tomes comme « Je l’ai » ?' })
    expect(dialogue).toHaveTextContent('2 tomes vont changer ; l’autre l’est déjà.')
    expect(faux.appels.ecritures).toHaveLength(0)
    await act(async () => fireEvent.click(within(dialogue).getByRole('button', { name: 'Confirmer' })))
    expect(faux.appels.ecritures).toEqual([{ action: 'possessionTomes', id: 'vin', valeur: { choix: 'tous', possession: 'possede' } }])
    expect(await screen.findByRole('button', { name: 'Possession : Je l’ai. Voir mes tomes' })).toBeInTheDocument()
  })

  it('change une plage de tomes', async () => {
    const faux = depotFictif({ oeuvres: [SERIE] })
    await ouvrirFiche(faux, 'vin')
    fireEvent.click(screen.getByRole('button', { name: 'Changer plusieurs tomes' }))
    fireEvent.change(screen.getByLabelText('Du tome'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Au tome'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('radio', { name: 'À acheter' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Appliquer' })))
    expect(faux.appels.ecritures).toContainEqual({
      action: 'possessionTomes',
      id: 'vin',
      valeur: { choix: { de: 2, a: 3 }, possession: 'a_acheter' },
    })
  })

  it('refuse une plage hors des tomes', async () => {
    const faux = depotFictif({ oeuvres: [SERIE] })
    await ouvrirFiche(faux, 'vin')
    fireEvent.click(screen.getByRole('button', { name: 'Changer plusieurs tomes' }))
    fireEvent.change(screen.getByLabelText('Au tome'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }))
    expect(screen.getAllByRole('alert').some((a) => a.textContent?.startsWith('Choisir des tomes entre 1 et 3'))).toBe(true)
    expect(faux.appels.ecritures).toHaveLength(0)
  })

  it('montre le média associé', async () => {
    await ouvrirFiche(depotFictif({ oeuvres: [SERIE] }), 'vin')
    expect(screen.getByText('Anime · 2 saisons · 48 épisodes')).toBeInTheDocument()
  })

  it('formule la confirmation sans erreur de nombre', () => {
    const tomes = (...p: ('possede' | 'a_acheter' | 'non_possede')[]) => p.map((possession, i) => ({ numero: i + 1, titre: null, isbn: null, possession }))
    expect(titreConfirmationTomes(tomes('non_possede'), 'possede')).toBe('Marquer le tome comme « Je l’ai » ?')
    expect(texteConfirmationTomes(tomes('non_possede', 'non_possede'), 'possede')).toBe('2 tomes vont changer.')
    expect(texteConfirmationTomes(tomes('possede', 'possede', 'non_possede'), 'possede')).toBe('1 tome va changer ; les 2 autres le sont déjà.')
    expect(texteConfirmationTomes(tomes('possede'), 'possede')).toBe('Tous les tomes le sont déjà : rien ne changera.')
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
