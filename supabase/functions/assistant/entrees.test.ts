// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isbn13, lireDemande } from './entrees.ts'

describe('isbn13', () => {
  it('accepte 13 chiffres, avec tirets ou espaces, et rend la forme compacte', () => {
    expect(isbn13('9782747024693')).toBe('9782747024693')
    expect(isbn13('978-2-7470-2469-3')).toBe('9782747024693')
    expect(isbn13(' 978 2 7470 2469 3 ')).toBe('9782747024693')
  })

  it('refuse un chiffre de contrôle faux', () => {
    expect(isbn13('9782747024694')).toBeNull()
  })

  it('refuse ce qui n’est pas un ISBN à 13 chiffres', () => {
    expect(isbn13('2747024695')).toBeNull() // ISBN à 10 chiffres
    expect(isbn13('1234567890123')).toBeNull() // ne commence pas par 978 ou 979
    expect(isbn13('9782747024693; drop table')).toBeNull()
    expect(isbn13('')).toBeNull()
    expect(isbn13(9782747024693)).toBeNull()
    expect(isbn13(null)).toBeNull()
  })

  it('refuse une saisie démesurée, même pleine de tirets', () => {
    expect(isbn13(`9782747024693${'-'.repeat(200)}`)).toBeNull()
  })
})

describe('lireDemande', () => {
  it('lit une recherche par ISBN et rend l’ISBN compact', () => {
    expect(lireDemande({ action: 'chercher_isbn', isbn: '978-2-7470-2469-3' })).toEqual({
      action: 'chercher_isbn',
      isbn: '9782747024693',
    })
  })

  it('lit une recherche par titre, avec ou sans auteur', () => {
    expect(lireDemande({ action: 'chercher_titre', titre: '  Momo ' })).toEqual({ action: 'chercher_titre', titre: 'Momo' })
    expect(lireDemande({ action: 'chercher_titre', titre: 'Momo', auteur: 'Ende' })).toEqual({
      action: 'chercher_titre',
      titre: 'Momo',
      auteur: 'Ende',
    })
  })

  it('lit une demande de couverture par ISBN ou par référence', () => {
    expect(lireDemande({ action: 'couverture', isbn: '9782747024693' })).toEqual({ action: 'couverture', isbn: '9782747024693' })
    expect(lireDemande({ action: 'couverture', ref: { source: 'google_books', id: 'zyTCAlFPjgYC' } })).toEqual({
      action: 'couverture',
      ref: { source: 'google_books', id: 'zyTCAlFPjgYC' },
    })
    expect(lireDemande({ action: 'couverture', ref: { source: 'open_library', numero: 8574580 } })).toEqual({
      action: 'couverture',
      ref: { source: 'open_library', numero: 8574580 },
    })
    expect(lireDemande({ action: 'couverture', ref: { source: 'open_library', isbn: '978-2-7470-2469-3' } })).toEqual({
      action: 'couverture',
      ref: { source: 'open_library', isbn: '9782747024693' },
    })
  })

  it('lit une demande de fiche', () => {
    const oeuvre = {
      titre: 'Momo',
      titreOriginal: 'Momo',
      auteurs: ['Michael Ende'],
      annee: 1973,
      langueOriginale: 'de',
      descriptions: [{ texte: 'Une orpheline et des voleurs de temps.', source: 'bnf' }],
    }
    expect(lireDemande({ action: 'fiche', oeuvre })).toEqual({ action: 'fiche', oeuvre })
  })

  it('lit une demande d’autres couvertures : titre, langue, et ce qu’on sait de mon édition', () => {
    expect(lireDemande({ action: 'autres_couvertures', titre: ' L’Étranger ', langue: 'fr' })).toEqual({ action: 'autres_couvertures', titre: 'L’Étranger', langue: 'fr' })
    expect(
      lireDemande({ action: 'autres_couvertures', titre: 'L’Étranger', auteur: 'Albert Camus', langue: 'en', isbn: '978-2-07-036002-4', editeur: 'Gallimard' }),
    ).toEqual({ action: 'autres_couvertures', titre: 'L’Étranger', auteur: 'Albert Camus', langue: 'en', isbn: '9782070360024', editeur: 'Gallimard' })
  })

  it('refuse une demande d’autres couvertures mal formée', () => {
    const base = { action: 'autres_couvertures', titre: 'L’Étranger', langue: 'fr' }
    // La langue : français ou anglais, rien d'autre (elle entre dans une adresse).
    expect(lireDemande({ ...base, langue: 'de' })).toBeNull()
    expect(lireDemande({ ...base, langue: 'fr&key=x' })).toBeNull()
    expect(lireDemande({ action: 'autres_couvertures', titre: 'L’Étranger' })).toBeNull()
    expect(lireDemande({ ...base, titre: '   ' })).toBeNull()
    expect(lireDemande({ ...base, titre: 'a'.repeat(201) })).toBeNull()
    expect(lireDemande({ ...base, auteur: 'a'.repeat(121) })).toBeNull()
    expect(lireDemande({ ...base, isbn: '9782070360025' })).toBeNull()
    expect(lireDemande({ ...base, editeur: 'a'.repeat(121) })).toBeNull()
    expect(lireDemande({ ...base, editeur: 'Galli\u0000mard' })).toBeNull()
    // Rien de personnel ne voyage : ni statut, ni note, ni image.
    expect(lireDemande({ ...base, statut: 'en_cours' })).toBeNull()
    expect(lireDemande({ ...base, url: 'https://exemple.test/x.jpg' })).toBeNull()
  })

  it('refuse une action inconnue ou absente', () => {
    expect(lireDemande({ action: 'supprimer_tout' })).toBeNull()
    expect(lireDemande({})).toBeNull()
    expect(lireDemande(null)).toBeNull()
    expect(lireDemande('chercher_isbn')).toBeNull()
    expect(lireDemande([{ action: 'chercher_isbn', isbn: '9782747024693' }])).toBeNull()
  })

  it('refuse un ISBN invalide', () => {
    expect(lireDemande({ action: 'chercher_isbn', isbn: '9782747024694' })).toBeNull()
    expect(lireDemande({ action: 'couverture', isbn: 'abc' })).toBeNull()
  })

  it('refuse un champ en trop : rien de personnel ne peut voyager par erreur', () => {
    expect(lireDemande({ action: 'chercher_isbn', isbn: '9782747024693', statut: 'en_cours' })).toBeNull()
    expect(lireDemande({ action: 'chercher_titre', titre: 'Momo', notes: 'ma note' })).toBeNull()
    expect(
      lireDemande({ action: 'fiche', oeuvre: { titre: 'Momo', auteurs: [], descriptions: [], ressenti: 'm’a marqué' } }),
    ).toBeNull()
    expect(
      lireDemande({
        action: 'fiche',
        oeuvre: { titre: 'Momo', auteurs: [], descriptions: [{ texte: 'x', source: 'bnf', note: 'perso' }] },
      }),
    ).toBeNull()
  })

  it('refuse les textes vides ou trop longs', () => {
    expect(lireDemande({ action: 'chercher_titre', titre: '   ' })).toBeNull()
    expect(lireDemande({ action: 'chercher_titre', titre: 'a'.repeat(201) })).toBeNull()
    expect(lireDemande({ action: 'chercher_titre', titre: 'Momo', auteur: 'a'.repeat(121) })).toBeNull()
    expect(lireDemande({ action: 'fiche', oeuvre: { titre: 'a'.repeat(201), auteurs: [], descriptions: [] } })).toBeNull()
    expect(
      lireDemande({
        action: 'fiche',
        oeuvre: { titre: 'Momo', auteurs: [], descriptions: [{ texte: 'a'.repeat(4001), source: 'bnf' }] },
      }),
    ).toBeNull()
  })

  it('refuse trop d’auteurs ou trop de descriptions', () => {
    const description = { texte: 'x', source: 'bnf' }
    expect(lireDemande({ action: 'fiche', oeuvre: { titre: 'Momo', auteurs: Array(7).fill('A'), descriptions: [] } })).toBeNull()
    expect(
      lireDemande({ action: 'fiche', oeuvre: { titre: 'Momo', auteurs: [], descriptions: Array(4).fill(description) } }),
    ).toBeNull()
  })

  it('refuse une année, une langue ou une source mal formées', () => {
    const base = { titre: 'Momo', auteurs: [], descriptions: [] }
    expect(lireDemande({ action: 'fiche', oeuvre: { ...base, annee: '1973' } })).toBeNull()
    expect(lireDemande({ action: 'fiche', oeuvre: { ...base, annee: 19730 } })).toBeNull()
    expect(lireDemande({ action: 'fiche', oeuvre: { ...base, langueOriginale: 'allemand' } })).toBeNull()
    expect(
      lireDemande({ action: 'fiche', oeuvre: { ...base, descriptions: [{ texte: 'x', source: 'mon_journal' }] } }),
    ).toBeNull()
  })

  it('refuse une référence de couverture qui ressemble à une adresse', () => {
    expect(lireDemande({ action: 'couverture', ref: { source: 'google_books', id: 'https://exemple.test/x' } })).toBeNull()
    expect(lireDemande({ action: 'couverture', ref: { source: 'google_books', id: '../../etc' } })).toBeNull()
    expect(lireDemande({ action: 'couverture', ref: { source: 'open_library', numero: -1 } })).toBeNull()
    expect(lireDemande({ action: 'couverture', ref: { source: 'open_library', numero: 1.5 } })).toBeNull()
    expect(lireDemande({ action: 'couverture', ref: { source: 'ailleurs', id: 'abc' } })).toBeNull()
    expect(lireDemande({ action: 'couverture', ref: { source: 'google_books', id: 'zyTCAlFPjgYC' }, isbn: '9782747024693' })).toBeNull()
    expect(lireDemande({ action: 'couverture', url: 'https://exemple.test/x.jpg' })).toBeNull()
  })

  it('refuse les caractères de contrôle dans un texte', () => {
    expect(lireDemande({ action: 'chercher_titre', titre: 'Mo\u0000mo' })).toBeNull()
  })
})
