import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../App'
import type { Assistant } from '../ajout/assistant'
import { assistantFictif, imageFictive, noticeFictive, reponseIsbnFictive } from '../ajout/assistant.fictif'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { couverturesFictives } from '../couvertures/stockage.fictif'
import { authFictif } from '../session/auth.fictif'

async function ouvrir(
  faux: ReturnType<typeof depotFictif>,
  hash: string,
  options: { couvertures?: ReturnType<typeof couverturesFictives>; assistant?: Assistant } = {},
) {
  window.location.hash = hash
  render(
    <App
      auth={authFictif({ compte: { email: 'moi@exemple.test' } }).auth}
      depot={faux.depot}
      couvertures={options.couvertures?.couvertures}
      assistant={options.assistant}
    />,
  )
  await act(async () => {})
}

// Un seul « Enregistrer » et un seul « Annuler » : dans la barre fixe du bas.
const barre = () => within(screen.getByRole('group', { name: 'Enregistrer ou annuler' }))
const enregistrer = async () => {
  await act(async () => fireEvent.click(barre().getByRole('button', { name: 'Enregistrer' })))
  await act(async () => {})
}

beforeEach(() => {
  window.location.hash = ''
  window.scrollTo = () => {}
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
})

describe('ajout d’une œuvre', () => {
  it('enregistre la fiche saisie puis ouvre directement sa fiche', async () => {
    const faux = depotFictif({
      oeuvres: [oeuvreFictive({ id: 'x', titreFr: 'Autre', etiquettes: [{ genre: 'theme', nom: 'Temps', coeur: true }] })],
    })
    await ouvrir(faux, '#/ajouter?mode=manuel')
    expect(screen.getByRole('heading', { level: 1, name: 'Ajouter une œuvre' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Momo' } })
    fireEvent.change(screen.getByLabelText('Auteur'), { target: { value: 'Michael Ende' } })
    fireEvent.change(screen.getByLabelText('Langue d’origine'), { target: { value: 'de' } })
    // Une étiquette déjà connue garde son écriture exacte.
    fireEvent.change(screen.getByLabelText('Thèmes'), { target: { value: 'temps' } })
    fireEvent.click(within(screen.getByLabelText('Thèmes').parentElement!).getByRole('button', { name: 'Ajouter' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Lumineuse' }))
    fireEvent.click(screen.getByRole('button', { name: 'Noter mon édition' }))
    fireEvent.change(screen.getByLabelText('Éditeur'), { target: { value: 'Le Livre de Poche' } })
    await enregistrer()

    expect(faux.appels.enregistrerOeuvre).toHaveLength(1)
    expect(faux.appels.enregistrerOeuvre[0]).toMatchObject({
      title_fr: 'Momo',
      original_language: 'de',
      title_original: null,
      tone: 5,
      density: null,
      authors: [{ name: 'Michael Ende', role: 'auteur' }],
      tags: [{ kind: 'theme', name: 'Temps' }],
      editions: [{ publisher: 'Le Livre de Poche', isbn: null, page_count: null, mienne: true }],
    })
    expect(faux.appels.enregistrerOeuvre[0]).not.toHaveProperty('id')
    expect(window.location.hash).toBe('#/oeuvre/nouvelle-1')
    expect(await screen.findByRole('heading', { level: 1, name: 'Momo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Statut de lecture : À découvrir. Changer' })).toBeInTheDocument()
  })

  it('signale les champs à revoir et n’envoie rien', async () => {
    const faux = depotFictif()
    await ouvrir(faux, '#/ajouter?mode=manuel')
    fireEvent.click(screen.getByRole('button', { name: 'Noter mon édition' }))
    fireEvent.change(screen.getByLabelText('ISBN'), { target: { value: '978-2-07-036002-5' } })
    await enregistrer()
    expect(faux.appels.enregistrerOeuvre).toHaveLength(0)
    expect(screen.getByLabelText('Titre')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Titre')).toHaveFocus()
    expect(screen.getByLabelText('ISBN')).toHaveAccessibleDescription(/Cet ISBN ne semble pas juste/)
    expect(screen.getAllByRole('alert').some((a) => a.textContent === 'Quelques champs sont à revoir avant d’enregistrer.')).toBe(true)
  })

  it('ouvre la section repliée où se trouve un champ à revoir', async () => {
    await ouvrir(depotFictif(), '#/ajouter?mode=manuel')
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Momo' } })
    fireEvent.change(screen.getByLabelText('Parution'), { target: { value: 'autrefois' } })
    const repli = screen.getByLabelText('Parution').closest('details')!
    expect(repli).not.toHaveAttribute('open')
    await enregistrer()
    expect(repli).toHaveAttribute('open')
    expect(screen.getByLabelText('Parution')).toHaveFocus()
  })

  it('garde la saisie et l’explique quand la base refuse', async () => {
    const faux = depotFictif({ ecriture: { ok: false, echec: 'reseau' } })
    await ouvrir(faux, '#/ajouter?mode=manuel')
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Momo' } })
    await enregistrer()
    expect(screen.getAllByRole('alert').some((a) => /rien n’a été enregistré/.test(a.textContent ?? ''))).toBe(true)
    expect(screen.getByLabelText('Titre')).toHaveValue('Momo')
    expect(window.location.hash).toBe('#/ajouter?mode=manuel')
  })

  it('n’enregistre pas hors connexion', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    const faux = depotFictif()
    await ouvrir(faux, '#/ajouter?mode=manuel')
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Momo' } })
    await enregistrer()
    expect(faux.appels.enregistrerOeuvre).toHaveLength(0)
    expect(screen.getByText('Hors connexion : je peux préparer la fiche, et l’enregistrer au retour du réseau.')).toBeInTheDocument()
  })

  it('demande avant d’abandonner une saisie', async () => {
    await ouvrir(depotFictif(), '#/ajouter?mode=manuel')
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Momo' } })
    fireEvent.click(barre().getByRole('button', { name: 'Annuler' }))
    expect(screen.getByRole('dialog', { name: 'Abandonner mes modifications ?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continuer la saisie' }))
    expect(screen.getByLabelText('Titre')).toHaveValue('Momo')
  })
})

describe('la barre « Annuler / Enregistrer »', () => {
  it('remplace la navigation pendant la saisie : un seul Enregistrer, un seul Annuler', async () => {
    await ouvrir(depotFictif({ oeuvres: [oeuvreFictive({ id: 'sid', titreFr: 'Siddhartha' })] }), '#/oeuvre/sid/modifier')
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Enregistrer' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Annuler' })).toHaveLength(1)
  })

  it('rend la navigation en quittant « Modifier »', async () => {
    await ouvrir(depotFictif({ oeuvres: [oeuvreFictive({ id: 'sid', titreFr: 'Siddhartha' })] }), '#/oeuvre/sid/modifier')
    await act(async () => fireEvent.click(barre().getByRole('button', { name: 'Annuler' })))
    await act(async () => {})
    await act(async () => void (window.location.hash = '#/oeuvre/sid'))
    await act(async () => {})
    expect(screen.getAllByRole('navigation', { name: 'Navigation principale' }).length).toBeGreaterThan(0)
  })
})

describe('modification d’une œuvre', () => {
  it('reprend la fiche et n’envoie que l’œuvre visée, sans toucher au statut', async () => {
    const faux = depotFictif({
      oeuvres: [
        oeuvreFictive({
          id: 'vin',
          titreFr: 'Vinland Saga',
          forme: 'manga',
          estSerie: true,
          statut: 'en_cours',
          auteurs: [{ nom: 'Makoto Yukimura', role: 'auteur' }],
          tomes: [
            { numero: 1, titre: null, isbn: null, possession: 'possede', lecture: 'a_lire' },
            { numero: 2, titre: null, isbn: null, possession: 'non_possede', lecture: 'a_lire' },
          ],
        }),
      ],
    })
    await ouvrir(faux, '#/oeuvre/vin/modifier')
    expect(screen.getByRole('heading', { level: 1, name: 'Modifier la fiche' })).toBeInTheDocument()
    expect(screen.getByLabelText('Titre')).toHaveValue('Vinland Saga')
    expect(screen.getByLabelText('Nombre de tomes')).toHaveValue('2')

    fireEvent.change(screen.getByLabelText('Nombre de tomes'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Vinland Saga (édition)' } })
    await enregistrer()
    const envoi = faux.appels.enregistrerOeuvre[0]
    expect(envoi).toMatchObject({ id: 'vin', title_fr: 'Vinland Saga (édition)', is_series: true })
    expect(envoi.volumes.map((v) => v.number)).toEqual([1, 2, 3, 4])
    expect(envoi).not.toHaveProperty('reading_status')
    // Les tomes gardés conservent leur possession.
    expect(faux.oeuvres()[0].tomes[0].possession).toBe('possede')
    expect(faux.oeuvres()[0].statut).toBe('en_cours')
  })

  it('met d’abord la couverture, mon édition, le titre et l’auteur ; le reste est replié, avec un résumé', async () => {
    const faux = depotFictif({
      oeuvres: [
        oeuvreFictive({
          id: 'sid',
          titreFr: 'Siddhartha',
          langueOriginale: 'de',
          annee: 1922,
          synopsis: 'Dans l’Inde ancienne…',
          auteurs: [
            { nom: 'Hermann Hesse', role: 'auteur' },
            { nom: 'Joseph Delage', role: 'traducteur' },
          ],
          etiquettes: [{ genre: 'genre', nom: 'Roman philosophique', coeur: false }],
          editions: [{ id: 'e1', isbn: '9782253008484', publisher: 'Le Livre de Poche', language: 'fr', format: null, translator: null, pageCount: 217, couverture: null }],
          monEdition: 'e1',
        }),
      ],
    })
    await ouvrir(faux, '#/oeuvre/sid/modifier')
    const titres = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titres).toEqual(['Mon édition', 'Titre et auteur'])
    expect(screen.getByLabelText('ISBN')).toHaveValue('9782253008484')
    expect(screen.getByLabelText('Pages')).toHaveValue('217')
    expect(screen.getByLabelText('Auteur')).toHaveValue('Hermann Hesse')
    // Le traducteur n'est pas en haut : il est dans « Détails de l'œuvre », replié.
    const replis = [...document.querySelectorAll('details')]
    expect(replis.map((d) => d.querySelector('summary')?.textContent)).toEqual([
      'Description et étiquettesRésumé · Roman philosophique',
      'Détails de l’œuvreAllemand · 1922 · roman · 1 autre personne',
      'À l’écranAucune adaptation',
      'Autres éditionsAucune autre édition notée',
    ])
    expect(replis.every((d) => !d.open)).toBe(true)
    expect(screen.getByDisplayValue('Joseph Delage').closest('details')).toBe(replis[1])
  })

  it('libellés parlants : type d’œuvre et difficulté de lecture', async () => {
    await ouvrir(depotFictif({ oeuvres: [oeuvreFictive({ id: 'sid', titreFr: 'Siddhartha' })] }), '#/oeuvre/sid/modifier')
    expect(screen.getByLabelText('Type d’œuvre')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Difficulté de lecture' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Modérée' })).toBeInTheDocument()
  })

  it('« C’est une série » répond au toucher sur toute sa ligne, d’au moins 44 px', async () => {
    await ouvrir(depotFictif({ oeuvres: [oeuvreFictive({ id: 'sid', titreFr: 'Siddhartha' })] }), '#/oeuvre/sid/modifier')
    const case_ = screen.getByRole('checkbox', { name: 'C’est une série en plusieurs tomes' })
    expect(case_.closest('label')).toHaveClass('min-h-11')
  })

  it('supprime l’œuvre depuis son bas de page, après confirmation, puis ouvre la bibliothèque', async () => {
    const faux = depotFictif({ oeuvres: [oeuvreFictive({ id: 'sid', titreFr: 'Siddhartha' })] })
    await ouvrir(faux, '#/oeuvre/sid/modifier')
    const bouton = screen.getByRole('button', { name: 'Supprimer cette œuvre de ma bibliothèque' })
    fireEvent.click(bouton)
    const dialogue = screen.getByRole('dialog', { name: 'Supprimer « Siddhartha » ?' })
    expect(dialogue).toHaveTextContent('Ce geste ne se défait pas.')
    // Comme dans les panneaux : l'action principale en haut.
    expect(within(dialogue).getAllByRole('button').map((b) => b.textContent)).toEqual(['Supprimer', 'Garder'])
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Garder' }))
    expect(faux.appels.ecritures).toHaveLength(0)

    fireEvent.click(bouton)
    await act(async () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' })))
    expect(faux.appels.ecritures).toEqual([{ action: 'suppression', id: 'sid', valeur: undefined }])
    expect(faux.oeuvres()).toHaveLength(0)
    await act(async () => {})
    expect(window.location.hash).toBe('#/bibliotheque')
  })

  it('ne propose pas de supprimer une œuvre qu’on est en train d’ajouter', async () => {
    await ouvrir(depotFictif(), '#/ajouter?mode=manuel')
    expect(screen.queryByRole('button', { name: /Supprimer/ })).not.toBeInTheDocument()
  })

  it('grise la suppression hors connexion', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    await ouvrir(depotFictif({ oeuvres: [oeuvreFictive({ id: 'sid', titreFr: 'Siddhartha' })] }), '#/oeuvre/sid/modifier')
    const bouton = screen.getByRole('button', { name: 'Supprimer cette œuvre de ma bibliothèque' })
    expect(bouton).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(bouton)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('prévient quand des tomes vont être retirés', async () => {
    const faux = depotFictif({
      oeuvres: [
        oeuvreFictive({
          id: 'vin',
          titreFr: 'Vinland Saga',
          estSerie: true,
          tomes: [1, 2, 3].map((numero) => ({ numero, titre: null, isbn: null, possession: 'possede' as const, lecture: 'a_lire' as const })),
        }),
      ],
    })
    await ouvrir(faux, '#/oeuvre/vin/modifier')
    fireEvent.change(screen.getByLabelText('Nombre de tomes'), { target: { value: '1' } })
    expect(screen.getByText('Les tomes 2 à 3 seront retirés, avec ce que j’avais noté sur leur possession.')).toBeInTheDocument()
  })
})

describe('couverture dans « Modifier » : tout attend « Enregistrer »', () => {
  const CHEMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef.jpg'
  const illustree = () =>
    depotFictif({
      oeuvres: [
        oeuvreFictive({
          id: 'momo',
          titreFr: 'Momo',
          editions: [{ id: 'e1', isbn: null, publisher: 'Bayard', language: 'fr', format: null, translator: null, pageCount: null, couverture: CHEMIN }],
          monEdition: 'e1',
        }),
      ],
    })
  const message = () => screen.getAllByRole('status').find((s) => s.getAttribute('data-etat') === 'ouvert')

  it('la croix retire la couverture de l’écran ; elle n’est retirée qu’avec « Enregistrer »', async () => {
    const faux = illustree()
    await ouvrir(faux, '#/oeuvre/momo/modifier')
    const section = within(screen.getByRole('region', { name: 'Couverture' }))
    fireEvent.click(section.getByRole('button', { name: 'Retirer la couverture' }))
    expect(section.queryByRole('button', { name: 'Retirer la couverture' })).not.toBeInTheDocument()
    expect(message()).toHaveTextContent(/^Couverture retirée.*Annuler$/)
    expect(faux.appels.ecritures).toHaveLength(0)

    await enregistrer()
    expect(faux.appels.ecritures).toContainEqual({ action: 'couverture', id: 'momo', valeur: { cible: { type: 'edition', edition: 'e1' }, chemin: null } })
    expect(faux.oeuvres()[0].editions[0].couverture).toBeNull()
  })

  it('« Annuler » dans le message remet la couverture, et rien n’est retiré', async () => {
    const faux = illustree()
    await ouvrir(faux, '#/oeuvre/momo/modifier')
    fireEvent.click(screen.getByRole('button', { name: 'Retirer la couverture' }))
    fireEvent.click(within(message()!).getByRole('button', { name: 'Annuler : remettre la couverture' }))
    expect(screen.getByRole('button', { name: 'Retirer la couverture' })).toBeInTheDocument()
    expect(message()).toBeUndefined()
    await enregistrer()
    expect(faux.appels.ecritures.filter((e) => e.action === 'couverture')).toHaveLength(0)
  })

  it('le message disparaît seul après quelques secondes', async () => {
    await ouvrir(illustree(), '#/oeuvre/momo/modifier')
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Retirer la couverture' }))
      expect(message()).toBeDefined()
      await act(async () => vi.advanceTimersByTime(5100))
      expect(message()).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('« Annuler » en bas annule vraiment tout, couverture comprise, après une confirmation', async () => {
    const faux = illustree()
    await ouvrir(faux, '#/oeuvre/momo/modifier')
    fireEvent.click(screen.getByRole('button', { name: 'Retirer la couverture' }))
    fireEvent.click(barre().getByRole('button', { name: 'Annuler' }))
    const dialogue = screen.getByRole('dialog', { name: 'Abandonner mes modifications ?' })
    expect(dialogue).toHaveTextContent('Rien de ce que j’ai changé ne sera enregistré, couverture comprise.')
    await act(async () => fireEvent.click(within(dialogue).getByRole('button', { name: 'Abandonner' })))
    expect(faux.appels.ecritures).toHaveLength(0)
    expect(faux.oeuvres()[0].editions[0].couverture).toBe(CHEMIN)
  })

  it('n’a pas de croix quand l’œuvre n’a que la couverture d’Ichnos', async () => {
    await ouvrir(depotFictif({ oeuvres: [oeuvreFictive({ id: 'momo', titreFr: 'Momo' })] }), '#/oeuvre/momo/modifier')
    expect(screen.queryByRole('button', { name: 'Retirer la couverture' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Changer la couverture' })).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('« Changer la couverture » ouvre un petit menu de trois gestes', async () => {
    await ouvrir(illustree(), '#/oeuvre/momo/modifier')
    fireEvent.click(screen.getByRole('button', { name: 'Changer la couverture' }))
    const menu = screen.getByRole('menu', { name: 'Changer la couverture' })
    expect(within(menu).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Prendre une photo', 'Choisir dans mes photos', 'Chercher d’autres couvertures'])
  })

  it('hors connexion, « Changer la couverture » est grisé', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    await ouvrir(illustree(), '#/oeuvre/momo/modifier')
    expect(screen.getByRole('button', { name: 'Changer la couverture' })).toHaveAttribute('aria-disabled', 'true')
  })
})

describe('« Chercher cette édition »', () => {
  const SIDDHARTHA = () =>
    depotFictif({
      oeuvres: [
        oeuvreFictive({
          id: 'sid',
          titreFr: 'Siddhartha',
          editions: [{ id: 'e1', isbn: null, publisher: 'Grasset', language: 'fr', format: null, translator: null, pageCount: null, couverture: null }],
          monEdition: 'e1',
        }),
      ],
    })
  const notice = noticeFictive({
    titre: { valeur: 'Siddhartha', source: 'bnf' },
    editeur: { valeur: 'Le Livre de Poche', source: 'bnf' },
    traducteur: { valeur: 'Joseph Delage', source: 'bnf' },
    pages: { valeur: 190, source: 'bnf' },
    langue: { valeur: 'fr', source: 'bnf' },
  })

  it('apparaît quand je saisis un ISBN valide, montre ce qui a été trouvé, et n’applique rien sans mon accord', async () => {
    const faux = SIDDHARTHA()
    const assistant = assistantFictif({ isbn: reponseIsbnFictive({ notice, couverture: null }) })
    await ouvrir(faux, '#/oeuvre/sid/modifier', { assistant: assistant.assistant })
    expect(screen.queryByRole('button', { name: 'Chercher cette édition' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('ISBN'), { target: { value: '978-2-253-00848-4' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Chercher cette édition' })))
    await act(async () => {})

    const panneau = within(screen.getByRole('dialog', { name: 'Ce qui a été trouvé' }))
    expect(panneau.getByText('J’avais noté : Grasset')).toBeInTheDocument()
    // Les boutons du panneau : l'action principale en haut, la secondaire en dessous.
    expect(panneau.getAllByRole('button').map((b) => b.textContent).slice(-2)).toEqual(['Appliquer à mon édition', 'Ne rien changer'])
    fireEvent.click(panneau.getByRole('button', { name: 'Ne rien changer' }))
    expect(screen.getByLabelText('Éditeur')).toHaveValue('Grasset')

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Chercher cette édition' })))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer à mon édition' }))
    expect(screen.getByLabelText('Éditeur')).toHaveValue('Le Livre de Poche')
    expect(screen.getByLabelText('Pages')).toHaveValue('190')
    // Rien n'est enregistré avant « Enregistrer ».
    expect(faux.appels.enregistrerOeuvre).toHaveLength(0)
    await enregistrer()
    expect(faux.appels.enregistrerOeuvre[0].editions[0]).toMatchObject({ isbn: '9782253008484', publisher: 'Le Livre de Poche', page_count: 190 })
  })

  it('sa couverture s’affiche tout de suite, mais n’est rangée qu’avec « Enregistrer »', async () => {
    const faux = SIDDHARTHA()
    const couvertures = couverturesFictives()
    const assistant = assistantFictif({
      isbn: reponseIsbnFictive({ notice, couverture: { source: 'open_library', isbn: '9782253008484' } }),
      couverture: imageFictive(),
    })
    await ouvrir(faux, '#/oeuvre/sid/modifier', { assistant: assistant.assistant, couvertures })
    fireEvent.change(screen.getByLabelText('ISBN'), { target: { value: '9782253008484' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Chercher cette édition' })))
    await act(async () => {})
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer à mon édition' }))
    expect(screen.getByRole('button', { name: 'Retirer la couverture' })).toBeInTheDocument()
    expect(couvertures.deposees).toHaveLength(0)
    await enregistrer()
    expect(couvertures.deposees).toHaveLength(1)
    expect(faux.oeuvres()[0].editions[0].couverture).not.toBeNull()
  })
})
