// Téléchargement d'une image de couverture, avec quatre garde-fous :
//   · la fonction construit elle-même l'adresse, à partir d'un identifiant vérifié ;
//   · une redirection n'est suivie que vers un site de la liste, en https ;
//   · le fichier doit être une vraie image (lue dans ses premiers octets), ni minuscule ni énorme ;
//   · rien d'autre n'est rendu que l'image : aucune erreur d'un site extérieur ne remonte.

import type { RefCouverture, Source, TypeImage } from './contrat.ts'

export type Recuperer = (adresse: string, options?: RequestInit) => Promise<Response>
export type Image = { type: TypeImage; octets: Uint8Array }

const TAILLE_MIN = 3_000
const TAILLE_MAX = 3_000_000
/** En dessous, c'est une vignette : la couverture typographique sera plus belle. */
const LARGEUR_MIN = 200
const REDIRECTIONS_MAX = 3
const DELAI = 10_000

/** Les seuls sites d'où une image peut venir (Open Library range les siennes sur archive.org). */
const SITES = ['books.google.com', 'covers.openlibrary.org', 'archive.org']
const DOMAINES = ['.archive.org', '.googleusercontent.com']

function adressePermise(adresse: string): boolean {
  let lue: URL
  try {
    lue = new URL(adresse)
  } catch {
    return false
  }
  if (lue.protocol !== 'https:' || lue.username || lue.password || lue.port) return false
  return SITES.includes(lue.hostname) || DOMAINES.some((domaine) => lue.hostname.endsWith(domaine))
}

export function adressesCouverture(ref: RefCouverture): string[] {
  if (ref.source === 'google_books') {
    return [
      `https://books.google.com/books/publisher/content/images/frontcover/${ref.id}?fife=w480-h720&source=gbs_api`,
      `https://books.google.com/books/content?id=${ref.id}&printsec=frontcover&img=1&zoom=0&source=gbs_api`,
    ]
  }
  if ('isbn' in ref) return [`https://covers.openlibrary.org/b/isbn/${ref.isbn}-L.jpg?default=false`]
  return [`https://covers.openlibrary.org/b/id/${ref.numero}-L.jpg?default=false`]
}

function typeDe(octets: Uint8Array): TypeImage | null {
  if (octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) return 'image/jpeg'
  if (octets[0] === 0x89 && octets[1] === 0x50 && octets[2] === 0x4e && octets[3] === 0x47) return 'image/png'
  const ascii = (debut: number) => String.fromCharCode(...octets.slice(debut, debut + 4))
  if (octets.length > 12 && ascii(0) === 'RIFF' && ascii(8) === 'WEBP') return 'image/webp'
  return null
}

/** Largeur et hauteur d'un JPEG ou d'un PNG, lues dans l'en-tête ; null si on ne sait pas. */
export function dimensions(octets: Uint8Array): { largeur: number; hauteur: number } | null {
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength)
  const type = typeDe(octets)
  if (type === 'image/png') {
    return octets.length >= 24 ? { largeur: vue.getUint32(16), hauteur: vue.getUint32(20) } : null
  }
  if (type !== 'image/jpeg') return null
  // Un JPEG est une suite de zones « FF xx longueur… » ; la zone SOF porte les dimensions.
  let position = 2
  while (position + 9 < octets.length) {
    if (octets[position] !== 0xff) return null
    const marque = octets[position + 1]
    const estSof = marque >= 0xc0 && marque <= 0xcf && marque !== 0xc4 && marque !== 0xc8 && marque !== 0xcc
    if (estSof) return { hauteur: vue.getUint16(position + 5), largeur: vue.getUint16(position + 7) }
    position += 2 + vue.getUint16(position + 2)
  }
  return null
}

/** L'image à cette adresse si elle est convenable, sinon null. Ne lève jamais d'erreur. */
export async function telechargerImage(adresse: string, recuperer: Recuperer): Promise<Image | null> {
  try {
    let courante = adresse
    for (let saut = 0; saut <= REDIRECTIONS_MAX; saut++) {
      if (!adressePermise(courante)) return null
      const reponse = await recuperer(courante, {
        redirect: 'manual',
        signal: AbortSignal.timeout(DELAI),
        headers: { accept: 'image/jpeg,image/png,image/webp' },
      })
      if (reponse.status >= 300 && reponse.status < 400) {
        const suite = reponse.headers.get('location')
        if (!suite) return null
        courante = new URL(suite, courante).toString()
        continue
      }
      if (reponse.status !== 200) return null
      if (!/^image\/(jpeg|png|webp)\b/i.test(reponse.headers.get('content-type') ?? '')) return null
      if (Number(reponse.headers.get('content-length') ?? 0) > TAILLE_MAX) return null

      const octets = new Uint8Array(await reponse.arrayBuffer())
      if (octets.length < TAILLE_MIN || octets.length > TAILLE_MAX) return null
      const type = typeDe(octets)
      if (!type) return null
      const taille = dimensions(octets)
      if (taille && taille.largeur < LARGEUR_MIN) return null
      return { type, octets }
    }
    return null
  } catch {
    return null
  }
}

/** Essaie les adresses d'une référence, dans l'ordre. */
export async function chercherCouverture(ref: RefCouverture, recuperer: Recuperer): Promise<{ image: Image; source: Source } | null> {
  for (const adresse of adressesCouverture(ref)) {
    const image = await telechargerImage(adresse, recuperer)
    if (image) return { image, source: ref.source }
  }
  return null
}

/** Les octets en base64, par morceaux (une grande image ne tient pas dans un seul appel). */
export function enBase64(octets: Uint8Array): string {
  let binaire = ''
  for (let debut = 0; debut < octets.length; debut += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(debut, debut + 0x8000))
  }
  return btoa(binaire)
}
