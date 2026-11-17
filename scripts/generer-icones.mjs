// Génère les icônes provisoires d'Ichnos (PNG), sans dépendance : node scripts/generer-icones.mjs
// Motif : trois traces de pas (« ichnos » = trace) couleur papier sur fond maroon.
import { writeFileSync } from 'node:fs'
import { deflateSync, crc32 } from 'node:zlib'

const FOND = [0x55, 0x00, 0x00]
const TRACE = [0xf5, 0xef, 0xe6]

// Traces en coordonnées normalisées (0..1) : centre, demi-axes, angle (degrés)
const TRACES = [
  { x: 0.38, y: 0.7, rx: 0.075, ry: 0.13, a: -18 },
  { x: 0.6, y: 0.5, rx: 0.075, ry: 0.13, a: -18 },
  { x: 0.42, y: 0.29, rx: 0.075, ry: 0.13, a: -18 },
]

function dansUneTrace(x, y, echelle, decalage) {
  for (const t of TRACES) {
    const cx = decalage + t.x * echelle
    const cy = decalage + t.y * echelle
    const ang = (t.a * Math.PI) / 180
    const dx = x - cx
    const dy = y - cy
    const u = dx * Math.cos(ang) + dy * Math.sin(ang)
    const v = -dx * Math.sin(ang) + dy * Math.cos(ang)
    if ((u / (t.rx * echelle)) ** 2 + (v / (t.ry * echelle)) ** 2 <= 1) return true
  }
  return false
}

/** taille en pixels ; marge = part réservée autour du motif (zone sûre des icônes masquables) */
function dessiner(taille, marge = 0) {
  const SS = 4 // suréchantillonnage pour des bords doux
  const echelle = 1 - 2 * marge
  const lignes = []
  for (let py = 0; py < taille; py++) {
    const ligne = Buffer.alloc(1 + taille * 3)
    for (let px = 0; px < taille; px++) {
      let couverture = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / taille
          const y = (py + (sy + 0.5) / SS) / taille
          if (dansUneTrace(x, y, echelle, marge)) couverture++
        }
      const k = couverture / (SS * SS)
      for (let c = 0; c < 3; c++) ligne[1 + px * 3 + c] = Math.round(FOND[c] * (1 - k) + TRACE[c] * k)
    }
    lignes.push(ligne)
  }
  return png(taille, Buffer.concat(lignes))
}

function bloc(type, donnees) {
  const longueur = Buffer.alloc(4)
  longueur.writeUInt32BE(donnees.length)
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees])
  const somme = Buffer.alloc(4)
  somme.writeUInt32BE(crc32(corps) >>> 0)
  return Buffer.concat([longueur, corps, somme])
}

function png(taille, brut) {
  const entete = Buffer.alloc(13)
  entete.writeUInt32BE(taille, 0)
  entete.writeUInt32BE(taille, 4)
  entete[8] = 8 // 8 bits par canal
  entete[9] = 2 // RVB, sans transparence (exigé par iOS pour apple-touch-icon)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', entete),
    bloc('IDAT', deflateSync(brut, { level: 9 })),
    bloc('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync('public/apple-touch-icon.png', dessiner(180, 0.08))
writeFileSync('public/icone-192.png', dessiner(192, 0.08))
writeFileSync('public/icone-512.png', dessiner(512, 0.08))
writeFileSync('public/icone-masquable-512.png', dessiner(512, 0.18))

const ellipses = TRACES.map(
  (t) =>
    `<ellipse cx="${t.x * 64}" cy="${t.y * 64}" rx="${t.rx * 64}" ry="${t.ry * 64}" transform="rotate(${t.a} ${t.x * 64} ${t.y * 64})"/>`,
).join('')
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#550000"/><g fill="#F5EFE6">${ellipses}</g></svg>\n`,
)
console.log('Icônes générées dans public/')
