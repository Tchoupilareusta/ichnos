import { etatVide, ligneAuteur, valider, versEnvoi } from '../bibliotheque/formulaire'
import type { OeuvreListee } from '../bibliotheque/depot'
import type { FicheProposee, Notice, Resultat } from './assistant'
import { appliquerProposition, depuisNotice, depuisResultat, doublonsProches, libelleSource, pourFiche } from './preremplir'

const NOTICE_VIDE: Notice = {
  titre: null,
  titreOriginal: null,
  auteurs: null,
  traducteur: null,
  editeur: null,
  pages: null,
  langue: null,
  langueOriginale: null,
  annee: null,
  tome: null,
  manga: false,
}

const MOMO: Notice = {
  ...NOTICE_VIDE,
  titre: { valeur: 'Momo', source: 'bnf' },
  titreOriginal: { valeur: 'Momo', source: 'bnf' },
  auteurs: { valeur: ['Michael Ende'], source: 'bnf' },
  traducteur: { valeur: 'Corinna Gepner', source: 'bnf' },
  editeur: { valeur: 'Bayard jeunesse', source: 'bnf' },
  pages: { valeur: 430, source: 'google_books' },
  langue: { valeur: 'fr', source: 'bnf' },
  langueOriginale: { valeur: 'de', source: 'bnf' },
  annee: { valeur: 1973, source: 'open_library' },
}

describe('depuisNotice (ajout par ISBN)', () => {
  it('remplit l’œuvre et l’édition exacte de mon exemplaire', () => {
    const { etat } = depuisNotice(MOMO, '9782747024693')
    expect(etat).toMatchObject({
      titreFr: 'Momo',
      titreOriginal: 'Momo',
      langueOriginale: 'de',
      annee: '1973',
      forme: 'roman',
      estSerie: false,
      synopsis: '',
      etiquettes: [],
    })
    expect(etat.auteurs.map((a) => ({ nom: a.nom, role: a.role }))).toEqual([{ nom: 'Michael Ende', role: 'auteur' }])
    expect(etat.editions).toHaveLength(1)
    expect(etat.editions[0]).toMatchObject({
      publisher: 'Bayard jeunesse',
      language: 'fr',
      translator: 'Corinna Gepner',
      isbn: '9782747024693',
      pageCount: '430',
    })
    // L'édition trouvée par l'ISBN de mon exemplaire est la mienne.
    expect(etat.mienne).toBe(etat.editions[0].cle)
    expect(valider(etat)).toEqual({})
  })

  it('garde la source de chaque champ rempli, et de lui seul', () => {
    expect(depuisNotice(MOMO, '9782747024693').provenance).toEqual({
      titreFr: 'bnf',
      titreOriginal: 'bnf',
      langueOriginale: 'bnf',
      annee: 'open_library',
      auteurs: 'bnf',
      editeur: 'bnf',
      langue: 'bnf',
      traducteur: 'bnf',
      pages: 'google_books',
    })
    const presqueVide = depuisNotice({ ...NOTICE_VIDE, titre: { valeur: 'Sans rien', source: 'open_library' } }, '9782747024693')
    expect(presqueVide.provenance).toEqual({ titreFr: 'open_library' })
  })

  it('laisse vide ce que la notice ne dit pas : rien n’est complété', () => {
    const { etat } = depuisNotice({ ...NOTICE_VIDE, titre: { valeur: 'Sans rien', source: 'bnf' } }, '9782747024693')
    expect(etat).toMatchObject({ titreFr: 'Sans rien', titreOriginal: '', langueOriginale: '', annee: '', tonalite: null, exigence: null, longueur: null })
    expect(etat.auteurs.map((a) => a.nom)).toEqual([''])
    expect(etat.editions[0]).toMatchObject({ publisher: '', language: '', translator: '', pageCount: '', isbn: '9782747024693' })
    const envoi = versEnvoi(etat)
    expect(envoi.editions[0]).toMatchObject({ publisher: null, language: null, translator: null, page_count: null, isbn: '9782747024693' })
    expect(envoi.first_published_year).toBeNull()
  })

  it('pour l’ISBN d’un tome, prépare la série : l’ISBN va sur le tome, pas sur l’édition', () => {
    const vinland: Notice = {
      ...NOTICE_VIDE,
      titre: { valeur: 'Vinland saga', source: 'bnf' },
      auteurs: { valeur: ['Makoto Yukimura'], source: 'bnf' },
      editeur: { valeur: 'Kurokawa', source: 'bnf' },
      pages: { valeur: 213, source: 'bnf' },
      langue: { valeur: 'fr', source: 'bnf' },
      tome: { valeur: 3, source: 'bnf' },
      manga: true,
    }
    const { etat, tome, provenance } = depuisNotice(vinland, '9782351423578')
    expect(tome).toBe(3)
    expect(etat.estSerie).toBe(true)
    expect(etat.forme).toBe('manga')
    expect(etat.tomes).toEqual([
      { numero: 1, titre: '', isbn: '' },
      { numero: 2, titre: '', isbn: '' },
      { numero: 3, titre: '', isbn: '9782351423578' },
    ])
    // Le nombre de pages est celui du tome, pas celui de l'édition de la série.
    expect(etat.editions[0]).toMatchObject({ publisher: 'Kurokawa', language: 'fr', isbn: '', pageCount: '' })
    expect(provenance.pages).toBeUndefined()
    expect(provenance.tomes).toBe('bnf')
    expect(valider(etat)).toEqual({})
  })

  it('ne dit « manga » que si une source le dit', () => {
    expect(depuisNotice({ ...MOMO, tome: { valeur: 1, source: 'bnf' } }, '9782747024693').etat.forme).toBe('roman')
  })
})

describe('depuisResultat (ajout par titre)', () => {
  const RESULTAT: Resultat = {
    titre: { valeur: 'Le meilleur des mondes', source: 'bnf' },
    titreOriginal: { valeur: 'Brave new world', source: 'bnf' },
    auteurs: { valeur: ['Aldous Huxley'], source: 'bnf' },
    langueOriginale: { valeur: 'en', source: 'bnf' },
    annee: { valeur: 1932, source: 'open_library' },
    manga: false,
    serie: false,
    descriptions: [],
    couverture: null,
  }

  it('remplit la fiche commune à toutes les éditions, sans ISBN, éditeur ni pagination', () => {
    const { etat, provenance, tome } = depuisResultat(RESULTAT)
    expect(etat).toMatchObject({ titreFr: 'Le meilleur des mondes', titreOriginal: 'Brave new world', langueOriginale: 'en', annee: '1932' })
    expect(etat.auteurs.map((a) => a.nom)).toEqual(['Aldous Huxley'])
    expect(etat.editions).toEqual([])
    expect(etat.mienne).toBeNull()
    expect(etat.tomes).toEqual([])
    expect(tome).toBeNull()
    expect(provenance).toEqual({ titreFr: 'bnf', titreOriginal: 'bnf', langueOriginale: 'bnf', annee: 'open_library', auteurs: 'bnf' })
    const envoi = versEnvoi(etat)
    expect(envoi.editions).toEqual([])
    expect(envoi.volumes).toEqual([])
  })

  it('reconnaît une série et un manga, sans inventer son nombre de tomes', () => {
    const { etat } = depuisResultat({ ...RESULTAT, serie: true, manga: true })
    expect(etat).toMatchObject({ estSerie: true, forme: 'manga', tomes: [] })
  })
})

describe('pourFiche', () => {
  it('ne garde que des données bibliographiques publiques', () => {
    const { etat } = depuisNotice(MOMO, '9782747024693')
    const descriptions = [{ texte: 'Une orpheline et des voleurs de temps.', source: 'bnf' as const }]
    expect(pourFiche(etat, descriptions)).toEqual({
      titre: 'Momo',
      titreOriginal: 'Momo',
      auteurs: ['Michael Ende'],
      annee: 1973,
      langueOriginale: 'de',
      descriptions,
    })
  })

  it('n’envoie ni traducteur, ni éditeur, ni ISBN, ni pagination, ni rien de ce que j’aurais écrit', () => {
    const etat = { ...depuisNotice(MOMO, '9782747024693').etat, synopsis: 'Mon résumé à moi.' }
    etat.auteurs = [...etat.auteurs, ligneAuteur('Corinna Gepner', 'traducteur'), ligneAuteur('  ', 'auteur')]
    const envoye = pourFiche(etat, [])
    expect(Object.keys(envoye).sort()).toEqual(['annee', 'auteurs', 'descriptions', 'langueOriginale', 'titre', 'titreOriginal'])
    expect(envoye.auteurs).toEqual(['Michael Ende'])
    expect(JSON.stringify(envoye)).not.toMatch(/Gepner|Bayard|9782747024693|430|Mon résumé/)
  })

  it('omet ce qui est vide ou mal formé plutôt que de l’envoyer', () => {
    const etat = { ...etatVide(), titreFr: ' Sans rien ', annee: 'vers 1900', langueOriginale: '' }
    expect(pourFiche(etat, [])).toEqual({ titre: 'Sans rien', auteurs: [], descriptions: [] })
  })
})

describe('appliquerProposition', () => {
  const FICHE: FicheProposee = {
    synopsis: 'Une petite fille qui sait écouter affronte des voleurs de temps.',
    genres: ['Conte philosophique'],
    themes: ['Rapport au temps', 'Amitié'],
    atmospheres: ['Lumineuse'],
    themesNouveaux: ['Écoute'],
    tonalite: 4,
    exigence: 2,
    longueur: 'moyen',
  }

  it('remplit les champs encore vides et dit lesquels', () => {
    const { etat, remplis } = appliquerProposition(etatVide(), FICHE)
    expect(etat).toMatchObject({ synopsis: FICHE.synopsis, tonalite: 4, exigence: 2, longueur: 'moyen' })
    expect(etat.etiquettes).toEqual([
      { genre: 'genre', nom: 'Conte philosophique' },
      { genre: 'theme', nom: 'Rapport au temps' },
      { genre: 'theme', nom: 'Amitié' },
      { genre: 'atmosphere', nom: 'Lumineuse' },
    ])
    expect(remplis).toEqual(['synopsis', 'etiquettes', 'tonalite', 'exigence', 'longueur'])
  })

  it('ne met jamais un thème nouveau parmi mes étiquettes : il reste proposé à part', () => {
    const { etat } = appliquerProposition(etatVide(), FICHE)
    expect(etat.etiquettes.map((e) => e.nom)).not.toContain('Écoute')
  })

  it('ne remplace rien de ce que j’ai déjà écrit ou choisi', () => {
    const depart = { ...etatVide(), synopsis: 'Mon résumé.', tonalite: 1, longueur: 'court' as const, etiquettes: [{ genre: 'theme' as const, nom: 'Amitié' }] }
    const { etat, remplis } = appliquerProposition(depart, FICHE)
    expect(etat).toMatchObject({ synopsis: 'Mon résumé.', tonalite: 1, exigence: 2, longueur: 'court' })
    expect(etat.etiquettes.filter((e) => e.nom === 'Amitié')).toHaveLength(1)
    expect(etat.etiquettes).toHaveLength(4)
    expect(remplis).toEqual(['etiquettes', 'exigence'])
  })

  it('ne remplit rien quand l’IA n’a rien proposé', () => {
    const vide: FicheProposee = { synopsis: null, genres: [], themes: [], atmospheres: [], themesNouveaux: [], tonalite: null, exigence: null, longueur: null }
    const depart = etatVide()
    expect(appliquerProposition(depart, vide)).toEqual({ etat: depart, remplis: [] })
  })
})

describe('doublonsProches', () => {
  const oeuvre = (id: string, titre: string, auteurs: string[], titreSecondaire: string | null = null): OeuvreListee => ({
    id,
    titre,
    titreSecondaire,
    auteurs,
    genres: [],
    themes: [],
    atmospheres: [],
    statut: 'a_decouvrir',
    possession: 'non_possede',
    possessionsFiltrables: ['non_possede'],
    couverture: null,
  })
  const BIBLIOTHEQUE = [
    oeuvre('1', 'Le Meilleur des mondes', ['Aldous Huxley'], 'Brave New World'),
    oeuvre('2', 'Momo', ['Michael Ende']),
    oeuvre('3', 'L’Étranger', ['Albert Camus']),
    oeuvre('4', 'Crime et Châtiment', ['Fiodor Dostoïevski']),
  ]
  const ids = (titre: string, auteurs: string[] = []) => doublonsProches(titre, auteurs, BIBLIOTHEQUE).map((o) => o.id)

  it('reconnaît le même titre malgré la casse, les accents, l’article et la ponctuation', () => {
    expect(ids('le meilleur des mondes')).toEqual(['1'])
    expect(ids('Meilleur des mondes')).toEqual(['1'])
    expect(ids("L'etranger")).toEqual(['3'])
    expect(ids('Crime et châtiment.')).toEqual(['4'])
  })

  it('reconnaît aussi le titre original', () => {
    expect(ids('Brave new world')).toEqual(['1'])
  })

  it('tolère une ou deux lettres d’écart sur un titre assez long', () => {
    expect(ids('Crime et chatimant')).toEqual(['4'])
    expect(ids('Le meilleur des monde')).toEqual(['1'])
    // Trop court pour tolérer un écart : « Mono » n'est pas « Momo ».
    expect(ids('Mono')).toEqual([])
  })

  it('ne confond pas deux œuvres de même titre dont les auteurs sont connus et différents', () => {
    expect(ids('Momo', ['Mayu Sakai'])).toEqual([])
    expect(ids('Momo', ['Michael Ende'])).toEqual(['2'])
    expect(ids('Momo', ['Ende, Michael'])).toEqual(['2'])
    // Auteur inconnu d'un côté : dans le doute, on prévient.
    expect(ids('Momo')).toEqual(['2'])
  })

  it('ne signale rien pour un titre différent', () => {
    expect(ids('La Peste', ['Albert Camus'])).toEqual([])
    expect(ids('')).toEqual([])
  })
})

describe('libelleSource', () => {
  it('nomme chaque source comme on la dit', () => {
    expect(libelleSource('bnf')).toBe('la BnF')
    expect(libelleSource('google_books')).toBe('Google Books')
    expect(libelleSource('open_library')).toBe('Open Library')
  })
})
