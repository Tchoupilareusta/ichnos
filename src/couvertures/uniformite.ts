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


// ---------------------------------------------------------------------------
// Les images de remplacement des catalogues
// ---------------------------------------------------------------------------
// Pour un livre sans image, Google Books sert « image not available » écrit en gris sur fond
// blanc. La fonction serveur la reconnaît à son empreinte exacte, mais Google la sert sous
// plusieurs tailles, chacune avec une empreinte différente (575 × 750 et 128 × 170, relevées le
// 22 novembre 2026). Et elle n'est uniforme qu'à 93 % : moins que bien des vraies couvertures
// sobres (Gallimard, 95 %). L'appareil la reconnaît donc à son dessin : le gris moyen de chaque
// case de 4 × 4 points de l'image regardée en 48 × 72, comparé à celui de l'image connue.
//
// Mesuré le 22 novembre 2026 (ressemblance de -1 à 1) : la même image en 128 × 170 : 0,83 ;
// L'Homme qui plantait des arbres (Gallimard, couverture blanche) : 0,42 et 0,43 ; couvertures
// illustrées : moins de 0,2.

const CASE = 4
const COLONNES = LARGEUR_MESURE / CASE
const LIGNES = HAUTEUR_MESURE / CASE

/** Au-delà, l'image est l'image de remplacement : elle est traitée comme « pas de couverture ». */
export const SEUIL_RESSEMBLANCE = 0.7

/**
 * Le dessin des images de remplacement connues : le gris (0 à 255) de chaque case, ligne par
 * ligne, en hexadécimal. Si un catalogue en sert une autre, ajouter ici son dessin (relevé avec
 * `signature`), et un test.
 */
export const IMAGES_DE_REMPLACEMENT: readonly string[] = [
  // Google Books, « image not available », 575 × 750.
  'fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffdfdfffffffffffffffffffff3eceaeff2e9f3f7fffffffff2f1e3e9dfe7e2f0fffffffffffffefcf7ecfcfffffffffffffffffffff9ffffffffffffffffebe5e8eafffffffffffffffff6eff1f4fffffffffffffffffffffffffffffffffff6f6f8f2f4ecf8e9f1f3ffffe5e9e8e3e2eee2e6e3e3fefff1f9fcf5f8f5f5f7fcf4ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
]

/** Le dessin d'une image regardée en 48 × 72 : le gris moyen de chaque case de 4 × 4 points. */
export function signature(pixels: ArrayLike<number>): number[] {
  const cases: number[] = []
  for (let ligne = 0; ligne < LIGNES; ligne++)
    for (let colonne = 0; colonne < COLONNES; colonne++) {
      let somme = 0
      for (let y = 0; y < CASE; y++)
        for (let x = 0; x < CASE; x++) {
          const i = ((ligne * CASE + y) * LARGEUR_MESURE + colonne * CASE + x) * 4
          somme += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
        }
      cases.push(somme / (CASE * CASE))
    }
  return cases
}

const lireSignature = (texte: string) => Array.from({ length: texte.length / 2 }, (_, i) => parseInt(texte.slice(i * 2, i * 2 + 2), 16))

/** À quel point deux dessins se ressemblent, de -1 à 1 (corrélation). 0 si l'un est tout uni. */
export function ressemblance(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  const centrer = (v: readonly number[]) => {
    const moyenne = v.reduce((t, x) => t + x, 0) / v.length
    return v.map((x) => x - moyenne)
  }
  const x = centrer(a)
  const y = centrer(b)
  let xy = 0
  let xx = 0
  let yy = 0
  for (let i = 0; i < x.length; i++) {
    xy += x[i] * y[i]
    xx += x[i] * x[i]
    yy += y[i] * y[i]
  }
  return xx === 0 || yy === 0 ? 0 : xy / Math.sqrt(xx * yy)
}

/** Vrai si l'image (en 48 × 72, points RVBA) ressemble à une image de remplacement connue. */
export function estImageDeRemplacement(pixels: ArrayLike<number>): boolean {
  const dessin = signature(pixels)
  return IMAGES_DE_REMPLACEMENT.some((connue) => ressemblance(dessin, lireSignature(connue)) >= SEUIL_RESSEMBLANCE)
}

/**
 * Vrai si l'image reçue n'est pas une couverture : presque uniforme (page blanche, toile unie)
 * ou image de remplacement d'un catalogue. Elle est regardée une seule fois, en 48 × 72. Dans le
 * doute (image illisible, pas de canvas), faux : une image n'est jamais écartée faute d'avoir pu
 * la mesurer.
 */
export async function estFausseCouverture(image: Blob, outils: Partial<Outils> = {}): Promise<boolean> {
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
      const pixels = dessin.getImageData(0, 0, LARGEUR_MESURE, HAUTEUR_MESURE).data
      return partUniforme(pixels) > SEUIL_UNIFORME || estImageDeRemplacement(pixels)
    } finally {
      photo.liberer?.()
    }
  } catch {
    return false
  }
}
