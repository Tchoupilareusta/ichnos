export type Ecran =
  | 'accueil'
  | 'bibliotheque'
  | 'decouvrir'
  | 'ajouter'
  | 'reglages'
  | 'oeuvre'
  | 'modifier'
  | 'introuvable'

/** L'écran, l'œuvre concernée s'il y en a une, et les paramètres (filtres de la bibliothèque). */
export type Route = { ecran: Ecran; id: string | null; parametres: URLSearchParams }

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
  /** Le formulaire complet, sans recherche automatique. */
  ajouterManuel: '#/ajouter?mode=manuel',
  reglages: '#/reglages',
  oeuvre: (id: string) => `#/oeuvre/${encodeURIComponent(id)}`,
  modifier: (id: string) => `#/oeuvre/${encodeURIComponent(id)}/modifier`,
} as const

/** Traduit le hash de l'adresse (« #/oeuvre/abc/modifier ») en route. */
export function routeDepuisHash(hash: string): Route {
  const [brut, requete = ''] = hash.replace(/^#/, '').split('?')
  const chemin = brut.replace(/\/+$/, '') || '/'
  const normal = chemin.startsWith('/') ? chemin : `/${chemin}`
  const parametres = new URLSearchParams(requete)

  const oeuvre = /^\/oeuvre\/([^/]+)(\/modifier)?$/.exec(normal)
  if (oeuvre) {
    let id: string
    try {
      id = decodeURIComponent(oeuvre[1])
    } catch {
      return { ecran: 'introuvable', id: null, parametres }
    }
    return { ecran: oeuvre[2] ? 'modifier' : 'oeuvre', id, parametres }
  }
  return { ecran: CHEMINS[normal] ?? 'introuvable', id: null, parametres }
}

/** Traduit le hash de l'adresse (« #/decouvrir ») en écran. */
export const ecranDepuisHash = (hash: string): Ecran => routeDepuisHash(hash).ecran

/** Écran de la barre de navigation à mettre en avant : une fiche fait partie de la bibliothèque. */
export const ongletDe = (ecran: Ecran): Ecran => (ecran === 'oeuvre' || ecran === 'modifier' ? 'bibliotheque' : ecran)
