// Le « hasard doux » des recommandations (§7.2) : un hasard qu'on peut fixer. Aucun Math.random :
// le même couple (graine, clé) rend toujours le même nombre, sur tous les appareils.

/** Empreinte FNV-1a sur 32 bits d'un texte. */
function empreinte(texte: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Un nombre entre 0 (compris) et 1 (non compris), tiré de la graine et de la clé (l'identifiant de l'œuvre). */
export function hasard(graine: string, cle: string): number {
  // Un tour de « mulberry32 » pour bien mélanger les bits de l'empreinte.
  let t = (empreinte(`${graine}|${cle}`) + 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * La graine de l'appli : le jour (à l'heure de l'appareil) et l'envie. Mes idées restent donc les
 * mêmes toute la journée, et changent le lendemain.
 */
export function graineDuJour(maintenant: Date, envie: string): string {
  const deux = (n: number) => String(n).padStart(2, '0')
  return `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}|${envie}`
}
