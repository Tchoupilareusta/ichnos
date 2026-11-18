import { titresAffiches } from './titres.ts'

const mil984 = { title_fr: '1984', title_original: 'Nineteen Eighty-Four', original_language: 'en' }
const momo = { title_fr: 'Momo', title_original: 'Momo', original_language: 'de' }
const laChute = { title_fr: 'La Chute', title_original: null, original_language: 'fr' }
const siddhartha = { title_fr: 'Siddhartha', title_original: 'Siddhartha. Eine indische Dichtung', original_language: 'de' }

describe('titresAffiches', () => {
  it('met le titre original en premier quand mon édition est en anglais', () => {
    expect(titresAffiches(mil984, 'en')).toEqual({ principal: 'Nineteen Eighty-Four', secondaire: '1984' })
  })

  it('met le titre français en premier pour une édition française', () => {
    expect(titresAffiches(mil984, 'fr')).toEqual({ principal: '1984', secondaire: 'Nineteen Eighty-Four' })
  })

  it('met le titre français en premier quand aucune édition n’est choisie', () => {
    expect(titresAffiches(mil984, null)).toEqual({ principal: '1984', secondaire: 'Nineteen Eighty-Four' })
    expect(titresAffiches(mil984, undefined).principal).toBe('1984')
  })

  it('ne répète pas un titre identique dans les deux langues', () => {
    expect(titresAffiches(momo, 'fr')).toEqual({ principal: 'Momo', secondaire: null })
  })

  it('n’affiche qu’un titre pour une œuvre écrite en français', () => {
    expect(titresAffiches(laChute, 'fr')).toEqual({ principal: 'La Chute', secondaire: null })
  })

  it('garde le titre français d’abord pour une traduction anglaise d’une œuvre allemande', () => {
    // Le titre de la traduction anglaise n'est pas connu de la base : on ne l'invente pas.
    expect(titresAffiches(siddhartha, 'en').principal).toBe('Siddhartha')
  })
})
