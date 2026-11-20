import { corrigerLumiere, mesurerLumiere } from './lumiere.ts'

type Couleur = [number, number, number]

/** Une image dessinée par le code : `couleur(i)` pour le i-ième point. */
function image(nombre: number, couleur: (i: number) => Couleur): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(nombre * 4)
  for (let i = 0; i < nombre; i++) pixels.set([...couleur(i), 255], i * 4)
  return pixels
}

const ameliorer = (pixels: Uint8ClampedArray) => {
  const copie = new Uint8ClampedArray(pixels)
  corrigerLumiere(copie, mesurerLumiere(pixels))
  return copie
}

describe('la correction légère de la lumière', () => {
  it('ne change presque rien à une image déjà équilibrée', () => {
    // Un dégradé de gris du noir au blanc.
    const origine = image(1024, (i) => [i % 256, i % 256, i % 256])
    const correction = mesurerLumiere(origine)
    expect(correction.gains).toEqual([1, 1, 1])
    expect(correction.noir).toBeLessThanOrEqual(2)
    expect(correction.blanc).toBeGreaterThanOrEqual(253)
    const corrigee = ameliorer(origine)
    let ecart = 0
    for (let i = 0; i < origine.length; i++) ecart = Math.max(ecart, Math.abs(corrigee[i] - origine[i]))
    // Seul le léger contraste joue : quelques nuances au plus.
    expect(ecart).toBeLessThanOrEqual(10)
  })

  it('éclaircit et redonne du contraste à une photo sombre et terne', () => {
    // Des gris de 30 à 180 : ni vrai noir, ni vrai blanc.
    const origine = image(1500, (i) => [30 + (i % 151), 30 + (i % 151), 30 + (i % 151)])
    const corrigee = ameliorer(origine)
    let min = 255
    let max = 0
    for (let i = 0; i < corrigee.length; i += 4) {
      min = Math.min(min, corrigee[i])
      max = Math.max(max, corrigee[i])
    }
    expect(min).toBeLessThan(15)
    expect(max).toBeGreaterThan(225)
  })

  it('ne brûle jamais une image : le blanc ne descend pas de plus de 60 nuances, le noir ne monte pas de plus de 32', () => {
    // Une image très sombre : tout entre 5 et 90.
    const sombre = mesurerLumiere(image(1000, (i) => [5 + (i % 86), 5 + (i % 86), 5 + (i % 86)]))
    expect(sombre.blanc).toBeGreaterThanOrEqual(195)
    // Une image délavée : tout entre 120 et 250.
    const delavee = mesurerLumiere(image(1000, (i) => [120 + (i % 131), 120 + (i % 131), 120 + (i % 131)]))
    expect(delavee.noir).toBeLessThanOrEqual(32)
  })

  it('atténue une dominante de couleur, mesurée sur les gris de l’image', () => {
    // Des gris clairs sous une lumière chaude : plus de rouge, moins de bleu.
    const origine = image(1000, (i) => [150 + (i % 60) + 12, 150 + (i % 60), 150 + (i % 60) - 12])
    const { gains } = mesurerLumiere(origine)
    expect(gains[0]).toBeLessThan(1)
    expect(gains[2]).toBeGreaterThan(1)
    const corrigee = ameliorer(origine)
    const dominante = (pixels: Uint8ClampedArray) => {
      let somme = 0
      for (let i = 0; i < pixels.length; i += 4) somme += pixels[i] - pixels[i + 2]
      return somme / (pixels.length / 4)
    }
    expect(dominante(corrigee)).toBeLessThan(dominante(origine) * 0.6)
    // Atténuée, pas inversée.
    expect(dominante(corrigee)).toBeGreaterThanOrEqual(0)
  })

  it('ne corrige jamais une dominante de plus de 8 % par canal', () => {
    const { gains } = mesurerLumiere(image(1000, () => [200, 160, 150]))
    for (const gain of gains) {
      expect(gain).toBeGreaterThanOrEqual(0.92)
      expect(gain).toBeLessThanOrEqual(1.08)
    }
  })

  it('laisse ses couleurs à une couverture très colorée, sans gris où mesurer une dominante', () => {
    // Du bleu-vert et de l'orange francs : la couleur vient du dessin, pas de la lumière.
    const { gains } = mesurerLumiere(image(1000, (i) => (i % 2 === 0 ? [30, 140, 150] : [220, 120, 30])))
    expect(gains).toEqual([1, 1, 1])
  })

  it('ne touche pas à l’opacité, et ne lève pas d’erreur sur une image vide', () => {
    const corrigee = ameliorer(image(100, (i) => [i, i, i]))
    for (let i = 3; i < corrigee.length; i += 4) expect(corrigee[i]).toBe(255)
    expect(mesurerLumiere(new Uint8ClampedArray(0))).toEqual({ gains: [1, 1, 1], noir: 0, blanc: 255 })
  })
})
