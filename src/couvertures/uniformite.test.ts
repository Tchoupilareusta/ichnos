import { describe, expect, it } from 'vitest'
import { estPresqueUniforme, HAUTEUR_MESURE, LARGEUR_MESURE, partUniforme, SEUIL_UNIFORME } from './uniformite'

// Les vraies images ne sont jamais dans le dépôt (§8.3) : ces images de 48 × 72 points les
// reproduisent d'après ce qui a été mesuré le 20 novembre 2026 sur les originaux.
type Couleur = [number, number, number]
function image(fond: Couleur, peindre: (x: number, y: number) => Couleur | null = () => null): Uint8ClampedArray {
  const points = new Uint8ClampedArray(LARGEUR_MESURE * HAUTEUR_MESURE * 4)
  for (let y = 0; y < HAUTEUR_MESURE; y++)
    for (let x = 0; x < LARGEUR_MESURE; x++) {
      const [r, v, b] = peindre(x, y) ?? fond
      points.set([r, v, b, 255], (y * LARGEUR_MESURE + x) * 4)
    }
  return points
}
// Un bruit fixe, pour ne pas dépendre du hasard.
const bruit = (x: number, y: number, amplitude: number) => (((x * 31 + y * 17) % 7) - 3) * (amplitude / 3)

/** Siddhartha chez Open Library : page de titre blanche, le nom de l'auteur et le titre en petit, un filet gris. */
const pageBlancheSiddhartha = image([248, 248, 248], (x, y) => {
  if (y === 15 && x >= 18 && x <= 29) return [40, 40, 40] // « Hermann Hesse »
  if (y === 17 && x >= 3 && x <= 44 && x % 4 === 0) return [200, 200, 200] // le filet, à peine visible une fois réduit
  if (y === 19 && x >= 20 && x <= 27 && x % 2 === 0) return [240, 150, 20] // « Siddaharta », en orange
  return null
})
/** Un livre relié sans jaquette : toile verte unie, avec son grain. */
const toileVerte = image([24, 58, 10], (x, y) => [24 + bruit(x, y, 6), 58 + bruit(x, y, 8), 10 + bruit(x, y, 4)])
/** Une vraie couverture très sobre (Minuit, Gallimard) : fond crème, filet bleu, titre et auteur, sigle. */
const couvertureSobre = image([250, 248, 240], (x, y) => {
  if ((x === 3 || x === 44 || y === 3 || y === 68) && x >= 3 && x <= 44 && y >= 3 && y <= 68) return [60, 90, 160] // le cadre
  if (y >= 10 && y <= 11 && x >= 12 && x <= 35) return [30, 30, 30] // l'auteur
  if (y >= 20 && y <= 23 && x >= 10 && x <= 37) return [20, 50, 120] // le titre
  if (y >= 40 && y <= 43 && x >= 21 && x <= 26) return [20, 50, 120] // le sigle
  if (y >= 60 && y <= 61 && x >= 14 && x <= 33) return [30, 30, 30] // l'éditeur
  return null
})

describe('fausses couvertures presque uniformes', () => {
  it('reconnaît la page blanche de Siddhartha', () => {
    expect(partUniforme(pageBlancheSiddhartha)).toBeGreaterThan(SEUIL_UNIFORME)
  })

  it('reconnaît la toile verte d’un livre relié', () => {
    expect(partUniforme(toileVerte)).toBeGreaterThan(SEUIL_UNIFORME)
  })

  it('garde une vraie couverture, même très sobre', () => {
    const part = partUniforme(couvertureSobre)
    expect(part).toBeLessThan(SEUIL_UNIFORME)
    expect(part).toBeGreaterThan(0.85)
  })

  it('garde une couverture illustrée', () => {
    const illustree = image([120, 60, 40], (x, y) => [(x * 5) % 256, (y * 3) % 256, ((x + y) * 4) % 256])
    expect(partUniforme(illustree)).toBeLessThan(0.5)
  })

  it('ne dit rien d’une image vide', () => {
    expect(partUniforme(new Uint8ClampedArray(0))).toBe(0)
  })
})

describe('mesure sur l’appareil', () => {
  const outils = (points: Uint8ClampedArray, largeur = 2480, hauteur = 3509) => {
    let liberee = false
    return {
      liberee: () => liberee,
      outils: {
        decoder: async () => ({ largeur, hauteur, image: {}, liberer: () => void (liberee = true) }),
        creerToile: () => ({ width: 0, height: 0, getContext: () => ({ drawImage: () => {}, getImageData: () => ({ data: points }) }) }),
      },
    }
  }

  it('écarte la page blanche, et libère l’image décodée', async () => {
    const essai = outils(pageBlancheSiddhartha)
    expect(await estPresqueUniforme(new Blob(['x']), essai.outils)).toBe(true)
    expect(essai.liberee()).toBe(true)
  })

  it('garde une vraie couverture', async () => {
    expect(await estPresqueUniforme(new Blob(['x']), outils(couvertureSobre).outils)).toBe(false)
  })

  it('n’écarte jamais une image faute d’avoir pu la mesurer', async () => {
    expect(await estPresqueUniforme(new Blob(['x']), { decoder: async () => Promise.reject(new Error('illisible')) })).toBe(false)
    expect(await estPresqueUniforme(new Blob(['x']), { ...outils(pageBlancheSiddhartha).outils, creerToile: () => ({ width: 0, height: 0, getContext: () => null }) })).toBe(false)
  })
})
