import {
  FILTRES_VIDES,
  comparerTitres,
  correspond,
  filtresDepuisParametres,
  isbnValide,
  libellePossession,
  normaliser,
  parametresDepuisFiltres,
  possessionAffichee,
  possessionsFiltrables,
  type OeuvreFiltrable,
} from './modele'

describe('possession d’une série', () => {
  it('se calcule à partir des tomes', () => {
    expect(possessionAffichee('non_possede', true, ['possede', 'possede'])).toBe('possede')
    expect(possessionAffichee('non_possede', true, ['possede', 'non_possede'])).toBe('partielle')
    expect(possessionAffichee('non_possede', true, ['a_acheter', 'non_possede'])).toBe('a_acheter')
    expect(possessionAffichee('possede', true, ['non_possede'])).toBe('non_possede')
  })

  it('suit la possession de l’œuvre quand ce n’est pas une série, ou sans tome connu', () => {
    expect(possessionAffichee('a_acheter', false, ['possede'])).toBe('a_acheter')
    expect(possessionAffichee('possede', true, [])).toBe('possede')
  })

  it('apparaît dans « Je l’ai » dès qu’un tome est possédé, et dans « À acheter » dès qu’un tome est à acheter', () => {
    expect(possessionsFiltrables('non_possede', true, ['possede', 'a_acheter', 'non_possede'])).toEqual(['possede', 'a_acheter', 'non_possede'])
    expect(possessionsFiltrables('non_possede', true, ['possede', 'possede'])).toEqual(['possede'])
    expect(possessionsFiltrables('a_acheter', false, [])).toEqual(['a_acheter'])
  })

  it('se dit à la première personne', () => {
    expect(libellePossession('partielle')).toBe('J’en ai une partie')
    expect(libellePossession('possede')).toBe('Je l’ai')
    expect(libellePossession('non_possede')).toBe('Je ne l’ai pas')
  })
})

describe('recherche et filtres', () => {
  const ETRANGER: OeuvreFiltrable = {
    titres: ['L’Étranger'],
    auteurs: ['Albert Camus'],
    genres: ['Roman philosophique'],
    themes: ['Absurde', 'Liberté'],
    atmospheres: ['Sobre'],
    statut: 'envie_de_lire',
    possessions: ['possede'],
  }

  it('cherche sans tenir compte des accents, des majuscules ni de l’apostrophe', () => {
    expect(correspond(ETRANGER, { ...FILTRES_VIDES, recherche: 'l’etranger' })).toBe(true)
    expect(correspond(ETRANGER, { ...FILTRES_VIDES, recherche: "L'ETRANGER" })).toBe(true)
    expect(correspond(ETRANGER, { ...FILTRES_VIDES, recherche: 'camus' })).toBe(true)
    expect(correspond(ETRANGER, { ...FILTRES_VIDES, recherche: 'camus étranger' })).toBe(true)
    expect(correspond(ETRANGER, { ...FILTRES_VIDES, recherche: 'camus peste' })).toBe(false)
  })

  it('combine les filtres', () => {
    expect(correspond(ETRANGER, { ...FILTRES_VIDES, theme: 'Absurde', statut: 'envie_de_lire' })).toBe(true)
    expect(correspond(ETRANGER, { ...FILTRES_VIDES, theme: 'Absurde', possession: 'a_acheter' })).toBe(false)
    expect(correspond(ETRANGER, { ...FILTRES_VIDES, auteur: 'George Orwell' })).toBe(false)
    expect(correspond(ETRANGER, { ...FILTRES_VIDES, atmosphere: 'Sobre', genre: 'Roman philosophique' })).toBe(true)
  })

  it('garde les filtres dans l’adresse, et ignore une valeur inconnue', () => {
    const filtres = { ...FILTRES_VIDES, recherche: 'momo', statut: 'envie_de_lire' as const, theme: 'Temps' }
    const parametres = parametresDepuisFiltres(filtres)
    expect(parametres.toString()).toBe('q=momo&statut=envie_de_lire&theme=Temps')
    expect(filtresDepuisParametres(parametres)).toEqual(filtres)
    expect(filtresDepuisParametres(new URLSearchParams('statut=nimporte&possession=tout'))).toEqual(FILTRES_VIDES)
  })

  it('normalise œ et les espaces', () => {
    expect(normaliser('  Le   Cœur  ')).toBe('le coeur')
  })

  it('range les titres sans tenir compte de l’article', () => {
    const titres = ['Momo', 'L’Étranger', 'La Chute', '1984', 'Le Prophète']
    expect([...titres].sort(comparerTitres)).toEqual(['1984', 'La Chute', 'L’Étranger', 'Momo', 'Le Prophète'])
  })
})

describe('ISBN', () => {
  it.each(['9782070360024', '978-2-07-036002-4', '2070360024', '0-306-40615-2', '080442957X'])('accepte %s', (isbn) => {
    expect(isbnValide(isbn)).toBe(true)
  })

  it.each(['9782070360025', '12345', '978207036002', 'abcdefghij', '2070360025'])('refuse %s', (isbn) => {
    expect(isbnValide(isbn)).toBe(false)
  })
})
