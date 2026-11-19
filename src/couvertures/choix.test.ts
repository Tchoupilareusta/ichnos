import { cibleCouverture, couvertureAffichee, type CouverturesOeuvre } from './choix'

const livre = (champs: Partial<CouverturesOeuvre> = {}): CouverturesOeuvre => ({
  estSerie: false,
  oeuvre: null,
  monEdition: null,
  tomes: [],
  ...champs,
})

describe('couvertureAffichee', () => {
  it('montre la couverture de mon édition, sinon celle de l’œuvre, sinon rien', () => {
    expect(couvertureAffichee(livre({ monEdition: 'a/edition.jpg', oeuvre: 'a/oeuvre.jpg' }))).toBe('a/edition.jpg')
    expect(couvertureAffichee(livre({ oeuvre: 'a/oeuvre.jpg' }))).toBe('a/oeuvre.jpg')
    expect(couvertureAffichee(livre())).toBeNull()
  })

  const serie = (tomes: CouverturesOeuvre['tomes'], oeuvre: string | null = null) => livre({ estSerie: true, tomes, oeuvre })

  it('pour une série, montre le tome où j’en suis', () => {
    expect(
      couvertureAffichee(
        serie([
          { numero: 1, lecture: 'lu', couverture: 'a/t1.jpg' },
          { numero: 2, lecture: 'en_cours', couverture: 'a/t2.jpg' },
          { numero: 3, lecture: 'a_lire', couverture: 'a/t3.jpg' },
        ]),
      ),
    ).toBe('a/t2.jpg')
  })

  it('sans tome en cours, montre le dernier tome lu', () => {
    expect(
      couvertureAffichee(
        serie([
          { numero: 1, lecture: 'lu', couverture: 'a/t1.jpg' },
          { numero: 2, lecture: 'lu', couverture: 'a/t2.jpg' },
          { numero: 3, lecture: 'a_lire', couverture: 'a/t3.jpg' },
        ]),
      ),
    ).toBe('a/t2.jpg')
  })

  it('pour une série pas commencée, ou si mon tome n’a pas de couverture, montre le tome 1', () => {
    const tomes: CouverturesOeuvre['tomes'] = [
      { numero: 2, lecture: 'a_lire', couverture: null },
      { numero: 1, lecture: 'a_lire', couverture: 'a/t1.jpg' },
    ]
    expect(couvertureAffichee(serie(tomes))).toBe('a/t1.jpg')
    expect(couvertureAffichee(serie([{ numero: 1, lecture: 'lu', couverture: 'a/t1.jpg' }, { numero: 2, lecture: 'en_cours', couverture: null }]))).toBe(
      'a/t1.jpg',
    )
  })

  it('à défaut, prend le premier tome qui a une couverture, puis celle de l’œuvre', () => {
    expect(
      couvertureAffichee(
        serie([
          { numero: 1, lecture: 'a_lire', couverture: null },
          { numero: 3, lecture: 'a_lire', couverture: 'a/t3.jpg' },
          { numero: 2, lecture: 'a_lire', couverture: 'a/t2.jpg' },
        ]),
      ),
    ).toBe('a/t2.jpg')
    expect(couvertureAffichee(serie([{ numero: 1, lecture: 'a_lire', couverture: null }], 'a/oeuvre.jpg'))).toBe('a/oeuvre.jpg')
    expect(couvertureAffichee(serie([]))).toBeNull()
  })
})

describe('cibleCouverture', () => {
  it('range la couverture sur mon édition quand elle a été trouvée par son ISBN', () => {
    expect(cibleCouverture({ edition: 'e1', monEdition: 'e1' })).toEqual({ type: 'edition', edition: 'e1' })
  })

  it('la range sur l’œuvre quand l’édition n’est pas la mienne, ou qu’il n’y en a pas', () => {
    expect(cibleCouverture({ edition: 'e2', monEdition: 'e1' })).toEqual({ type: 'oeuvre' })
    expect(cibleCouverture({ edition: null, monEdition: 'e1' })).toEqual({ type: 'oeuvre' })
    expect(cibleCouverture({ edition: 'e2', monEdition: null })).toEqual({ type: 'oeuvre' })
  })

  it('la range sur le tome quand c’est celle d’un tome', () => {
    expect(cibleCouverture({ edition: null, monEdition: null, tome: 4 })).toEqual({ type: 'tome', numero: 4 })
  })
})
