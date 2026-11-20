// La détection des quatre coins d'un livre photographié sur une table : de la vision par ordinateur
// classique, sans IA ni réseau. Sur une photo réduite à 512 px :
//   1. la couleur du fond (table, drap, tapis) s'apprend sur les bords de la photo ; il peut y en
//      avoir plusieurs (soleil et ombre, motif à deux couleurs) ;
//   2. ce qui n'a pas une couleur du fond est le livre : on garde la plus grande zone d'un seul
//      tenant, et les morceaux proches d'elle (une couverture a souvent une partie de la couleur du fond) ;
//   3. on prend son contour (enveloppe convexe) ;
//   4. de chaque côté, on cherche le bord droit du livre : la droite, au ras de la zone ou juste
//      au-delà, le long de laquelle l'image change le plus nettement. C'est ce qui retrouve le haut
//      noir d'une couverture posée sur un drap sombre ;
//   5. si les quatre bords ne donnent rien de plausible : l'enveloppe réduite à quatre côtés ;
//      et sinon, les quatre coins de l'image. Les coins restent toujours réglables à la main.
//
// Mis au point le 20 novembre 2026 sur six vraies photos (parquet au soleil, forte perspective,
// drap gris foncé, tissu à motifs) ; les tests n'utilisent que des images dessinées par le code.

import type { Point, Quad } from './geometrie.ts'

/** La part du petit côté de la photo, sur chaque bord, où la couleur du fond s'apprend. */
const BORDURE = 0.06
/** Les couleurs sont rangées par cases : 10 niveaux de clarté, et 22 × 22 teintes (pas de 12 nuances). */
const CLARTES = 10
const TEINTES = 22
const PAS_TEINTE = 12
/** Une case est une couleur du fond si elle porte au moins cette part des points des bords. */
const PART_FOND = 0.0008
/** Nettoyage du masque : les détails plus fins sont retirés (grain, joints du parquet), les trous plus petits bouchés. */
const OUVERTURE = 2
const FERMETURE = 4
/** En dessous de cette part de la photo, ce n'est pas un livre. */
const AIRE_MIN = 0.05
/** Un coin de livre fait à peu près un angle droit : entre 40° et 140° sur la photo. */
const ANGLE_MIN = (40 * Math.PI) / 180

export function coinsDeLImage(largeur: number, hauteur: number): Quad {
  return [
    { x: 0, y: 0 },
    { x: largeur, y: 0 },
    { x: largeur, y: hauteur },
    { x: 0, y: hauteur },
  ]
}

// ---------------------------------------------------------------------------
// 1 et 2. Le masque du livre
// ---------------------------------------------------------------------------

function caseDe(r: number, v: number, b: number): number {
  const clarte = Math.min(CLARTES - 1, Math.floor(((r * 2 + v * 3 + b) / 6 / 256) * CLARTES))
  const borner = (teinte: number) => Math.max(0, Math.min(TEINTES - 1, Math.floor(teinte / PAS_TEINTE + TEINTES / 2)))
  return (clarte * TEINTES + borner(r - v)) * TEINTES + borner((r + v) / 2 - b)
}

/** 1 pour chaque point dont la couleur est rare sur les bords de la photo. */
function masqueDuLivre(pixels: ArrayLike<number>, largeur: number, hauteur: number): Uint8Array {
  const total = largeur * hauteur
  const comptes = new Uint32Array(CLARTES * TEINTES * TEINTES)
  const bande = Math.max(2, Math.round(Math.min(largeur, hauteur) * BORDURE))
  const cases = new Uint16Array(total)
  let echantillon = 0
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const i = (y * largeur + x) * 4
      const laCase = caseDe(pixels[i], pixels[i + 1], pixels[i + 2])
      cases[y * largeur + x] = laCase
      if (x < bande || y < bande || x >= largeur - bande || y >= hauteur - bande) {
        comptes[laCase]++
        echantillon++
      }
    }
  }
  // Une couleur fréquente sur les bords est une couleur du fond, et ses voisines aussi (tolérance).
  const seuil = Math.max(2, echantillon * PART_FOND)
  const fond = new Uint8Array(comptes.length)
  for (let c = 0; c < CLARTES; c++) {
    for (let a = 0; a < TEINTES; a++) {
      for (let b = 0; b < TEINTES; b++) {
        if (comptes[(c * TEINTES + a) * TEINTES + b] < seuil) continue
        for (let dc = -1; dc <= 1; dc++) {
          for (let da = -1; da <= 1; da++) {
            for (let db = -1; db <= 1; db++) {
              const [c2, a2, b2] = [c + dc, a + da, b + db]
              if (c2 >= 0 && c2 < CLARTES && a2 >= 0 && a2 < TEINTES && b2 >= 0 && b2 < TEINTES) fond[(c2 * TEINTES + a2) * TEINTES + b2] = 1
            }
          }
        }
      }
    }
  }
  const masque = new Uint8Array(total)
  for (let p = 0; p < total; p++) masque[p] = fond[cases[p]] ? 0 : 1
  return masque
}

/** Érosion (cible 0) ou dilatation (cible 1) par un carré, en deux passes. Hors de l'image : du fond. */
function etendre(masque: Uint8Array, largeur: number, hauteur: number, rayon: number, cible: 0 | 1): Uint8Array {
  const passe = (source: Uint8Array, horizontal: boolean) => {
    const sortie = new Uint8Array(source.length)
    for (let y = 0; y < hauteur; y++) {
      for (let x = 0; x < largeur; x++) {
        let trouve = false
        for (let d = -rayon; d <= rayon && !trouve; d++) {
          const xx = horizontal ? x + d : x
          const yy = horizontal ? y : y + d
          const valeur = xx < 0 || yy < 0 || xx >= largeur || yy >= hauteur ? 0 : source[yy * largeur + xx]
          if (valeur === cible) trouve = true
        }
        sortie[y * largeur + x] = trouve ? cible : 1 - cible
      }
    }
    return sortie
  }
  return passe(passe(masque, true), false)
}

function nettoyer(masque: Uint8Array, largeur: number, hauteur: number): Uint8Array {
  let m = etendre(masque, largeur, hauteur, OUVERTURE, 0)
  m = etendre(m, largeur, hauteur, OUVERTURE, 1)
  m = etendre(m, largeur, hauteur, FERMETURE, 1)
  return etendre(m, largeur, hauteur, FERMETURE, 0)
}

type Boite = { x0: number; y0: number; x1: number; y1: number }

/**
 * La zone du livre : la plus grande zone d'un seul tenant (de préférence une zone qui ne touche pas
 * le bord de la photo), et les morceaux proches d'elle.
 */
function zoneDuLivre(masque: Uint8Array, largeur: number, hauteur: number): Uint8Array | null {
  const etiquettes = new Int32Array(masque.length).fill(-1)
  const zones: { aire: number; touche: boolean; boite: Boite }[] = []
  const pile: number[] = []
  for (let depart = 0; depart < masque.length; depart++) {
    if (!masque[depart] || etiquettes[depart] !== -1) continue
    const numero = zones.length
    const zone = { aire: 0, touche: false, boite: { x0: largeur, y0: hauteur, x1: 0, y1: 0 } }
    pile.push(depart)
    etiquettes[depart] = numero
    while (pile.length) {
      const p = pile.pop() as number
      const x = p % largeur
      const y = (p - x) / largeur
      zone.aire++
      zone.boite.x0 = Math.min(zone.boite.x0, x)
      zone.boite.x1 = Math.max(zone.boite.x1, x)
      zone.boite.y0 = Math.min(zone.boite.y0, y)
      zone.boite.y1 = Math.max(zone.boite.y1, y)
      if (x === 0 || y === 0 || x === largeur - 1 || y === hauteur - 1) zone.touche = true
      for (const voisin of [x > 0 ? p - 1 : -1, x < largeur - 1 ? p + 1 : -1, y > 0 ? p - largeur : -1, y < hauteur - 1 ? p + largeur : -1]) {
        if (voisin >= 0 && masque[voisin] && etiquettes[voisin] === -1) {
          etiquettes[voisin] = numero
          pile.push(voisin)
        }
      }
    }
    zones.push(zone)
  }
  if (zones.length === 0) return null
  // Une zone qui touche le bord de la photo est sans doute autre chose que le livre (un meuble, un tapis).
  const note = (zone: { aire: number; touche: boolean }) => zone.aire * (zone.touche ? 0.25 : 1)
  let principale = 0
  for (let n = 1; n < zones.length; n++) if (note(zones[n]) > note(zones[principale])) principale = n
  const prises = new Set([principale])
  const boite = { ...zones[principale].boite }
  const ecart = Math.hypot(largeur, hauteur) * 0.05
  const aireMin = largeur * hauteur * 0.0015
  for (let change = true; change; ) {
    change = false
    zones.forEach((zone, n) => {
      if (prises.has(n) || zone.aire < aireMin || zone.touche) return
      const dx = Math.max(0, zone.boite.x0 - boite.x1, boite.x0 - zone.boite.x1)
      const dy = Math.max(0, zone.boite.y0 - boite.y1, boite.y0 - zone.boite.y1)
      if (Math.hypot(dx, dy) > ecart) return
      prises.add(n)
      boite.x0 = Math.min(boite.x0, zone.boite.x0)
      boite.y0 = Math.min(boite.y0, zone.boite.y0)
      boite.x1 = Math.max(boite.x1, zone.boite.x1)
      boite.y1 = Math.max(boite.y1, zone.boite.y1)
      change = true
    })
  }
  const zone = new Uint8Array(masque.length)
  for (let p = 0; p < masque.length; p++) if (prises.has(etiquettes[p])) zone[p] = 1
  return zone
}

// ---------------------------------------------------------------------------
// 3. Le contour : enveloppe convexe
// ---------------------------------------------------------------------------

const croix = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

/** L'enveloppe convexe des points d'une zone (chaîne monotone d'Andrew), dans le sens des aiguilles d'une montre à l'écran. */
function enveloppe(zone: Uint8Array, largeur: number, hauteur: number): Point[] {
  // Les extrémités de chaque ligne suffisent : les autres points sont à l'intérieur.
  const points: Point[] = []
  for (let y = 0; y < hauteur; y++) {
    let premier = -1
    let dernier = -1
    for (let x = 0; x < largeur; x++) {
      if (!zone[y * largeur + x]) continue
      if (premier === -1) premier = x
      dernier = x
    }
    if (premier === -1) continue
    points.push({ x: premier, y }, { x: dernier + 1, y }, { x: premier, y: y + 1 }, { x: dernier + 1, y: y + 1 })
  }
  points.sort((a, b) => a.x - b.x || a.y - b.y)
  if (points.length < 3) return points
  const moitie = (liste: Point[]) => {
    const chaine: Point[] = []
    for (const p of liste) {
      while (chaine.length >= 2 && croix(chaine[chaine.length - 2], chaine[chaine.length - 1], p) <= 0) chaine.pop()
      chaine.push(p)
    }
    return chaine.slice(0, -1)
  }
  return [...moitie(points), ...moitie([...points].reverse())]
}

function aire(polygone: Point[]): number {
  let somme = 0
  polygone.forEach((a, i) => {
    const b = polygone[(i + 1) % polygone.length]
    somme += a.x * b.y - b.x * a.y
  })
  return Math.abs(somme) / 2
}

/** L'intersection des droites (a1, a2) et (b1, b2), ou null si elles sont parallèles. */
function intersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const d = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x)
  if (Math.abs(d) < 1e-9) return null
  const t = ((a1.x - b1.x) * (b1.y - b2.y) - (a1.y - b1.y) * (b1.x - b2.x)) / d
  return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) }
}

/**
 * Réduit un polygone convexe à quatre côtés : on retire un à un le côté dont la disparition (ses
 * deux voisins prolongés jusqu'à se rencontrer) ajoute le moins de surface.
 */
function enQuadrilatere(polygone: Point[]): Point[] | null {
  const p = [...polygone]
  while (p.length > 4) {
    const n = p.length
    let meilleur = -1
    let ajout = Infinity
    let sommet: Point | null = null
    for (let i = 0; i < n; i++) {
      const a = p[i]
      const b = p[(i + 1) % n]
      const rencontre = intersection(p[(i - 1 + n) % n], a, b, p[(i + 2) % n])
      // La rencontre doit être du côté extérieur du côté retiré.
      if (!rencontre || croix(a, b, rencontre) >= 0) continue
      const surface = aire([a, rencontre, b])
      if (surface < ajout) {
        ajout = surface
        meilleur = i
        sommet = rencontre
      }
    }
    if (meilleur === -1 || !sommet) return null
    p[meilleur] = sommet
    p.splice((meilleur + 1) % n, 1)
  }
  return p.length === 4 ? p : null
}

// ---------------------------------------------------------------------------
// 4. Les bords droits du livre
// ---------------------------------------------------------------------------

/** Le relief de l'image : en chaque point, la pente du canal de couleur où elle est la plus forte, sur une image adoucie. */
function relief(pixels: ArrayLike<number>, largeur: number, hauteur: number): { gx: Float32Array; gy: Float32Array } {
  const total = largeur * hauteur
  const doux = [0, 1, 2].map((canal) => {
    const plan = new Float32Array(total)
    for (let y = 0; y < hauteur; y++) {
      for (let x = 0; x < largeur; x++) {
        let somme = 0
        let nombre = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx
            const yy = y + dy
            if (xx < 0 || yy < 0 || xx >= largeur || yy >= hauteur) continue
            somme += pixels[(yy * largeur + xx) * 4 + canal]
            nombre++
          }
        }
        plan[y * largeur + x] = somme / nombre
      }
    }
    return plan
  })
  const gx = new Float32Array(total)
  const gy = new Float32Array(total)
  for (let y = 1; y < hauteur - 1; y++) {
    for (let x = 1; x < largeur - 1; x++) {
      const p = y * largeur + x
      let fort = -1
      for (const plan of doux) {
        const dx = (plan[p + 1] - plan[p - 1]) / 2
        const dy = (plan[p + largeur] - plan[p - largeur]) / 2
        if (dx * dx + dy * dy > fort) {
          fort = dx * dx + dy * dy
          gx[p] = dx
          gy[p] = dy
        }
      }
    }
  }
  return { gx, gy }
}

/** Jusqu'où chercher un bord : au-delà de la zone (part de sa hauteur), et vers l'intérieur pour un livre penché (part de sa largeur). */
const DEHORS = 0.12
const DEDANS = 0.36
/** Une pente d'au moins 4 nuances par point compte comme une arête ; au-delà de 30, elle ne compte pas plus. */
const PENTE_MIN = 4
const PENTE_MAX = 30
/** Une vraie arête ressort des droites parallèles situées à 4 points d'elle. */
const VOISINE = 4
/** Plus une droite s'éloigne de la zone trouvée, moins elle est crue (part de la hauteur de la zone). */
const ELOIGNEMENT = 0.07
/** Le long d'une droite, 64 points sont regardés. */
const POINTS = 64

type Droite = [Point, Point]

/**
 * Le bord d'un côté du livre. `cote` : 0 pour le haut, 1 la droite, 2 le bas, 3 la gauche ;
 * l'image est tournée par la pensée pour que le côté cherché soit toujours « le haut ». Une droite
 * candidate joint la gauche et la droite de la zone, à deux hauteurs ; elle doit laisser la zone
 * de son bon côté. La meilleure est celle qui suit l'arête la plus nette, au plus près de la zone.
 */
function bordDuCote(cote: number, sommets: Point[], gx: Float32Array, gy: Float32Array, largeur: number, hauteur: number): Droite | null {
  const hauteurTournee = cote % 2 === 0 ? hauteur : largeur
  const tourner = (p: Point): Point =>
    cote === 0 ? p : cote === 1 ? { x: p.y, y: largeur - 1 - p.x } : cote === 2 ? { x: largeur - 1 - p.x, y: hauteur - 1 - p.y } : { x: hauteur - 1 - p.y, y: p.x }
  const revenir = (p: Point): Point =>
    cote === 0 ? p : cote === 1 ? { x: largeur - 1 - p.y, y: p.x } : cote === 2 ? { x: largeur - 1 - p.x, y: hauteur - 1 - p.y } : { x: p.y, y: hauteur - 1 - p.x }
  const tournes = sommets.map(tourner)
  const u0 = Math.min(...tournes.map((p) => p.x))
  const u1 = Math.max(...tournes.map((p) => p.x))
  const v0 = Math.min(...tournes.map((p) => p.y))
  const large = u1 - u0
  const haut = Math.max(...tournes.map((p) => p.y)) - v0
  if (large < 8 || haut < 8) return null
  const debut = Math.max(1, Math.round(v0 - Math.max(8, haut * DEHORS)))
  const fin = Math.min(hauteurTournee - 2, Math.round(v0 + Math.max(8, large * DEDANS)))
  const nombre = fin - debut + 1
  if (nombre < 3) return null
  const tolerance = Math.max(2, Math.hypot(largeur, hauteur) * 0.006)

  // La note brute de chaque droite (-1 : hors champ), et sa distance à la zone (négative : elle la coupe).
  const notes = new Float32Array(nombre * nombre).fill(-1)
  const marges = new Float32Array(nombre * nombre)
  for (let a = 0; a < nombre; a++) {
    for (let b = 0; b < nombre; b++) {
      const pente = (b - a) / large
      if (Math.abs(pente) > 0.45) continue
      let marge = Infinity
      for (const sommet of tournes) marge = Math.min(marge, sommet.y - (debut + a + pente * (sommet.x - u0)))
      const A = revenir({ x: u0, y: debut + a })
      const B = revenir({ x: u1, y: debut + b })
      const longueur = Math.hypot(B.x - A.x, B.y - A.y)
      const nx = -(B.y - A.y) / longueur
      const ny = (B.x - A.x) / longueur
      let somme = 0
      let nettes = 0
      let vus = 0
      for (let s = 0; s <= POINTS; s++) {
        // Les extrémités sont laissées de côté : un coin de livre est souvent arrondi ou corné.
        const t = 0.04 + (0.92 * s) / POINTS
        const x = Math.round(A.x + (B.x - A.x) * t)
        const y = Math.round(A.y + (B.y - A.y) * t)
        if (x < 1 || y < 1 || x >= largeur - 1 || y >= hauteur - 1) continue
        const force = Math.abs(gx[y * largeur + x] * nx + gy[y * largeur + x] * ny)
        somme += Math.min(force, PENTE_MAX)
        if (force >= PENTE_MIN) nettes++
        vus++
      }
      if (vus < POINTS * 0.6) continue
      notes[a * nombre + b] = (nettes / vus) * 0.6 + (somme / vus / PENTE_MAX) * 0.4
      marges[a * nombre + b] = marge
    }
  }

  let meilleure = -Infinity
  let choix: [number, number] | null = null
  const echelle = Math.max(6, haut * ELOIGNEMENT)
  for (let a = 0; a < nombre; a++) {
    for (let b = 0; b < nombre; b++) {
      const note = notes[a * nombre + b]
      if (note < 0 || marges[a * nombre + b] < -tolerance) continue
      // Sur un fond à motifs, toutes les droites ont une bonne note : seule compte celle qui ressort de ses voisines.
      const voisine = (ecart: number): number | null => {
        const [a2, b2] = [a + ecart, b + ecart]
        return a2 < 0 || b2 < 0 || a2 >= nombre || b2 >= nombre || notes[a2 * nombre + b2] < 0 ? null : notes[a2 * nombre + b2]
      }
      const avant = voisine(-VOISINE)
      const apres = voisine(VOISINE)
      const saillie = note - ((avant ?? apres ?? note) + (apres ?? avant ?? note)) / 2
      const finale = (saillie + 0.15 * note) * Math.exp(-Math.max(0, marges[a * nombre + b]) / echelle)
      if (finale > meilleure) {
        meilleure = finale
        choix = [a, b]
      }
    }
  }
  return choix ? [revenir({ x: u0, y: debut + choix[0] }), revenir({ x: u1, y: debut + choix[1] })] : null
}

// ---------------------------------------------------------------------------
// 5. Le résultat, ou le repli
// ---------------------------------------------------------------------------

/** Haut-gauche, haut-droite, bas-droite, bas-gauche, dans les limites de l'image. */
function ordonner(points: Point[], largeur: number, hauteur: number): Quad {
  const cx = points.reduce((somme, p) => somme + p.x, 0) / 4
  const cy = points.reduce((somme, p) => somme + p.y, 0) / 4
  const tournes = [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx))
  let depart = 0
  for (let i = 1; i < 4; i++) if (tournes[i].x + tournes[i].y < tournes[depart].x + tournes[depart].y) depart = i
  return [0, 1, 2, 3].map((i) => {
    const p = tournes[(depart + i) % 4]
    return { x: Math.max(0, Math.min(largeur, p.x)), y: Math.max(0, Math.min(hauteur, p.y)) }
  }) as Quad
}

/** Assez grand, convexe, et sans angle trop fermé ni trop ouvert : c'est peut-être un livre. */
function plausible(quad: Quad, largeur: number, hauteur: number): boolean {
  if (aire(quad) < largeur * hauteur * AIRE_MIN) return false
  return quad.every((b, i) => {
    const a = quad[(i + 3) % 4]
    const c = quad[(i + 1) % 4]
    if (croix(a, b, c) <= 0) return false
    const angle = Math.acos(((a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y)) / (Math.hypot(a.x - b.x, a.y - b.y) * Math.hypot(c.x - b.x, c.y - b.y)))
    return angle >= ANGLE_MIN && angle <= Math.PI - ANGLE_MIN
  })
}

/**
 * Les quatre coins du livre sur une photo réduite (points RVBA à la suite, comme les rend un
 * canvas). `trouve` est faux quand rien de plausible n'a été trouvé : les coins sont alors ceux de
 * l'image. Ne lève jamais d'erreur.
 */
export function detecterCoins(pixels: ArrayLike<number>, largeur: number, hauteur: number): { coins: Quad; trouve: boolean } {
  const entiere = { coins: coinsDeLImage(largeur, hauteur), trouve: false }
  try {
    if (largeur < 16 || hauteur < 16 || pixels.length < largeur * hauteur * 4) return entiere
    const zone = zoneDuLivre(nettoyer(masqueDuLivre(pixels, largeur, hauteur), largeur, hauteur), largeur, hauteur)
    if (!zone) return entiere
    const contour = enveloppe(zone, largeur, hauteur)
    if (contour.length < 3 || aire(contour) < largeur * hauteur * AIRE_MIN * 0.5) return entiere
    const { gx, gy } = relief(pixels, largeur, hauteur)
    const [haut, droite, bas, gauche] = [0, 1, 2, 3].map((cote) => bordDuCote(cote, contour, gx, gy, largeur, hauteur))
    if (haut && droite && bas && gauche) {
      const coins = [intersection(haut[0], haut[1], gauche[0], gauche[1]), intersection(haut[0], haut[1], droite[0], droite[1]), intersection(bas[0], bas[1], droite[0], droite[1]), intersection(bas[0], bas[1], gauche[0], gauche[1])]
      if (coins.every((coin) => coin !== null)) {
        const quad = ordonner(coins as Point[], largeur, hauteur)
        if (plausible(quad, largeur, hauteur)) return { coins: quad, trouve: true }
      }
    }
    const simple = enQuadrilatere(contour)
    if (simple) {
      const quad = ordonner(simple, largeur, hauteur)
      if (plausible(quad, largeur, hauteur)) return { coins: quad, trouve: true }
    }
    return entiere
  } catch {
    return entiere
  }
}
