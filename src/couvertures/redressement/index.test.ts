import { estMarquee } from '../marque.ts'
import type { Quad } from './geometrie.ts'
import { COTE_DETECTION, redresser, trouverCoins, type ToileRedressement } from './index.ts'

type Couleur = [number, number, number]

/** Un JPEG minimal, comme en rendrait une toile de dessin : début d'image, en-tête JFIF, données. */
const jpeg = () =>
  new Blob(
    [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xda, 0x00, 0x02, 0x55, 0xff, 0xd9])],
    { type: 'image/jpeg' },
  )

/**
 * Un faux atelier : chaque toile retient ce qu'on y dessine. `scene(x, y, largeur, hauteur)` donne
 * la couleur d'un point de la photo, quelle que soit la taille à laquelle elle est dessinée
 * (x et y de 0 à 1 dans la partie dessinée).
 */
function atelier(scene: (x: number, y: number) => Couleur, options: { contexte?: boolean } = {}) {
  const toiles: { width: number; height: number; dessins: unknown[][]; poses: Uint8ClampedArray[]; sorties: [string, number][] }[] = []
  const creerToile = (): ToileRedressement => {
    const journal = { width: 0, height: 0, dessins: [] as unknown[][], poses: [] as Uint8ClampedArray[], sorties: [] as [string, number][] }
    toiles.push(journal)
    return {
      get width() {
        return journal.width
      },
      set width(valeur: number) {
        journal.width = valeur
      },
      get height() {
        return journal.height
      },
      set height(valeur: number) {
        journal.height = valeur
      },
      getContext: () =>
        options.contexte === false
          ? null
          : {
              drawImage: (...args: unknown[]) => void journal.dessins.push(args),
              getImageData: (_x: number, _y: number, largeur: number, hauteur: number) => {
                const data = new Uint8ClampedArray(largeur * hauteur * 4)
                // La partie de la photo dessinée sur cette toile (la photo entière si rien n'est précisé).
                const dessin = journal.dessins.at(-1) ?? []
                const [sx, sy, sl, sh] = dessin.length === 9 ? (dessin.slice(1, 5) as number[]) : [0, 0, 1, 1]
                const [pl, ph] = dessin.length === 9 ? [PHOTO.largeur, PHOTO.hauteur] : [1, 1]
                for (let y = 0; y < hauteur; y++) {
                  for (let x = 0; x < largeur; x++) {
                    const [r, v, b] = scene((sx + ((x + 0.5) / largeur) * sl) / pl, (sy + ((y + 0.5) / hauteur) * sh) / ph)
                    data.set([r, v, b, 255], (y * largeur + x) * 4)
                  }
                }
                return { data }
              },
              createImageData: (largeur: number, hauteur: number) => ({ data: new Uint8ClampedArray(largeur * hauteur * 4), width: largeur, height: hauteur }),
              putImageData: (image: { data: Uint8ClampedArray }) => void journal.poses.push(new Uint8ClampedArray(image.data)),
            },
      toBlob: (suite: (image: Blob | null) => void, type: string, qualite: number) => {
        journal.sorties.push([type, qualite])
        suite(jpeg())
      },
    }
  }
  return { creerToile, toiles }
}

/** La photo de travail : 3000 × 4000 points. */
const PHOTO = { source: { nom: 'photo' }, largeur: 3000, hauteur: 4000 }

/** Un livre terne (gris de 60 à 170, donc à améliorer) sur un parquet, entre 25 % et 75 % de la photo. */
const scene = (x: number, y: number): Couleur => {
  if (x < 0.25 || x > 0.75 || y < 0.2 || y > 0.8) return [170, 120, 70]
  const gris = 60 + Math.round(((y - 0.2) / 0.6) * 110)
  return [gris, gris + 10, gris + 30]
}
const LIVRE: Quad = [
  { x: 750, y: 800 },
  { x: 2250, y: 800 },
  { x: 2250, y: 3200 },
  { x: 750, y: 3200 },
]

describe('trouverCoins', () => {
  it('cherche le livre sur une photo réduite à 512 px, et rend les coins à l’échelle de la photo', () => {
    const { creerToile, toiles } = atelier(scene)
    const { coins, trouve } = trouverCoins(PHOTO, creerToile)
    expect(toiles[0]).toMatchObject({ width: 384, height: 512 })
    expect(Math.max(toiles[0].width, toiles[0].height)).toBe(COTE_DETECTION)
    expect(toiles[0].dessins[0]).toEqual([PHOTO.source, 0, 0, 384, 512])
    expect(trouve).toBe(true)
    coins.forEach((coin, i) => {
      // À 30 points près sur une photo de 3000 × 4000 : moins de 1 %.
      expect(Math.hypot(coin.x - LIVRE[i].x, coin.y - LIVRE[i].y), `coin ${i}`).toBeLessThanOrEqual(30)
    })
  })

  it('sans livre trouvé, ou sans toile de dessin, place les coins aux coins de la photo', () => {
    const entiere = [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 4000 }, { x: 0, y: 4000 }]
    expect(trouverCoins(PHOTO, atelier(() => [170, 120, 70]).creerToile)).toEqual({ coins: entiere, trouve: false })
    expect(trouverCoins(PHOTO, atelier(scene, { contexte: false }).creerToile)).toEqual({ coins: entiere, trouve: false })
  })
})

describe('redresser', () => {
  it('rend la couverture droite, à 1200 px au plus, en JPEG, sous deux formes : couleurs d’origine et lumière corrigée', async () => {
    const { creerToile, toiles } = atelier(scene)
    const redressee = await redresser(PHOTO, LIVRE, creerToile)
    expect(redressee).not.toBeNull()
    // 1500 × 2400 sur la photo : 750 × 1200 une fois rangée.
    expect(redressee).toMatchObject({ largeur: 750, hauteur: 1200 })
    expect(redressee?.origine.type).toBe('image/jpeg')
    expect(redressee?.amelioree.type).toBe('image/jpeg')
    const sorties = toiles.filter((toile) => toile.sorties.length > 0)
    expect(sorties).toHaveLength(2)
    for (const toile of sorties) expect(toile).toMatchObject({ width: 750, height: 1200, sorties: [['image/jpeg', 0.85]] })
  })

  it('ne garde que le livre : la table autour a disparu', async () => {
    const { creerToile, toiles } = atelier(scene)
    await redresser(PHOTO, LIVRE, creerToile)
    const origine = toiles.find((toile) => toile.poses.length > 0)!.poses[0]
    // Aucun point de la couleur du parquet. Les points sont comptés d'abord, puis vérifiés en une fois :
    // un expect par point (900 000 pour 750 × 1200) prenait à lui seul plus de 5 s sur GitHub.
    let parquet = 0
    for (let i = 0; i < origine.length; i += 4) if (origine[i] === 170 && origine[i + 1] === 120) parquet++
    expect(parquet).toBe(0)
    // Le haut du livre est sombre, le bas plus clair, comme sur la photo.
    expect(origine[0]).toBeLessThan(70)
    expect(origine[origine.length - 4]).toBeGreaterThan(160)
  })

  it('la lumière n’est corrigée que sur la forme « améliorée »', async () => {
    const { creerToile, toiles } = atelier(scene)
    await redresser(PHOTO, LIVRE, creerToile)
    const [origine, amelioree] = toiles.filter((toile) => toile.poses.length > 0).map((toile) => toile.poses[0])
    const etendue = (pixels: Uint8ClampedArray) => {
      let min = 255
      let max = 0
      for (let i = 0; i < pixels.length; i += 4) {
        min = Math.min(min, pixels[i + 1])
        max = Math.max(max, pixels[i + 1])
      }
      return max - min
    }
    expect(etendue(amelioree)).toBeGreaterThan(etendue(origine) + 30)
  })

  it('réduit d’abord la photo avec le navigateur, pour une image nette : jamais plus du double de la taille rangée', async () => {
    const { creerToile, toiles } = atelier(scene)
    await redresser(PHOTO, LIVRE, creerToile)
    // La première toile reçoit la partie de la photo qui contient le livre (1500 × 2400), réduite.
    const [, sx, sy, sl, sh] = toiles[0].dessins[0] as number[]
    expect([sx, sy, sl, sh]).toEqual([750, 800, 1500, 2400])
    expect(toiles[0].height).toBeLessThanOrEqual(2400)
    expect(toiles[0].height).toBeGreaterThanOrEqual(1200)
  })

  it('porte la marque invisible : cette couverture ne sera jamais recadrée à l’affichage', async () => {
    const redressee = await redresser(PHOTO, LIVRE, atelier(scene).creerToile)
    expect(await estMarquee(redressee!.origine)).toBe(true)
    expect(await estMarquee(redressee!.amelioree)).toBe(true)
  })

  it('« Image entière » : les coins de la photo rendent la photo entière, réduite et marquée', async () => {
    const entiere: Quad = [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 4000 }, { x: 0, y: 4000 }]
    const redressee = await redresser(PHOTO, entiere, atelier(scene).creerToile)
    expect(redressee).toMatchObject({ largeur: 900, hauteur: 1200 })
    expect(await estMarquee(redressee!.origine)).toBe(true)
  })

  it('rend null si l’image ne peut pas être produite, sans lever d’erreur', async () => {
    expect(await redresser(PHOTO, LIVRE, atelier(scene, { contexte: false }).creerToile)).toBeNull()
    const aplati: Quad = [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 200 }, { x: 300, y: 300 }]
    expect(await redresser(PHOTO, aplati, atelier(scene).creerToile)).toBeNull()
  })
})
