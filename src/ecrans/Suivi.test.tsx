import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from '../App'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import type { OeuvreDetaillee } from '../bibliotheque/depot'
import { authFictif } from '../session/auth.fictif'
import { DELAI_ENREGISTREMENT } from '../suivi/ProgressionFiche'

const ANNEE = new Date().getFullYear()

const siddhartha = (champs: Partial<OeuvreDetaillee> = {}) =>
  oeuvreFictive({
    id: 'sid',
    titreFr: 'Siddhartha',
    auteurs: [{ nom: 'Hermann Hesse', role: 'auteur' }],
    editions: [{ id: 'e1', isbn: null, publisher: 'Le Livre de Poche', language: 'fr', format: 'poche', translator: null, pageCount: 190 }],
    monEdition: 'e1',
    statut: 'en_cours',
    historique: [{ type: 'commence', valeur: null, date: `${ANNEE}-03-03T10:00:00Z`, precision: 'jour' }],
    ...champs,
  })

const LUCILIUS = oeuvreFictive({
  id: 'luc',
  titreFr: 'Lettres à Lucilius',
  auteurs: [{ nom: 'Sénèque', role: 'auteur' }],
  statut: 'en_cours',
  unite: 'lettre',
  position: 12,
})

const VINLAND = oeuvreFictive({
  id: 'vin',
  titreFr: 'Vinland Saga',
  forme: 'manga',
  estSerie: true,
  statut: 'en_cours',
  tomes: Array.from({ length: 29 }, (_, i) => ({
    numero: i + 1,
    titre: null,
    isbn: null,
    possession: 'non_possede' as const,
    lecture: i < 3 ? ('lu' as const) : i === 3 ? ('en_cours' as const) : ('a_lire' as const),
  })),
  medias: [{ id: 'm1', type: 'anime', titre: null, saisons: 2, episodes: 48, episodesVus: null, statut: 'a_voir' }],
})

async function ouvrir(faux: ReturnType<typeof depotFictif>, hash: string) {
  window.location.hash = hash
  render(<App auth={authFictif({ compte: { email: 'moi@exemple.test' } }).auth} depot={faux.depot} />)
  await act(async () => {})
}

const cliquer = async (element: HTMLElement) => act(async () => fireEvent.click(element))
const ecritures = (faux: ReturnType<typeof depotFictif>) => faux.appels.ecritures.map(({ action, valeur }) => ({ action, valeur }))

beforeEach(() => {
  window.location.hash = ''
  Element.prototype.scrollIntoView = () => {}
  window.scrollTo = () => {}
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
})

describe('progression sur la fiche', () => {
  it('propose « page » et le total de mon édition, puis enregistre une seule fois après les appuis', async () => {
    const faux = depotFictif({ oeuvres: [siddhartha()] })
    await ouvrir(faux, '#/oeuvre/sid')
    const section = screen.getByRole('region', { name: 'Ma progression' })
    expect(within(section).getByText('Rien de noté pour l’instant')).toBeInTheDocument()
    expect(within(section).getByText('En pages · sur 190, d’après mon édition')).toBeInTheDocument()

    fireEvent.click(within(section).getByRole('button', { name: 'Une page de plus' }))
    fireEvent.click(within(section).getByRole('button', { name: 'Une page de plus' }))
    expect(within(section).getByText('Page 2 sur 190')).toBeInTheDocument()
    expect(faux.appels.ecritures).toHaveLength(0)

    await act(async () => new Promise((fin) => setTimeout(fin, DELAI_ENREGISTREMENT + 100)))
    expect(ecritures(faux)).toEqual([
      { action: 'unite', valeur: { unite: 'page', total: 190 } },
      { action: 'progression', valeur: 2 },
    ])
    const barre = within(section).getByRole('progressbar', { name: 'Progression dans Siddhartha' })
    expect(barre).toHaveAttribute('aria-valuenow', '2')
    expect(barre).toHaveAttribute('aria-valuetext', 'Page 2 sur 190')
  })

  it('accepte la saisie directe, dans les bornes', async () => {
    const faux = depotFictif({ oeuvres: [siddhartha({ unite: 'page', total: 190, position: 40 })] })
    await ouvrir(faux, '#/oeuvre/sid')
    fireEvent.click(screen.getByRole('button', { name: 'Saisir la page' }))
    const champ = screen.getByLabelText('J’en suis à la page')
    fireEvent.change(champ, { target: { value: '250' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(screen.getByText('Au plus 190.')).toBeInTheDocument()
    fireEvent.change(champ, { target: { value: '120' } })
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(ecritures(faux)).toEqual([{ action: 'progression', valeur: 120 }])
  })

  it('propose doucement « J’ai terminé ce livre ? » au total, sans le faire à ma place', async () => {
    const faux = depotFictif({ oeuvres: [siddhartha({ unite: 'page', total: 190, position: 190 })] })
    await ouvrir(faux, '#/oeuvre/sid')
    expect(screen.getByText('La fin est atteinte. Marquer ce livre comme terminé ?')).toBeInTheDocument()
    expect(faux.appels.ecritures).toHaveLength(0)
    await cliquer(screen.getByRole('button', { name: 'Oui, je l’ai terminé' }))
    expect(ecritures(faux)).toEqual([{ action: 'statut', valeur: 'termine' }])

    // Puis mon ressenti, sans obligation.
    const panneau = screen.getByRole('dialog', { name: 'Mon ressenti' })
    await cliquer(within(panneau).getByRole('button', { name: 'Beau moment' }))
    expect(ecritures(faux)).toContainEqual({ action: 'appreciation', valeur: 'beau_moment' })
    expect(screen.queryByRole('dialog', { name: 'Mon ressenti' })).not.toBeInTheDocument()
  })

  it('change l’unité ; une autre unité remet la position à zéro', async () => {
    const faux = depotFictif({ oeuvres: [siddhartha({ unite: 'page', total: 190, position: 40 })] })
    await ouvrir(faux, '#/oeuvre/sid')
    fireEvent.click(screen.getByRole('button', { name: 'Changer l’unité et le total' }))
    const panneau = screen.getByRole('dialog', { name: 'Comment je compte' })
    fireEvent.click(within(panneau).getByRole('radio', { name: 'Lettre' }))
    expect(within(panneau).getByText('Avec une autre unité, ma position repartira de zéro.')).toBeInTheDocument()
    expect(within(panneau).getByLabelText('Total (facultatif)')).toHaveValue('')
    await cliquer(within(panneau).getByRole('button', { name: 'Enregistrer' }))
    expect(ecritures(faux)).toEqual([{ action: 'unite', valeur: { unite: 'lettre', total: null } }])
    expect(await screen.findByText('En lettres, sans total')).toBeInTheDocument()
  })

  it('n’apparaît que pour un livre en cours ou en pause', async () => {
    await ouvrir(depotFictif({ oeuvres: [siddhartha({ statut: 'a_decouvrir', historique: [] })] }), '#/oeuvre/sid')
    expect(screen.queryByRole('region', { name: 'Ma progression' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Mon parcours' })).not.toBeInTheDocument()
  })
})

describe('statut, parcours et ressenti sur la fiche', () => {
  it('propose mon ressenti quand je passe le livre en « Terminé », et « Plus tard » ne choisit rien', async () => {
    const faux = depotFictif({ oeuvres: [siddhartha()] })
    await ouvrir(faux, '#/oeuvre/sid')
    fireEvent.click(screen.getByRole('button', { name: /^Statut de lecture/ }))
    await cliquer(screen.getByRole('menuitemradio', { name: 'Terminé' }))
    const panneau = screen.getByRole('dialog', { name: 'Mon ressenti' })
    await cliquer(within(panneau).getByRole('button', { name: 'Plus tard' }))
    expect(ecritures(faux)).toEqual([{ action: 'statut', valeur: 'termine' }])
    // Mon parcours dit la fin, en quelques mots.
    expect(await screen.findByText(/^Commencé le 3 mars · terminé le /)).toBeInTheDocument()
  })

  it('montre le ressenti choisi, le retire par un lien visible, et l’annonce à VoiceOver', async () => {
    const faux = depotFictif({ oeuvres: [siddhartha({ statut: 'termine', appreciation: 'marque' })] })
    await ouvrir(faux, '#/oeuvre/sid')
    const mot = screen.getByRole('button', { name: 'M’a marqué' })
    expect(mot).toHaveAttribute('aria-pressed', 'true')
    expect(mot).toHaveAccessibleDescription('Toucher deux fois pour retirer')
    expect(screen.getByRole('button', { name: 'Beau moment' })).toHaveAttribute('aria-pressed', 'false')
    await cliquer(screen.getByRole('button', { name: 'Retirer mon ressenti « M’a marqué »' }))
    expect(ecritures(faux)).toEqual([{ action: 'appreciation', valeur: null }])
    await waitFor(() => expect(screen.getByRole('button', { name: 'M’a marqué' })).toHaveAttribute('aria-pressed', 'false'))
  })

  it('raconte mon parcours et mes relectures, sans aucun chiffre de performance', async () => {
    const historique = [
      { type: 'commence' as const, valeur: null, date: `${ANNEE}-03-03T10:00:00Z`, precision: 'jour' as const },
      { type: 'progression' as const, valeur: 80, date: `${ANNEE}-03-10T10:00:00Z`, precision: 'jour' as const },
      { type: 'termine' as const, valeur: 190, date: `${ANNEE}-04-20T10:00:00Z`, precision: 'jour' as const },
      { type: 'commence' as const, valeur: null, date: `${ANNEE}-06-02T10:00:00Z`, precision: 'jour' as const },
    ]
    await ouvrir(depotFictif({ oeuvres: [siddhartha({ historique })] }), '#/oeuvre/sid')
    const parcours = screen.getByRole('region', { name: 'Mon parcours' })
    expect(within(parcours).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Commencé le 3 mars · terminé le 20 avril',
      'Relecture commencée le 2 juin',
    ])
  })

  it('me laisse noter que j’ai terminé un livre « en 2019 », sans rien inventer', async () => {
    const faux = depotFictif({ oeuvres: [siddhartha({ statut: 'termine', historique: [] })] })
    await ouvrir(faux, '#/oeuvre/sid')
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter la date de fin' }))
    const panneau = screen.getByRole('dialog', { name: 'Quand l’ai-je terminé ?' })
    expect(within(panneau).getByRole('radio', { name: 'L’année' })).toBeChecked()
    fireEvent.change(within(panneau).getByLabelText('Année'), { target: { value: '2019' } })
    await cliquer(within(panneau).getByRole('button', { name: 'Enregistrer' }))
    expect(ecritures(faux)).toEqual([{ action: 'dateFin', valeur: { date: '2019-01-01', precision: 'annee' } }])
    expect(await screen.findByText('Terminé en 2019')).toBeInTheDocument()

    // Et la retirer.
    fireEvent.click(screen.getByRole('button', { name: 'Modifier la date de fin' }))
    await cliquer(screen.getByRole('button', { name: 'Retirer la date de fin' }))
    expect(ecritures(faux)).toContainEqual({ action: 'dateFin', valeur: { date: null, precision: 'annee' } })
    await waitFor(() => expect(screen.queryByText('Terminé en 2019')).not.toBeInTheDocument())
  })
})

describe('série et média sur la fiche', () => {
  it('tire la progression d’une série de ses tomes', async () => {
    const faux = depotFictif({ oeuvres: [VINLAND] })
    await ouvrir(faux, '#/oeuvre/vin')
    const section = screen.getByRole('region', { name: 'Ma progression' })
    expect(within(section).getByText('Tome 4 sur 29')).toBeInTheDocument()
    fireEvent.click(within(section).getByRole('button', { name: 'Saisir le tome' }))
    fireEvent.change(screen.getByLabelText('J’en suis au tome'), { target: { value: '6' } })
    await cliquer(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(ecritures(faux)).toEqual([{ action: 'progression', valeur: 6 }])
    const tomes = screen.getByRole('list', { name: 'Tomes de Vinland Saga' })
    expect(within(tomes).getByRole('button', { name: /^Tome 5, lu/ })).toBeInTheDocument()
    expect(within(tomes).getByRole('button', { name: /^Tome 6, en cours/ })).toBeInTheDocument()
  })

  it('compte les épisodes vus ; le premier fait passer l’anime « En cours »', async () => {
    const faux = depotFictif({ oeuvres: [VINLAND] })
    await ouvrir(faux, '#/oeuvre/vin')
    expect(screen.getByText('Aucun épisode vu')).toBeInTheDocument()
    await cliquer(screen.getByRole('button', { name: 'Un épisode de plus' }))
    expect(ecritures(faux)).toEqual([{ action: 'media', valeur: { media: 'm1', vus: 1, statut: 'en_cours' } }])
    expect(await screen.findByText('Épisode 1 sur 48')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anime : En cours. Changer' })).toBeInTheDocument()
  })
})

describe('accueil « En ce moment »', () => {
  it('reste calme quand rien n’est en cours, avec un chemin vers la bibliothèque', async () => {
    await ouvrir(depotFictif({ oeuvres: [siddhartha({ statut: 'envie_de_lire' })] }), '#/')
    expect(screen.getByText('Aucune lecture en cours pour l’instant.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Parcourir ma bibliothèque' })).toHaveAttribute('href', '#/bibliotheque')
  })

  it('montre mes lectures en couvertures cliquables, la progression en mots, sans barre', async () => {
    await ouvrir(depotFictif({ oeuvres: [siddhartha({ unite: 'page', total: 230, position: 75 }), LUCILIUS, VINLAND] }), '#/')
    const liste = screen.getByRole('list', { name: 'Mes lectures en cours' })
    const cartes = within(liste).getAllByRole('listitem')
    expect(cartes).toHaveLength(3)
    expect(within(liste).getByText('p. 75 sur 230')).toBeInTheDocument()
    expect(within(liste).getByText('Lettre 12')).toBeInTheDocument()
    expect(within(liste).getByText('Tome 4 sur 29')).toBeInTheDocument()
    expect(within(liste).getByRole('link', { name: /^Siddhartha/ })).toHaveAttribute('href', '#/oeuvre/sid')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(within(liste).getAllByRole('button', { name: /^Noter où j’en suis dans / })).toHaveLength(3)
  })

  it('note où j’en suis depuis le panneau, puis le referme', async () => {
    const faux = depotFictif({ oeuvres: [siddhartha({ unite: 'page', total: 190, position: 75 })] })
    await ouvrir(faux, '#/')
    fireEvent.click(screen.getByRole('button', { name: 'Noter où j’en suis dans Siddhartha' }))
    const panneau = screen.getByRole('dialog', { name: 'Siddhartha' })
    expect(within(panneau).getByText('Mon édition · 190 pages')).toBeInTheDocument()
    const champ = within(panneau).getByLabelText('J’en suis à la page')
    expect(champ).toHaveValue('75')
    fireEvent.click(within(panneau).getByRole('button', { name: 'Une page de plus' }))
    expect(champ).toHaveValue('76')
    await cliquer(within(panneau).getByRole('button', { name: 'Enregistrer' }))
    expect(ecritures(faux)).toEqual([{ action: 'progression', valeur: 76 }])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText('p. 76 sur 190')).toBeInTheDocument()
  })

  it('« J’ai terminé ce livre » : le panneau propose ensuite mon ressenti, « Plus tard » le ferme', async () => {
    const faux = depotFictif({ oeuvres: [siddhartha({ unite: 'page', total: 190, position: 75 })] })
    await ouvrir(faux, '#/')
    fireEvent.click(screen.getByRole('button', { name: 'Noter où j’en suis dans Siddhartha' }))
    await cliquer(within(screen.getByRole('dialog')).getByRole('button', { name: 'J’ai terminé ce livre' }))
    expect(ecritures(faux)).toEqual([{ action: 'statut', valeur: 'termine' }])
    const ressenti = screen.getByRole('dialog', { name: 'Mon ressenti' })
    expect(within(ressenti).getAllByRole('button', { pressed: false })).toHaveLength(4)
    await cliquer(within(ressenti).getByRole('button', { name: 'Plus tard' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(ecritures(faux)).toHaveLength(1)
    expect(await screen.findByText('Aucune lecture en cours pour l’instant.')).toBeInTheDocument()
  })

  it('« Le mettre en pause » range le livre sans jugement', async () => {
    const faux = depotFictif({ oeuvres: [siddhartha({ unite: 'page', total: 190, position: 75 })] })
    await ouvrir(faux, '#/')
    fireEvent.click(screen.getByRole('button', { name: 'Noter où j’en suis dans Siddhartha' }))
    await cliquer(within(screen.getByRole('dialog')).getByRole('button', { name: 'Le mettre en pause' }))
    expect(ecritures(faux)).toEqual([{ action: 'statut', valeur: 'en_pause' }])
    expect(screen.getByText('Siddhartha est en pause, toujours dans ma bibliothèque.')).toBeInTheDocument()
  })

  it('hors connexion, grise « Où j’en suis » avec un mot calme', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    await ouvrir(depotFictif({ oeuvres: [LUCILIUS] }), '#/')
    expect(screen.getByRole('button', { name: 'Noter où j’en suis dans Lettres à Lucilius' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('La progression pourra être notée au retour du réseau.')).toBeInTheDocument()
  })
})
