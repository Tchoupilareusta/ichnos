import { describe, expect, it } from 'vitest'
import {
  dateSaisie,
  derniereFin,
  lecturesFaites,
  pas,
  pourcentage,
  progressionLivre,
  progressionSerie,
  texteDate,
  texteEpisodes,
  texteParcours,
  texteProgression,
  totalAtteint,
  totalPropose,
  type Evenement,
} from './suivi'

const ev = (type: Evenement['type'], date: string, precision: Evenement['precision'] = 'jour'): Evenement => ({
  type,
  valeur: null,
  date,
  precision,
})
const AUJOURDHUI = new Date('2026-11-19T12:00:00Z')

describe('progression écrite en mots', () => {
  it('écrit une page, avec ou sans total', () => {
    expect(texteProgression({ unite: 'page', position: 75, total: 230 })).toBe('p. 75 sur 230')
    expect(texteProgression({ unite: 'page', position: 75, total: null })).toBe('p. 75')
    expect(texteProgression({ unite: 'page', position: 75, total: 230 }, { long: true })).toBe('Page 75 sur 230')
  })

  it('écrit les autres unités en toutes lettres', () => {
    expect(texteProgression({ unite: 'lettre', position: 12, total: null })).toBe('Lettre 12')
    expect(texteProgression({ unite: 'tome', position: 4, total: 29 })).toBe('Tome 4 sur 29')
    expect(texteProgression({ unite: 'chapitre', position: 3, total: 12 })).toBe('Chapitre 3 sur 12')
    expect(texteProgression({ unite: 'section', position: 2, total: null })).toBe('Section 2')
    expect(texteProgression({ unite: 'pourcentage', position: 42, total: 100 })).toBe('42 %')
    expect(texteProgression({ unite: 'pourcentage', position: 42, total: 100 }, { long: true })).toBe('42 pour cent')
  })

  it('n’écrit rien tant que rien n’est noté', () => {
    expect(texteProgression({ unite: 'page', position: null, total: 230 })).toBeNull()
  })
})

describe('progression d’un livre', () => {
  it('propose « page » quand aucune unité n’est choisie', () => {
    expect(progressionLivre(null, null, null, null)).toEqual({ unite: 'page', position: null, total: null })
  })

  it('prend le nombre de pages de mon édition comme total proposé, pour la page seulement', () => {
    expect(progressionLivre(null, 10, null, 190)).toEqual({ unite: 'page', position: 10, total: 190 })
    expect(progressionLivre('page', 10, null, 190)).toEqual({ unite: 'page', position: 10, total: null })
    expect(progressionLivre('lettre', 10, null, 190)).toEqual({ unite: 'lettre', position: 10, total: null })
    expect(totalPropose('page', 190)).toBe(190)
    expect(totalPropose('chapitre', 190)).toBeNull()
    expect(totalPropose('page', null)).toBeNull()
  })

  it('garde le total que j’ai saisi plutôt que celui de l’édition', () => {
    expect(progressionLivre('page', 10, 180, 190).total).toBe(180)
  })

  it('compte le pourcentage sur 100', () => {
    expect(progressionLivre('pourcentage', 42, null, 190)).toEqual({ unite: 'pourcentage', position: 42, total: 100 })
  })
})

describe('pourcentage lu', () => {
  it('se calcule seulement si un total est connu', () => {
    expect(pourcentage({ unite: 'page', position: 75, total: 190 })).toBe(39)
    expect(pourcentage({ unite: 'page', position: 75, total: null })).toBeNull()
    expect(pourcentage({ unite: 'page', position: null, total: 190 })).toBeNull()
  })

  it('reconnaît le total atteint', () => {
    expect(totalAtteint({ unite: 'page', position: 190, total: 190 })).toBe(true)
    expect(totalAtteint({ unite: 'page', position: 189, total: 190 })).toBe(false)
    expect(totalAtteint({ unite: 'page', position: 190, total: null })).toBe(false)
  })
})

describe('− et +', () => {
  it('avance et recule sans sortir de 0…total', () => {
    expect(pas({ unite: 'page', position: 75, total: 190 }, 1)).toBe(76)
    expect(pas({ unite: 'page', position: 190, total: 190 }, 1)).toBe(190)
    expect(pas({ unite: 'page', position: 0, total: 190 }, -1)).toBe(0)
    expect(pas({ unite: 'page', position: null, total: null }, 1)).toBe(1)
    expect(pas({ unite: 'page', position: null, total: null }, -1)).toBe(0)
    expect(pas({ unite: 'page', position: 4, total: null }, 1)).toBe(5)
  })

  it('pour une série, va du premier au dernier tome', () => {
    expect(pas({ unite: 'tome', position: null, total: 29 }, 1, 1)).toBe(1)
    expect(pas({ unite: 'tome', position: 1, total: 29 }, -1, 1)).toBe(1)
    expect(pas({ unite: 'tome', position: 29, total: 29 }, 1, 1)).toBe(29)
  })
})

describe('progression d’une série, tirée des tomes', () => {
  it('prend le plus haut tome en cours', () => {
    const tomes = [
      { numero: 1, lecture: 'lu' as const },
      { numero: 2, lecture: 'lu' as const },
      { numero: 3, lecture: 'en_cours' as const },
      { numero: 7, lecture: 'lu' as const },
    ]
    expect(progressionSerie(tomes)).toEqual({ unite: 'tome', position: 3, total: 4 })
  })

  it('à défaut, le plus haut tome lu', () => {
    expect(progressionSerie([{ numero: 1, lecture: 'lu' }, { numero: 2, lecture: 'a_lire' }]).position).toBe(1)
  })

  it('sans tome commencé, n’affiche rien', () => {
    expect(progressionSerie([{ numero: 1, lecture: 'a_lire' }])).toEqual({ unite: 'tome', position: null, total: 1 })
    expect(progressionSerie([])).toEqual({ unite: 'tome', position: null, total: null })
  })
})

describe('mon parcours', () => {
  it('raconte une lecture commencée puis terminée', () => {
    const lectures = lecturesFaites([ev('commence', '2026-03-03T10:00:00Z'), ev('progression', '2026-03-10T10:00:00Z'), ev('termine', '2026-04-20T10:00:00Z')])
    expect(texteParcours(lectures, AUJOURDHUI)).toEqual(['Commencé le 3 mars · terminé le 20 avril'])
  })

  it('raconte une lecture en cours', () => {
    expect(texteParcours(lecturesFaites([ev('commence', '2026-03-03T10:00:00Z'), ev('mis_en_pause', '2026-03-05T10:00:00Z')]), AUJOURDHUI)).toEqual([
      'Commencé le 3 mars',
    ])
  })

  it('dit seulement l’année d’une date approximative, sans inventer de jour', () => {
    const lectures = lecturesFaites([ev('termine', '2019-01-01T12:00:00Z', 'annee')])
    expect(texteParcours(lectures, AUJOURDHUI)).toEqual(['Terminé en 2019'])
    expect(texteParcours(lecturesFaites([ev('termine', '2019-03-01T12:00:00Z', 'mois')]), AUJOURDHUI)).toEqual(['Terminé en mars 2019'])
  })

  it('ajoute les relectures, et l’année quand elle n’est pas celle-ci', () => {
    const lectures = lecturesFaites([
      ev('termine', '2019-01-01T12:00:00Z', 'annee'),
      ev('commence', '2025-06-01T10:00:00Z'),
      ev('termine', '2025-07-04T10:00:00Z'),
      ev('commence', '2026-11-02T10:00:00Z'),
    ])
    expect(texteParcours(lectures, AUJOURDHUI)).toEqual([
      'Terminé en 2019',
      'Relecture commencée le 1er juin 2025 · terminée le 4 juillet 2025',
      'Relecture commencée le 2 novembre',
    ])
  })

  it('ne raconte rien sans historique', () => {
    expect(texteParcours(lecturesFaites([]), AUJOURDHUI)).toEqual([])
  })

  it('retrouve la date de fin de la dernière lecture', () => {
    expect(derniereFin([ev('termine', '2019-01-01T12:00:00Z', 'annee')])).toEqual({ date: '2019-01-01T12:00:00Z', precision: 'annee' })
    expect(derniereFin([ev('termine', '2019-01-01T12:00:00Z', 'annee'), ev('commence', '2026-01-01T12:00:00Z')])).toBeNull()
  })

  it('écrit le premier du mois « 1er »', () => {
    expect(texteDate('2026-03-01T12:00:00Z', 'jour', AUJOURDHUI)).toBe('le 1er mars')
  })
})

describe('date de fin saisie à la main', () => {
  it('accepte un jour, un mois ou une année', () => {
    expect(dateSaisie('jour', { jour: '2025-04-20' }, AUJOURDHUI)).toBe('2025-04-20')
    expect(dateSaisie('mois', { mois: '3', annee: '2019' }, AUJOURDHUI)).toBe('2019-03-01')
    expect(dateSaisie('annee', { annee: '2019' }, AUJOURDHUI)).toBe('2019-01-01')
  })

  it('refuse une date incomplète, impossible ou à venir', () => {
    expect(dateSaisie('annee', { annee: '19' }, AUJOURDHUI)).toBeNull()
    expect(dateSaisie('mois', { mois: '13', annee: '2019' }, AUJOURDHUI)).toBeNull()
    expect(dateSaisie('jour', { jour: '' }, AUJOURDHUI)).toBeNull()
    expect(dateSaisie('annee', { annee: '2030' }, AUJOURDHUI)).toBeNull()
    expect(dateSaisie('jour', { jour: '2026-12-01' }, AUJOURDHUI)).toBeNull()
  })
})

describe('épisodes', () => {
  it('écrit l’épisode vu, avec ou sans total', () => {
    expect(texteEpisodes(14, 48)).toBe('Épisode 14 sur 48')
    expect(texteEpisodes(14, null)).toBe('Épisode 14')
    expect(texteEpisodes(0, 48)).toBeNull()
    expect(texteEpisodes(null, 48)).toBeNull()
  })
})
