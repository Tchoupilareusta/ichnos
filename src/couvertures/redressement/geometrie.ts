// La géométrie du redressement d'une photo de couverture : l'homographie (la transformation qui
// rend droit et rectangulaire ce que la perspective a déformé), le vrai format du livre, et le
// rééchantillonnage des points. Calcul pur, sans navigateur : il se teste tel quel.

export type Point = { x: number; y: number }
/** Les quatre coins, toujours dans cet ordre : haut-gauche, haut-droite, bas-droite, bas-gauche. */
export type Quad = [Point, Point, Point, Point]

/** Résout un système linéaire n × n (élimination de Gauss avec pivot). Null s'il n'a pas de solution unique. */
export function resoudre(matrice: number[][], second: number[]): number[] | null {
  const n = second.length
  const m = matrice.map((ligne, i) => [...ligne, second[i]])
  for (let colonne = 0; colonne < n; colonne++) {
    let pivot = colonne
    for (let ligne = colonne + 1; ligne < n; ligne++) if (Math.abs(m[ligne][colonne]) > Math.abs(m[pivot][colonne])) pivot = ligne
    if (Math.abs(m[pivot][colonne]) < 1e-10) return null
    ;[m[colonne], m[pivot]] = [m[pivot], m[colonne]]
    for (let ligne = 0; ligne < n; ligne++) {
      if (ligne === colonne) continue
      const facteur = m[ligne][colonne] / m[colonne][colonne]
      for (let k = colonne; k <= n; k++) m[ligne][k] -= facteur * m[colonne][k]
    }
  }
  return m.map((ligne, i) => ligne[n] / ligne[i])
}

/** Les neuf nombres d'une homographie (le dernier vaut 1), ligne par ligne. */
export type Homographie = number[]

/** L'homographie qui envoie les quatre points `de` sur les quatre points `vers` (système 8 × 8). */
export function homographie(de: Quad, vers: Quad): Homographie | null {
  const matrice: number[][] = []
  const second: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = de[i]
    const { x: u, y: v } = vers[i]
    matrice.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    second.push(u)
    matrice.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    second.push(v)
  }
  const h = resoudre(matrice, second)
  return h ? [...h, 1] : null
}

export function appliquer(h: Homographie, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8]
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w }
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * La focale supposée de l'appareil, en parts du grand côté de la photo : celle de l'objectif
 * principal d'un iPhone (24 à 26 mm, soit 0,69 à 0,75). Mesurée sur de vraies photos le
 * 20 novembre 2026 : la focale déduite des seuls coins est bien trop instable (elle ne se calcule
 * même pas quand le livre ne fuit que dans un sens), alors qu'une focale supposée retrouve le
 * format d'un manga photographié de biais à 1 % près.
 */
const FOCALE = 0.72

/**
 * Largeur ÷ hauteur du livre réel dont on voit les quatre coins, la photo entière faisant
 * `largeur` × `hauteur`. Vu de biais, la moyenne des côtés est fausse (le côté qui fuit paraît
 * plus court) : le format se déduit de la perspective, en prenant le centre de la photo pour
 * centre optique (Zhang et He, « Whiteboard scanning and image enhancement », 2004). Vu bien à
 * plat, le calcul rend simplement le rapport des côtés. S'il ne tient pas debout, la moyenne des
 * côtés opposés.
 */
export function formatReel(coins: Quad, largeur: number, hauteur: number): number {
  const [hg, hd, bd, bg] = coins
  const simple = (distance(hg, hd) + distance(bg, bd)) / (distance(hg, bg) + distance(hd, bd))
  const centre = (p: Point) => [p.x - largeur / 2, p.y - hauteur / 2, 1]
  const croix = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const scalaire = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const m1 = centre(hg)
  const m2 = centre(hd)
  const m3 = centre(bg)
  const m4 = centre(bd)
  const k2 = scalaire(croix(m1, m4), m3) / scalaire(croix(m2, m4), m3)
  const k3 = scalaire(croix(m1, m4), m2) / scalaire(croix(m3, m4), m2)
  // Les deux directions du livre (sa largeur, sa hauteur), telles qu'elles partent du coin haut-gauche.
  const n2 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 - 1]
  const n3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 - 1]
  const focale2 = (FOCALE * Math.max(largeur, hauteur)) ** 2
  const format = Math.sqrt(((n2[0] ** 2 + n2[1] ** 2) / focale2 + n2[2] ** 2) / ((n3[0] ** 2 + n3[1] ** 2) / focale2 + n3[2] ** 2))
  return Number.isFinite(format) && format > 0.2 && format < 5 ? format : simple
}

/**
 * La taille de l'image redressée : au format réel du livre, sans perdre de détail (elle suit le
 * plus long côté vu sur la photo), le grand côté ramené à `coteMax` au plus.
 */
export function tailleRedressee(coins: Quad, largeur: number, hauteur: number, coteMax: number): { largeur: number; hauteur: number } {
  const [hg, hd, bd, bg] = coins
  const format = formatReel(coins, largeur, hauteur)
  const large = Math.max(distance(hg, hd), distance(bg, bd))
  const haut = Math.max(distance(hg, bg), distance(hd, bd))
  let l = Math.max(large, haut * format)
  let h = l / format
  const echelle = Math.min(1, coteMax / Math.max(l, h))
  l *= echelle
  h *= echelle
  return { largeur: Math.max(1, Math.round(l)), hauteur: Math.max(1, Math.round(h)) }
}

/**
 * Redresse : chaque point de l'image de sortie (un rectangle `largeur` × `hauteur`) va chercher sa
 * couleur dans la photo (points RVBA à la suite), à l'endroit que donne l'homographie, entre ses
 * quatre voisins (interpolation bilinéaire). Null si les coins ne permettent pas de redresser.
 */
export function redresserPixels(source: ArrayLike<number>, largeurSource: number, hauteurSource: number, coins: Quad, largeur: number, hauteur: number): Uint8ClampedArray | null {
  const h = homographie(
    [
      { x: 0, y: 0 },
      { x: largeur, y: 0 },
      { x: largeur, y: hauteur },
      { x: 0, y: hauteur },
    ],
    coins,
  )
  if (!h) return null
  const sortie = new Uint8ClampedArray(largeur * hauteur * 4)
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      // Du centre du point de sortie au centre des points de la photo.
      const w = h[6] * (x + 0.5) + h[7] * (y + 0.5) + 1
      const sx = Math.max(0, Math.min(largeurSource - 1, (h[0] * (x + 0.5) + h[1] * (y + 0.5) + h[2]) / w - 0.5))
      const sy = Math.max(0, Math.min(hauteurSource - 1, (h[3] * (x + 0.5) + h[4] * (y + 0.5) + h[5]) / w - 0.5))
      const x0 = Math.floor(sx)
      const y0 = Math.floor(sy)
      const x1 = Math.min(largeurSource - 1, x0 + 1)
      const y1 = Math.min(hauteurSource - 1, y0 + 1)
      const fx = sx - x0
      const fy = sy - y0
      const a = (y0 * largeurSource + x0) * 4
      const b = (y0 * largeurSource + x1) * 4
      const c = (y1 * largeurSource + x0) * 4
      const d = (y1 * largeurSource + x1) * 4
      const o = (y * largeur + x) * 4
      for (let canal = 0; canal < 3; canal++) {
        const dessus = source[a + canal] * (1 - fx) + source[b + canal] * fx
        const dessous = source[c + canal] * (1 - fx) + source[d + canal] * fx
        sortie[o + canal] = dessus * (1 - fy) + dessous * fy
      }
      sortie[o + 3] = 255
    }
  }
  return sortie
}
