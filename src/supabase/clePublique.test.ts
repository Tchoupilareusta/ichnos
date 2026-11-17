import { estCleSecrete } from './clePublique'

/** Fabrique un faux jeton au format des anciennes clés Supabase (sans signature valable). */
const fauxJeton = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ iss: 'supabase', role }))}.signature`

describe('garde-fou : seule une clé publique peut entrer dans l’appli', () => {
  it('accepte une clé publique', () => {
    expect(estCleSecrete('sb_publishable_exemple')).toBe(false)
    expect(estCleSecrete(fauxJeton('anon'))).toBe(false)
  })

  it('refuse une clé secrète', () => {
    expect(estCleSecrete('sb_secret_exemple')).toBe(true)
    expect(estCleSecrete(fauxJeton('service_role'))).toBe(true)
  })

  it('ne dit rien d’une clé absente', () => {
    expect(estCleSecrete('')).toBe(false)
    expect(estCleSecrete(undefined)).toBe(false)
  })
})
