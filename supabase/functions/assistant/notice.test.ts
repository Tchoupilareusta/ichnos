// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fusionnerNotice, grouperResultats } from './notice.ts'
import { lireNoticesBnf, type NoticeBnf } from './sources/bnf.ts'
import type { VolumeGoogle } from './sources/google.ts'
import type { EditionOpenLibrary, OeuvreOpenLibrary } from './sources/openLibrary.ts'

const echantillon = (nom: string) => readFileSync(new URL(`./echantillons/${nom}`, import.meta.url), 'utf8')

const bnf = (champs: Partial<NoticeBnf>): NoticeBnf => ({
  isbn: null,
  titre: null,
  tome: null,
  auteurs: [],
  signature: null,
  traducteur: null,
  editeur: null,
  pages: null,
  langue: null,
  langueOriginale: null,
  titreOriginal: null,
  description: null,
  ...champs,
})
const google = (champs: Partial<VolumeGoogle>): VolumeGoogle => ({
  id: 'zyTCAlFPjgYC',
  titre: null,
  auteurs: [],
  editeur: null,
  pages: null,
  langue: null,
  description: null,
  manga: false,
  aCouverture: false,
  isbn13: [],
  ...champs,
})
const edition = (champs: Partial<EditionOpenLibrary>): EditionOpenLibrary => ({
  titre: null,
  editeur: null,
  pages: null,
  langue: null,
  traducteur: null,
  langueOriginale: null,
  titreOriginal: null,
  aCouverture: false,
  ...champs,
})

describe('fusionnerNotice', () => {
  const ISBN = '9782747024693'

  it('donne la priorité à la BnF, puis à Google Books, puis à Open Library, et garde la source de chaque champ', () => {
    const { trouve, notice } = fusionnerNotice(ISBN, {
      bnf: [bnf({ isbn: ISBN, titre: 'Momo', auteurs: ['Michael Ende'], editeur: 'Bayard jeunesse', langue: 'fr', titreOriginal: 'Momo' })],
      google: [google({ isbn13: [ISBN], titre: 'MOMO', editeur: 'Bayard', pages: 430, langue: 'fr' })],
      edition: edition({ titre: 'Momo (OL)', pages: 432, traducteur: 'Corinna Gepner', langueOriginale: 'de' }),
      oeuvres: [{ titre: 'Momo oder Die seltsame Geschichte von den Zeit-Dieben', auteurs: ['Michael Ende'], annee: 1973, couverture: 8574580 }],
    })
    expect(trouve).toBe(true)
    expect(notice.titre).toEqual({ valeur: 'Momo', source: 'bnf' })
    expect(notice.auteurs).toEqual({ valeur: ['Michael Ende'], source: 'bnf' })
    expect(notice.editeur).toEqual({ valeur: 'Bayard jeunesse', source: 'bnf' })
    expect(notice.pages).toEqual({ valeur: 430, source: 'google_books' })
    expect(notice.traducteur).toEqual({ valeur: 'Corinna Gepner', source: 'open_library' })
    expect(notice.langueOriginale).toEqual({ valeur: 'de', source: 'open_library' })
    expect(notice.annee).toEqual({ valeur: 1973, source: 'open_library' })
  })

  it('écrit le nom de l’auteur comme sur le livre, plutôt que sous sa forme savante', () => {
    const auteurs = (noticeBnf: Partial<NoticeBnf>) =>
      fusionnerNotice(ISBN, { bnf: [bnf({ isbn: ISBN, titre: 'Crime et châtiment', ...noticeBnf })], google: [], edition: null, oeuvres: [] }).notice.auteurs
    expect(auteurs({ auteurs: ['Fedor Mihajlovič Dostoevskij'], signature: 'Fiodor Dostoïevski' })).toEqual({
      valeur: ['Fiodor Dostoïevski'],
      source: 'bnf',
    })
    // Sans signature lisible, ou avec plusieurs auteurs, on garde les noms du catalogue.
    expect(auteurs({ auteurs: ['Fedor Mihajlovič Dostoevskij'], signature: null })?.valeur).toEqual(['Fedor Mihajlovič Dostoevskij'])
    expect(auteurs({ auteurs: ['Alice Desbiolles', 'Anne Defréville'], signature: 'Alice Desbiolles' })?.valeur).toEqual([
      'Alice Desbiolles',
      'Anne Defréville',
    ])
  })

  it('laisse vide ce qu’aucune source ne donne', () => {
    const { notice } = fusionnerNotice(ISBN, {
      bnf: [bnf({ isbn: ISBN, titre: 'Momo' })],
      google: [],
      edition: null,
      oeuvres: [],
    })
    expect(notice).toEqual({
      titre: { valeur: 'Momo', source: 'bnf' },
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
    })
  })

  it('dit « pas trouvé » quand aucune source ne connaît l’ISBN', () => {
    const resultat = fusionnerNotice(ISBN, { bnf: [], google: [], edition: null, oeuvres: [] })
    expect(resultat.trouve).toBe(false)
    expect(resultat.notice.titre).toBeNull()
    expect(resultat.couverture).toBeNull()
    expect(resultat.descriptions).toEqual([])
  })

  it('écarte un volume Google qui ne porte pas cet ISBN', () => {
    const { trouve, notice } = fusionnerNotice(ISBN, {
      bnf: [],
      google: [google({ isbn13: ['9782070368228'], titre: 'Un autre livre', pages: 100 })],
      edition: null,
      oeuvres: [],
    })
    expect(trouve).toBe(false)
    expect(notice.pages).toBeNull()
  })

  it('ne garde l’année d’Open Library que si elle se rapporte clairement à l’œuvre originale', () => {
    const annee = (noticeBnf: Partial<NoticeBnf>, ol: Partial<EditionOpenLibrary> | null, titreOeuvre: string) =>
      fusionnerNotice(ISBN, {
        bnf: [bnf({ isbn: ISBN, titre: 'Le meilleur des mondes', ...noticeBnf })],
        google: [],
        edition: ol ? edition({ titre: 'Le meilleur des mondes', ...ol }) : null,
        oeuvres: [{ titre: titreOeuvre, auteurs: ['Aldous Huxley'], annee: 1932, couverture: null }],
      }).notice.annee
    // Le titre de l'œuvre trouvée est bien le titre original : l'année est la sienne.
    expect(annee({ titreOriginal: 'Brave new world' }, null, 'Brave New World')).toEqual({ valeur: 1932, source: 'open_library' })
    // L'œuvre trouvée porte le titre français : c'est peut-être la fiche d'une traduction. On ne garde rien.
    expect(annee({ titreOriginal: 'Brave new world' }, null, 'Le meilleur des mondes')).toBeNull()
    // Une traduction dont on ignore le titre original : rien non plus.
    expect(annee({ langue: 'fr', langueOriginale: 'en' }, null, 'Le meilleur des mondes')).toBeNull()
    expect(annee({}, { traducteur: 'Jules Castier' }, 'Le meilleur des mondes')).toBeNull()
    // Le tome d'une série : son année n'est pas celle de la série.
    expect(annee({ tome: 3 }, null, 'Le meilleur des mondes')).toBeNull()
    // Une œuvre que rien ne signale comme traduite : l'année est gardée.
    expect(annee({ langue: 'fr' }, null, 'Le meilleur des mondes')).toEqual({ valeur: 1932, source: 'open_library' })
  })

  it('reconnaît le tome d’une série et le manga', () => {
    const [vinland] = lireNoticesBnf(echantillon('bnf-vinland1.xml'))
    const { notice } = fusionnerNotice('9782351423554', {
      bnf: [vinland],
      google: [google({ isbn13: ['9782351423554'], manga: true })],
      edition: null,
      oeuvres: [],
    })
    expect(notice.titre).toEqual({ valeur: 'Vinland saga', source: 'bnf' })
    expect(notice.tome).toEqual({ valeur: 1, source: 'bnf' })
    expect(notice.manga).toBe(true)
  })

  it('rassemble les descriptions de la BnF et de Google Books, jamais celles d’Open Library', () => {
    const { descriptions } = fusionnerNotice(ISBN, {
      bnf: [bnf({ isbn: ISBN, titre: 'Momo', description: 'Résumé de la BnF.' })],
      google: [google({ isbn13: [ISBN], description: 'Présentation de Google.' })],
      edition: edition({ titre: 'Momo' }),
      oeuvres: [],
    })
    expect(descriptions).toEqual([
      { texte: 'Résumé de la BnF.', source: 'bnf' },
      { texte: 'Présentation de Google.', source: 'google_books' },
    ])
  })

  it('coupe une description démesurée', () => {
    const { descriptions } = fusionnerNotice(ISBN, {
      bnf: [],
      google: [google({ isbn13: [ISBN], titre: 'Momo', description: 'a'.repeat(9000) })],
      edition: null,
      oeuvres: [],
    })
    expect(descriptions[0].texte.length).toBeLessThanOrEqual(4000)
  })

  it('propose la couverture de Google Books d’abord, sinon celle de l’édition sur Open Library', () => {
    const sources = { bnf: [bnf({ isbn: ISBN, titre: 'Momo' })], oeuvres: [] as OeuvreOpenLibrary[] }
    expect(
      fusionnerNotice(ISBN, { ...sources, google: [google({ isbn13: [ISBN], aCouverture: true })], edition: edition({ aCouverture: true }) })
        .couverture,
    ).toEqual({ source: 'google_books', id: 'zyTCAlFPjgYC' })
    expect(fusionnerNotice(ISBN, { ...sources, google: [], edition: edition({ titre: 'Momo', aCouverture: true }) }).couverture).toEqual({
      source: 'open_library',
      isbn: ISBN,
    })
    expect(fusionnerNotice(ISBN, { ...sources, google: [], edition: null }).couverture).toBeNull()
  })
})

describe('grouperResultats', () => {
  it('rassemble les éditions d’une même œuvre en un seul résultat, d’après de vraies notices', () => {
    const resultats = grouperResultats('Momo', {
      bnf: lireNoticesBnf(echantillon('bnf-titre-momo.xml')),
      google: [],
      oeuvres: [],
    })
    expect(resultats).toHaveLength(1)
    expect(resultats[0].titre).toEqual({ valeur: 'Momo', source: 'bnf' })
    expect(resultats[0].auteurs).toEqual({ valeur: ['Michael Ende'], source: 'bnf' })
    expect(resultats[0].langueOriginale).toEqual({ valeur: 'de', source: 'bnf' })
    expect(resultats[0].titreOriginal).toEqual({ valeur: 'Momo', source: 'bnf' })
    expect(resultats[0].descriptions[0]).toMatchObject({ source: 'bnf' })
    // Une fiche commune à toutes les éditions : ni ISBN, ni éditeur, ni pagination dans un résultat.
    expect(Object.keys(resultats[0]).sort()).toEqual(
      ['annee', 'auteurs', 'couverture', 'descriptions', 'langueOriginale', 'manga', 'serie', 'titre', 'titreOriginal'].sort(),
    )
  })

  it('sépare deux œuvres de même titre et d’auteurs différents', () => {
    const resultats = grouperResultats('Le meilleur des mondes', {
      bnf: [
        bnf({ titre: 'Le meilleur des mondes', auteurs: ['Aldous Huxley'], langue: 'fr', langueOriginale: 'en', titreOriginal: 'Brave new world' }),
        bnf({ titre: 'Le Meilleur des mondes', auteurs: ['Aldous Huxley'], langue: 'fr' }),
        bnf({ titre: 'Le meilleur des mondes', auteurs: ['Autre Auteur'], langue: 'fr' }),
        bnf({ titre: 'Étude sur Huxley, "Le meilleur des mondes"', auteurs: ['Suzanne Henderson'], langue: 'fr' }),
        bnf({ titre: 'Le meilleur des mondes', auteurs: [], langue: 'fr' }),
      ],
      google: [],
      oeuvres: [],
    })
    expect(resultats.map((r) => r.auteurs?.valeur)).toEqual([['Aldous Huxley'], ['Autre Auteur']])
    expect(resultats[0].titreOriginal).toEqual({ valeur: 'Brave new world', source: 'bnf' })
  })

  it('complète un résultat de la BnF avec la description de Google Books et l’année d’Open Library', () => {
    const [resultat] = grouperResultats('Le meilleur des mondes', {
      bnf: [bnf({ titre: 'Le meilleur des mondes', auteurs: ['Aldous Huxley'], langue: 'fr', titreOriginal: 'Brave new world' })],
      google: [google({ titre: 'Le meilleur des mondes', auteurs: ['Aldous Huxley'], description: 'Une société parfaite.', aCouverture: true })],
      oeuvres: [{ titre: 'Brave New World', auteurs: ['Aldous Huxley'], annee: 1932, couverture: 42 }],
    })
    expect(resultat.descriptions).toEqual([{ texte: 'Une société parfaite.', source: 'google_books' }])
    expect(resultat.annee).toEqual({ valeur: 1932, source: 'open_library' })
    expect(resultat.couverture).toEqual({ source: 'google_books', id: 'zyTCAlFPjgYC' })
  })

  it('ne prend pas pour l’année de l’œuvre celle d’une traduction', () => {
    const [resultat] = grouperResultats('Le meilleur des mondes', {
      bnf: [bnf({ titre: 'Le meilleur des mondes', auteurs: ['Aldous Huxley'], langue: 'fr', langueOriginale: 'en', titreOriginal: 'Brave new world' })],
      google: [],
      oeuvres: [{ titre: 'Le meilleur des mondes', auteurs: ['Aldous Huxley'], annee: 1976, couverture: 9 }],
    })
    expect(resultat.annee).toBeNull()
    // La couverture, elle, peut venir de l'édition française.
    expect(resultat.couverture).toEqual({ source: 'open_library', numero: 9 })
  })

  it('range d’abord le titre exact, et ne crée pas de résultat pour un titre seulement voisin hors BnF', () => {
    const resultats = grouperResultats('Momo', {
      bnf: [
        bnf({ titre: 'Momo et les autres', auteurs: ['Un Autre'], langue: 'fr' }),
        bnf({ titre: 'Momo et les autres', auteurs: ['Un Autre'], langue: 'fr' }),
        bnf({ titre: 'Momo', auteurs: ['Michael Ende'], langue: 'fr' }),
      ],
      google: [google({ titre: 'Momo, mon ami', auteurs: ['Encore Un'] })],
      oeuvres: [
        { titre: 'Momo en de tijdspaarders', auteurs: ['Michael Ende'], annee: 1975, couverture: 3 },
        { titre: 'Momo', auteurs: ['Quelqu’un D’autre'], annee: 2001, couverture: null },
      ],
    })
    // L'homonyme que seul Open Library connaît est écarté : la BnF a déjà le titre exact.
    expect(resultats.map((r) => r.auteurs?.valeur[0])).toEqual(['Michael Ende', 'Un Autre'])
  })

  it('ne prête pas l’année d’une autre œuvre du même auteur', () => {
    const [resultat] = grouperResultats('Le meilleur des mondes', {
      bnf: [bnf({ titre: 'Le meilleur des mondes', auteurs: ['Aldous Huxley'], langue: 'fr', titreOriginal: 'Brave new world' })],
      google: [],
      oeuvres: [{ titre: 'Island', auteurs: ['Aldous Huxley'], annee: 1962, couverture: null }],
    })
    expect(resultat.annee).toBeNull()
  })

  it('garde un résultat que seules Google Books ou Open Library connaissent', () => {
    const resultats = grouperResultats('Piranesi', {
      bnf: [],
      google: [google({ titre: 'Piranesi', auteurs: ['Susanna Clarke'], description: 'Une maison infinie.' })],
      oeuvres: [{ titre: 'Piranesi', auteurs: ['Susanna Clarke'], annee: 2020, couverture: 7 }],
    })
    expect(resultats).toHaveLength(1)
    expect(resultats[0].titre).toEqual({ valeur: 'Piranesi', source: 'google_books' })
    expect(resultats[0].annee).toEqual({ valeur: 2020, source: 'open_library' })
    expect(resultats[0].couverture).toEqual({ source: 'open_library', numero: 7 })
  })

  it('ignore les accents, la casse et l’ordre du nom et du prénom pour reconnaître un auteur', () => {
    const resultats = grouperResultats('vinland saga', {
      bnf: [bnf({ titre: 'Vinland saga', auteurs: ['Makoto Yukimura'], langue: 'fr', tome: 1 })],
      google: [google({ titre: 'Vinland Saga', auteurs: ['Yukimura Makoto'], manga: true })],
      oeuvres: [],
    })
    expect(resultats).toHaveLength(1)
    expect(resultats[0].manga).toBe(true)
  })

  it('reconnaît une série à ses tomes, et ne lui prête pas l’année d’un tome', () => {
    const [resultat] = grouperResultats('Chainsaw man', {
      bnf: [
        bnf({ titre: 'Chainsaw man', auteurs: ['Tatsuki Fujimoto'], langue: 'fr', tome: 1, titreOriginal: 'Chainsaw man' }),
        bnf({ titre: 'Chainsaw man', auteurs: ['Tatsuki Fujimoto'], langue: 'fr', tome: 2, titreOriginal: 'Chainsaw man' }),
      ],
      google: [],
      oeuvres: [{ titre: 'Chainsaw Man', auteurs: ['Tatsuki Fujimoto'], annee: 2020, couverture: 12 }],
    })
    expect(resultat.serie).toBe(true)
    expect(resultat.annee).toBeNull()
    expect(resultat.couverture).toEqual({ source: 'open_library', numero: 12 })
  })

  it('regroupe les éditions d’un auteur signé de plusieurs façons, et affiche la signature la plus courante', () => {
    const dostoievski = (signature: string | null) =>
      bnf({ titre: 'Crime et châtiment', auteurs: ['Fedor Mihajlovič Dostoevskij'], signature, langue: 'fr', langueOriginale: 'ru' })
    const resultats = grouperResultats('Crime et châtiment', {
      bnf: [dostoievski('Dostoïevski'), dostoievski('Fiodor Dostoïevski'), dostoievski('F. M. Dostoïevski'), dostoievski('Fiodor Dostoïevski'), dostoievski(null)],
      google: [google({ titre: 'Crime et châtiment', auteurs: ['Fiodor Dostoïevski'], description: 'Un étudiant, une hache.' })],
      oeuvres: [{ titre: 'Crime et Châtiment', auteurs: ['Fiodor Dostoïevski'], annee: 2017, couverture: 13 }],
    })
    expect(resultats).toHaveLength(1)
    expect(resultats[0].auteurs).toEqual({ valeur: ['Fiodor Dostoïevski'], source: 'bnf' })
    expect(resultats[0].descriptions).toEqual([{ texte: 'Un étudiant, une hache.', source: 'google_books' }])
    expect(resultats[0].couverture).toEqual({ source: 'open_library', numero: 13 })
    // L'année d'une fiche au titre français d'une œuvre traduite n'est pas retenue.
    expect(resultats[0].annee).toBeNull()
  })

  it('quand la BnF connaît le titre exact, écarte ce que seuls les autres catalogues proposent', () => {
    const resultats = grouperResultats('Crime et châtiment', {
      bnf: [bnf({ titre: 'Crime et châtiment', auteurs: ['Fedor Mihajlovič Dostoevskij'], signature: 'Fiodor Dostoïevski', langue: 'fr' })],
      google: [google({ titre: 'Crime et châtiment', auteurs: ['Un Commentateur'] })],
      oeuvres: [{ titre: '"Crime et châtiment."', auteurs: ['Perrot, Jean'], annee: 1970, couverture: null }],
    })
    expect(resultats.map((r) => r.auteurs?.valeur[0])).toEqual(['Fiodor Dostoïevski'])
  })

  it('rend au plus huit résultats, et rien pour une recherche sans réponse', () => {
    const beaucoup = Array.from({ length: 12 }, (_, rang) => bnf({ titre: 'Poèmes', auteurs: [`Auteur ${rang}`], langue: 'fr' }))
    expect(grouperResultats('Poèmes', { bnf: beaucoup, google: [], oeuvres: [] })).toHaveLength(8)
    expect(grouperResultats('Introuvable', { bnf: [], google: [], oeuvres: [] })).toEqual([])
  })
})
