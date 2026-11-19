// Téléchargement d'une image de couverture, avec cinq garde-fous :
//   · la fonction construit elle-même l'adresse, à partir d'un identifiant vérifié ;
//   · une redirection n'est suivie que vers un site de la liste, en https ;
//   · le fichier doit être une vraie image (lue dans ses premiers octets), ni minuscule ni énorme ;
//   · ce n'est pas une des fausses couvertures grises de Google Books (reconnues à leur empreinte) ;
//   · rien d'autre n'est rendu que l'image : aucune erreur d'un site extérieur ne remonte.
// Les adresses sont essayées de la plus grande image à la plus petite, et la plus large est gardée.

import { LARGEUR_PETITE, type RefCouverture, type Source, type TypeImage } from './contrat.ts'

export type Recuperer = (adresse: string, options?: RequestInit) => Promise<Response>
/** Largeur et hauteur : null quand le format ne permet pas de les lire ici (WebP). */
export type Image = { type: TypeImage; octets: Uint8Array; largeur: number | null; hauteur: number | null }

/**
 * Pour un livre sans image, Google Books renvoie parfois une fausse couverture grise : une vraie
 * image, assez lourde et assez large pour passer les autres contrôles. Leurs empreintes SHA-256,
 * relevées le 19 novembre 2026. Si Google en sert une autre : ajouter ici son empreinte, et un test.
 */
export const IMAGES_GRISES: ReadonlySet<string> = new Set([
  // PNG gris « image not available », 575 × 750.
  '3efa8c43e5b4348f303a528c81adf435f0111ea752fe9f0f6241478b60987fa6',
  // JPEG, silhouette de livre grise, 575 × 829.
  '5e7f0425abc77878f2a1efe98f12070d7e97b3047d2ce1cd050598230e34e205',
  // PNG, bandeau gris, 575 × 92.
  '2c38965f2e5664a903671e6dd2fe87fa38bc0c2be0c2c43065245ebe1650f0f8',
])

async function empreinte(octets: Uint8Array): Promise<string> {
  const condense = await crypto.subtle.digest('SHA-256', octets as unknown as BufferSource)
  return [...new Uint8Array(condense)].map((octet) => octet.toString(16).padStart(2, '0')).join('')
}

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
  // De la plus grande image à la plus petite (tailles mesurées le 19 novembre 2026).
  if (ref.source === 'google_books') {
    const editeur = `https://books.google.com/books/publisher/content/images/frontcover/${ref.id}`
    return [
      // Jusqu'à 1200 px de large. Une demande plus modeste (« w480-h720 ») ne rend qu'une vignette.
      `${editeur}?fife=w1200-h1800&source=gbs_api`,
      // Environ 800 px de large.
      `https://books.google.com/books/content?id=${ref.id}&printsec=frontcover&img=1&zoom=0&source=gbs_api`,
      `${editeur}?fife=w480-h720&source=gbs_api`,
    ]
  }
  // Par ISBN : limité à une centaine de demandes par 5 minutes, et plafonné à 500 px de haut.
  // En dernier recours seulement, quand le numéro de couverture de l'édition n'est pas connu.
  if ('isbn' in ref) return [`https://covers.openlibrary.org/b/isbn/${ref.isbn}-L.jpg?default=false`]
  return [
    // Sans taille : l'image d'origine, jusqu'à 1000 px de large.
    `https://covers.openlibrary.org/b/id/${ref.numero}.jpg?default=false`,
    `https://covers.openlibrary.org/b/id/${ref.numero}-L.jpg?default=false`,
  ]
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
export async function telechargerImage(
  adresse: string,
  recuperer: Recuperer,
  /** Les empreintes des images à écarter : les fausses couvertures grises. */
  grises: ReadonlySet<string> = IMAGES_GRISES,
): Promise<Image | null> {
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
      if (grises.has(await empreinte(octets))) return null
      return { type, octets, largeur: taille?.largeur ?? null, hauteur: taille?.hauteur ?? null }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Essaie les adresses de chaque référence, dans l'ordre, et s'arrête à la première image assez
 * large. Tant qu'elle n'a trouvé que des images de petite taille, elle continue, d'une source
 * à l'autre, et garde la plus large.
 */
export async function chercherCouverture(refs: RefCouverture[], recuperer: Recuperer): Promise<{ image: Image; source: Source } | null> {
  let meilleure: { image: Image; source: Source } | null = null
  for (const ref of refs) {
    for (const adresse of adressesCouverture(ref)) {
      const image = await telechargerImage(adresse, recuperer)
      if (!image) continue
      // Une largeur illisible (WebP) : on ne sait pas dire qu'elle est petite, on la garde.
      if (image.largeur === null || image.largeur >= LARGEUR_PETITE) return { image, source: ref.source }
      if (!meilleure || image.largeur > (meilleure.image.largeur ?? 0)) meilleure = { image, source: ref.source }
    }
  }
  return meilleure
}

/** Les octets en base64, par morceaux (une grande image ne tient pas dans un seul appel). */
export function enBase64(octets: Uint8Array): string {
  let binaire = ''
  for (let debut = 0; debut < octets.length; debut += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(debut, debut + 0x8000))
  }
  return btoa(binaire)
}
