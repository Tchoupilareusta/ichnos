import { appliquerTheme, lireChoixTheme } from './theme'

function preparerMetas() {
  document.head.innerHTML = `
    <meta name="theme-color" content="#F5EFE6" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#151413" media="(prefers-color-scheme: dark)">`
}

describe('thème', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
    preparerMetas()
  })

  it('suit l’appareil par défaut', () => {
    expect(lireChoixTheme()).toBe('auto')
  })

  it('force le sombre et colore la barre d’état en conséquence', () => {
    appliquerTheme('sombre')
    expect(document.documentElement.dataset.theme).toBe('dark')
    const couleurs = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => m.content)
    expect(couleurs).toEqual(['#151413', '#151413'])
    expect(lireChoixTheme()).toBe('sombre')
  })

  it('revient à l’automatique et rend à chaque barre sa couleur', () => {
    appliquerTheme('clair')
    appliquerTheme('auto')
    expect(document.documentElement.dataset.theme).toBeUndefined()
    const couleurs = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => m.content)
    expect(couleurs).toEqual(['#F5EFE6', '#151413'])
    expect(lireChoixTheme()).toBe('auto')
  })
})
