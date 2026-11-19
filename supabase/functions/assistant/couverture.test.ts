// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { adressesCouverture, chercherCouverture, dimensions, enBase64, IMAGES_GRISES, telechargerImage } from './couverture.ts'
import { jpeg, png, reponseImage } from './essais.ts'

describe('dimensions', () => {
  it('lit la taille d’un JPEG et d’un PNG', () => {
    expect(dimensions(jpeg(480, 720))).toEqual({ largeur: 480, hauteur: 720 })
    expect(dimensions(png(128, 170))).toEqual({ largeur: 128, hauteur: 170 })
  })

  it('rend null pour ce qui n’est pas une image lisible', () => {
    expect(dimensions(new TextEncoder().encode('<html>pas une image</html>'))).toBeNull()
    expect(dimensions(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull()
  })
})

describe('adressesCouverture', () => {
  it('construit elle-même les adresses, uniquement vers Google Books et Open Library', () => {
    expect(adressesCouverture({ source: 'open_library', isbn: '9782747024693' })).toEqual([
      'https://covers.openlibrary.org/b/isbn/9782747024693-L.jpg?default=false',
    ])
    for (const ref of [
      { source: 'google_books', id: 'zyTCAlFPjgYC' } as const,
      { source: 'open_library', numero: 8574580 } as const,
    ]) {
      for (const adresse of adressesCouverture(ref)) {
        expect(['books.google.com', 'covers.openlibrary.org']).toContain(new URL(adresse).hostname)
      }
    }
  })

  it('range les adresses de la plus grande image à la plus petite', () => {
    // Mesuré le 19 novembre 2026 : « w480-h720 » ne rend qu'une vignette, « w1200-h1800 » la grande image.
    expect(adressesCouverture({ source: 'google_books', id: 'zyTCAlFPjgYC' })).toEqual([
      'https://books.google.com/books/publisher/content/images/frontcover/zyTCAlFPjgYC?fife=w1200-h1800&source=gbs_api',
      'https://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover&img=1&zoom=0&source=gbs_api',
      'https://books.google.com/books/publisher/content/images/frontcover/zyTCAlFPjgYC?fife=w480-h720&source=gbs_api',
    ])
    // Open Library, par numéro de couverture : l'image d'origine (sans taille), puis la taille « L ».
    expect(adressesCouverture({ source: 'open_library', numero: 8574580 })).toEqual([
      'https://covers.openlibrary.org/b/id/8574580.jpg?default=false',
      'https://covers.openlibrary.org/b/id/8574580-L.jpg?default=false',
    ])
  })
})

describe('telechargerImage', () => {
  const ADRESSE = 'https://covers.openlibrary.org/b/isbn/9782747024693-L.jpg?default=false'

  it('rend l’image et son vrai type, lu dans le fichier et non dans l’en-tête', async () => {
    const image = await telechargerImage(ADRESSE, async () => reponseImage(png(400, 600), 'image/jpeg'))
    expect(image?.type).toBe('image/png')
    expect(image?.octets.length).toBeGreaterThan(3000)
  })

  it('suit une redirection vers archive.org, où Open Library range ses images', async () => {
    const vues: string[] = []
    const image = await telechargerImage(ADRESSE, async (adresse) => {
      vues.push(String(adresse))
      return vues.length === 1
        ? new Response(null, { status: 302, headers: { location: 'https://ia800100.us.archive.org/zip/l_covers/0008574580-L.jpg' } })
        : reponseImage(jpeg(400, 600))
    })
    expect(image?.type).toBe('image/jpeg')
    expect(vues).toEqual([ADRESSE, 'https://ia800100.us.archive.org/zip/l_covers/0008574580-L.jpg'])
  })

  it('refuse de suivre une redirection vers un autre site, une adresse interne ou du http', async () => {
    for (const cible of [
      'https://exemple.test/image.jpg',
      'http://169.254.169.254/latest/meta-data/',
      'http://covers.openlibrary.org/b/id/1-L.jpg',
      'https://archive.org.exemple.test/x.jpg',
      'https://localhost/x.jpg',
    ]) {
      const vues: string[] = []
      const image = await telechargerImage(ADRESSE, async (adresse) => {
        vues.push(String(adresse))
        return vues.length === 1 ? new Response(null, { status: 302, headers: { location: cible } }) : reponseImage(jpeg(400, 600))
      })
      expect(image, cible).toBeNull()
      expect(vues, cible).toEqual([ADRESSE])
    }
  })

  it('abandonne après trop de redirections', async () => {
    let appels = 0
    const image = await telechargerImage(ADRESSE, async () => {
      appels++
      return new Response(null, { status: 302, headers: { location: `https://archive.org/tour/${appels}` } })
    })
    expect(image).toBeNull()
    expect(appels).toBeLessThanOrEqual(4)
  })

  it('refuse ce qui n’est pas une image, même annoncé comme tel', async () => {
    const html = new TextEncoder().encode(`<html>${'x'.repeat(5000)}</html>`)
    expect(await telechargerImage(ADRESSE, async () => reponseImage(html, 'image/jpeg'))).toBeNull()
    expect(await telechargerImage(ADRESSE, async () => reponseImage(jpeg(400, 600), 'text/html'))).toBeNull()
  })

  it('refuse l’image grise « couverture indisponible » de Google Books et les vignettes trop petites', async () => {
    expect(await telechargerImage(ADRESSE, async () => reponseImage(png(128, 170, 1269)))).toBeNull()
    expect(await telechargerImage(ADRESSE, async () => reponseImage(jpeg(128, 190, 9500)))).toBeNull()
  })

  it('donne la largeur et la hauteur de l’image, lues dans le fichier', async () => {
    const image = await telechargerImage(ADRESSE, async () => reponseImage(jpeg(800, 1237)))
    expect(image).toMatchObject({ largeur: 800, hauteur: 1237 })
  })

  it('connaît les fausses couvertures grises de Google Books par leur empreinte', () => {
    // Relevées le 19 novembre 2026 : de vraies images, assez lourdes et assez larges pour passer les autres contrôles.
    expect(IMAGES_GRISES.has('3efa8c43e5b4348f303a528c81adf435f0111ea752fe9f0f6241478b60987fa6')).toBe(true)
    expect(IMAGES_GRISES.has('5e7f0425abc77878f2a1efe98f12070d7e97b3047d2ce1cd050598230e34e205')).toBe(true)
  })

  it('traite une image grise reconnue à son empreinte comme « pas de couverture »', async () => {
    // Une image qui passe tous les autres contrôles (575 × 829, 246 Ko, comme la silhouette grise de Google).
    const grise = jpeg(575, 829, 246_264)
    const condense = await crypto.subtle.digest('SHA-256', grise as unknown as BufferSource)
    const empreinte = [...new Uint8Array(condense)].map((octet) => octet.toString(16).padStart(2, '0')).join('')
    expect(await telechargerImage(ADRESSE, async () => reponseImage(grise))).not.toBeNull()
    expect(await telechargerImage(ADRESSE, async () => reponseImage(grise), new Set([empreinte]))).toBeNull()
    // Un seul octet de différence : ce n'est plus cette image-là.
    const autre = jpeg(575, 829, 246_264)
    autre[300] = 7
    expect(await telechargerImage(ADRESSE, async () => reponseImage(autre), new Set([empreinte]))).not.toBeNull()
  })

  it('refuse une image démesurée', async () => {
    expect(await telechargerImage(ADRESSE, async () => reponseImage(jpeg(4000, 6000, 3_200_000)))).toBeNull()
    const annoncee = new Response(jpeg(400, 600), { headers: { 'content-type': 'image/jpeg', 'content-length': '99000000' } })
    expect(await telechargerImage(ADRESSE, async () => annoncee)).toBeNull()
  })

  it('rend null quand la source répond « introuvable » ou ne répond pas', async () => {
    expect(await telechargerImage(ADRESSE, async () => new Response('non', { status: 404 }))).toBeNull()
    expect(
      await telechargerImage(ADRESSE, async () => {
        throw new Error('panne réseau')
      }),
    ).toBeNull()
  })
})

describe('chercherCouverture', () => {
  const GOOGLE = { source: 'google_books', id: 'zyTCAlFPjgYC' } as const
  const OPEN_LIBRARY = { source: 'open_library', numero: 7 } as const

  /** Un faux réseau : la première règle dont le motif est dans l'adresse donne la réponse. */
  const reseau = (regles: [string, () => Response][]) => {
    const vues: string[] = []
    const recuperer = async (adresse: string) => {
      vues.push(String(adresse))
      return regles.find(([motif]) => String(adresse).includes(motif))?.[1]() ?? new Response('non', { status: 404 })
    }
    return { vues, recuperer }
  }

  it('s’arrête à la première image assez large', async () => {
    const { vues, recuperer } = reseau([['w1200-h1800', () => reponseImage(jpeg(1163, 1800))]])
    const trouvee = await chercherCouverture([GOOGLE, OPEN_LIBRARY], recuperer)
    expect(trouvee).toMatchObject({ source: 'google_books', image: { largeur: 1163, hauteur: 1800 } })
    expect(vues).toHaveLength(1)
  })

  it('passe à l’adresse suivante quand la première ne donne rien', async () => {
    const { vues, recuperer } = reseau([['zoom=0', () => reponseImage(jpeg(800, 1237))]])
    const trouvee = await chercherCouverture([GOOGLE], recuperer)
    expect(trouvee?.image.largeur).toBe(800)
    expect(vues).toHaveLength(2)
  })

  it('devant une image de moins de 450 px de large, essaie les suivantes et garde la plus large', async () => {
    const { vues, recuperer } = reseau([
      ['w1200-h1800', () => reponseImage(jpeg(300, 450))],
      ['zoom=0', () => reponseImage(jpeg(420, 640))],
      ['w480-h720', () => reponseImage(jpeg(250, 380))],
    ])
    const trouvee = await chercherCouverture([GOOGLE], recuperer)
    expect(trouvee?.image.largeur).toBe(420)
    expect(vues).toHaveLength(3)
  })

  it('après une petite image de Google Books, va voir si Open Library en a une plus grande', async () => {
    const { recuperer } = reseau([
      ['books.google.com', () => reponseImage(jpeg(300, 450))],
      ['/b/id/7.jpg', () => reponseImage(jpeg(625, 999))],
    ])
    expect(await chercherCouverture([GOOGLE, OPEN_LIBRARY], recuperer)).toMatchObject({ source: 'open_library', image: { largeur: 625 } })
  })

  it('garde la petite image quand aucune source n’en a de plus grande', async () => {
    const { recuperer } = reseau([['books.google.com', () => reponseImage(jpeg(300, 450))]])
    expect(await chercherCouverture([GOOGLE, OPEN_LIBRARY], recuperer)).toMatchObject({ source: 'google_books', image: { largeur: 300 } })
  })

  it('rend null si aucune adresse ne donne d’image convenable', async () => {
    expect(await chercherCouverture([OPEN_LIBRARY], async () => new Response('non', { status: 404 }))).toBeNull()
  })
})

describe('enBase64', () => {
  it('code des octets, même nombreux', () => {
    expect(enBase64(new Uint8Array([72, 105]))).toBe('SGk=')
    const grand = new Uint8Array(200_000).fill(65)
    expect(enBase64(grand).length).toBe(Math.ceil(200_000 / 3) * 4)
  })
})
