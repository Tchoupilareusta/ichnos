import { bandesUnies, cadrageDe, cadrer, FORMAT_CADRE, placer, zoneRognee, type Bandes, type ToileMesure } from './cadrage'

type Couleur = [number, number, number]
const BLANC: Couleur = [255, 255, 255]
const NOIR: Couleur = [0, 0, 0]

/** Une image dessinée par le code : un motif à deux couleurs (une « couverture »), entouré de bandes unies. */
function image(largeur: number, hauteur: number, bandes: Partial<Bandes> = {}, couleurBande: Couleur = BLANC) {
  const { haut = 0, bas = 0, gauche = 0, droite = 0 } = bandes
  const pixels = new Uint8ClampedArray(largeur * hauteur * 4)
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const dansBande = y < haut || y >= hauteur - bas || x < gauche || x >= largeur - droite
      // Un damier de 3 points : aucune ligne ni colonne de la « couverture » n'est unie.
      const motif: Couleur = (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0 ? [180, 40, 40] : [30, 60, 120]
      const [r, v, b] = dansBande ? couleurBande : motif
      pixels.set([r, v, b, 255], (y * largeur + x) * 4)
    }
  }
  return pixels
}

describe('bandesUnies', () => {
  it('ne trouve rien autour d’une image sans marge', () => {
    expect(bandesUnies(image(100, 160), 100, 160)).toEqual({ haut: 0, bas: 0, gauche: 0, droite: 0 })
  })

  it('mesure la bande unie de chaque côté', () => {
    expect(bandesUnies(image(100, 160, { haut: 3, bas: 2, gauche: 4, droite: 5 }), 100, 160)).toEqual({ haut: 3, bas: 2, gauche: 4, droite: 5 })
  })

  it('reconnaît une marge d’une autre couleur que le blanc', () => {
    expect(bandesUnies(image(100, 160, { gauche: 6, droite: 6 }, NOIR), 100, 160)).toMatchObject({ gauche: 6, droite: 6 })
  })

  it('tolère un léger bruit : 98 % des points à 20 nuances près', () => {
    const pixels = image(100, 160, { haut: 4 })
    // Deux points sur cent, dans la première ligne, sont d'une autre couleur ; les autres varient un peu.
    pixels.set([10, 10, 10, 255], 0)
    pixels.set([10, 10, 10, 255], 50 * 4)
    for (let x = 1; x < 100; x += 7) pixels.set([240, 245, 238, 255], (100 + x) * 4)
    expect(bandesUnies(pixels, 100, 160).haut).toBe(4)
  })

  it('une zone unie qui atteint 15 % de la dimension n’est pas une marge : c’est le fond de la couverture', () => {
    // 24 lignes sur 160 : 15 %. Une marge de scan n'est jamais si large ; un fond de couverture, souvent.
    expect(bandesUnies(image(100, 160, { haut: 24 }), 100, 160).haut).toBe(0)
    expect(bandesUnies(image(100, 160, { haut: 23 }), 100, 160).haut).toBe(23)
  })
})

describe('zoneRognee', () => {
  const sur = (bandes: Partial<Bandes>) => zoneRognee({ haut: 0, bas: 0, gauche: 0, droite: 0, ...bandes }, 100, 200)

  it('garde l’image entière quand elle n’a pas de marge', () => {
    expect(sur({})).toEqual({ x: 0, y: 0, largeur: 1, hauteur: 1 })
  })

  it('rogne une bande d’un seul côté quand elle fait moins de 4 % de la dimension', () => {
    // 7 lignes sur 200 : 3,5 %.
    expect(sur({ haut: 7 })).toEqual({ x: 0, y: 0.035, largeur: 1, hauteur: 0.965 })
  })

  it('garde une bande d’un seul côté de 4 % ou plus : elle fait sans doute partie du dessin', () => {
    // Le blanc du haut d'une couverture Folio : 5,5 %.
    expect(sur({ haut: 11 })).toEqual({ x: 0, y: 0, largeur: 1, hauteur: 1 })
    expect(sur({ haut: 8 })).toEqual({ x: 0, y: 0, largeur: 1, hauteur: 1 })
  })

  it('rogne des bandes opposées, même larges : c’est un cadre de scan', () => {
    expect(sur({ haut: 20, bas: 16 })).toEqual({ x: 0, y: 0.1, largeur: 1, hauteur: 0.82 })
    expect(sur({ gauche: 10, droite: 5 })).toEqual({ x: 0.1, y: 0, largeur: 0.85, hauteur: 1 })
  })

  it('juge chaque paire de côtés à part', () => {
    // Haut large et seul : gardé. Gauche et droite : rognés.
    expect(sur({ haut: 20, gauche: 2, droite: 2 })).toEqual({ x: 0.02, y: 0, largeur: 0.96, hauteur: 1 })
  })
})

describe('cadrer', () => {
  const ENTIERE = { x: 0, y: 0, largeur: 1, hauteur: 1 }

  it('remplit le cadre quand le format est à 6 % au plus de 5:8', () => {
    // 5:8 = 0,625. De 0,5875 à 0,6625.
    for (const [largeur, hauteur] of [[625, 1000], [588, 1000], [662, 1000], [911, 1500], [304, 500], [300, 475]]) {
      expect(cadrer({ largeur, hauteur }, ENTIERE, false).mode, `${largeur} × ${hauteur}`).toBe('remplir')
    }
  })

  it('pose l’image sur l’étagère, à sa vraie forme, au-delà de 6 %', () => {
    for (const [largeur, hauteur] of [[580, 1000], [670, 1000], [350, 475], [700, 1000], [1000, 700]]) {
      const cadrage = cadrer({ largeur, hauteur }, ENTIERE, false)
      expect(cadrage.mode, `${largeur} × ${hauteur}`).toBe('etagere')
      expect(cadrage.format).toBeCloseTo(largeur / hauteur, 5)
      expect(cadrage.visible).toEqual(ENTIERE)
    }
  })

  it('en remplissant, ne retire jamais plus de 3 % de chaque côté, et reste centré', () => {
    // Plus étroite que le cadre (0,5875) : on perd en haut et en bas.
    const etroite = cadrer({ largeur: 588, hauteur: 1000 }, ENTIERE, false)
    expect(etroite.format).toBe(FORMAT_CADRE)
    expect(etroite.visible.x).toBe(0)
    expect(etroite.visible.largeur).toBe(1)
    expect(etroite.visible.y).toBeGreaterThan(0)
    expect(etroite.visible.y).toBeLessThanOrEqual(0.03)
    expect(etroite.visible.y * 2 + etroite.visible.hauteur).toBeCloseTo(1, 6)
    // Plus large (0,6625) : on perd à gauche et à droite.
    const large = cadrer({ largeur: 662, hauteur: 1000 }, ENTIERE, false)
    expect(large.visible.y).toBe(0)
    expect(large.visible.x).toBeGreaterThan(0)
    expect(large.visible.x).toBeLessThanOrEqual(0.03)
  })

  it('juge le format après le rognage des marges', () => {
    // 700 × 1000 avec 5 % de marge à gauche et à droite : la couverture fait 630 × 1000, elle remplit le cadre.
    const cadrage = cadrer({ largeur: 700, hauteur: 1000 }, { x: 0.05, y: 0, largeur: 0.9, hauteur: 1 }, false)
    expect(cadrage.mode).toBe('remplir')
    expect(cadrage.visible.x).toBeGreaterThanOrEqual(0.05)
    expect(cadrage.visible.x + cadrage.visible.largeur).toBeLessThanOrEqual(0.95)
  })

  it('ne retouche jamais une image que j’ai cadrée moi-même', () => {
    // Même avec des marges mesurées, la zone reste l'image entière.
    const avecMarges = { x: 0.05, y: 0.02, largeur: 0.9, hauteur: 0.96 }
    // À 3 % du cadre : une autre image remplirait le cadre, rognée ; celle-ci est posée telle quelle.
    const posee = cadrer({ largeur: 606, hauteur: 1000 }, avecMarges, true)
    expect(posee).toEqual({ mode: 'etagere', visible: ENTIERE, format: 0.606 })
    // Déjà au format du cadre, à 1 % près : elle le remplit, entière.
    const pleine = cadrer({ largeur: 750, hauteur: 1200 }, avecMarges, true)
    expect(pleine.mode).toBe('remplir')
    expect(pleine.visible).toEqual(ENTIERE)
    expect(cadrer({ largeur: 620, hauteur: 1000 }, ENTIERE, true).mode).toBe('remplir')
    expect(cadrer({ largeur: 617, hauteur: 1000 }, ENTIERE, true).mode).toBe('etagere')
  })
})

describe('placer', () => {
  it('une image qui remplit le cadre occupe toute la case', () => {
    const { livre } = placer(cadrer({ largeur: 625, hauteur: 1000 }, { x: 0, y: 0, largeur: 1, hauteur: 1 }, false))
    expect(livre).toEqual({ largeur: 100, hauteur: 100 })
  })

  it('sur l’étagère, une image étroite prend toute la hauteur ; une image large, toute la largeur', () => {
    const etroite = placer(cadrer({ largeur: 500, hauteur: 1000 }, { x: 0, y: 0, largeur: 1, hauteur: 1 }, false))
    expect(etroite.livre.hauteur).toBe(100)
    expect(etroite.livre.largeur).toBeCloseTo(80, 5)
    const large = placer(cadrer({ largeur: 1000, hauteur: 1000 }, { x: 0, y: 0, largeur: 1, hauteur: 1 }, false))
    expect(large.livre.largeur).toBe(100)
    expect(large.livre.hauteur).toBeCloseTo(62.5, 5)
  })

  it('l’image est agrandie et décalée pour ne montrer que la zone gardée', () => {
    const { image } = placer({ mode: 'etagere', visible: { x: 0.1, y: 0.2, largeur: 0.8, hauteur: 0.5 }, format: 1 })
    expect(image.largeur).toBeCloseTo(125, 5)
    expect(image.hauteur).toBeCloseTo(200, 5)
    expect(image.gauche).toBeCloseTo(-12.5, 5)
    expect(image.haut).toBeCloseTo(-40, 5)
  })
})

describe('cadrageDe', () => {
  /** Une fausse toile qui rend les points d'une image dessinée par le code. */
  function atelier(largeurImage: number, hauteurImage: number, bandes: Partial<Bandes> = {}) {
    let mesures = 0
    const creerToile = (): ToileMesure => {
      const toile = {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: () => {},
          getImageData: (_x: number, _y: number, largeur: number, hauteur: number) => {
            mesures++
            // Les bandes sont données en centièmes de l'image.
            const enPoints = (valeur: number | undefined, dimension: number) => Math.round(((valeur ?? 0) * dimension) / 100)
            return {
              data: image(largeur, hauteur, {
                haut: enPoints(bandes.haut, hauteur),
                bas: enPoints(bandes.bas, hauteur),
                gauche: enPoints(bandes.gauche, largeur),
                droite: enPoints(bandes.droite, largeur),
              }),
            }
          },
        }),
      }
      return toile
    }
    const img = { naturalWidth: largeurImage, naturalHeight: hauteurImage, src: `blob:essai/${largeurImage}-${hauteurImage}-${JSON.stringify(bandes)}-${Math.random()}` } as HTMLImageElement
    return { img, creerToile, mesures: () => mesures }
  }

  it('mesure l’image sur une petite toile, une seule fois par adresse', async () => {
    const { img, creerToile, mesures } = atelier(911, 1500)
    const outils = { creerToile, lireMarque: async () => false }
    const premier = await cadrageDe(img, outils)
    const second = await cadrageDe(img, outils)
    expect(premier).toEqual(second)
    expect(premier?.mode).toBe('remplir')
    expect(mesures()).toBe(1)
  })

  it('rogne un cadre de scan avant de juger le format', async () => {
    // 700 × 1000, 5 % de marge de chaque côté : rognée, la couverture (0,63) remplit le cadre.
    const { img, creerToile } = atelier(700, 1000, { gauche: 5, droite: 5 })
    const cadrage = await cadrageDe(img, { creerToile, lireMarque: async () => false })
    expect(cadrage?.mode).toBe('remplir')
    expect(cadrage?.visible.x).toBeGreaterThan(0.04)
  })

  it('ne mesure pas les marges d’une image que j’ai cadrée moi-même', async () => {
    const { img, creerToile, mesures } = atelier(700, 1000, { gauche: 5, droite: 5 })
    const cadrage = await cadrageDe(img, { creerToile, lireMarque: async () => true })
    expect(cadrage).toEqual({ mode: 'etagere', visible: { x: 0, y: 0, largeur: 1, hauteur: 1 }, format: 0.7 })
    expect(mesures()).toBe(0)
  })

  it('sans toile de dessin, juge l’image entière d’après ses dimensions', async () => {
    const img = { naturalWidth: 700, naturalHeight: 1000, src: 'blob:essai/sans-toile' } as HTMLImageElement
    const cadrage = await cadrageDe(img, { creerToile: () => ({ width: 0, height: 0, getContext: () => null }), lireMarque: async () => false })
    expect(cadrage).toEqual({ mode: 'etagere', visible: { x: 0, y: 0, largeur: 1, hauteur: 1 }, format: 0.7 })
  })

  it('rend null pour une image dont les dimensions ne sont pas connues', async () => {
    const img = { naturalWidth: 0, naturalHeight: 0, src: 'blob:essai/vide' } as HTMLImageElement
    expect(await cadrageDe(img)).toBeNull()
  })
})
