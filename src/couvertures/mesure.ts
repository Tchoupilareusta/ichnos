/**
 * La taille d'une image en pixels, mesurée sur l'appareil : une adresse déjà affichable
 * (« blob: ») ou une image pas encore rangée. Null si l'image ne se lit pas.
 */
export async function tailleImage(source: string | Blob): Promise<{ largeur: number; hauteur: number } | null> {
  const adresse = typeof source === 'string' ? source : URL.createObjectURL(source)
  try {
    const image = new Image()
    image.src = adresse
    await image.decode()
    return image.naturalWidth > 0 && image.naturalHeight > 0 ? { largeur: image.naturalWidth, hauteur: image.naturalHeight } : null
  } catch {
    return null
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(adresse)
  }
}
