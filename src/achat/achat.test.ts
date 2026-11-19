import { noticeFictive } from '../ajout/assistant.fictif'
import { preparerAchat, titreRessemble } from './achat'

describe('titreRessemble', () => {
  it('reconnaît le même titre malgré la casse, les accents et l’article', () => {
    expect(titreRessemble('L’ÉTRANGER', ['L’Étranger'])).toBe(true)
    expect(titreRessemble('Etranger', ['L’Étranger'])).toBe(true)
    expect(titreRessemble('Vinland saga', ['Vinland Saga', null])).toBe(true)
  })

  it('accepte un sous-titre en plus, d’un côté ou de l’autre', () => {
    expect(titreRessemble('Momo ou la Mystérieuse histoire des voleurs de temps', ['Momo'])).toBe(true)
    expect(titreRessemble('Elden Ring', ['Elden Ring : Le chemin vers l’Arbre-Monde'])).toBe(true)
  })

  it('compare aussi au titre original', () => {
    expect(titreRessemble('Nineteen Eighty-Four', ['1984', 'Nineteen Eighty-Four'])).toBe(true)
  })

  it('tolère une faute de frappe dans un titre assez long', () => {
    expect(titreRessemble('Crime et chatiments', ['Crime et Châtiment'])).toBe(true)
  })

  it('dit non quand c’est un autre livre', () => {
    expect(titreRessemble('La Peste', ['L’Étranger', 'The Stranger'])).toBe(false)
    expect(titreRessemble('Momotaro', ['Momo'])).toBe(false)
  })

  it('sans titre à comparer, ne dit rien', () => {
    expect(titreRessemble('', ['Momo'])).toBe(true)
    expect(titreRessemble('La Peste', [null, ''])).toBe(true)
  })
})

describe('preparerAchat', () => {
  const ISBN = '9782070360024'

  it('envoie l’ISBN et ce que les catalogues donnent, rien d’autre', () => {
    const notice = noticeFictive({
      titre: { valeur: 'L’Étranger', source: 'bnf' },
      auteurs: { valeur: ['Albert Camus'], source: 'bnf' },
      editeur: { valeur: 'Gallimard', source: 'bnf' },
      pages: { valeur: 186, source: 'google_books' },
      langue: { valeur: 'fr', source: 'bnf' },
      annee: { valeur: 1942, source: 'open_library' },
    })
    expect(preparerAchat({ isbn: ISBN, notice, tome: null, couverture: 'moi/abc.jpg' })).toEqual({
      isbn: ISBN,
      publisher: 'Gallimard',
      language: 'fr',
      page_count: 186,
      couverture: 'moi/abc.jpg',
    })
  })

  it('laisse vide ce qu’aucune source ne donne', () => {
    expect(preparerAchat({ isbn: ISBN, notice: noticeFictive(), tome: null, couverture: null })).toEqual({ isbn: ISBN })
    expect(preparerAchat({ isbn: ISBN, notice: null, tome: null, couverture: null })).toEqual({ isbn: ISBN })
  })

  it('pour un tome, n’envoie que l’ISBN, le numéro du tome et la couverture', () => {
    const notice = noticeFictive({ editeur: { valeur: 'Kurokawa', source: 'bnf' }, pages: { valeur: 220, source: 'bnf' }, tome: { valeur: 2, source: 'bnf' } })
    expect(preparerAchat({ isbn: ISBN, notice, tome: 2, couverture: 'moi/t2.jpg' })).toEqual({ isbn: ISBN, tome: 2, couverture: 'moi/t2.jpg' })
    expect(preparerAchat({ isbn: ISBN, notice, tome: 2, couverture: null })).toEqual({ isbn: ISBN, tome: 2 })
  })
})
