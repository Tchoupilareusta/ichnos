// Le fond derrière une image de couverture montrée en entier. Une couverture plus étroite ou plus
// large que le cadre 2:3 laisse deux bandes : elles prennent la couleur moyenne des bords de
// l'image, adoucie vers le fond de l'appli, pour que la couverture semble se prolonger.

export type Couleur = { r: number; v: number; b: number }

/**
 * La couleur moyenne d'une bande de quelques pixels sur les quatre bords d'une image (pixels en
 * rouge, vert, bleu, opacité). Les pixels transparents ne comptent pas. Null si rien n'est lisible.
 */
export function moyenneDesBords(pixels: ArrayLike<number>, largeur: number, hauteur: number, bande = 2): Couleur | null {
  if (largeur <= 0 || hauteur <= 0 || pixels.length < largeur * hauteur * 4) return null
  let rouge = 0
  let vert = 0
  let bleu = 0
  let poids = 0
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      if (x >= bande && x < largeur - bande && y >= bande && y < hauteur - bande) continue
      const rang = (y * largeur + x) * 4
      const opacite = pixels[rang + 3] / 255
      rouge += pixels[rang] * opacite
      vert += pixels[rang + 1] * opacite
      bleu += pixels[rang + 2] * opacite
      poids += opacite
    }
  }
  if (poids === 0) return null
  return { r: Math.round(rouge / poids), v: Math.round(vert / poids), b: Math.round(bleu / poids) }
}

/** La couleur des bords, adoucie vers le fond de l'appli ; sans couleur connue, celle des cartes. */
export function fondAdouci(couleur: Couleur | null): string {
  return couleur ? `color-mix(in srgb, rgb(${couleur.r} ${couleur.v} ${couleur.b}) 70%, var(--fond))` : 'var(--surface)'
}

/** Ce dont le calcul a besoin d'une toile de dessin (un <canvas> en vrai, une fausse dans les tests). */
export type Toile = {
  width: number
  height: number
  getContext(type: '2d'): {
    drawImage(image: HTMLImageElement, x: number, y: number, largeur: number, hauteur: number): void
    getImageData(x: number, y: number, largeur: number, hauteur: number): { data: ArrayLike<number> }
  } | null
}

/** Une petite toile suffit pour une couleur moyenne : l'image y est réduite. */
const LARGEUR_TOILE = 32
const HAUTEUR_MAX = 96

/** Le résultat est gardé par adresse : une image n'est mesurée qu'une fois. */
const connues = new Map<string, Couleur | null>()

const toileDuNavigateur = (): Toile => document.createElement('canvas') as unknown as Toile

/**
 * La couleur des bords d'une image déjà chargée. Son adresse est un « blob: » de l'appli (image
 * de mon stockage privé ou aperçu), donc lisible. Null sans toile de dessin, ou en cas d'erreur.
 */
export function couleurDesBords(image: HTMLImageElement, creerToile: () => Toile = toileDuNavigateur): Couleur | null {
  // Pas encore chargée (ou pas de moteur d'image, comme dans les tests) : rien à mesurer.
  if (!image.naturalWidth || !image.naturalHeight) return null
  const connue = connues.get(image.src)
  if (connue !== undefined) return connue
  let couleur: Couleur | null = null
  try {
    const toile = creerToile()
    const largeur = LARGEUR_TOILE
    const hauteur = Math.max(1, Math.min(HAUTEUR_MAX, Math.round((LARGEUR_TOILE * image.naturalHeight) / image.naturalWidth)))
    toile.width = largeur
    toile.height = hauteur
    const dessin = toile.getContext('2d')
    if (dessin) {
      dessin.drawImage(image, 0, 0, largeur, hauteur)
      couleur = moyenneDesBords(dessin.getImageData(0, 0, largeur, hauteur).data, largeur, hauteur)
    }
  } catch {
    couleur = null
  }
  connues.set(image.src, couleur)
  return couleur
}
