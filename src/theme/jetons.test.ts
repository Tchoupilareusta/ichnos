import { contraste } from '../couvertures/palette'
// Lu par Node, tel qu'il est écrit : la configuration des tests vide les fichiers CSS (css: false).
const { readFileSync } = (await import('node:' + 'fs')) as { readFileSync: (chemin: string, codage: string) => string }
const css = readFileSync('src/index.css', 'utf8')

// Les jetons de couleur, lus dans index.css tels qu'ils sont écrits : le bouton d'action principale
// d'une carte (« Commencer ») doit se détacher de la surface de la carte et rester lisible.

/** Les valeurs des jetons d'un bloc de index.css (« --surface: #fbf8f3; »). */
function jetons(bloc: string): Record<string, string> {
  return Object.fromEntries([...bloc.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map(([, nom, valeur]) => [nom, valeur]))
}

/** Le contenu entre l'accolade ouvrante qui suit `debut` et l'accolade fermante qui lui répond. */
function bloc(debut: string): string {
  const depart = css.indexOf('{', css.indexOf(debut))
  let profondeur = 0
  for (let i = depart; i < css.length; i++) {
    if (css[i] === '{') profondeur++
    if (css[i] === '}' && --profondeur === 0) return css.slice(depart + 1, i)
  }
  throw new Error(`Bloc introuvable : ${debut}`)
}

const THEMES = {
  clair: jetons(bloc(':root {')),
  'sombre (appareil)': jetons(bloc(":root:not([data-theme='light']) {")),
  'sombre (choisi)': jetons(bloc(":root[data-theme='dark']")),
}

describe('jetons : l’action principale d’une carte', () => {
  for (const [theme, valeurs] of Object.entries(THEMES)) {
    it(`se détache de la carte d’au moins 3:1, avec un texte AA (${theme})`, () => {
      expect(valeurs.action, 'jeton --action').toBeDefined()
      expect(contraste(valeurs.action, valeurs.surface)).toBeGreaterThanOrEqual(3)
      expect(contraste(valeurs.action, valeurs['sur-action'])).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('ne prend que des couleurs de la palette existante', () => {
    const palette = new Set(Object.values(THEMES).flatMap((valeurs) => Object.entries(valeurs).filter(([nom]) => !nom.includes('action')).map(([, v]) => v.toLowerCase())))
    for (const valeurs of Object.values(THEMES)) {
      expect(palette).toContain(valeurs.action.toLowerCase())
      expect(palette).toContain(valeurs['sur-action'].toLowerCase())
    }
  })
})
