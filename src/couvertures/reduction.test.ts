import type { ToilePhoto } from './photo'
import { estPetite, POIDS_SANS_RETOUCHE, reduireImage, tailleRangee } from './reduction'

/** Une fausse image d'un poids donné (seuls son type et son poids comptent ici). */
const image = (octets: number, type = 'image/jpeg') => new Blob([new Uint8Array(octets)], { type })

/** De faux outils : un décodeur qui « lit » une image de la taille voulue, et une toile qui retient ce qu'on lui demande. */
function atelier(largeur: number, hauteur: number, options: { poidsSortie?: number; decodage?: boolean; contexte?: boolean } = {}) {
  const toiles: { width: number; height: number; dessins: unknown[][]; sorties: [string, number][] }[] = []
  let decodages = 0
  let liberations = 0
  const outils = {
    decoder: async () => {
      decodages++
      if (options.decodage === false) throw new Error('image illisible')
      return { largeur, hauteur, image: { nom: 'photo décodée' }, liberer: () => void liberations++ }
    },
    creerToile: (): ToilePhoto => {
      const journal = { width: 0, height: 0, dessins: [] as unknown[][], sorties: [] as [string, number][] }
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
        getContext: () => (options.contexte === false ? null : { fillStyle: '', fillRect: () => {}, drawImage: (...args: unknown[]) => void journal.dessins.push(args) }),
        toBlob: (suite: (sortie: Blob | null) => void, type: string, qualite: number) => {
          journal.sorties.push([type, qualite])
          suite(new Blob([new Uint8Array(options.poidsSortie ?? 200_000)], { type }))
        },
      }
    },
  }
  return { outils, toiles, decodages: () => decodages, liberations: () => liberations }
}

describe('tailleRangee', () => {
  it('ramène le grand côté à 1200 px au plus, en gardant les proportions', () => {
    expect(tailleRangee({ largeur: 911, hauteur: 1500 })).toEqual({ largeur: 729, hauteur: 1200 })
    expect(tailleRangee({ largeur: 1163, hauteur: 1800 })).toEqual({ largeur: 775, hauteur: 1200 })
    expect(tailleRangee({ largeur: 1600, hauteur: 1000 })).toEqual({ largeur: 1200, hauteur: 750 })
  })

  it('n’agrandit jamais une image', () => {
    expect(tailleRangee({ largeur: 300, hauteur: 450 })).toEqual({ largeur: 300, hauteur: 450 })
    expect(tailleRangee({ largeur: 800, hauteur: 1200 })).toEqual({ largeur: 800, hauteur: 1200 })
  })

  it('laisse une marge pour la fiche sur écran Retina : une couverture ordinaire garde au moins 600 px de large', () => {
    // La fiche affiche la couverture sur 196 points, soit 588 pixels sur un iPhone (×3).
    for (const [largeur, hauteur] of [[2000, 3000], [1163, 1800], [625, 999], [1400, 2200], [1500, 2800]]) {
      expect(tailleRangee({ largeur, hauteur }).largeur, `${largeur} × ${hauteur}`).toBeGreaterThanOrEqual(600)
    }
  })
})

describe('estPetite', () => {
  it('dit petite une couverture de moins de 450 px de large', () => {
    expect(estPetite({ largeur: 300, hauteur: 450 })).toBe(true)
    expect(estPetite({ largeur: 449, hauteur: 700 })).toBe(true)
    expect(estPetite({ largeur: 450, hauteur: 700 })).toBe(false)
    expect(estPetite({ largeur: 800, hauteur: 1200 })).toBe(false)
  })

  it('ne dit pas petite une image réduite à 1200 px, même étroite : elle ne peut pas être plus grande', () => {
    expect(estPetite({ largeur: 400, hauteur: 1200 })).toBe(false)
    expect(estPetite({ largeur: 1200, hauteur: 420 })).toBe(false)
    // Avant réduction, une telle image sera ramenée à 1200 px : elle n'est pas « petite » non plus.
    expect(estPetite({ largeur: 440, hauteur: 1400 })).toBe(false)
  })

  it('ne dit rien d’une image dont la taille n’est pas connue', () => {
    expect(estPetite({ largeur: null, hauteur: null })).toBe(false)
    expect(estPetite({ largeur: 300, hauteur: null })).toBe(true)
  })
})

describe('reduireImage', () => {
  it('ramène une grande image à 1200 px sur le grand côté, en JPEG de qualité 0,85', async () => {
    const { outils, toiles, liberations } = atelier(911, 1500)
    const origine = image(960_000, 'image/png')
    const rangee = await reduireImage(origine, outils)
    expect(rangee).not.toBe(origine)
    expect(rangee.type).toBe('image/jpeg')
    expect(rangee.size).toBe(200_000)
    expect(toiles).toHaveLength(1)
    expect(toiles[0]).toMatchObject({ width: 729, height: 1200, sorties: [['image/jpeg', 0.85]] })
    // L'image entière est dessinée, sans recadrage.
    expect(toiles[0].dessins[0].slice(1)).toEqual([0, 0, 911, 1500, 0, 0, 729, 1200])
    expect(liberations()).toBe(1)
  })

  it('ne touche pas à une image déjà assez petite et assez légère (une photo que je viens de recadrer)', async () => {
    const { outils, toiles } = atelier(800, 1200)
    const origine = image(250_000)
    expect(await reduireImage(origine, outils)).toBe(origine)
    expect(toiles).toHaveLength(0)
    expect(POIDS_SANS_RETOUCHE).toBeGreaterThanOrEqual(300_000)
  })

  it('recompresse une image de bonne taille mais lourde, et garde la version la plus légère', async () => {
    const lourde = image(900_000, 'image/png')
    const allegee = await reduireImage(lourde, atelier(600, 900, { poidsSortie: 120_000 }).outils)
    expect(allegee.type).toBe('image/jpeg')
    expect(allegee.size).toBe(120_000)
    // Si la recompression n'allège pas, l'image d'origine est gardée telle quelle.
    const { outils, toiles } = atelier(600, 900, { poidsSortie: 950_000 })
    expect(await reduireImage(lourde, outils)).toBe(lourde)
    expect(toiles[0]).toMatchObject({ width: 600, height: 900 })
  })

  it('garde toujours la version réduite d’une image trop grande, quel que soit son poids', async () => {
    const origine = image(100_000, 'image/png')
    const rangee = await reduireImage(origine, atelier(2000, 3000, { poidsSortie: 180_000 }).outils)
    expect(rangee.size).toBe(180_000)
  })

  it('décode l’image une seule fois, même quand elle n’a rien à changer', async () => {
    const monde = atelier(400, 620)
    await reduireImage(image(40_000), monde.outils)
    expect(monde.decodages()).toBe(1)
  })

  it('en cas d’échec (image illisible, pas de toile), rend l’image d’origine : rien ne bloque le rangement', async () => {
    const origine = image(960_000, 'image/png')
    expect(await reduireImage(origine, atelier(911, 1500, { decodage: false }).outils)).toBe(origine)
    expect(await reduireImage(origine, atelier(911, 1500, { contexte: false }).outils)).toBe(origine)
    expect(await reduireImage(origine, atelier(0, 0).outils)).toBe(origine)
  })
})
