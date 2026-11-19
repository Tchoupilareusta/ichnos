// « Choisir une image » : une photo de mon exemplaire (photothèque, appareil photo ou fichiers)
// devient une couverture. Lecture, recadrage libre et réduction se font sur l'appareil, avec les
// seules fonctions du navigateur ; l'image produite est un JPEG léger. Jamais dans le dépôt GitHub.

/** Au-delà, le fichier n'est pas lu (30 Mo : bien plus qu'une photo d'iPhone). */
export const TAILLE_MAX_FICHIER = 30 * 1024 * 1024
/** Safari limite la taille des toiles de dessin : l'image de travail est réduite dès la lecture. */
export const COTE_MAX_LECTURE = 4096
/** Le grand côté de l'image rangée : net sur la fiche d'un iPhone, pour 200 à 300 Ko. */
export const COTE_MAX_SORTIE = 1200
const QUALITE = 0.85

export type EchecPhoto = 'pas_image' | 'trop_lourd' | 'illisible'

/** Le fichier choisi peut-il être lu comme une image ? (Son vrai contenu est vérifié au décodage.) */
export function verifierFichier(fichier: File): 'ok' | 'pas_image' | 'trop_lourd' {
  // Un type absent : certaines photos arrivent ainsi ; le décodage tranchera.
  if (fichier.type && !fichier.type.startsWith('image/')) return 'pas_image'
  if (fichier.size > TAILLE_MAX_FICHIER) return 'trop_lourd'
  return 'ok'
}

// ---------------------------------------------------------------------------
// Le cadre de recadrage, en pixels de l'image de travail
// ---------------------------------------------------------------------------

export type Cadre = { x: number; y: number; largeur: number; hauteur: number }
export type Coin = 'haut-gauche' | 'haut-droite' | 'bas-gauche' | 'bas-droite'
export const COINS: Coin[] = ['haut-gauche', 'haut-droite', 'bas-gauche', 'bas-droite']
type Taille = { largeur: number; hauteur: number }

export const cadreEntier = (largeur: number, hauteur: number): Cadre => ({ x: 0, y: 0, largeur, hauteur })

export const estEntier = (cadre: Cadre, image: Taille) =>
  cadre.x === 0 && cadre.y === 0 && cadre.largeur === image.largeur && cadre.hauteur === image.hauteur

const borner = (valeur: number, min: number, max: number) => Math.min(Math.max(valeur, min), max)

/**
 * Le cadre après avoir fait glisser un coin de (dx, dy) pixels : le coin opposé ne bouge pas,
 * le cadre ne sort pas de l'image et garde une taille minimale (un dixième du petit côté).
 */
export function deplacerCoin(cadre: Cadre, coin: Coin, dx: number, dy: number, image: Taille): Cadre {
  const minimum = Math.max(1, Math.round(Math.min(image.largeur, image.hauteur) / 10))
  let gauche = cadre.x
  let droite = cadre.x + cadre.largeur
  let haut = cadre.y
  let bas = cadre.y + cadre.hauteur
  if (coin.endsWith('gauche')) gauche = borner(gauche + dx, 0, droite - minimum)
  else droite = borner(droite + dx, gauche + minimum, image.largeur)
  if (coin.startsWith('haut')) haut = borner(haut + dy, 0, bas - minimum)
  else bas = borner(bas + dy, haut + minimum, image.hauteur)
  return { x: Math.round(gauche), y: Math.round(haut), largeur: Math.round(droite - gauche), hauteur: Math.round(bas - haut) }
}

/** La taille de l'image rangée : le grand côté ramené à 1200 px au plus, jamais agrandi. */
export function tailleSortie(cadre: Cadre, coteMax = COTE_MAX_SORTIE): Taille {
  const echelle = Math.min(1, coteMax / Math.max(cadre.largeur, cadre.hauteur))
  return { largeur: Math.max(1, Math.round(cadre.largeur * echelle)), hauteur: Math.max(1, Math.round(cadre.hauteur * echelle)) }
}

// ---------------------------------------------------------------------------
// Lecture et recadrage (toile de dessin du navigateur ; une fausse dans les tests)
// ---------------------------------------------------------------------------

/** Ce dont la photo a besoin d'une toile de dessin. */
export type ToilePhoto = {
  width: number
  height: number
  getContext(type: '2d'): {
    fillStyle: unknown
    fillRect(x: number, y: number, largeur: number, hauteur: number): void
    drawImage(...arguments_: unknown[]): void
  } | null
  toBlob(suite: (image: Blob | null) => void, type: string, qualite: number): void
}

/** La photo prête à être recadrée : une image de travail (au plus 4096 px), et son aperçu affichable. */
export type ImageLue = { source: ToilePhoto; largeur: number; hauteur: number; apercu: string; liberer: () => void }
export type LecturePhoto = { ok: true; image: ImageLue } | { ok: false; echec: EchecPhoto }

/** La photo décodée : ses dimensions, ce qu'on dessine sur la toile, et de quoi libérer la mémoire. */
export type PhotoDecodee = { largeur: number; hauteur: number; image: unknown; liberer?: () => void }

/** Décode la photo, en la redressant d'après son orientation (une photo prise « couchée » revient droite). */
export async function decoderPhoto(fichier: Blob): Promise<PhotoDecodee> {
  if (typeof createImageBitmap === 'function') {
    try {
      const photo = await createImageBitmap(fichier, { imageOrientation: 'from-image' })
      return { largeur: photo.width, hauteur: photo.height, image: photo, liberer: () => photo.close() }
    } catch {
      // Format que createImageBitmap ne lit pas ici : on essaie par une image ordinaire.
    }
  }
  const adresse = URL.createObjectURL(fichier)
  try {
    const image = new Image()
    image.src = adresse
    await image.decode()
    return { largeur: image.naturalWidth, hauteur: image.naturalHeight, image }
  } finally {
    URL.revokeObjectURL(adresse)
  }
}

const toileDuNavigateur = (): ToilePhoto => document.createElement('canvas') as unknown as ToilePhoto
const versBlob = (toile: ToilePhoto, qualite: number) =>
  new Promise<Blob | null>((suite) => {
    try {
      toile.toBlob(suite, 'image/jpeg', qualite)
    } catch {
      suite(null)
    }
  })

type OutilsLecture = {
  decoder: (fichier: Blob) => Promise<PhotoDecodee>
  creerToile: () => ToilePhoto
  creerAdresse: (image: Blob) => string
  libererAdresse: (adresse: string) => void
}

/**
 * Lit la photo choisie et prépare l'image de travail, réduite si elle dépasse 4096 px.
 * Ne lève jamais d'erreur : une photo qui ne se lit pas est « illisible ».
 */
export async function lireImage(fichier: Blob, outils: Partial<OutilsLecture> = {}): Promise<LecturePhoto> {
  const decoder = outils.decoder ?? decoderPhoto
  const creerToile = outils.creerToile ?? toileDuNavigateur
  const creerAdresse = outils.creerAdresse ?? ((image: Blob) => URL.createObjectURL(image))
  const libererAdresse = outils.libererAdresse ?? ((adresse: string) => URL.revokeObjectURL(adresse))
  try {
    const photo = await decoder(fichier)
    if (!photo.largeur || !photo.hauteur) return { ok: false, echec: 'illisible' }
    const echelle = Math.min(1, COTE_MAX_LECTURE / Math.max(photo.largeur, photo.hauteur))
    const toile = creerToile()
    toile.width = Math.max(1, Math.round(photo.largeur * echelle))
    toile.height = Math.max(1, Math.round(photo.hauteur * echelle))
    const dessin = toile.getContext('2d')
    if (!dessin) return { ok: false, echec: 'illisible' }
    dessin.drawImage(photo.image, 0, 0, toile.width, toile.height)
    // La photo décodée (jusqu'à 48 mégapixels) est libérée dès qu'elle est dessinée.
    photo.liberer?.()
    const apercu = await versBlob(toile, 0.9)
    if (!apercu) return { ok: false, echec: 'illisible' }
    const adresse = creerAdresse(apercu)
    return { ok: true, image: { source: toile, largeur: toile.width, hauteur: toile.height, apercu: adresse, liberer: () => libererAdresse(adresse) } }
  } catch {
    return { ok: false, echec: 'illisible' }
  }
}

/**
 * Une partie d'une image, en JPEG de qualité 0,85, le grand côté à 1200 px au plus : la forme sous
 * laquelle toute couverture est rangée. Null si elle ne peut pas être produite.
 */
export async function enJpeg(source: unknown, cadre: Cadre, creerToile: () => ToilePhoto = toileDuNavigateur): Promise<Blob | null> {
  try {
    const { largeur, hauteur } = tailleSortie(cadre)
    const toile = creerToile()
    toile.width = largeur
    toile.height = hauteur
    const dessin = toile.getContext('2d')
    if (!dessin) return null
    // Un fond clair sous une image transparente (PNG) : le JPEG n'a pas de transparence.
    dessin.fillStyle = '#ffffff'
    dessin.fillRect(0, 0, largeur, hauteur)
    dessin.drawImage(source, cadre.x, cadre.y, cadre.largeur, cadre.hauteur, 0, 0, largeur, hauteur)
    return await versBlob(toile, QUALITE)
  } catch {
    return null
  }
}

/** La partie choisie de la photo, prête à être rangée. Null si elle ne peut pas être produite. */
export const recadrer = (image: ImageLue, cadre: Cadre, creerToile?: () => ToilePhoto): Promise<Blob | null> =>
  enJpeg(image.source, cadre, creerToile)
