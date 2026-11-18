import { PALETTE, contraste, echelleTitre, teinteDe } from './palette'

describe('couvertures générées', () => {
  it.each(PALETTE.map((t) => [t.fond, t.texte]))('fond %s, texte %s : contraste d’au moins 4,5:1', (fond, texte) => {
    expect(contraste(fond, texte)).toBeGreaterThanOrEqual(4.5)
  })

  it('calcule le contraste comme les règles WCAG', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
    expect(contraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5)
  })

  it('donne toujours la même teinte à la même œuvre', () => {
    expect(teinteDe('abc')).toBe(teinteDe('abc'))
    const teintes = new Set(Array.from({ length: 60 }, (_, i) => teinteDe(`oeuvre-${i}`)))
    expect(teintes.size).toBeGreaterThan(4)
  })

  it('réduit le titre quand il s’allonge', () => {
    expect(echelleTitre('Momo')).toBeGreaterThan(echelleTitre('La Maison au milieu de la mer céruléenne'))
    expect(echelleTitre('Siddhartha')).toBeLessThanOrEqual(11)
  })
})
