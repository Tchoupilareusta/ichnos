export type Ecran = 'accueil' | 'bibliotheque' | 'decouvrir' | 'ajouter' | 'reglages' | 'introuvable'

const CHEMINS: Record<string, Ecran> = {
  '/': 'accueil',
  '/bibliotheque': 'bibliotheque',
  '/decouvrir': 'decouvrir',
  '/ajouter': 'ajouter',
  '/reglages': 'reglages',
}

export const LIENS = {
  accueil: '#/',
  bibliotheque: '#/bibliotheque',
  decouvrir: '#/decouvrir',
  ajouter: '#/ajouter',
  reglages: '#/reglages',
} as const

/** Traduit le hash de l'adresse (« #/decouvrir ») en écran. */
export function ecranDepuisHash(hash: string): Ecran {
  const chemin = hash.replace(/^#/, '').split('?')[0].replace(/\/+$/, '') || '/'
  return CHEMINS[chemin.startsWith('/') ? chemin : `/${chemin}`] ?? 'introuvable'
}
