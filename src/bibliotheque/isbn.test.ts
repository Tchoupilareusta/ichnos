import { isbnAffiche, isbnEnChiffres, isbnEnSaisie, saisirIsbn } from './isbn'

describe('isbnAffiche', () => {
  it.each([
    ['9782253008484', '978-2-253-00848-4'], // Siddhartha, Le Livre de poche
    ['9782070360024', '978-2-07-036002-4'], // L'Étranger, Folio
    ['9782081510852', '978-2-08-151085-2'], // Le Gai Savoir, GF
    ['9780140817690', '978-0-14-081769-0'], // une édition anglaise
    ['9782351423561', '978-2-35142-356-1'], // Vinland Saga, tome 2
  ])('place les tirets de %s', (isbn, attendu) => {
    expect(isbnAffiche(isbn)).toBe(attendu)
  })

  it('accepte un ISBN à 10 caractères', () => {
    expect(isbnAffiche('2070360024')).toBe('2-07-036002-4')
    expect(isbnAffiche('080442957X')).toBe('0-8044-2957-X')
  })

  it('rend les mêmes tirets, que l’ISBN arrive avec ou sans tirets', () => {
    expect(isbnAffiche('978 2 07 036002 4')).toBe('978-2-07-036002-4')
    expect(isbnAffiche('978-2070360024')).toBe('978-2-07-036002-4')
  })

  it('hors des plages connues, rend l’ISBN sans tirets : jamais de tirets devinés', () => {
    expect(isbnAffiche('9790000000000')).toBe('9790000000000')
  })

  it('laisse tel quel ce qui n’est pas un ISBN complet', () => {
    expect(isbnAffiche('97820703')).toBe('97820703')
    expect(isbnAffiche('')).toBe('')
  })
})

describe('isbnEnChiffres', () => {
  it('sépare les chiffres par des espaces, pour être lu chiffre par chiffre', () => {
    expect(isbnEnChiffres('9782253008484')).toBe('9 7 8 2 2 5 3 0 0 8 4 8 4')
    expect(isbnEnChiffres('978-2-253-00848-4')).toBe('9 7 8 2 2 5 3 0 0 8 4 8 4')
  })
})

describe('isbnEnSaisie', () => {
  it('place les tirets au fil de la frappe, dès que le début saisi le permet', () => {
    const frappes = [...'9782070360024'].map((_, rang, tout) => isbnEnSaisie(tout.slice(0, rang + 1).join('')))
    expect(frappes).toEqual([
      '9',
      '97',
      '978',
      '978-2',
      '978-2-0',
      '978-2-07',
      '978-2-07-0',
      '978-2-07-03',
      '978-2-07-036',
      '978-2-07-0360',
      '978-2-07-03600',
      '978-2-07-036002',
      '978-2-07-036002-4',
    ])
  })

  it('attend d’en savoir assez pour placer le tiret de l’éditeur', () => {
    // « 978-2-35 » peut encore être un éditeur à cinq chiffres (35142, Kurokawa).
    expect(isbnEnSaisie('978235')).toBe('978-2-35')
    expect(isbnEnSaisie('97823514')).toBe('978-2-3514')
    expect(isbnEnSaisie('978235142')).toBe('978-2-35142')
    expect(isbnEnSaisie('9782351423')).toBe('978-2-35142-3')
  })

  it('donne la même forme que l’affichage pour un ISBN complet', () => {
    for (const isbn of ['9782253008484', '9782081510852', '9780140817690', '9782351423561', '2070360024', '080442957X']) {
      expect(isbnEnSaisie(isbn)).toBe(isbnAffiche(isbn))
    }
  })

  it('place les tirets d’un ISBN à 10 caractères', () => {
    expect(isbnEnSaisie('2')).toBe('2')
    expect(isbnEnSaisie('207')).toBe('2-07')
    expect(isbnEnSaisie('207036002')).toBe('2-07-036002')
  })

  it('oublie les tirets, les espaces et les lettres collés avec l’ISBN', () => {
    expect(isbnEnSaisie('ISBN 978 2 253 00848 4')).toBe('978-2-253-00848-4')
    expect(isbnEnSaisie('978-2-253-00848-4')).toBe('978-2-253-00848-4')
    expect(isbnEnSaisie('97822530-08484')).toBe('978-2-253-00848-4')
  })

  it('laisse les chiffres tels quels quand les tirets ne peuvent pas être placés', () => {
    // Hors des plages connues.
    expect(isbnEnSaisie('9790000000000')).toBe('9790000000000')
    // Trop de chiffres : rien n'est coupé, la vérification le dira.
    expect(isbnEnSaisie('97820703600245')).toBe('97820703600245')
  })
})

describe('saisirIsbn', () => {
  it('rend l’ISBN sans tirets, pour la base, et sa forme à tirets, pour le champ', () => {
    expect(saisirIsbn('978207', '9782070', 7)).toEqual({ compact: '9782070', affiche: '978-2-07-0', curseur: 10 })
  })

  it('garde le curseur à sa place logique : après le même nombre de chiffres', () => {
    // Je tape « 2 » après « 978 » : le tiret arrive, le curseur reste après le 2.
    expect(saisirIsbn('978', '9782', 4)).toMatchObject({ affiche: '978-2', curseur: 5 })
    // Je tape « 5 » au milieu de « 978-2-07-036002-4 », après « 978-2-0 ».
    expect(saisirIsbn('9782070360024', '978-2-057-036002-4', 8)).toMatchObject({ compact: '97820570360024', curseur: 6 })
    // Au tout début.
    expect(saisirIsbn('782070360024', '9782070360024', 1)).toMatchObject({ affiche: '978-2-07-036002-4', curseur: 1 })
  })

  it('un collage avec des espaces arrive entier, le curseur à la fin', () => {
    expect(saisirIsbn('', '978 2 253 00848 4', 17)).toEqual({ compact: '9782253008484', affiche: '978-2-253-00848-4', curseur: 17 })
  })

  it('effacer un tiret efface le chiffre d’avant', () => {
    // « 978-2-07| » : retour arrière sur le tiret entre 2 et 07 → le curseur était après « 978-2- ».
    expect(saisirIsbn('978207', '978-207', 5)).toEqual({ compact: '97807', affiche: '978-0-7', curseur: 3 })
  })

  it('« Suppr » devant un tiret efface le chiffre d’après', () => {
    expect(saisirIsbn('978207', '978-207', 5, 'avant')).toEqual({ compact: '97827', affiche: '978-2-7', curseur: 5 })
  })

  it('effacer un chiffre ordinaire n’en efface qu’un', () => {
    expect(saisirIsbn('978207', '978-2-0', 7)).toEqual({ compact: '97820', affiche: '978-2-0', curseur: 7 })
  })

  it('garde le X final d’un ISBN à 10 caractères, en majuscule', () => {
    expect(saisirIsbn('080442957', '0-8044-2957x', 12)).toMatchObject({ compact: '080442957X', affiche: '0-8044-2957-X' })
  })
})
