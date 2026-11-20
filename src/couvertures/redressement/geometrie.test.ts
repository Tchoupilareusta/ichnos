import { appliquer, formatReel, homographie, redresserPixels, resoudre, tailleRedressee, type Point, type Quad } from './geometrie.ts'

const CARRE: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]

describe('resoudre', () => {
  it('résout un système linéaire', () => {
    // 2x + y = 5 ; x − y = 1 → x = 2, y = 1.
    const solution = resoudre(
      [
        [2, 1],
        [1, -1],
      ],
      [5, 1],
    )
    expect(solution?.[0]).toBeCloseTo(2, 9)
    expect(solution?.[1]).toBeCloseTo(1, 9)
  })

  it('rend null quand le système n’a pas de solution unique', () => {
    expect(
      resoudre(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2],
      ),
    ).toBeNull()
  })
})

describe('homographie', () => {
  const QUAD: Quad = [
    { x: 120, y: 80 },
    { x: 410, y: 95 },
    { x: 450, y: 520 },
    { x: 90, y: 480 },
  ]

  it('envoie un carré connu sur un quadrilatère connu, coin pour coin', () => {
    const h = homographie(CARRE, QUAD)
    expect(h).not.toBeNull()
    CARRE.forEach((coin, i) => {
      const image = appliquer(h!, coin)
      expect(image.x).toBeCloseTo(QUAD[i].x, 6)
      expect(image.y).toBeCloseTo(QUAD[i].y, 6)
    })
  })

  it('et le chemin du retour ramène chaque point à sa place', () => {
    const aller = homographie(CARRE, QUAD)!
    const retour = homographie(QUAD, CARRE)!
    for (const point of [{ x: 0.5, y: 0.5 }, { x: 0.1, y: 0.9 }, { x: 0.75, y: 0.2 }]) {
      const revenu = appliquer(retour, appliquer(aller, point))
      expect(revenu.x).toBeCloseTo(point.x, 6)
      expect(revenu.y).toBeCloseTo(point.y, 6)
    }
  })

  it('garde les droites droites : le milieu d’un côté reste sur ce côté', () => {
    const h = homographie(CARRE, QUAD)!
    const milieu = appliquer(h, { x: 0.5, y: 0 })
    // Aligné avec les deux coins du haut.
    const aligne = (QUAD[1].x - QUAD[0].x) * (milieu.y - QUAD[0].y) - (QUAD[1].y - QUAD[0].y) * (milieu.x - QUAD[0].x)
    expect(aligne).toBeCloseTo(0, 6)
  })

  it('rend null pour quatre points qui ne forment pas un quadrilatère', () => {
    const aplati: Quad = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]
    expect(homographie(CARRE, aplati)).toBeNull()
  })
})

describe('formatReel', () => {
  /** Les coins d'un rectangle (largeur × hauteur, posé à plat) vus par un appareil penché, de focale donnée. */
  function vue(largeur: number, hauteur: number, inclinaison: number, focale: number, photo: { largeur: number; hauteur: number }): Quad {
    const angle = (inclinaison * Math.PI) / 180
    const projeter = (x: number, y: number): Point => {
      // Le rectangle est basculé autour de l'axe horizontal, puis éloigné de l'appareil.
      const y3 = y * Math.cos(angle)
      const z3 = 4 + y * Math.sin(angle)
      return { x: photo.largeur / 2 + (focale * x) / z3, y: photo.hauteur / 2 + (focale * y3) / z3 }
    }
    return [projeter(-largeur / 2, -hauteur / 2), projeter(largeur / 2, -hauteur / 2), projeter(largeur / 2, hauteur / 2), projeter(-largeur / 2, hauteur / 2)]
  }
  const PHOTO = { largeur: 3000, hauteur: 4000 }
  const longueur = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
  const moyenneDesCotes = ([hg, hd, bd, bg]: Quad) => (longueur(hg, hd) + longueur(bg, bd)) / (longueur(hg, bg) + longueur(hd, bd))

  it('vu bien à plat, c’est le rapport des côtés', () => {
    expect(formatReel(vue(0.7, 1, 0, 2880, PHOTO), PHOTO.largeur, PHOTO.hauteur)).toBeCloseTo(0.7, 3)
    expect(formatReel(vue(0.618, 1, 4, 2880, PHOTO), PHOTO.largeur, PHOTO.hauteur)).toBeCloseTo(0.618, 2)
  })

  it('retrouve le vrai format d’un livre vu en forte perspective', () => {
    // Un manga (0,70) photographié de biais avec l'objectif principal d'un iPhone (focale : 0,72 fois le grand côté).
    const coins = vue(0.7, 1, 50, 2880, PHOTO)
    // La moyenne des côtés le croirait bien plus large.
    expect(moyenneDesCotes(coins)).toBeGreaterThan(0.85)
    expect(formatReel(coins, PHOTO.largeur, PHOTO.hauteur)).toBeCloseTo(0.7, 2)
  })

  it('avec un autre objectif, reste bien plus près du vrai format que la moyenne des côtés', () => {
    for (const focale of [2400, 3400]) {
      const coins = vue(0.7, 1, 50, focale, PHOTO)
      const format = formatReel(coins, PHOTO.largeur, PHOTO.hauteur)
      // Très penché (50°) et avec une focale de 0,60 ou 0,85 au lieu de 0,72 : moins de 0,09 d’écart, contre 0,38.
      expect(Math.abs(format - 0.7)).toBeLessThan(0.09)
      expect(Math.abs(format - 0.7)).toBeLessThan(Math.abs(moyenneDesCotes(coins) - 0.7) / 3)
    }
  })

  it('ne rend jamais un format absurde, même avec des coins invraisemblables', () => {
    const tordu: Quad = [{ x: 0, y: 0 }, { x: 2900, y: 900 }, { x: 600, y: 3900 }, { x: 100, y: 300 }]
    const format = formatReel(tordu, PHOTO.largeur, PHOTO.hauteur)
    expect(Number.isFinite(format)).toBe(true)
    expect(format).toBeGreaterThan(0.2)
    expect(format).toBeLessThan(5)
  })
})

describe('tailleRedressee', () => {
  it('ne perd aucun détail : la taille suit le plus long côté vu', () => {
    const coins: Quad = [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 700 }, { x: 100, y: 700 }]
    expect(tailleRedressee(coins, 1000, 1000, 1200)).toEqual({ largeur: 400, hauteur: 600 })
  })

  it('ramène le grand côté à la limite, en gardant le format', () => {
    const coins: Quad = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 3200 }, { x: 0, y: 3200 }]
    expect(tailleRedressee(coins, 3000, 4000, 1200)).toEqual({ largeur: 750, hauteur: 1200 })
  })
})

describe('redresserPixels', () => {
  /** Une image 8 × 8 : la moitié gauche rouge, la moitié droite bleue. */
  const source = new Uint8ClampedArray(8 * 8 * 4)
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) source.set(x < 4 ? [200, 0, 0, 255] : [0, 0, 200, 255], (y * 8 + x) * 4)

  it('l’image entière, à la même taille, ressort identique', () => {
    const entier: Quad = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 }]
    expect([...redresserPixels(source, 8, 8, entier, 8, 8)!]).toEqual([...source])
  })

  it('ne garde que ce qui est entre les quatre coins', () => {
    const moitieDroite: Quad = [{ x: 4, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 4, y: 8 }]
    const sortie = redresserPixels(source, 8, 8, moitieDroite, 4, 8)!
    for (let i = 0; i < sortie.length; i += 4) expect([sortie[i], sortie[i + 1], sortie[i + 2], sortie[i + 3]]).toEqual([0, 0, 200, 255])
  })

  it('mélange les points voisins quand la sortie tombe entre deux points (interpolation bilinéaire)', () => {
    // Un seul point de sortie pour toute l'image : il tombe au milieu, entre le rouge et le bleu.
    const entier: Quad = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 0, y: 8 }]
    const sortie = redresserPixels(source, 8, 8, entier, 1, 1)!
    expect(sortie[0]).toBe(100)
    expect(sortie[2]).toBe(100)
  })

  it('rend null si les coins ne permettent pas de redresser', () => {
    const aplati: Quad = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]
    expect(redresserPixels(source, 8, 8, aplati, 4, 4)).toBeNull()
  })
})
