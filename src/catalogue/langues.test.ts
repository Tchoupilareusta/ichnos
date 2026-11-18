import { deLaLangue, mentionTraduction, nomLangue, traductionIndirecte, traduitDe } from './langues.ts'

describe('mentionTraduction', () => {
  it('annonce la langue d’origine d’une édition traduite', () => {
    expect(mentionTraduction('de', 'fr', 'Corinna Gepner')).toBe('traduit de l’allemand')
    expect(mentionTraduction('ja', 'fr', null)).toBe('traduit du japonais')
  })

  it('ne dit rien quand l’édition est dans la langue d’origine', () => {
    expect(mentionTraduction('fr', 'fr')).toBeNull()
    expect(mentionTraduction('en', 'en')).toBeNull()
    expect(mentionTraduction(null, 'fr')).toBeNull()
  })

  it('se tait quand la traduction a été faite à partir d’une autre langue', () => {
    const traducteur = 'Clifford J. Bacon et Louise Drolet (à partir de la version anglaise)'
    expect(traductionIndirecte(traducteur)).toBe(true)
    expect(mentionTraduction('de', 'fr', traducteur)).toBeNull()
    expect(traductionIndirecte('Josée Kamoun')).toBe(false)
    expect(traductionIndirecte(null)).toBe(false)
  })
})

describe('traduitDe', () => {
  it.each([
    ['en', 'traduit de l’anglais'],
    ['de', 'traduit de l’allemand'],
    ['it', 'traduit de l’italien'],
    ['ar', 'traduit de l’arabe'],
    ['es', 'traduit de l’espagnol'],
    ['he', 'traduit de l’hébreu'],
  ])('élide devant une voyelle ou un h muet : %s', (code, attendu) => {
    expect(traduitDe(code)).toBe(attendu)
  })

  it.each([
    ['ja', 'traduit du japonais'],
    ['ru', 'traduit du russe'],
    ['la', 'traduit du latin'],
    ['grc', 'traduit du grec ancien'],
    ['hu', 'traduit du hongrois'],
    ['hi', 'traduit du hindi'],
  ])('garde « du » devant une consonne ou un h aspiré : %s', (code, attendu) => {
    expect(traduitDe(code)).toBe(attendu)
  })

  it('ne dit rien quand la langue est inconnue ou absente', () => {
    expect(traduitDe('xx')).toBeNull()
    expect(traduitDe(null)).toBeNull()
    expect(traduitDe(undefined)).toBeNull()
  })

  it('n’écrit jamais « du » devant une voyelle, pour aucune langue connue', () => {
    const codes = ['fr', 'en', 'de', 'it', 'es', 'pt', 'ru', 'ja', 'la', 'grc', 'el', 'ar', 'he', 'zh', 'ko', 'hi', 'fa', 'tr', 'hu', 'nl', 'sv', 'no', 'da', 'pl', 'cs']
    for (const code of codes) {
      expect(nomLangue(code), code).not.toBeNull()
      expect(traduitDe(code), code).not.toMatch(/ du [aàâeéèêëiîïoôuùûyœ]/i)
    }
  })
})

describe('deLaLangue', () => {
  it('s’applique à n’importe quel nom de langue', () => {
    expect(deLaLangue('islandais')).toBe('de l’islandais')
    expect(deLaLangue('finnois')).toBe('du finnois')
  })
})
