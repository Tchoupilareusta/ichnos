import {
  cadreEntier,
  COTE_MAX_LECTURE,
  COTE_MAX_SORTIE,
  deplacerCoin,
  estEntier,
  lireImage,
  recadrer,
  tailleSortie,
  TAILLE_MAX_FICHIER,
  verifierFichier,
  type ToilePhoto,
} from './photo'

const fichier = (type: string, taille = 1000, nom = 'photo') => {
  const f = new File(['x'], nom, { type })
  Object.defineProperty(f, 'size', { value: taille })
  return f
}

describe('verifierFichier', () => {
  it('accepte une image, quel que soit son format', () => {
    expect(verifierFichier(fichier('image/jpeg'))).toBe('ok')
    expect(verifierFichier(fichier('image/heic'))).toBe('ok')
    expect(verifierFichier(fichier('image/png'))).toBe('ok')
  })

  it('laisse sa chance à un fichier dont le type n’est pas dit (certaines photos de l’iPhone)', () => {
    expect(verifierFichier(fichier(''))).toBe('ok')
  })

  it('refuse ce qui n’est pas une image', () => {
    expect(verifierFichier(fichier('application/pdf'))).toBe('pas_image')
    expect(verifierFichier(fichier('text/html'))).toBe('pas_image')
    expect(verifierFichier(fichier('video/mp4'))).toBe('pas_image')
  })

  it('refuse un fichier démesuré, au-delà de 30 Mo', () => {
    expect(verifierFichier(fichier('image/jpeg', TAILLE_MAX_FICHIER))).toBe('ok')
    expect(verifierFichier(fichier('image/jpeg', TAILLE_MAX_FICHIER + 1))).toBe('trop_lourd')
    expect(TAILLE_MAX_FICHIER).toBe(30 * 1024 * 1024)
  })
})

describe('cadre de recadrage', () => {
  const IMAGE = { largeur: 3000, hauteur: 4000 }

  it('part de l’image entière', () => {
    expect(cadreEntier(3000, 4000)).toEqual({ x: 0, y: 0, largeur: 3000, hauteur: 4000 })
    expect(estEntier(cadreEntier(3000, 4000), IMAGE)).toBe(true)
  })

  it('déplace un coin sans toucher au coin opposé', () => {
    const cadre = deplacerCoin(cadreEntier(3000, 4000), 'haut-gauche', 300, 500, IMAGE)
    expect(cadre).toEqual({ x: 300, y: 500, largeur: 2700, hauteur: 3500 })
    expect(estEntier(cadre, IMAGE)).toBe(false)
    expect(deplacerCoin(cadre, 'bas-droite', -200, -1000, IMAGE)).toEqual({ x: 300, y: 500, largeur: 2500, hauteur: 2500 })
    expect(deplacerCoin(cadre, 'haut-droite', -100, 100, IMAGE)).toEqual({ x: 300, y: 600, largeur: 2600, hauteur: 3400 })
    expect(deplacerCoin(cadre, 'bas-gauche', 100, -100, IMAGE)).toEqual({ x: 400, y: 500, largeur: 2600, hauteur: 3400 })
  })

  it('ne sort jamais de l’image', () => {
    expect(deplacerCoin(cadreEntier(3000, 4000), 'haut-gauche', -500, -500, IMAGE)).toEqual(cadreEntier(3000, 4000))
    expect(deplacerCoin(cadreEntier(3000, 4000), 'bas-droite', 900, 900, IMAGE)).toEqual(cadreEntier(3000, 4000))
  })

  it('garde une taille minimale : un coin ne dépasse pas le coin opposé', () => {
    const cadre = deplacerCoin(cadreEntier(3000, 4000), 'haut-gauche', 5000, 5000, IMAGE)
    expect(cadre.largeur).toBeGreaterThanOrEqual(300)
    expect(cadre.hauteur).toBeGreaterThanOrEqual(300)
    expect(cadre.x + cadre.largeur).toBe(3000)
    expect(cadre.y + cadre.hauteur).toBe(4000)
  })
})

describe('tailleSortie', () => {
  it('ramène le grand côté à 1200 px au plus, en gardant les proportions', () => {
    expect(COTE_MAX_SORTIE).toBe(1200)
    expect(tailleSortie({ x: 0, y: 0, largeur: 3000, hauteur: 4000 })).toEqual({ largeur: 900, hauteur: 1200 })
    expect(tailleSortie({ x: 10, y: 10, largeur: 4000, hauteur: 2000 })).toEqual({ largeur: 1200, hauteur: 600 })
  })

  it('n’agrandit jamais une petite image', () => {
    expect(tailleSortie({ x: 0, y: 0, largeur: 300, hauteur: 450 })).toEqual({ largeur: 300, hauteur: 450 })
  })
})

/** Une fausse toile de dessin, qui retient ce qu'on lui demande. */
function atelier(options: { contexte?: boolean; blob?: boolean } = {}) {
  const toiles: { width: number; height: number; dessins: unknown[][]; sorties: [string, number][] }[] = []
  const creer = (): ToilePhoto => {
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
      getContext: () =>
        options.contexte === false
          ? null
          : {
              fillStyle: '',
              fillRect: () => {},
              drawImage: (...args: unknown[]) => void journal.dessins.push(args),
            },
      toBlob: (suite: (image: Blob | null) => void, type: string, qualite: number) => {
        journal.sorties.push([type, qualite])
        suite(options.blob === false ? null : new Blob(['image'], { type }))
      },
    }
  }
  return { creer, toiles }
}

describe('lireImage', () => {
  const outils = (largeur: number, hauteur: number, extra: Partial<Parameters<typeof lireImage>[1]> = {}) => {
    const { creer, toiles } = atelier()
    const fermees: number[] = []
    return {
      toiles,
      fermees,
      outils: {
        decoder: async () => ({ largeur, hauteur, image: {}, liberer: () => void fermees.push(1) }),
        creerToile: creer,
        creerAdresse: () => 'blob:photo',
        libererAdresse: () => {},
        ...extra,
      },
    }
  }

  it('prépare une image de travail aux dimensions de la photo', async () => {
    const { outils: o, toiles, fermees } = outils(3000, 4000)
    const lecture = await lireImage(fichier('image/jpeg'), o)
    expect(lecture).toMatchObject({ ok: true, image: { largeur: 3000, hauteur: 4000, apercu: 'blob:photo' } })
    expect(toiles[0]).toMatchObject({ width: 3000, height: 4000 })
    // La photo décodée est libérée dès qu'elle est dessinée.
    expect(fermees).toHaveLength(1)
  })

  it('réduit dès la lecture une photo de plus de 4096 px (limite des toiles de Safari)', async () => {
    expect(COTE_MAX_LECTURE).toBe(4096)
    const { outils: o, toiles } = outils(8064, 6048)
    const lecture = await lireImage(fichier('image/heic'), o)
    expect(lecture).toMatchObject({ ok: true, image: { largeur: 4096, hauteur: 3072 } })
    expect(toiles[0]).toMatchObject({ width: 4096, height: 3072 })
  })

  it('dit « illisible » quand la photo ne se décode pas, sans lever d’erreur', async () => {
    const { outils: o } = outils(0, 0, {
      decoder: async () => {
        throw new Error('format inconnu')
      },
    })
    expect(await lireImage(fichier('image/jpeg'), o)).toEqual({ ok: false, echec: 'illisible' })
    expect(await lireImage(fichier('image/jpeg'), outils(0, 0).outils)).toEqual({ ok: false, echec: 'illisible' })
    expect(await lireImage(fichier('image/jpeg'), outils(100, 100, { creerToile: atelier({ contexte: false }).creer }).outils)).toEqual({ ok: false, echec: 'illisible' })
  })
})

describe('recadrer', () => {
  const image = (creer: () => ToilePhoto) => ({ source: creer(), largeur: 3000, hauteur: 4000, apercu: 'blob:photo', liberer: () => {} })

  it('rend un JPEG de qualité 0,85 dont le grand côté fait 1200 px au plus', async () => {
    const { creer, toiles } = atelier()
    const source = image(creer)
    const blob = await recadrer(source, cadreEntier(3000, 4000), creer)
    expect(blob?.type).toBe('image/jpeg')
    const sortie = toiles[1]
    expect(sortie).toMatchObject({ width: 900, height: 1200 })
    expect(sortie.sorties).toEqual([['image/jpeg', 0.85]])
  })

  it('ne dessine que la partie choisie', async () => {
    const { creer, toiles } = atelier()
    const source = image(creer)
    await recadrer(source, { x: 300, y: 500, largeur: 2400, hauteur: 3000 }, creer)
    expect(toiles[1]).toMatchObject({ width: 960, height: 1200 })
    expect(toiles[1].dessins[0].slice(1)).toEqual([300, 500, 2400, 3000, 0, 0, 960, 1200])
  })

  it('rend null si l’image ne peut pas être produite', async () => {
    const source = image(atelier().creer)
    expect(await recadrer(source, cadreEntier(3000, 4000), atelier({ contexte: false }).creer)).toBeNull()
    expect(await recadrer(source, cadreEntier(3000, 4000), atelier({ blob: false }).creer)).toBeNull()
  })
})
