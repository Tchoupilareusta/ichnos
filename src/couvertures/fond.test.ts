import { couleurDesBords, fondAdouci, moyenneDesBords, type Toile } from './fond'

/** Une image de test : chaque pixel est donné par une fonction (rouge, vert, bleu, opacité). */
function pixels(largeur: number, hauteur: number, couleur: (x: number, y: number) => [number, number, number, number]) {
  const donnees = new Uint8ClampedArray(largeur * hauteur * 4)
  for (let y = 0; y < hauteur; y++) for (let x = 0; x < largeur; x++) donnees.set(couleur(x, y), (y * largeur + x) * 4)
  return donnees
}

describe('moyenneDesBords', () => {
  it('fait la moyenne d’une bande sur les quatre bords, sans regarder le centre', () => {
    // Un cadre rouge de 2 pixels autour d'un centre bleu.
    const image = pixels(10, 12, (x, y) => (x < 2 || x >= 8 || y < 2 || y >= 10 ? [200, 40, 20, 255] : [0, 0, 255, 255]))
    expect(moyenneDesBords(image, 10, 12, 2)).toEqual({ r: 200, v: 40, b: 20 })
  })

  it('mélange les couleurs des bords', () => {
    // Moitié gauche noire, moitié droite blanche : les bords sont gris moyen.
    const image = pixels(8, 8, (x) => (x < 4 ? [0, 0, 0, 255] : [255, 255, 255, 255]))
    const moyenne = moyenneDesBords(image, 8, 8, 1)
    expect(moyenne?.r).toBeGreaterThan(120)
    expect(moyenne?.r).toBeLessThan(135)
    expect(moyenne?.v).toBe(moyenne?.r)
  })

  it('ne compte pas les pixels transparents', () => {
    const image = pixels(6, 6, (x) => (x < 3 ? [10, 200, 30, 255] : [255, 0, 0, 0]))
    expect(moyenneDesBords(image, 6, 6, 1)).toEqual({ r: 10, v: 200, b: 30 })
  })

  it('rend null pour une image vide, entièrement transparente ou mal mesurée', () => {
    expect(moyenneDesBords(new Uint8ClampedArray(0), 0, 0)).toBeNull()
    expect(moyenneDesBords(pixels(4, 4, () => [0, 0, 0, 0]), 4, 4)).toBeNull()
    expect(moyenneDesBords(pixels(4, 4, () => [9, 9, 9, 255]), 40, 40)).toBeNull()
  })
})

describe('fondAdouci', () => {
  it('adoucit la couleur des bords vers le fond de l’appli', () => {
    expect(fondAdouci({ r: 200, v: 40, b: 20 })).toBe('color-mix(in srgb, rgb(200 40 20) 70%, var(--fond))')
  })

  it('sans couleur connue, prend la couleur des cartes', () => {
    expect(fondAdouci(null)).toBe('var(--surface)')
  })
})

describe('couleurDesBords', () => {
  const image = (adresse: string, largeur = 400, hauteur = 600) => ({ src: adresse, naturalWidth: largeur, naturalHeight: hauteur }) as HTMLImageElement

  /** Une fausse toile de dessin, unie, qui compte ses usages. */
  function atelier(couleur: [number, number, number, number] = [30, 60, 90, 255]) {
    const dessins: { largeur: number; hauteur: number }[] = []
    const creer = (): Toile => {
      const toile = {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: () => void dessins.push({ largeur: toile.width, hauteur: toile.height }),
          getImageData: (_x: number, _y: number, largeur: number, hauteur: number) => ({ data: pixels(largeur, hauteur, () => couleur) }),
        }),
      }
      return toile
    }
    return { creer, dessins }
  }

  it('dessine l’image dans une petite toile et rend la couleur de ses bords', () => {
    const { creer, dessins } = atelier()
    expect(couleurDesBords(image('blob:essai/1'), creer)).toEqual({ r: 30, v: 60, b: 90 })
    // Une petite toile suffit : la couleur moyenne ne demande pas l'image entière.
    expect(dessins).toHaveLength(1)
    expect(dessins[0].largeur).toBeLessThanOrEqual(48)
    expect(dessins[0].hauteur).toBeLessThanOrEqual(96)
  })

  it('ne calcule qu’une fois par image, et retient le résultat par adresse', () => {
    const { creer, dessins } = atelier()
    couleurDesBords(image('blob:essai/2'), creer)
    couleurDesBords(image('blob:essai/2'), creer)
    expect(dessins).toHaveLength(1)
    couleurDesBords(image('blob:essai/3'), creer)
    expect(dessins).toHaveLength(2)
  })

  it('rend null sans toile de dessin, pour une image pas encore chargée, ou si le dessin échoue', () => {
    expect(couleurDesBords(image('blob:essai/4'), () => ({ width: 0, height: 0, getContext: () => null }))).toBeNull()
    expect(couleurDesBords(image('blob:essai/5', 0, 0), atelier().creer)).toBeNull()
    const cassee = (): Toile => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => {
          throw new Error('image illisible')
        },
        getImageData: () => ({ data: new Uint8ClampedArray(0) }),
      }),
    })
    expect(couleurDesBords(image('blob:essai/6'), cassee)).toBeNull()
  })
})
