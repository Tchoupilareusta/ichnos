import { coinsDeLImage, detecterCoins } from './detection.ts'
import type { Point, Quad } from './geometrie.ts'

// Toutes les images sont dessinées par le code : jamais de vraie photo dans le dépôt.

type Couleur = [number, number, number]
const LARGEUR = 384
const HAUTEUR = 512

/** Un hasard reproductible : les mêmes images à chaque lancement des tests. */
function hasard(graine: number) {
  let etat = graine
  return () => {
    etat = (etat + 0x6d2b79f5) | 0
    let t = Math.imul(etat ^ (etat >>> 15), 1 | etat)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const dedans = (p: Point, quad: Quad) =>
  quad.every((a, i) => {
    const b = quad[(i + 1) % 4]
    return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= 0
  })

/** Une « photo » : un fond, et un livre (quadrilatère) dessiné par-dessus. `v` : la hauteur dans le livre, de 0 (haut) à 1 (bas). */
function photo(fond: (x: number, y: number) => Couleur, livre: Quad | null, couverture: (x: number, y: number, v: number) => Couleur = () => [40, 110, 150]) {
  const pixels = new Uint8ClampedArray(LARGEUR * HAUTEUR * 4)
  const haut = livre ? Math.min(livre[0].y, livre[1].y) : 0
  const bas = livre ? Math.max(livre[2].y, livre[3].y) : 1
  for (let y = 0; y < HAUTEUR; y++) {
    for (let x = 0; x < LARGEUR; x++) {
      const dansLivre = livre !== null && dedans({ x: x + 0.5, y: y + 0.5 }, livre)
      const [r, v, b] = dansLivre ? couverture(x, y, (y - haut) / (bas - haut)) : fond(x, y)
      pixels.set([r, v, b, 255], (y * LARGEUR + x) * 4)
    }
  }
  return pixels
}

/** Un livre vu un peu de biais. */
const LIVRE: Quad = [
  { x: 110, y: 90 },
  { x: 290, y: 110 },
  { x: 300, y: 400 },
  { x: 90, y: 380 },
]

const BOIS: Couleur = [170, 120, 70]

function attendre(trouves: Quad, attendus: Quad, tolerance: number) {
  trouves.forEach((coin, i) => {
    const ecart = Math.hypot(coin.x - attendus[i].x, coin.y - attendus[i].y)
    expect(ecart, `coin ${i} : trouvé (${coin.x.toFixed(1)}, ${coin.y.toFixed(1)}), attendu (${attendus[i].x}, ${attendus[i].y})`).toBeLessThanOrEqual(tolerance)
  })
}

describe('detecterCoins', () => {
  it('trouve les quatre coins d’un livre posé sur un fond uni', () => {
    const { coins, trouve } = detecterCoins(photo(() => BOIS, LIVRE), LARGEUR, HAUTEUR)
    expect(trouve).toBe(true)
    attendre(coins, LIVRE, 3)
  })

  it('rend les coins dans l’ordre : haut-gauche, haut-droite, bas-droite, bas-gauche', () => {
    const { coins } = detecterCoins(photo(() => BOIS, LIVRE), LARGEUR, HAUTEUR)
    const [hg, hd, bd, bg] = coins
    expect(hg.x).toBeLessThan(hd.x)
    expect(bg.x).toBeLessThan(bd.x)
    expect(hg.y).toBeLessThan(bg.y)
    expect(hd.y).toBeLessThan(bd.y)
  })

  it('sur un fond légèrement texturé (grain du bois)', () => {
    const alea = hasard(7)
    const fond = (): Couleur => {
      const grain = Math.round((alea() - 0.5) * 24)
      return [BOIS[0] + grain, BOIS[1] + grain, BOIS[2] + grain]
    }
    const { coins, trouve } = detecterCoins(photo(fond, LIVRE), LARGEUR, HAUTEUR)
    expect(trouve).toBe(true)
    attendre(coins, LIVRE, 4)
  })

  it('sur un fond à deux lumières (soleil et ombre), avec une ombre qui passe sous le livre', () => {
    // À gauche d'une diagonale, le parquet est à l'ombre : plus sombre, un peu plus bleu.
    const fond = (x: number, y: number): Couleur => (x + y * 0.4 < 260 ? [95, 68, 46] : BOIS)
    const { coins, trouve } = detecterCoins(photo(fond, LIVRE), LARGEUR, HAUTEUR)
    expect(trouve).toBe(true)
    attendre(coins, LIVRE, 4)
  })

  it('quand le haut de la couverture a presque la couleur du fond (livre sombre sur drap sombre)', () => {
    // Le drap est gris foncé ; le tiers haut de la couverture est noir, sauf un dessin à droite qui
    // monte jusqu'en haut (comme l'arbre de Siddhartha au Livre de poche). Le reste est coloré.
    const drap: Couleur = [62, 62, 64]
    const couverture = (x: number, _y: number, v: number): Couleur => (v < 0.33 && x < 235 ? [28, 28, 30] : x % 40 < 20 ? [60, 120, 170] : [200, 180, 90])
    const { coins, trouve } = detecterCoins(photo(() => drap, LIVRE, couverture), LARGEUR, HAUTEUR)
    expect(trouve).toBe(true)
    attendre(coins, LIVRE, 5)
  })

  it('pour une couverture en plusieurs morceaux, dont une bande a exactement la couleur du fond', () => {
    const couverture = (_x: number, _y: number, v: number): Couleur => (v > 0.45 && v < 0.55 ? BOIS : [40, 110, 150])
    const { coins, trouve } = detecterCoins(photo(() => BOIS, LIVRE, couverture), LARGEUR, HAUTEUR)
    expect(trouve).toBe(true)
    attendre(coins, LIVRE, 4)
  })

  it('sur un tissu à motifs, reste près du livre', () => {
    // Un damier fin noir et blanc : le fond a deux couleurs, et des arêtes partout.
    const fond = (x: number, y: number): Couleur => ((Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0 ? [35, 35, 35] : [215, 210, 200])
    const { coins, trouve } = detecterCoins(photo(fond, LIVRE), LARGEUR, HAUTEUR)
    expect(trouve).toBe(true)
    attendre(coins, LIVRE, 8)
  })

  it('sans livre (fond seul), place les coins aux coins de l’image', () => {
    const { coins, trouve } = detecterCoins(photo(() => BOIS, null), LARGEUR, HAUTEUR)
    expect(trouve).toBe(false)
    expect(coins).toEqual(coinsDeLImage(LARGEUR, HAUTEUR))
  })

  it('pour une zone trop petite pour être un livre (moins de 5 % de la photo), place les coins aux coins de l’image', () => {
    const petit: Quad = [{ x: 180, y: 240 }, { x: 230, y: 240 }, { x: 230, y: 300 }, { x: 180, y: 300 }]
    const { coins, trouve } = detecterCoins(photo(() => BOIS, petit), LARGEUR, HAUTEUR)
    expect(trouve).toBe(false)
    expect(coins).toEqual(coinsDeLImage(LARGEUR, HAUTEUR))
  })

  it('ne lève jamais d’erreur, même sur une image vide ou minuscule', () => {
    expect(detecterCoins(new Uint8ClampedArray(0), 0, 0)).toEqual({ coins: coinsDeLImage(0, 0), trouve: false })
    expect(detecterCoins(new Uint8ClampedArray(4 * 4 * 4), 4, 4).trouve).toBe(false)
  })
})
