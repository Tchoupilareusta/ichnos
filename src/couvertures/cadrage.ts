// Comment une image de couverture se place dans sa case. La case a toujours le même format, 5:8
// (celui des poches français : Folio, GF, Le Livre de poche), pour que la grille reste régulière.
// Trois règles, appliquées sur l'appareil au moment d'afficher l'image, sans jamais la modifier :
//   1. les marges unies d'un scan sont rognées ;
//   2. si le format qui reste est à 6 % au plus de 5:8, l'image remplit la case (elle perd au plus
//      3 % de chaque côté) ;
//   3. sinon elle est montrée à sa vraie forme, posée en bas de la case comme un livre sur une
//      étagère, sans bande colorée autour.
// Une image que j'ai cadrée moi-même (marque.ts) n'est jamais rognée ni recadrée.

import { estMarquee } from './marque'

/** Largeur ÷ hauteur de la case. */
export const FORMAT_CADRE = 5 / 8
/** Jusqu'à cet écart avec le format de la case, l'image la remplit. */
const ECART_REMPLIR = 0.06
/** Une image cadrée par moi ne remplit la case que si elle en a déjà le format, à 1 % près. */
const ECART_MARQUEE = 0.01

/** Un côté n'est rogné seul que si sa bande fait moins de 4 % de la dimension. */
const BANDE_SEULE = 0.04
/** Une zone unie qui atteint 15 % de la dimension n'est pas une marge de scan : c'est le fond de la couverture. */
const BANDE_MAX = 0.15
/** Une ligne est unie si 98 % de ses points sont à 20 nuances près (sur 255, par canal) de la couleur du bord. */
const PART_UNIE = 0.98
const NUANCES = 20

/** Le nombre de lignes (ou de colonnes) unies depuis chaque bord, en points de l'image mesurée. */
export type Bandes = { haut: number; bas: number; gauche: number; droite: number }
/** Une partie de l'image, en fractions de sa largeur et de sa hauteur (de 0 à 1). */
export type Zone = { x: number; y: number; largeur: number; hauteur: number }
/**
 * mode : l'image remplit la case, ou elle est posée sur l'étagère ;
 * visible : la partie de l'image qui est montrée ; format : largeur ÷ hauteur de ce qui est montré.
 */
export type Cadrage = { mode: 'remplir' | 'etagere'; visible: Zone; format: number }

const ENTIERE: Zone = { x: 0, y: 0, largeur: 1, hauteur: 1 }

/** La valeur du milieu d'une liste de nuances. */
function mediane(valeurs: number[]): number {
  const triees = [...valeurs].sort((a, b) => a - b)
  return triees[Math.floor(triees.length / 2)]
}

/**
 * Les bandes unies autour d'une image (points RVBA à la suite, comme les rend un canvas). On part
 * de chaque bord, dont la couleur du milieu sert de repère, et on avance tant que la ligne est unie.
 */
export function bandesUnies(pixels: ArrayLike<number>, largeur: number, hauteur: number): Bandes {
  const vide = { haut: 0, bas: 0, gauche: 0, droite: 0 }
  if (largeur <= 0 || hauteur <= 0 || pixels.length < largeur * hauteur * 4) return vide

  /** Depuis un bord : `ligne(i)` rend les rangs des points de la i-ième ligne en partant de ce bord. */
  const depuis = (nombre: number, longueur: number, rangDe: (ligne: number, point: number) => number): number => {
    const repere = [0, 1, 2].map((canal) => mediane(Array.from({ length: longueur }, (_, point) => pixels[rangDe(0, point) + canal])))
    const limite = Math.ceil(nombre * BANDE_MAX)
    let unies = 0
    while (unies < limite) {
      let proches = 0
      for (let point = 0; point < longueur; point++) {
        const rang = rangDe(unies, point)
        const ecart = Math.max(Math.abs(pixels[rang] - repere[0]), Math.abs(pixels[rang + 1] - repere[1]), Math.abs(pixels[rang + 2] - repere[2]))
        if (ecart <= NUANCES) proches++
      }
      if (proches < longueur * PART_UNIE) break
      unies++
    }
    // Arrivée à la limite sans rencontrer la couverture : ce n'est pas une marge.
    return unies >= limite ? 0 : unies
  }

  return {
    haut: depuis(hauteur, largeur, (ligne, point) => (ligne * largeur + point) * 4),
    bas: depuis(hauteur, largeur, (ligne, point) => ((hauteur - 1 - ligne) * largeur + point) * 4),
    gauche: depuis(largeur, hauteur, (ligne, point) => (point * largeur + ligne) * 4),
    droite: depuis(largeur, hauteur, (ligne, point) => (point * largeur + (largeur - 1 - ligne)) * 4),
  }
}

/**
 * Ce qui reste de l'image une fois les marges rognées. Un côté n'est rogné que si sa bande est
 * mince (moins de 4 %), ou si le côté opposé a lui aussi une bande : c'est alors un cadre de scan.
 * Une bande large d'un seul côté (le blanc du haut d'un Folio) fait partie du dessin : elle reste.
 */
export function zoneRognee(bandes: Bandes, largeur: number, hauteur: number): Zone {
  const rogner = (bande: number, opposee: number, dimension: number) => (bande > 0 && (bande < dimension * BANDE_SEULE || opposee > 0) ? bande : 0)
  const haut = rogner(bandes.haut, bandes.bas, hauteur)
  const bas = rogner(bandes.bas, bandes.haut, hauteur)
  const gauche = rogner(bandes.gauche, bandes.droite, largeur)
  const droite = rogner(bandes.droite, bandes.gauche, largeur)
  return { x: gauche / largeur, y: haut / hauteur, largeur: (largeur - gauche - droite) / largeur, hauteur: (hauteur - haut - bas) / hauteur }
}

/**
 * Remplir la case ou poser sur l'étagère. `taille` : l'image en pixels ; `rognee` : ce qu'il en
 * reste sans ses marges ; `marquee` : je l'ai cadrée moi-même, elle n'est jamais retouchée.
 */
export function cadrer(taille: { largeur: number; hauteur: number }, rognee: Zone, marquee: boolean): Cadrage {
  const zone = marquee ? ENTIERE : rognee
  const format = (zone.largeur * taille.largeur) / (zone.hauteur * taille.hauteur)
  const ecart = Math.abs(format / FORMAT_CADRE - 1)
  if (ecart > (marquee ? ECART_MARQUEE : ECART_REMPLIR)) return { mode: 'etagere', visible: zone, format }
  if (marquee) return { mode: 'remplir', visible: zone, format: FORMAT_CADRE }
  // L'image remplit la case : ce qui dépasse est retiré à parts égales des deux côtés.
  if (format >= FORMAT_CADRE) {
    const largeur = (zone.largeur * FORMAT_CADRE) / format
    return { mode: 'remplir', visible: { x: zone.x + (zone.largeur - largeur) / 2, y: zone.y, largeur, hauteur: zone.hauteur }, format: FORMAT_CADRE }
  }
  const hauteur = (zone.hauteur * format) / FORMAT_CADRE
  return { mode: 'remplir', visible: { x: zone.x, y: zone.y + (zone.hauteur - hauteur) / 2, largeur: zone.largeur, hauteur }, format: FORMAT_CADRE }
}

/**
 * Les mesures pour l'écran, en pourcentages. `livre` : la place de l'image dans la case (toujours
 * posée en bas, centrée). `image` : sa taille et son décalage dans cette place, pour que seule la
 * partie visible y paraisse.
 */
export function placer(cadrage: Cadrage) {
  const { visible, format } = cadrage
  const livre =
    cadrage.mode === 'remplir'
      ? { largeur: 100, hauteur: 100 }
      : format >= FORMAT_CADRE
        ? { largeur: 100, hauteur: (FORMAT_CADRE / format) * 100 }
        : { largeur: (format / FORMAT_CADRE) * 100, hauteur: 100 }
  const largeur = 100 / visible.largeur
  const hauteur = 100 / visible.hauteur
  return { livre, image: { largeur, hauteur, gauche: -visible.x * largeur, haut: -visible.y * hauteur } }
}

// ---------------------------------------------------------------------------
// La mesure d'une image affichée (toile de dessin du navigateur ; une fausse dans les tests)
// ---------------------------------------------------------------------------

/** Ce dont la mesure a besoin d'une toile de dessin. */
export type ToileMesure = {
  width: number
  height: number
  getContext(type: '2d'): {
    drawImage(image: HTMLImageElement, x: number, y: number, largeur: number, hauteur: number): void
    getImageData(x: number, y: number, largeur: number, hauteur: number): { data: ArrayLike<number> }
  } | null
}

/** Le grand côté de la toile de mesure : un point y vaut 0,4 % de l'image, assez pour des marges de 1 %. */
const COTE_MESURE = 256

type Outils = {
  creerToile: () => ToileMesure
  /** L'image porte-t-elle ma marque ? (lue dans les premiers octets du fichier) */
  lireMarque: (adresse: string) => Promise<boolean>
}

const toileDuNavigateur = (): ToileMesure => document.createElement('canvas') as unknown as ToileMesure

/** L'adresse est un « blob: » de l'appli (stockage privé ou aperçu) : son début se relit sans réseau. */
async function marqueDeLAdresse(adresse: string): Promise<boolean> {
  try {
    return await estMarquee(await (await fetch(adresse)).blob())
  } catch {
    return false
  }
}

/** Le résultat est gardé par adresse : une image n'est mesurée qu'une fois. */
const connus = new Map<string, Promise<Cadrage | null>>()

/**
 * Le cadrage d'une image déjà chargée. Null si ses dimensions ne sont pas connues (pas encore
 * chargée, ou pas de moteur d'image comme dans les tests). Sans toile de dessin, ou en cas
 * d'erreur, l'image est jugée entière, sans rognage.
 */
export function cadrageDe(image: HTMLImageElement, outils: Partial<Outils> = {}): Promise<Cadrage | null> {
  const taille = { largeur: image.naturalWidth, hauteur: image.naturalHeight }
  if (!taille.largeur || !taille.hauteur) return Promise.resolve(null)
  const adresse = image.src
  const connu = connus.get(adresse)
  if (connu) return connu
  const mesure = (async () => {
    if (await (outils.lireMarque ?? marqueDeLAdresse)(adresse)) return cadrer(taille, ENTIERE, true)
    let rognee = ENTIERE
    try {
      const echelle = COTE_MESURE / Math.max(taille.largeur, taille.hauteur)
      const largeur = Math.max(1, Math.round(taille.largeur * echelle))
      const hauteur = Math.max(1, Math.round(taille.hauteur * echelle))
      const toile = (outils.creerToile ?? toileDuNavigateur)()
      toile.width = largeur
      toile.height = hauteur
      const dessin = toile.getContext('2d')
      if (dessin) {
        dessin.drawImage(image, 0, 0, largeur, hauteur)
        rognee = zoneRognee(bandesUnies(dessin.getImageData(0, 0, largeur, hauteur).data, largeur, hauteur), largeur, hauteur)
      }
    } catch {
      rognee = ENTIERE
    }
    return cadrer(taille, rognee, false)
  })()
  connus.set(adresse, mesure)
  return mesure
}
