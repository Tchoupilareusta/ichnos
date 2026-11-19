// @vitest-environment node
// Lecture des réponses des trois sources. Les échantillons de la BnF et d'Open Library sont de
// vraies réponses publiques, réduites aux champs lus ; celui de Google Books suit la forme documentée.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adresseBnfIsbn, adresseBnfTitre, lireNoticesBnf } from './sources/bnf.ts'
import { lireVolumesGoogle } from './sources/google.ts'
import { lireEditionOpenLibrary, lireRechercheOpenLibrary } from './sources/openLibrary.ts'

const echantillon = (nom: string) => readFileSync(new URL(`./echantillons/${nom}`, import.meta.url), 'utf8')

describe('BnF', () => {
  it('lit l’édition française de Momo : titre, auteur, traductrice, éditeur, pages, langues', () => {
    const [notice] = lireNoticesBnf(echantillon('bnf-momo.xml'))
    expect(notice).toMatchObject({
      isbn: '9782747024693',
      titre: 'Momo',
      tome: null,
      auteurs: ['Michael Ende'],
      signature: 'Michael Ende',
      traducteur: 'Corinna Gepner',
      editeur: 'Bayard jeunesse',
      pages: 430,
      langue: 'fr',
      langueOriginale: 'de',
      titreOriginal: 'Momo',
    })
    expect(notice.description).toMatch(/^Dans une ville du Sud/)
  })

  it('lit un tome de manga : le titre est celui de la série, le numéro de tome est à part', () => {
    const [notice] = lireNoticesBnf(echantillon('bnf-vinland1.xml'))
    expect(notice).toMatchObject({
      isbn: '9782351423554',
      titre: 'Vinland saga',
      tome: 1,
      auteurs: ['Makoto Yukimura'],
      traducteur: null,
      editeur: 'Kurokawa',
      pages: 213,
      langue: 'fr',
      // La notice ne code pas la langue d'origine : elle reste inconnue, on ne la devine pas.
      langueOriginale: null,
      titreOriginal: null,
      description: null,
    })
  })

  it('lit toutes les notices d’une recherche par titre', () => {
    const notices = lireNoticesBnf(echantillon('bnf-titre-momo.xml'))
    expect(notices).toHaveLength(11)
    expect(notices.filter((n) => n.langue === 'fr').length).toBeGreaterThanOrEqual(4)
  })

  it('lit le nom de l’auteur tel qu’il est imprimé sur le livre, quand c’est bien un nom', () => {
    const notice = (mention: string) =>
      lireNoticesBnf(
        '<srw:record><mxc:datafield tag="200" ind1="1" ind2=" "><mxc:subfield code="a">Crime et châtiment</mxc:subfield>' +
          `<mxc:subfield code="f">${mention}</mxc:subfield></mxc:datafield>` +
          '<mxc:datafield tag="700" ind1=" " ind2="|"><mxc:subfield code="a">Dostoevskij</mxc:subfield>' +
          '<mxc:subfield code="b">Fedor Mihajlovič</mxc:subfield><mxc:subfield code="4">070</mxc:subfield></mxc:datafield></srw:record>',
      )[0]
    // La forme savante du catalogue reste disponible pour reconnaître l'auteur d'une édition à l'autre.
    expect(notice('Fiodor Dostoïevski').auteurs).toEqual(['Fedor Mihajlovič Dostoevskij'])
    expect(notice('Fiodor Dostoïevski').signature).toBe('Fiodor Dostoïevski')
    expect(notice('F. M. Dostoïevski').signature).toBe('F. M. Dostoïevski')
    expect(notice('Antoine de Saint-Exupéry').signature).toBe('Antoine de Saint-Exupéry')
    // Ce qui n'est pas un simple nom n'est pas pris pour une signature.
    for (const mention of ['collection dirigée par Jean Duché', '[dir. publ. Olivier Rubinstein]', 'Suzanne Henderson,...', 'Claude Mertens et Serge De Waersegger', 'adapté par Marthe Bernard']) {
      expect(notice(mention).signature, mention).toBeNull()
    }
  })

  it('ne devine pas une pagination ambiguë', () => {
    const xml = (pagination: string) =>
      `<srw:record><mxc:datafield tag="200" ind1="1" ind2=" "><mxc:subfield code="a">Essai</mxc:subfield></mxc:datafield>` +
      `<mxc:datafield tag="215" ind1=" " ind2=" "><mxc:subfield code="a">${pagination}</mxc:subfield></mxc:datafield></srw:record>`
    expect(lireNoticesBnf(xml('1 vol. (430 p.)'))[0].pages).toBe(430)
    expect(lireNoticesBnf(xml('213 p.'))[0].pages).toBe(213)
    expect(lireNoticesBnf(xml('2 vol. (312, 280 p.)'))[0].pages).toBeNull()
    expect(lireNoticesBnf(xml('1 vol. (non paginé)'))[0].pages).toBeNull()
  })

  it('décode les caractères codés du XML', () => {
    const xml =
      `<srw:record><mxc:datafield tag="200" ind1="1" ind2=" "><mxc:subfield code="a">Guerre &amp; paix &#233;ternelle</mxc:subfield></mxc:datafield></srw:record>`
    expect(lireNoticesBnf(xml)[0].titre).toBe('Guerre & paix éternelle')
  })

  it('rend une liste vide pour une réponse sans notice ou illisible', () => {
    expect(lireNoticesBnf('<srw:numberOfRecords>0</srw:numberOfRecords>')).toEqual([])
    expect(lireNoticesBnf('')).toEqual([])
  })

  it('construit ses adresses sans jamais laisser passer de guillemet dans la requête', () => {
    expect(adresseBnfIsbn('9782747024693')).toContain(encodeURIComponent('bib.isbn any "9782747024693"'))
    const adresse = adresseBnfTitre('Momo" or bib.title all "x', 'Ende')
    expect(adresse.startsWith('https://catalogue.bnf.fr/api/SRU?')).toBe(true)
    expect(decodeURIComponent(adresse)).toContain('bib.title all "Momo or bib.title all x" and bib.author all "Ende"')
  })
})

describe('Google Books', () => {
  const reponse = {
    kind: 'books#volumes',
    totalItems: 1,
    items: [
      {
        id: 'zyTCAlFPjgYC',
        volumeInfo: {
          title: 'Momo',
          authors: ['Michael Ende'],
          publisher: 'Bayard Jeunesse',
          publishedDate: '2009',
          description: 'Momo, une petite fille, affronte les hommes gris.',
          industryIdentifiers: [
            { type: 'ISBN_10', identifier: '2747024695' },
            { type: 'ISBN_13', identifier: '9782747024693' },
          ],
          pageCount: 430,
          categories: ['Juvenile Fiction'],
          imageLinks: { thumbnail: 'http://books.google.com/books/content?id=zyTCAlFPjgYC&img=1' },
          language: 'fr',
        },
      },
    ],
  }

  it('lit un volume', () => {
    expect(lireVolumesGoogle(reponse)).toEqual([
      {
        id: 'zyTCAlFPjgYC',
        titre: 'Momo',
        auteurs: ['Michael Ende'],
        editeur: 'Bayard Jeunesse',
        pages: 430,
        langue: 'fr',
        description: 'Momo, une petite fille, affronte les hommes gris.',
        manga: false,
        aCouverture: true,
        isbn13: ['9782747024693'],
      },
    ])
  })

  it('laisse vide ce que Google ne donne pas, et ignore une pagination nulle', () => {
    const [volume] = lireVolumesGoogle({ items: [{ id: 'abcdef123456', volumeInfo: { title: 'Sans rien', pageCount: 0 } }] })
    expect(volume).toEqual({
      id: 'abcdef123456',
      titre: 'Sans rien',
      auteurs: [],
      editeur: null,
      pages: null,
      langue: null,
      description: null,
      manga: false,
      aCouverture: false,
      isbn13: [],
    })
  })

  it('reconnaît un manga à sa catégorie', () => {
    const [volume] = lireVolumesGoogle({
      items: [{ id: 'abcdef123456', volumeInfo: { title: 'Vinland Saga', categories: ['Comics & Graphic Novels / Manga / Historical Fiction'] } }],
    })
    expect(volume.manga).toBe(true)
  })

  it('écarte un volume dont l’identifiant ne ressemble pas à un identifiant', () => {
    expect(lireVolumesGoogle({ items: [{ id: 'https://exemple.test/x', volumeInfo: { title: 'Piège' } }] })).toEqual([])
  })

  it('rend une liste vide pour une réponse vide ou illisible', () => {
    expect(lireVolumesGoogle({ totalItems: 0 })).toEqual([])
    expect(lireVolumesGoogle(null)).toEqual([])
    expect(lireVolumesGoogle('erreur')).toEqual([])
  })
})

describe('Open Library', () => {
  it('lit une édition : éditeur, pages, langue, traductrice, langue d’origine', () => {
    expect(lireEditionOpenLibrary(JSON.parse(echantillon('ol-edition-momo.json')))).toEqual({
      titre: 'Momo',
      editeur: 'Bayard Jeunesse',
      pages: 430,
      langue: 'fr',
      traducteur: 'Corinna Gepner',
      langueOriginale: 'de',
      titreOriginal: 'Momo',
      couverture: 8751329,
    })
    expect(lireEditionOpenLibrary({ title: 'Sans image', covers: [-1, 'x'] })?.couverture).toBeNull()
  })

  it('lit une recherche : auteur, année de première publication, numéro de couverture', () => {
    expect(lireRechercheOpenLibrary(JSON.parse(echantillon('ol-recherche-momo.json')))).toEqual([
      {
        titre: 'Momo oder Die seltsame Geschichte von den Zeit-Dieben und von dem Kind, das den Menschen die gestohlene Zeit zurückbrachte',
        auteurs: ['Michael Ende'],
        annee: 1973,
        couverture: 8574580,
      },
    ])
  })

  it('retire les dates accolées au nom d’un auteur', () => {
    const [oeuvre] = lireRechercheOpenLibrary({ docs: [{ title: 'Momo', author_name: ['Michael Ende (1929-1995)', 'Ende, Michael 1929-1995'] }] })
    expect(oeuvre.auteurs).toEqual(['Michael Ende', 'Ende, Michael'])
  })

  it('rend rien pour une réponse vide ou illisible', () => {
    expect(lireEditionOpenLibrary({ error: 'notfound' })).toBeNull()
    expect(lireEditionOpenLibrary(null)).toBeNull()
    expect(lireRechercheOpenLibrary({ docs: [] })).toEqual([])
    expect(lireRechercheOpenLibrary('erreur')).toEqual([])
  })
})
