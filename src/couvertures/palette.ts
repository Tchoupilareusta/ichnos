// Couvertures typographiques générées, en attendant les vraies (étape 6) et en dernier recours
// ensuite (docs/reference.md §8.2) : titre sur un fond doux, choisi dans une petite palette chaude.
// Chaque couple fond/texte dépasse 4,5:1 de contraste (vérifié par les tests).

export type Teinte = { fond: string; texte: string }

export const PALETTE: Teinte[] = [
  { fond: '#C9A46A', texte: '#2A2420' }, // sable
  { fond: '#2F3A40', texte: '#EFE7DC' }, // ardoise
  { fond: '#550000', texte: '#F5EFE6' }, // maroon
  { fond: '#2D3A5C', texte: '#F5EFE6' }, // bleu nuit
  { fond: '#8E4A35', texte: '#FBF8F3' }, // terre cuite
  { fond: '#A8B59A', texte: '#2A2420' }, // sauge
  { fond: '#D9C2B0', texte: '#2A2420' }, // rose poudré
  { fond: '#4A5A3F', texte: '#F5EFE6' }, // olive
]

/** La même œuvre garde toujours la même teinte, d'un appareil à l'autre. */
export function teinteDe(graine: string): Teinte {
  let empreinte = 2166136261
  for (const caractere of graine) {
    empreinte ^= caractere.codePointAt(0) ?? 0
    empreinte = Math.imul(empreinte, 16777619)
  }
  return PALETTE[(empreinte >>> 0) % PALETTE.length]
}

const lineaire = (canal: number) => {
  const c = canal / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(couleur: string): number {
  const [r, g, b] = [1, 3, 5].map((debut) => parseInt(couleur.slice(debut, debut + 2), 16))
  return 0.2126 * lineaire(r) + 0.7152 * lineaire(g) + 0.0722 * lineaire(b)
}

/** Rapport de contraste WCAG entre deux couleurs « #RRGGBB ». */
export function contraste(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (clair + 0.05) / (sombre + 0.05)
}

/** Taille du titre, en part de la largeur de la couverture : plus le titre est long, plus il est petit. */
export function echelleTitre(titre: string): number {
  const longueur = titre.length
  const motLePlusLong = Math.max(...titre.split(/\s+/).map((mot) => mot.length))
  let echelle = longueur <= 12 ? 14 : longueur <= 22 ? 12 : longueur <= 36 ? 10.5 : 9.5
  // Un mot très long doit tenir sur une ligne sans être coupé n'importe où.
  if (motLePlusLong >= 10) echelle = Math.min(echelle, 11)
  if (motLePlusLong >= 13) echelle = Math.min(echelle, 9.5)
  return echelle
}
