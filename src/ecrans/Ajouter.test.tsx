import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../App'
import type { FicheProposee, Reponse } from '../ajout/assistant'
import { assistantFictif, ficheFictive, imageFictive, noticeFictive, reponseIsbnFictive, reponseTitreFictive, resultatFictif } from '../ajout/assistant.fictif'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { couverturesFictives } from '../couvertures/stockage.fictif'
import { authFictif } from '../session/auth.fictif'

const ISBN = '9782747024693'
const MOMO = noticeFictive({
  titre: { valeur: 'Momo', source: 'bnf' },
  titreOriginal: { valeur: 'Momo', source: 'bnf' },
  auteurs: { valeur: ['Michael Ende'], source: 'bnf' },
  traducteur: { valeur: 'Corinna Gepner', source: 'bnf' },
  editeur: { valeur: 'Bayard jeunesse', source: 'bnf' },
  pages: { valeur: 430, source: 'google_books' },
  langue: { valeur: 'fr', source: 'bnf' },
  langueOriginale: { valeur: 'de', source: 'bnf' },
  annee: { valeur: 1973, source: 'open_library' },
})
const IMAGE = imageFictive()
const DESCRIPTION = { texte: 'Une orpheline et des voleurs de temps.', source: 'bnf' as const }

type Monde = { depot?: ReturnType<typeof depotFictif>; assistant?: ReturnType<typeof assistantFictif>; couvertures?: ReturnType<typeof couverturesFictives> }

async function ouvrir(monde: Monde = {}, hash = '#/ajouter') {
  const depot = monde.depot ?? depotFictif()
  const assistant = monde.assistant ?? assistantFictif()
  const couvertures = monde.couvertures ?? couverturesFictives()
  window.location.hash = hash
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

const principal = () => within(screen.getByRole('main'))
/** Laisse aboutir les recherches et les relectures en cours (plusieurs allers-retours simulés). */
const attendre = async () => {
  for (let tour = 0; tour < 4; tour++) await act(async () => void (await new Promise((suite) => setTimeout(suite, 0))))
}

async function chercherIsbn(saisie: string) {
  fireEvent.change(screen.getByLabelText('ISBN à 13 chiffres'), { target: { value: saisie } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Chercher ce livre' })))
  await attendre()
}

async function chercherTitre(titre: string, auteur = '') {
  fireEvent.change(screen.getByLabelText('Titre'), { target: { value: titre } })
  if (auteur) fireEvent.change(screen.getByLabelText('Auteur'), { target: { value: auteur } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Chercher cette œuvre' })))
  await attendre()
}

const enregistrer = async () => {
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' })))
  await attendre()
}

beforeEach(() => {
  window.location.hash = ''
  window.scrollTo = () => {}
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
  URL.createObjectURL = () => 'blob:apercu'
  URL.revokeObjectURL = () => {}
})

describe('écran « Ajouter »', () => {
  it('propose deux manières : remplir automatiquement, ou tout saisir moi-même', async () => {
    await ouvrir()
    expect(screen.getByRole('heading', { level: 1, name: 'Ajouter une œuvre' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Remplir automatiquement' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Tout saisir moi-même' })).toBeInTheDocument()
    expect(screen.getByLabelText('ISBN à 13 chiffres')).toHaveAttribute('inputmode', 'numeric')
    expect(screen.getByRole('link', { name: 'Ouvrir le formulaire complet' })).toHaveAttribute('href', '#/ajouter?mode=manuel')
  })

  it('garde le formulaire complet à portée, pour tout saisir moi-même', async () => {
    const { depot, assistant } = await ouvrir({}, '#/ajouter?mode=manuel')
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Momo' } })
    await enregistrer()
    expect(depot.appels.enregistrerOeuvre).toHaveLength(1)
    // Aucun appel à l'assistant : l'appli fonctionne entièrement sans lui.
    expect(assistant.appels).toEqual({ chercherIsbn: [], chercherTitre: [], couverture: [], autresCouvertures: [], proposerFiche: [] })
  })
})

describe('ajout par ISBN', () => {
  const trouve = () => assistantFictif({ isbn: reponseIsbnFictive({ notice: MOMO, descriptions: [DESCRIPTION], couverture: { source: 'open_library', isbn: ISBN } }), couverture: IMAGE })

  it('remplit l’édition exacte de mon exemplaire, avec la source de chaque champ', async () => {
    const { assistant } = await ouvrir({ assistant: trouve() })
    await chercherIsbn('978-2-7470-2469-3')
    expect(assistant.appels.chercherIsbn).toEqual([ISBN])

    expect(screen.getByLabelText('Titre')).toHaveValue('Momo')
    expect(screen.getByLabelText('Titre')).toHaveAccessibleDescription('D’après la BnF.')
    expect(screen.getByLabelText('Langue d’origine')).toHaveValue('de')
    expect(screen.getByLabelText('Parution')).toHaveValue('1973')
    expect(screen.getByLabelText('Parution')).toHaveAccessibleDescription(/D’après Open Library, à vérifier/)
    expect(screen.getByLabelText('Auteur')).toHaveValue('Michael Ende')
    expect(screen.getByLabelText('Éditeur')).toHaveValue('Bayard jeunesse')
    expect(screen.getByLabelText('Traduction')).toHaveValue('Corinna Gepner')
    // Sans tirets en base, avec ses tirets dans le champ.
    expect(screen.getByLabelText('ISBN')).toHaveValue('978-2-7470-2469-3')
    expect(screen.getByLabelText('Pages')).toHaveValue('430')
    expect(screen.getByLabelText('Pages')).toHaveAccessibleDescription(/D’après Google Books/)
    // L'édition trouvée est la mienne : elle est en haut, sous « Mon édition ».
    expect(screen.getByLabelText('ISBN').closest('section')).toHaveAccessibleName('Mon édition')
  })

  it('n’enregistre rien tant que je n’ai pas validé', async () => {
    const { depot, couvertures } = await ouvrir({ assistant: trouve() })
    await chercherIsbn(ISBN)
    expect(depot.appels.enregistrerOeuvre).toHaveLength(0)
    expect(depot.appels.ecritures).toHaveLength(0)
    expect(couvertures.deposees).toHaveLength(0)
  })

  it('à la validation, enregistre la fiche puis range la couverture sur mon édition', async () => {
    const { depot, assistant, couvertures } = await ouvrir({ assistant: trouve() })
    await chercherIsbn(ISBN)
    expect(assistant.appels.couverture).toEqual([{ ref: { source: 'open_library', isbn: ISBN } }])
    expect(screen.getByText('Couverture trouvée sur Open Library.')).toBeInTheDocument()

    await enregistrer()
    expect(depot.appels.enregistrerOeuvre[0]).toMatchObject({
      title_fr: 'Momo',
      title_original: 'Momo',
      original_language: 'de',
      first_published_year: 1973,
      authors: [{ name: 'Michael Ende', role: 'auteur' }],
      editions: [{ isbn: ISBN, publisher: 'Bayard jeunesse', translator: 'Corinna Gepner', language: 'fr', page_count: 430, mienne: true }],
    })
    expect(couvertures.deposees).toHaveLength(1)
    const rangement = depot.appels.ecritures.find((e) => e.action === 'couverture')
    expect(rangement?.valeur).toMatchObject({ cible: { type: 'edition' }, chemin: couvertures.deposees[0].chemin })
    expect(window.location.hash).toBe('#/oeuvre/nouvelle-1')
  })

  it('ne range pas la couverture si je choisis de ne pas la garder', async () => {
    const { depot, couvertures } = await ouvrir({ assistant: trouve() })
    await chercherIsbn(ISBN)
    fireEvent.click(screen.getByRole('button', { name: 'Ne pas la garder' }))
    await enregistrer()
    expect(depot.appels.enregistrerOeuvre).toHaveLength(1)
    expect(couvertures.deposees).toHaveLength(0)
    expect(depot.appels.ecritures.some((e) => e.action === 'couverture')).toBe(false)
  })

  it('enregistre quand même la fiche si la couverture ne peut pas être rangée', async () => {
    const { depot } = await ouvrir({ assistant: trouve(), couvertures: couverturesFictives({ depot: { ok: false, echec: 'reseau' } }) })
    await chercherIsbn(ISBN)
    await enregistrer()
    expect(depot.appels.enregistrerOeuvre).toHaveLength(1)
    expect(window.location.hash).toBe('#/oeuvre/nouvelle-1')
  })

  it('refuse un ISBN mal formé sans rien chercher', async () => {
    const { assistant } = await ouvrir({ assistant: trouve() })
    await chercherIsbn('9782747024694')
    expect(screen.getByLabelText('ISBN à 13 chiffres')).toHaveAccessibleDescription(/Cet ISBN ne semble pas juste/)
    await chercherIsbn('2747024695')
    expect(screen.getByLabelText('ISBN à 13 chiffres')).toHaveAccessibleDescription(/L’ISBN à 13 chiffres est attendu/)
    expect(assistant.appels.chercherIsbn).toEqual([])
  })

  it('dit calmement qu’aucun catalogue ne connaît l’ISBN', async () => {
    await ouvrir({ assistant: assistantFictif({ isbn: reponseIsbnFictive({ trouve: false, notice: noticeFictive() }) }) })
    await chercherIsbn(ISBN)
    expect(principal().getByRole('alert')).toHaveTextContent('Aucun catalogue ne connaît cet ISBN')
    expect(screen.getByLabelText('ISBN à 13 chiffres')).toHaveValue('978-2-7470-2469-3')
  })

  it('pour l’ISBN d’un tome, prépare la série et range la couverture sur ce tome', async () => {
    const tome = noticeFictive({ titre: { valeur: 'Vinland saga', source: 'bnf' }, tome: { valeur: 2, source: 'bnf' }, manga: true })
    const assistant = assistantFictif({ isbn: reponseIsbnFictive({ notice: tome, couverture: { source: 'open_library', isbn: '9782351423561' } }), couverture: IMAGE })
    const { depot } = await ouvrir({ assistant })
    await chercherIsbn('9782351423561')
    expect(screen.getByRole('checkbox', { name: 'C’est une série en plusieurs tomes' })).toBeChecked()
    expect(screen.getByLabelText('Nombre de tomes')).toHaveValue('2')
    await enregistrer()
    expect(depot.appels.enregistrerOeuvre[0]).toMatchObject({ is_series: true, form: 'manga', volumes: [{ number: 1, isbn: null }, { number: 2, isbn: '9782351423561' }] })
    expect(depot.appels.ecritures.find((e) => e.action === 'couverture')?.valeur).toMatchObject({ cible: { type: 'tome', numero: 2 } })
  })
})

describe('œuvre déjà dans ma bibliothèque', () => {
  const dejaLa = () =>
    depotFictif({
      oeuvres: [
        oeuvreFictive({
          id: 'momo',
          titreFr: 'Momo',
          auteurs: [{ nom: 'Michael Ende', role: 'auteur' }],
          editions: [{ id: 'e1', isbn: ISBN, publisher: 'Bayard', language: 'fr', format: null, translator: null, pageCount: null }],
          monEdition: 'e1',
        }),
      ],
    })

  it('me prévient avant toute recherche quand l’ISBN y est déjà, et propose d’ouvrir sa fiche', async () => {
    const { assistant } = await ouvrir({ depot: dejaLa(), assistant: assistantFictif({ isbn: reponseIsbnFictive({ notice: MOMO }) }) })
    await chercherIsbn(ISBN)
    expect(screen.getByRole('heading', { level: 1, name: 'Déjà dans ma bibliothèque' })).toBeInTheDocument()
    expect(screen.getByText(/Cet ISBN est celui de « Momo »/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ouvrir sa fiche : Momo' })).toHaveAttribute('href', '#/oeuvre/momo')
    expect(assistant.appels.chercherIsbn).toEqual([])
  })

  it('me prévient quand le titre est très proche, et propose d’y ajouter l’édition', async () => {
    const autreIsbn = '9782070368228'
    const { depot, assistant } = await ouvrir({ depot: dejaLa(), assistant: assistantFictif({ isbn: reponseIsbnFictive({ notice: MOMO }), fiche: { ok: true, valeur: ficheFictive() } }) })
    await chercherIsbn(autreIsbn)
    expect(screen.getByRole('heading', { level: 1, name: 'Déjà dans ma bibliothèque ?' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ouvrir sa fiche : Momo' })).toHaveAttribute('href', '#/oeuvre/momo')
    // Pas d'appel à l'IA tant que je n'ai pas dit que c'est une autre œuvre.
    expect(assistant.appels.proposerFiche).toHaveLength(0)

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Ajouter cette édition à sa fiche : Momo' })))
    await attendre()
    expect(window.location.hash).toBe('#/oeuvre/momo/modifier')
    expect(screen.getByRole('heading', { level: 1, name: 'Modifier la fiche' })).toBeInTheDocument()
    expect(screen.getAllByLabelText('ISBN').map((champ) => (champ as HTMLInputElement).value)).toEqual(['978-2-7470-2469-3', '978-2-07-036822-8'])
    await enregistrer()
    expect(depot.appels.enregistrerOeuvre[0]).toMatchObject({ id: 'momo', editions: [{ id: 'e1', isbn: ISBN, mienne: true }, { isbn: autreIsbn, publisher: 'Bayard jeunesse', mienne: false }] })
  })

  it('me laisse continuer si c’est une autre œuvre', async () => {
    await ouvrir({ depot: dejaLa(), assistant: assistantFictif({ isbn: reponseIsbnFictive({ notice: MOMO }) }) })
    await chercherIsbn('9782070368228')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'C’est une autre œuvre, continuer' })))
    await attendre()
    expect(screen.getByLabelText('Titre')).toHaveValue('Momo')
  })
})

describe('ajout par titre', () => {
  const RESULTATS = [
    resultatFictif({ titre: 'Momo', auteurs: { valeur: ['Michael Ende'], source: 'bnf' }, titreOriginal: { valeur: 'Momo', source: 'bnf' }, langueOriginale: { valeur: 'de', source: 'bnf' }, annee: { valeur: 1973, source: 'open_library' }, descriptions: [DESCRIPTION], couverture: { source: 'open_library', numero: 8574580 } }),
    resultatFictif({ titre: 'Momo', auteurs: { valeur: ['Mayu Sakai'], source: 'bnf' }, serie: true }),
  ]

  it('me fait choisir la bonne œuvre parmi les résultats', async () => {
    const { assistant } = await ouvrir({ assistant: assistantFictif({ titre: reponseTitreFictive(RESULTATS) }) })
    await chercherTitre('Momo', 'Ende')
    expect(assistant.appels.chercherTitre).toEqual([{ titre: 'Momo', auteur: 'Ende' }])
    expect(screen.getByRole('heading', { level: 1, name: 'Quelle œuvre ?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Momo, de Michael Ende : choisir cette œuvre' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Momo, de Mayu Sakai : choisir cette œuvre' })).toBeInTheDocument()
  })

  it('remplit la fiche commune à toutes les éditions, sans ISBN, éditeur ni pagination', async () => {
    const { depot, couvertures } = await ouvrir({ assistant: assistantFictif({ titre: reponseTitreFictive(RESULTATS), couverture: IMAGE }) })
    await chercherTitre('Momo')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Momo, de Michael Ende : choisir cette œuvre' })))
    await attendre()
    expect(screen.getByLabelText('Titre')).toHaveValue('Momo')
    expect(screen.getByLabelText('Parution')).toHaveValue('1973')
    expect(screen.getByText('Mon édition n’est pas encore notée.')).toBeInTheDocument()
    await enregistrer()
    expect(depot.appels.enregistrerOeuvre[0]).toMatchObject({ title_fr: 'Momo', editions: [], volumes: [] })
    // Sans édition, la couverture est celle de l'œuvre.
    expect(couvertures.deposees).toHaveLength(1)
    expect(depot.appels.ecritures.find((e) => e.action === 'couverture')?.valeur).toMatchObject({ cible: { type: 'oeuvre' } })
  })

  it('revient à la recherche si aucune œuvre ne convient', async () => {
    await ouvrir({ assistant: assistantFictif({ titre: reponseTitreFictive(RESULTATS) }) })
    await chercherTitre('Momo')
    fireEvent.click(screen.getByRole('button', { name: 'Aucune ne convient' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Ajouter une œuvre' })).toBeInTheDocument()
    expect(screen.getByLabelText('Titre')).toHaveValue('Momo')
  })

  it('dit calmement qu’aucun catalogue ne connaît le titre', async () => {
    await ouvrir({ assistant: assistantFictif({ titre: reponseTitreFictive([]) }) })
    await chercherTitre('Titre introuvable')
    expect(principal().getByRole('alert')).toHaveTextContent('Aucun catalogue ne connaît ce titre')
  })

  it('demande un titre avant de chercher', async () => {
    const { assistant } = await ouvrir()
    await chercherTitre('   ')
    expect(screen.getByLabelText('Titre')).toHaveAccessibleDescription(/Le titre, au moins, est attendu/)
    expect(assistant.appels.chercherTitre).toEqual([])
  })
})

describe('fiche proposée par l’IA', () => {
  const FICHE = ficheFictive({
    synopsis: 'Une petite fille qui sait écouter affronte des voleurs de temps.',
    genres: ['Conte philosophique'],
    themes: ['Rapport au temps'],
    atmospheres: ['Lumineuse'],
    themesNouveaux: ['Écoute'],
    tonalite: 4,
    exigence: 2,
    longueur: 'moyen',
  })
  const avecFiche = (fiche: Reponse<FicheProposee> = { ok: true, valeur: FICHE }) =>
    assistantFictif({ isbn: reponseIsbnFictive({ notice: MOMO, descriptions: [DESCRIPTION] }), fiche })

  it('propose synopsis et étiquettes dans le formulaire, modifiables, sans rien enregistrer', async () => {
    const { depot } = await ouvrir({ assistant: avecFiche() })
    await chercherIsbn(ISBN)
    expect(screen.getByLabelText('Résumé')).toHaveValue(FICHE.synopsis)
    expect(screen.getByLabelText('Résumé')).toHaveAccessibleDescription(/Proposé par l’IA/)
    expect(screen.getByRole('button', { name: 'Retirer Rapport au temps' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retirer Conte philosophique' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Douce' })).toBeChecked()
    expect(depot.appels.enregistrerOeuvre).toHaveLength(0)

    fireEvent.change(screen.getByLabelText('Résumé'), { target: { value: 'Mon résumé corrigé.' } })
    await enregistrer()
    expect(depot.appels.enregistrerOeuvre[0]).toMatchObject({
      synopsis: 'Mon résumé corrigé.',
      tone: 4,
      density: 2,
      length: 'moyen',
      tags: [
        { kind: 'genre', name: 'Conte philosophique' },
        { kind: 'theme', name: 'Rapport au temps' },
        { kind: 'atmosphere', name: 'Lumineuse' },
      ],
    })
  })

  it('n’envoie à l’IA que des données bibliographiques publiques', async () => {
    const { assistant } = await ouvrir({ assistant: avecFiche() })
    await chercherIsbn(ISBN)
    expect(assistant.appels.proposerFiche).toEqual([
      { titre: 'Momo', titreOriginal: 'Momo', auteurs: ['Michael Ende'], annee: 1973, langueOriginale: 'de', descriptions: [DESCRIPTION] },
    ])
  })

  it('montre un thème nouveau à part, marqué comme nouveau, et ne l’ajoute que si je le veux', async () => {
    const { depot } = await ouvrir({ assistant: avecFiche() })
    await chercherIsbn(ISBN)
    const nouveaux = screen.getByRole('group', { name: 'Thèmes proposés, absents de mon vocabulaire' })
    expect(within(nouveaux).getByText('Nouveau')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retirer Écoute' })).not.toBeInTheDocument()

    fireEvent.click(within(nouveaux).getByRole('button', { name: 'Ajouter le thème nouveau Écoute' }))
    expect(screen.getByRole('button', { name: 'Retirer Écoute' })).toBeInTheDocument()
    await enregistrer()
    expect(depot.appels.enregistrerOeuvre[0].tags).toContainEqual({ kind: 'theme', name: 'Écoute' })
  })

  it('ne remplace pas ce que j’ai écrit pendant que la proposition se préparait', async () => {
    const assistant = avecFiche()
    assistant.attente.active = true
    await ouvrir({ assistant })
    await chercherIsbn(ISBN)
    expect(principal().getAllByRole('status').some((s) => /Une proposition de résumé et d’étiquettes se prépare/.test(s.textContent ?? ''))).toBe(true)
    fireEvent.change(screen.getByLabelText('Résumé'), { target: { value: 'Mon résumé à moi.' } })
    await act(async () => assistant.attente.liberer())
    await attendre()
    expect(screen.getByLabelText('Résumé')).toHaveValue('Mon résumé à moi.')
    expect(screen.getByRole('button', { name: 'Retirer Rapport au temps' })).toBeInTheDocument()
  })

  it('reste calme si la limite du jour est atteinte : la fiche se remplit à la main', async () => {
    const { depot } = await ouvrir({ assistant: avecFiche({ ok: false, echec: 'limite' }) })
    await chercherIsbn(ISBN)
    expect(screen.getByText(/L’IA a déjà préparé ses 30 fiches du jour/)).toBeInTheDocument()
    expect(screen.getByLabelText('Résumé')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('Résumé'), { target: { value: 'Écrit par moi.' } })
    await enregistrer()
    expect(depot.appels.enregistrerOeuvre[0]).toMatchObject({ title_fr: 'Momo', synopsis: 'Écrit par moi.' })
  })

  it('reste calme si l’IA ne répond pas', async () => {
    await ouvrir({ assistant: avecFiche({ ok: false, echec: 'ia' }) })
    await chercherIsbn(ISBN)
    expect(screen.getByText(/La proposition automatique n’est pas disponible pour le moment/)).toBeInTheDocument()
    // Ce n'est pas une erreur : aucune alerte, juste une phrase.
    expect(principal().getByRole('alert')).toHaveTextContent('')
  })

  it('n’appelle l’IA qu’une fois par ajout', async () => {
    const { assistant } = await ouvrir({ assistant: avecFiche() })
    await chercherIsbn(ISBN)
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Momo, corrigé' } })
    await attendre()
    expect(assistant.appels.proposerFiche).toHaveLength(1)
  })
})

describe('repères pour VoiceOver et le clavier', () => {
  it('à chaque nouvel écran, repart du haut : le titre des résultats, puis le début du formulaire', async () => {
    const haut: unknown[][] = []
    window.scrollTo = ((...args: unknown[]) => void haut.push(args)) as typeof window.scrollTo
    await ouvrir({ assistant: assistantFictif({ titre: reponseTitreFictive([resultatFictif({ titre: 'Momo', auteurs: { valeur: ['Michael Ende'], source: 'bnf' } })]) }) })
    await chercherTitre('Momo')
    expect(screen.getByRole('heading', { level: 1, name: 'Quelle œuvre ?' })).toHaveFocus()

    haut.length = 0
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Momo, de Michael Ende : choisir cette œuvre' })))
    await attendre()
    // Le formulaire s'ouvre : le focus va au début du contenu, et la page remonte en haut.
    expect(screen.getByRole('main')).toHaveFocus()
    expect(haut).toContainEqual([0, 0])
  })

  it('annonce la recherche en cours dans une zone toujours présente', async () => {
    await ouvrir()
    const zones = principal().getAllByRole('status')
    expect(zones).toHaveLength(2)
    expect(zones.every((zone) => zone.textContent === '')).toBe(true)
  })

  it('dit simplement que l’ISBN est déjà là quand le titre de l’œuvre n’est pas encore connu', async () => {
    const depot = depotFictif({
      oeuvres: [oeuvreFictive({ id: 'momo', titreFr: 'Momo', editions: [{ id: 'e1', isbn: ISBN, publisher: null, language: null, format: null, translator: null, pageCount: null }] })],
    })
    // La liste de la bibliothèque n'arrive pas : le titre reste inconnu de l'écran.
    depot.depot.listerOeuvres = async () => ({ ok: false, echec: 'reseau' })
    await ouvrir({ depot })
    await chercherIsbn(ISBN)
    expect(screen.getByText('Cet ISBN est déjà dans ma bibliothèque.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ouvrir sa fiche' })).toHaveAttribute('href', '#/oeuvre/momo')
  })
})

describe('quand la recherche n’est pas possible', () => {
  it('reste calme si l’assistant ne répond pas, et rappelle que tout se saisit à la main', async () => {
    await ouvrir()
    await chercherIsbn(ISBN)
    expect(principal().getByRole('alert')).toHaveTextContent('La recherche automatique ne répond pas pour le moment')
    expect(screen.getByRole('link', { name: 'Ouvrir le formulaire complet' })).toBeInTheDocument()
  })

  it('hors connexion, grise la recherche et explique pourquoi', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    const { assistant, depot } = await ouvrir({ assistant: assistantFictif({ isbn: reponseIsbnFictive({ notice: MOMO }) }) })
    expect(screen.getByRole('button', { name: 'Chercher ce livre' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Chercher cette œuvre' })).toHaveAttribute('aria-disabled', 'true')
    expect(principal().getByText(/Hors connexion : la recherche reprendra au retour du réseau/)).toBeInTheDocument()
    await chercherIsbn(ISBN)
    expect(assistant.appels.chercherIsbn).toEqual([])
    expect(depot.appels.ecritures).toHaveLength(0)
  })
})
