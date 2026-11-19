// Le poids des couvertures : toute image rangée dans mon stockage privé suit la même règle que
// mes photos. Au plus 1200 px sur le grand côté, en JPEG de bonne qualité (150 à 300 Ko environ).
// Une image d'origine trouvée dans un catalogue pèse parfois près de 1 Mo : elle est réduite sur
// l'appareil au moment d'être rangée, jamais avant (un aperçu que je ne garde pas n'est pas touché).
//
// La marge reste large pour un affichage net : la fiche montre la couverture sur 196 points, soit
// 588 pixels sur un iPhone (×3) ; une couverture ordinaire réduite à 1200 px de haut en garde 750 à 800.

import { LARGEUR_PETITE } from '../ajout/assistant'
import { cadreEntier, COTE_MAX_SORTIE, decoderPhoto, enJpeg, tailleSortie, type PhotoDecodee, type ToilePhoto } from './photo'

/**
 * En dessous de ce poids, une image qui tient déjà dans 1200 px n'est pas recompressée :
 * c'est le cas d'une photo que je viens de recadrer, qui ne doit pas être compressée deux fois.
 */
export const POIDS_SANS_RETOUCHE = 350 * 1024

type Taille = { largeur: number; hauteur: number }

/** La taille qu'aura une image une fois rangée : le grand côté à 1200 px au plus, jamais agrandie. */
export const tailleRangee = (taille: Taille): Taille => tailleSortie(cadreEntier(taille.largeur, taille.hauteur))

/**
 * Une couverture « de petite taille » : moins de 450 px de large. Une image dont le grand côté
 * atteint 1200 px ne l'est jamais, même étroite : c'est la plus grande que l'appli range, et
 * aucune recherche n'en donnerait une plus grande. Sans largeur connue, on ne dit rien.
 */
export function estPetite(taille: { largeur: number | null; hauteur: number | null }): boolean {
  if (taille.largeur === null || taille.largeur >= LARGEUR_PETITE) return false
  return Math.max(taille.largeur, taille.hauteur ?? 0) < COTE_MAX_SORTIE
}

type Outils = { decoder: (image: Blob) => Promise<PhotoDecodee>; creerToile: () => ToilePhoto }

/**
 * L'image telle qu'elle sera rangée. Trop grande : réduite à 1200 px, en JPEG. De bonne taille
 * mais lourde : recompressée, et gardée seulement si elle en sort plus légère. Déjà petite et
 * légère : rendue telle quelle. Ne lève jamais d'erreur : en cas d'échec, l'image d'origine.
 */
export async function reduireImage(image: Blob, outils: Partial<Outils> = {}): Promise<Blob> {
  try {
    const photo = await (outils.decoder ?? decoderPhoto)(image)
    try {
      if (!photo.largeur || !photo.hauteur) return image
      const tropGrande = Math.max(photo.largeur, photo.hauteur) > COTE_MAX_SORTIE
      if (!tropGrande && image.size <= POIDS_SANS_RETOUCHE) return image
      const reduite = await enJpeg(photo.image, cadreEntier(photo.largeur, photo.hauteur), outils.creerToile)
      if (!reduite) return image
      return tropGrande || reduite.size < image.size ? reduite : image
    } finally {
      photo.liberer?.()
    }
  } catch {
    return image
  }
}
