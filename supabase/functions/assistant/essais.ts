// Outils des tests de la fonction : fausses images, fausses réponses. Jamais chargé par la fonction en ligne.

/** Un JPEG minimal de la taille voulue : en-tête, dimensions, puis du remplissage. */
export function jpeg(largeur: number, hauteur: number, octets = 6000): Uint8Array {
  const image = new Uint8Array(octets)
  image.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0])
  // Zone SOF0 : longueur, précision, hauteur, largeur.
  image.set([0xff, 0xc0, 0x00, 0x11, 0x08, hauteur >> 8, hauteur & 0xff, largeur >> 8, largeur & 0xff, 3], 20)
  image.set([0xff, 0xd9], octets - 2)
  return image
}

/** Un PNG minimal de la taille voulue : signature, bloc IHDR, puis du remplissage. */
export function png(largeur: number, hauteur: number, octets = 6000): Uint8Array {
  const image = new Uint8Array(octets)
  image.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  const vue = new DataView(image.buffer)
  vue.setUint32(16, largeur)
  vue.setUint32(20, hauteur)
  return image
}

export const reponseImage = (octets: Uint8Array, type = 'image/jpeg') =>
  new Response(octets as unknown as BodyInit, { status: 200, headers: { 'content-type': type } })

export const reponseJson = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { 'content-type': 'application/json' } })
