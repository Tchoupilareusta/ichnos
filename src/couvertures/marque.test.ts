import { estMarquee, marquer } from './marque'

/** Un JPEG minimal : début d'image, en-tête JFIF, une table, début des données, fin d'image. */
function jpeg(options: { jfif?: boolean; poids?: number } = {}): Blob {
  const octets: number[] = [0xff, 0xd8]
  if (options.jfif !== false) octets.push(0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00)
  octets.push(0xff, 0xdb, 0x00, 0x04, 0x00, 0x01)
  octets.push(0xff, 0xda, 0x00, 0x02)
  const donnees = new Uint8Array(options.poids ?? 8).fill(0x55)
  return new Blob([new Uint8Array(octets), donnees, new Uint8Array([0xff, 0xd9])], { type: 'image/jpeg' })
}

const octetsDe = async (image: Blob) => [...new Uint8Array(await image.arrayBuffer())]

describe('la marque invisible d’une couverture cadrée à la main', () => {
  it('une image ordinaire ne la porte pas', async () => {
    expect(await estMarquee(jpeg())).toBe(false)
  })

  it('une image marquée la porte, et reste un JPEG', async () => {
    const marquee = await marquer(jpeg())
    expect(marquee.type).toBe('image/jpeg')
    expect(await estMarquee(marquee)).toBe(true)
  })

  it('s’écrit dans un commentaire JPEG, juste après l’en-tête, sans toucher au reste de l’image', async () => {
    const origine = await octetsDe(jpeg())
    const marquee = await octetsDe(await marquer(jpeg()))
    // Début d'image et en-tête JFIF inchangés (20 octets), puis le commentaire (FF FE).
    expect(marquee.slice(0, 20)).toEqual(origine.slice(0, 20))
    expect(marquee.slice(20, 22)).toEqual([0xff, 0xfe])
    const longueur = marquee[22] * 256 + marquee[23]
    expect(new TextDecoder().decode(new Uint8Array(marquee.slice(24, 22 + longueur)))).toBe('Ichnos : cadrée à la main')
    // Tout le reste suit, à l'identique.
    expect(marquee.slice(22 + longueur)).toEqual(origine.slice(20))
  })

  it('sans en-tête JFIF, s’écrit juste après le début de l’image', async () => {
    const marquee = await octetsDe(await marquer(jpeg({ jfif: false })))
    expect(marquee.slice(0, 4)).toEqual([0xff, 0xd8, 0xff, 0xfe])
    expect(await estMarquee(new Blob([new Uint8Array(marquee)], { type: 'image/jpeg' }))).toBe(true)
  })

  it('ne marque pas deux fois la même image', async () => {
    const une = await marquer(jpeg())
    const deux = await marquer(une)
    expect(deux.size).toBe(une.size)
  })

  it('ne lit que le début du fichier, même pour une image lourde', async () => {
    const lourde = await marquer(jpeg({ poids: 400_000 }))
    let lus = 0
    const espion = new Proxy(lourde, {
      get(cible, cle) {
        if (cle === 'slice') {
          return (debut?: number, fin?: number) => {
            lus += (fin ?? cible.size) - (debut ?? 0)
            return cible.slice(debut, fin)
          }
        }
        const valeur = Reflect.get(cible, cle)
        return typeof valeur === 'function' ? valeur.bind(cible) : valeur
      },
    })
    expect(await estMarquee(espion)).toBe(true)
    expect(lus).toBeLessThanOrEqual(1024)
  })

  it('une image qui n’est pas un JPEG n’est jamais marquée, ni dite marquée', async () => {
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])], { type: 'image/png' })
    expect(await estMarquee(png)).toBe(false)
    expect(await marquer(png)).toBe(png)
    expect(await estMarquee(new Blob([]))).toBe(false)
  })

  it('un commentaire d’un autre logiciel n’est pas la marque', async () => {
    const texte = [...new TextEncoder().encode('Fait avec un autre logiciel')]
    const autre = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xfe, 0x00, texte.length + 2, ...texte, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9])], { type: 'image/jpeg' })
    expect(await estMarquee(autre)).toBe(false)
  })
})
