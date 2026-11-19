// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { adressesCouverture, chercherCouverture, dimensions, enBase64, telechargerImage } from './couverture.ts'
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
    expect(adressesCouverture({ source: 'google_books', id: 'zyTCAlFPjgYC' })).toEqual([
      'https://books.google.com/books/publisher/content/images/frontcover/zyTCAlFPjgYC?fife=w480-h720&source=gbs_api',
      'https://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover&img=1&zoom=0&source=gbs_api',
    ])
    expect(adressesCouverture({ source: 'open_library', isbn: '9782747024693' })).toEqual([
      'https://covers.openlibrary.org/b/isbn/9782747024693-L.jpg?default=false',
    ])
    expect(adressesCouverture({ source: 'open_library', numero: 8574580 })).toEqual([
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
  it('essaie la grande image de Google Books, puis l’autre adresse si la première ne convient pas', async () => {
    const vues: string[] = []
    const trouvee = await chercherCouverture({ source: 'google_books', id: 'zyTCAlFPjgYC' }, async (adresse) => {
      vues.push(String(adresse))
      return vues.length === 1 ? new Response('non', { status: 404 }) : reponseImage(jpeg(600, 900))
    })
    expect(trouvee?.source).toBe('google_books')
    expect(vues).toHaveLength(2)
  })

  it('rend null si aucune adresse ne donne d’image convenable', async () => {
    expect(await chercherCouverture({ source: 'open_library', numero: 7 }, async () => new Response('non', { status: 404 }))).toBeNull()
  })
})

describe('enBase64', () => {
  it('code des octets, même nombreux', () => {
    expect(enBase64(new Uint8Array([72, 105]))).toBe('SGk=')
    const grand = new Uint8Array(200_000).fill(65)
    expect(enBase64(grand).length).toBe(Math.ceil(200_000 / 3) * 4)
  })
})
