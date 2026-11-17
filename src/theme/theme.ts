export type ChoixTheme = 'auto' | 'clair' | 'sombre'

const CLE = 'ichnos-theme'
export const COULEUR_BARRE = { clair: '#F5EFE6', sombre: '#151413' } as const

export function lireChoixTheme(): ChoixTheme {
  try {
    const valeur = localStorage.getItem(CLE)
    if (valeur === 'clair' || valeur === 'sombre') return valeur
  } catch {
    // stockage indisponible (navigation privée) : on suit l'appareil
  }
  return 'auto'
}

/** Applique le thème à la page et à la barre d'état, puis le mémorise. */
export function appliquerTheme(choix: ChoixTheme, doc: Document = document): void {
  const racine = doc.documentElement
  if (choix === 'auto') delete racine.dataset.theme
  else racine.dataset.theme = choix === 'clair' ? 'light' : 'dark'

  const metas = doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
  metas.forEach((meta) => {
    if (choix === 'auto') {
      const sombre = (meta.getAttribute('media') ?? '').includes('dark')
      meta.content = sombre ? COULEUR_BARRE.sombre : COULEUR_BARRE.clair
    } else {
      meta.content = COULEUR_BARRE[choix]
    }
  })

  try {
    if (choix === 'auto') localStorage.removeItem(CLE)
    else localStorage.setItem(CLE, choix)
  } catch {
    // sans stockage, le choix vaut pour cette visite seulement
  }
}
