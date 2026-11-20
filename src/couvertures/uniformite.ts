// Les fausses couvertures presque uniformes : une page de titre blanche avec deux lignes de texte
// (Siddhartha chez Open Library, 2480 × 3509 px), la toile unie d'un livre relié sans jaquette.
// Elles passent les contrôles de la fonction serveur (vraie image, assez grande), mais ce ne sont
// pas des couvertures. L'appareil les reconnaît en regardant l'image en tout petit : si plus de
// 98 % de ses points ont presque la même couleur, elle est écartée, comme les images grises de Google.
//
// Mesuré le 20 novembre 2026 : page blanche de Siddhartha 99,2 %, toile verte 100 % ; vraies
// couvertures très sobres : La Jalousie (Minuit) 96,3 %, L'Homme qui plantait des arbres
// (Gallimard, Blanche) 94,4 %. Une page de titre plus chargée (94 %) n'est pas reconnue.

import { decoderPhoto, type PhotoDecodee } from './photo'

/** L'image est regardée à cette taille : assez pour voir un titre, assez peu pour aller vite. */
export const LARGEUR_MESURE = 48
export const HAUTEUR_MESURE = 72
/** Au-delà de cette part de points d'une même couleur, l'image n'est pas une couverture. */
export const SEUIL_UNIFORME = 0.98
/** « Presque la même couleur » : un écart d'au plus 24 sur 255, sur chaque canal. */
const ECART = 24

/**
 * La part des points (de 0 à 1) qui ont presque la couleur la plus fréquente de l'image.
 * `pixels` : des points RVBA à la suite, comme les rend un canvas (getImageData).
 */
export function partUniforme(pixels: ArrayLike<number>): number {
  const nombre = Math.floor(pixels.length / 4)
  if (nombre === 0) return 0
  // La couleur la plus fréquente, par cases de 16 nuances sur chaque canal.
  const cases = new Map<number, number>()
  for (let i = 0; i < nombre; i++) {
    const cle = ((pixels[i * 4] >> 4) << 8) | ((pixels[i * 4 + 1] >> 4) << 4) | (pixels[i * 4 + 2] >> 4)
    cases.set(cle, (cases.get(cle) ?? 0) + 1)
  }
  let dominante = 0
  let compte = -1
  for (const [cle, n] of cases) if (n > compte) [dominante, compte] = [cle, n]
  // Le milieu de la case dominante.
  const r = ((dominante >> 8) << 4) + 8
  const v = (((dominante >> 4) & 15) << 4) + 8
  const b = ((dominante & 15) << 4) + 8
  let proches = 0
  for (let i = 0; i < nombre; i++) {
    const ecart = Math.max(Math.abs(pixels[i * 4] - r), Math.abs(pixels[i * 4 + 1] - v), Math.abs(pixels[i * 4 + 2] - b))
    if (ecart <= ECART) proches++
  }
  return proches / nombre
}

type Toile = {
  width: number
  height: number
  getContext(type: '2d'): { drawImage(...args: unknown[]): void; getImageData(x: number, y: number, l: number, h: number): { data: ArrayLike<number> } } | null
}
type Outils = { decoder: (image: Blob) => Promise<PhotoDecodee>; creerToile: () => Toile }

/**
 * Vrai si l'image est presque uniforme : ce n'est pas une couverture. Dans le doute (image
 * illisible, pas de canvas), faux : une image n'est jamais écartée faute d'avoir pu la mesurer.
 */
export async function estPresqueUniforme(image: Blob, outils: Partial<Outils> = {}): Promise<boolean> {
  try {
    const photo = await (outils.decoder ?? decoderPhoto)(image)
    try {
      if (!photo.largeur || !photo.hauteur) return false
      const toile = (outils.creerToile ?? (() => document.createElement('canvas') as unknown as Toile))()
      toile.width = LARGEUR_MESURE
      toile.height = HAUTEUR_MESURE
      const dessin = toile.getContext('2d')
      if (!dessin) return false
      dessin.drawImage(photo.image, 0, 0, LARGEUR_MESURE, HAUTEUR_MESURE)
      return partUniforme(dessin.getImageData(0, 0, LARGEUR_MESURE, HAUTEUR_MESURE).data) > SEUIL_UNIFORME
    } finally {
      photo.liberer?.()
    }
  } catch {
    return false
  }
}
