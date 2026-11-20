// Le redressement d'une photo de couverture, à la manière du scanner de documents de l'iPhone :
// trouver les quatre coins du livre, puis le rendre droit et rectangulaire, sans la table autour.
// Tout se fait sur l'appareil, sans IA, sans réseau et sans dépendance.
//
// Ce module et ceux qu'il importe (detection, geometrie, lumiere) ne sont chargés qu'à l'ouverture
// du panneau de redressement : `import()` dynamique dans ChoisirImage.tsx. Ne pas l'importer
// ailleurs, pour qu'il reste hors du paquet principal de l'appli.

import { marquer } from '../marque.ts'
import { coinsDeLImage, detecterCoins } from './detection.ts'
import { redresserPixels, tailleRedressee, type Quad } from './geometrie.ts'
import { corrigerLumiere, mesurerLumiere } from './lumiere.ts'

/** Le grand côté de la photo réduite sur laquelle le livre est cherché. */
export const COTE_DETECTION = 512
/** Le grand côté de l'image rangée, et sa qualité : la règle de toutes les couvertures (reduction.ts). */
const COTE_MAX_SORTIE = 1200
const QUALITE = 0.85
/** Avant d'être redressée, la photo est réduite par le navigateur à cette part de la taille rangée, au plus. */
const SURECHANTILLON = 1.5

/** Ce dont le redressement a besoin d'une toile de dessin (un <canvas> en vrai, une fausse dans les tests). */
export type ToileRedressement = {
  width: number
  height: number
  getContext(type: '2d'): {
    drawImage(...arguments_: unknown[]): void
    getImageData(x: number, y: number, largeur: number, hauteur: number): { data: ArrayLike<number> }
    createImageData(largeur: number, hauteur: number): { data: Uint8ClampedArray }
    putImageData(image: never, x: number, y: number): void
  } | null
  toBlob(suite: (image: Blob | null) => void, type: string, qualite: number): void
}

/** La photo de travail : ce qu'on dessine sur une toile, et ses dimensions. */
export type PhotoDeTravail = { source: unknown; largeur: number; hauteur: number }

/** La couverture redressée, sous ses deux formes : telle que photographiée, et la lumière corrigée. */
export type Redressee = { origine: Blob; amelioree: Blob; largeur: number; hauteur: number }

const toileDuNavigateur = (): ToileRedressement => document.createElement('canvas') as unknown as ToileRedressement

/**
 * Les quatre coins du livre, en points de la photo de travail. `trouve` est faux quand rien de
 * plausible n'a été trouvé : les coins sont alors ceux de la photo. Ne lève jamais d'erreur.
 */
export function trouverCoins(photo: PhotoDeTravail, creerToile: () => ToileRedressement = toileDuNavigateur): { coins: Quad; trouve: boolean } {
  const entiere = { coins: coinsDeLImage(photo.largeur, photo.hauteur), trouve: false }
  try {
    const echelle = Math.min(1, COTE_DETECTION / Math.max(photo.largeur, photo.hauteur))
    const largeur = Math.max(1, Math.round(photo.largeur * echelle))
    const hauteur = Math.max(1, Math.round(photo.hauteur * echelle))
    const toile = creerToile()
    toile.width = largeur
    toile.height = hauteur
    const dessin = toile.getContext('2d')
    if (!dessin) return entiere
    dessin.drawImage(photo.source, 0, 0, largeur, hauteur)
    const { coins, trouve } = detecterCoins(dessin.getImageData(0, 0, largeur, hauteur).data, largeur, hauteur)
    if (!trouve) return entiere
    return { coins: coins.map((coin) => ({ x: (coin.x * photo.largeur) / largeur, y: (coin.y * photo.hauteur) / hauteur })) as Quad, trouve }
  } catch {
    return entiere
  }
}

const enJpeg = (toile: ToileRedressement) =>
  new Promise<Blob | null>((suite) => {
    try {
      toile.toBlob(suite, 'image/jpeg', QUALITE)
    } catch {
      suite(null)
    }
  })

/**
 * La couverture redressée : droite, rectangulaire, au vrai format du livre, 1200 px au plus sur le
 * grand côté, en JPEG, avec la marque invisible (marque.ts). Rendue sous deux formes, pour que
 * l'interrupteur « Couleurs d'origine » réponde tout de suite. Null si elle ne peut pas être produite.
 */
export async function redresser(photo: PhotoDeTravail, coins: Quad, creerToile: () => ToileRedressement = toileDuNavigateur): Promise<Redressee | null> {
  try {
    const taille = tailleRedressee(coins, photo.largeur, photo.hauteur, COTE_MAX_SORTIE)

    // La partie de la photo qui contient le livre, réduite par le navigateur (qui adoucit bien mieux
    // qu'un simple rééchantillonnage) jusqu'à une fois et demie la taille rangée.
    const x0 = Math.max(0, Math.floor(Math.min(...coins.map((coin) => coin.x))))
    const y0 = Math.max(0, Math.floor(Math.min(...coins.map((coin) => coin.y))))
    const x1 = Math.min(photo.largeur, Math.ceil(Math.max(...coins.map((coin) => coin.x))))
    const y1 = Math.min(photo.hauteur, Math.ceil(Math.max(...coins.map((coin) => coin.y))))
    if (x1 - x0 < 2 || y1 - y0 < 2) return null
    const echelle = Math.min(1, (SURECHANTILLON * Math.max(taille.largeur, taille.hauteur)) / Math.max(x1 - x0, y1 - y0))
    const largeur = Math.max(2, Math.round((x1 - x0) * echelle))
    const hauteur = Math.max(2, Math.round((y1 - y0) * echelle))
    const travail = creerToile()
    travail.width = largeur
    travail.height = hauteur
    const dessin = travail.getContext('2d')
    if (!dessin) return null
    dessin.drawImage(photo.source, x0, y0, x1 - x0, y1 - y0, 0, 0, largeur, hauteur)
    const source = dessin.getImageData(0, 0, largeur, hauteur).data
    const surTravail = coins.map((coin) => ({ x: ((coin.x - x0) * largeur) / (x1 - x0), y: ((coin.y - y0) * hauteur) / (y1 - y0) })) as Quad

    const droite = redresserPixels(source, largeur, hauteur, surTravail, taille.largeur, taille.hauteur)
    if (!droite) return null
    const amelioree = new Uint8ClampedArray(droite)
    corrigerLumiere(amelioree, mesurerLumiere(droite))

    const produire = async (pixels: Uint8ClampedArray) => {
      const toile = creerToile()
      toile.width = taille.largeur
      toile.height = taille.hauteur
      const sortie = toile.getContext('2d')
      if (!sortie) return null
      const image = sortie.createImageData(taille.largeur, taille.hauteur)
      image.data.set(pixels)
      sortie.putImageData(image as never, 0, 0)
      const jpeg = await enJpeg(toile)
      return jpeg ? marquer(jpeg) : null
    }
    const origine = await produire(droite)
    const corrigee = await produire(amelioree)
    if (!origine || !corrigee) return null
    return { origine, amelioree: corrigee, largeur: taille.largeur, hauteur: taille.hauteur }
  } catch {
    return null
  }
}
