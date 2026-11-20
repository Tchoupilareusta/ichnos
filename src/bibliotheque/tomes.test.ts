import type { Tome } from './depot'
import {
  BULLES_LECTURE,
  appliquerChangements,
  preparerChangement,
  selectionGlissee,
  selectionPlage,
  texteApplique,
  texteConfirmation,
  texteRienAChanger,
  texteSelection,
  titreConfirmation,
} from './tomes'

const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 8]
const ens = (...n: number[]) => new Set(n)
const trie = (s: Set<number>) => [...s].sort((a, b) => a - b)

describe('sélection par glissement, comme dans Photos', () => {
  it('sélectionne tous les tomes entre le départ et le doigt, dans les deux sens', () => {
    expect(trie(selectionGlissee(NUMEROS, ens(), 3, 6))).toEqual([3, 4, 5, 6])
    expect(trie(selectionGlissee(NUMEROS, ens(), 6, 3))).toEqual([3, 4, 5, 6])
    expect(trie(selectionGlissee(NUMEROS, ens(), 4, 4))).toEqual([4])
  })

  it('revenir en arrière rend aux tomes quittés leur état d’avant le geste', () => {
    const avant = ens(1, 7)
    expect(trie(selectionGlissee(NUMEROS, avant, 3, 7))).toEqual([1, 3, 4, 5, 6, 7])
    expect(trie(selectionGlissee(NUMEROS, avant, 3, 4))).toEqual([1, 3, 4, 7])
  })

  it('partir d’un tome sélectionné désélectionne', () => {
    expect(trie(selectionGlissee(NUMEROS, ens(2, 3, 4, 5), 3, 5))).toEqual([2])
  })

  it('suit l’ordre des tomes, même quand leurs numéros ne se suivent pas', () => {
    expect(trie(selectionGlissee([1, 2, 5, 9], ens(), 2, 9))).toEqual([2, 5, 9])
  })

  it('Maj + clic sélectionne la plage depuis le dernier tome touché', () => {
    expect(trie(selectionPlage(NUMEROS, ens(2), 2, 5))).toEqual([2, 3, 4, 5])
    expect(trie(selectionPlage(NUMEROS, ens(6), 6, 4))).toEqual([4, 5, 6])
  })
})

const TOMES: Tome[] = [
  { numero: 1, titre: null, isbn: null, possession: 'possede', lecture: 'lu' },
  { numero: 2, titre: null, isbn: null, possession: 'a_acheter', lecture: 'en_cours' },
  { numero: 3, titre: null, isbn: null, possession: 'non_possede', lecture: 'a_lire' },
]

describe('appliquer un choix', () => {
  it('ne garde que les tomes qui changent vraiment, et prépare leur état d’avant', () => {
    const { changements, annulation } = preparerChangement(TOMES, ens(1, 3), { type: 'possession', valeur: 'possede' })
    expect(changements).toEqual([{ numero: 3, possession: 'possede' }])
    expect(annulation).toEqual([{ numero: 3, possession: 'non_possede', lecture: 'a_lire' }])
  })

  it('« Annuler » rend exactement l’état de départ', () => {
    const { changements, annulation } = preparerChangement(TOMES, ens(1, 2, 3), { type: 'lecture', valeur: 'lu' })
    const apres = appliquerChangements(TOMES, changements)
    expect(apres.map((t) => t.lecture)).toEqual(['lu', 'lu', 'lu'])
    expect(appliquerChangements(apres, annulation)).toEqual(TOMES)
  })

  it('ne donne pas de possession aux tomes de l’accueil, qui n’ont que leur lecture', () => {
    expect(appliquerChangements([{ numero: 3, lecture: 'a_lire' as const }], [{ numero: 3, possession: 'possede', lecture: 'lu' }])).toEqual([
      { numero: 3, lecture: 'lu' },
    ])
  })

  it('range les bulles de lecture dans l’ordre demandé', () => {
    expect(BULLES_LECTURE.map((b) => b.libelle)).toEqual(['Lu', 'En cours', 'À lire'])
  })
})

describe('textes, sans erreur de nombre ni « je »', () => {
  it('compte les tomes sélectionnés et ceux qui ont changé', () => {
    expect(texteSelection(1)).toBe('1 tome sélectionné')
    expect(texteSelection(4)).toBe('4 tomes sélectionnés')
    expect(texteApplique(1, { type: 'lecture', valeur: 'lu' })).toBe('1 tome marqué « Lu »')
    expect(texteApplique(4, { type: 'possession', valeur: 'possede' })).toBe('4 tomes marqués « Je l’ai »')
  })

  it('dit quand rien ne change', () => {
    expect(texteRienAChanger(1, { type: 'possession', valeur: 'a_acheter' })).toBe('Ce tome est déjà « À acheter » : rien n’a changé.')
    expect(texteRienAChanger(3, { type: 'lecture', valeur: 'en_cours' })).toBe('Ces tomes sont déjà « En cours » : rien n’a changé.')
  })

  it('pose la question de confirmation à l’infinitif', () => {
    expect(titreConfirmation(12)).toBe('Changer 12 tomes ?')
    expect(texteConfirmation(12, { type: 'possession', valeur: 'non_possede' })).toBe(
      'Ils seront marqués « Je ne l’ai pas ». « Annuler » restera possible quelques secondes.',
    )
  })
})
