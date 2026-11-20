// La marque invisible d'une couverture que j'ai cadrée moi-même (photo redressée) : un commentaire
// écrit dans le fichier JPEG, que personne ne voit. À l'affichage, une image qui la porte n'est
// jamais rognée ni recadrée par l'appli (cadrage.ts) : mon cadrage est le bon.
//
// Un JPEG est une suite de segments : FF D8 (début), puis FF xx + longueur sur deux octets + contenu.
// Le commentaire (FF FE) est écrit juste après l'en-tête JFIF (FF E0) que pose le navigateur.

const TEXTE = new TextEncoder().encode('Ichnos : cadrée à la main')
/** La marque est toujours dans les premiers octets : inutile de lire toute l'image. */
const DEBUT_LU = 1024

const DEBUT_IMAGE = 0xd8
const JFIF = 0xe0
const COMMENTAIRE = 0xfe
const DEBUT_DONNEES = 0xda

const estJpeg = (octets: Uint8Array) => octets.length >= 4 && octets[0] === 0xff && octets[1] === DEBUT_IMAGE

/** Où écrire la marque : après le début de l'image et son en-tête JFIF, s'il y en a un. */
function placeDeLaMarque(octets: Uint8Array): number {
  if (octets.length >= 6 && octets[2] === 0xff && octets[3] === JFIF) {
    const fin = 4 + octets[4] * 256 + octets[5]
    if (fin <= octets.length) return fin
  }
  return 2
}

function porteLaMarque(octets: Uint8Array): boolean {
  if (!estJpeg(octets)) return false
  let rang = 2
  // De segment en segment, jusqu'aux données de l'image ou à la fin de ce qui a été lu.
  while (rang + 4 <= octets.length && octets[rang] === 0xff && octets[rang + 1] !== DEBUT_DONNEES) {
    const longueur = octets[rang + 2] * 256 + octets[rang + 3]
    if (longueur < 2) return false
    if (octets[rang + 1] === COMMENTAIRE && longueur === TEXTE.length + 2 && rang + 4 + TEXTE.length <= octets.length) {
      if (TEXTE.every((octet, i) => octets[rang + 4 + i] === octet)) return true
    }
    rang += 2 + longueur
  }
  return false
}

/** Vrai si l'image porte la marque. Dans le doute (image illisible, autre format), faux. */
export async function estMarquee(image: Blob): Promise<boolean> {
  try {
    return porteLaMarque(new Uint8Array(await image.slice(0, DEBUT_LU).arrayBuffer()))
  } catch {
    return false
  }
}

/** La même image, avec la marque. Une image qui n'est pas un JPEG, ou qui la porte déjà, est rendue telle quelle. */
export async function marquer(image: Blob): Promise<Blob> {
  try {
    const debut = new Uint8Array(await image.slice(0, DEBUT_LU).arrayBuffer())
    if (!estJpeg(debut) || porteLaMarque(debut)) return image
    const place = placeDeLaMarque(debut)
    const longueur = TEXTE.length + 2
    const segment = new Uint8Array([0xff, COMMENTAIRE, longueur >> 8, longueur & 0xff, ...TEXTE])
    return new Blob([image.slice(0, place), segment, image.slice(place)], { type: 'image/jpeg' })
  } catch {
    return image
  }
}
