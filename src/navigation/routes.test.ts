import { ecranDepuisHash } from './routes'

describe('routage par hash', () => {
  it.each([
    ['', 'accueil'],
    ['#', 'accueil'],
    ['#/', 'accueil'],
    ['#/bibliotheque', 'bibliotheque'],
    ['#/bibliotheque/', 'bibliotheque'],
    ['#/decouvrir?mode=court', 'decouvrir'],
    ['#/ajouter', 'ajouter'],
    ['#/reglages', 'reglages'],
    ['#/nimportequoi', 'introuvable'],
  ])('%s → %s', (hash, attendu) => {
    expect(ecranDepuisHash(hash)).toBe(attendu)
  })
})
