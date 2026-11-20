// La correction légère de la lumière d'une photo de couverture, à la manière du bouton
// « Améliorer » de Photos, sans IA : la balance des couleurs, les niveaux (ce qui devient noir,
// ce qui devient blanc) et un soupçon de contraste. Elle agit sur toute l'image de la même façon :
// elle ne peut donc ni effacer un reflet, ni une ombre nette. Toujours modérée et bornée : une
// photo déjà bonne ne change presque pas, et « Couleurs d'origine » la retire.

export type Correction = {
  /** Ce par quoi chaque canal (rouge, vert, bleu) est multiplié : la balance des couleurs. */
  gains: [number, number, number]
  /** Les niveaux : la clarté qui devient noire, et celle qui devient blanche. */
  noir: number
  blanc: number
}

/** Une dominante n'est mesurée que s'il y a assez de gris dans l'image : au moins 3 % des points. */
const PART_DE_GRIS = 0.03
/** Elle est corrigée aux deux tiers, et jamais de plus de 8 % par canal. */
const FORCE_BALANCE = 0.66
const GAIN_MAX = 0.08
/** Le noir ne monte jamais de plus de 32 nuances, le blanc ne descend jamais de plus de 60 : rien n'est brûlé. */
const NOIR_MAX = 32
const BLANC_MAX = 60
/** L'amplitude de la courbe de contraste, en part de l'échelle des clartés. */
const CONTRASTE = 0.03

const borner = (valeur: number, min: number, max: number) => Math.min(max, Math.max(min, valeur))

/** Mesure l'image (points RVBA à la suite) et rend la correction à lui appliquer. */
export function mesurerLumiere(pixels: ArrayLike<number>): Correction {
  const nombre = Math.floor(pixels.length / 4)
  if (nombre === 0) return { gains: [1, 1, 1], noir: 0, blanc: 255 }

  // La dominante : la teinte moyenne des points presque gris et assez clairs (papier, blancs, gris).
  // Une couleur franche vient du dessin de la couverture, pas de la lumière : elle ne compte pas.
  let rouge = 0
  let vert = 0
  let bleu = 0
  let gris = 0
  for (let i = 0; i < nombre; i++) {
    const [r, v, b] = [pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]]
    const max = Math.max(r, v, b)
    if (max < 90 || max > 250 || max - Math.min(r, v, b) > max * 0.18) continue
    rouge += r
    vert += v
    bleu += b
    gris++
  }
  let gains: [number, number, number] = [1, 1, 1]
  if (gris >= nombre * PART_DE_GRIS) {
    const moyenne = (rouge + vert + bleu) / 3
    const gain = (canal: number) => borner(1 + (moyenne / canal - 1) * FORCE_BALANCE, 1 - GAIN_MAX, 1 + GAIN_MAX)
    gains = [gain(rouge), gain(vert), gain(bleu)]
  }

  // Les niveaux : la clarté des points les plus sombres et les plus clairs (0,5 % de chaque côté écartés).
  const histogramme = new Uint32Array(256)
  for (let i = 0; i < nombre; i++) {
    histogramme[Math.round(borner((pixels[i * 4] * gains[0] * 2 + pixels[i * 4 + 1] * gains[1] * 3 + pixels[i * 4 + 2] * gains[2]) / 6, 0, 255))]++
  }
  const centile = (part: number) => {
    let cumul = 0
    for (let clarte = 0; clarte < 256; clarte++) {
      cumul += histogramme[clarte]
      if (cumul >= nombre * part) return clarte
    }
    return 255
  }
  return { gains, noir: Math.min(NOIR_MAX, centile(0.005)), blanc: 255 - Math.min(BLANC_MAX, 255 - centile(0.995)) }
}

/** Applique la correction, sur place (points RVBA à la suite). L'opacité n'est pas touchée. */
export function corrigerLumiere(pixels: Uint8ClampedArray, correction: Correction): void {
  const etendue = Math.max(1, correction.blanc - correction.noir)
  const tables = correction.gains.map((gain) => {
    const table = new Uint8ClampedArray(256)
    for (let nuance = 0; nuance < 256; nuance++) {
      const t = borner((nuance * gain - correction.noir) / etendue, 0, 1)
      // Une courbe en « S » très douce : le noir, le milieu et le blanc restent en place.
      table[nuance] = Math.round(borner(t - CONTRASTE * Math.sin(2 * Math.PI * t), 0, 1) * 255)
    }
    return table
  })
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    pixels[i] = tables[0][pixels[i]]
    pixels[i + 1] = tables[1][pixels[i + 1]]
    pixels[i + 2] = tables[2][pixels[i + 2]]
  }
}
