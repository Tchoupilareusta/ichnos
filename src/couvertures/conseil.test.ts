import { CONSEIL_PHOTO, conseilAMontrer, noterPhotoPrise } from './conseil'

beforeEach(() => localStorage.clear())

describe('le conseil de lumière avant la photo', () => {
  it('tient en une phrase courte', () => {
    expect(CONSEIL_PHOTO).toBe('Lumière douce, sans flash, téléphone bien à plat au-dessus du livre.')
  })

  it('se montre les trois premières fois, puis se fait oublier', () => {
    expect(conseilAMontrer()).toBe(true)
    noterPhotoPrise()
    noterPhotoPrise()
    expect(conseilAMontrer()).toBe(true)
    noterPhotoPrise()
    expect(conseilAMontrer()).toBe(false)
    noterPhotoPrise()
    expect(conseilAMontrer()).toBe(false)
  })

  it('ne retient qu’un compte sur l’appareil, rien de personnel', () => {
    noterPhotoPrise()
    expect({ ...localStorage }).toEqual({ 'ichnos-conseil-photo': '1' })
  })

  it('se montre quand la mémoire de l’appareil n’est pas lisible, sans lever d’erreur', () => {
    const lire = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('navigation privée')
    })
    const ecrire = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('navigation privée')
    })
    expect(conseilAMontrer()).toBe(true)
    expect(() => noterPhotoPrise()).not.toThrow()
    lire.mockRestore()
    ecrire.mockRestore()
  })
})
