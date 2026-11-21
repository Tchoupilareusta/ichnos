// Pour les tests de l'algorithme : mon vrai catalogue (catalogue/catalogue-initial.json, public),
// avec des situations de lecture écrites par chaque test. Mes vrais statuts restent hors du dépôt.
import fichier from '../../catalogue/catalogue-initial.json'
import type { Forme, Longueur } from '../bibliotheque/modele'
import type { OeuvreIdee } from './modele'

type Brut = {
  key: string
  title_fr: string
  form: string
  is_series: boolean
  tone: number
  density: number
  length: string
  authors: { name: string; role: string }[]
  genres: string[]
  themes: string[]
  atmospheres: string[]
}

const catalogue = fichier as unknown as {
  tags: { genre: string[]; atmosphere: string[]; theme: { name: string; is_interest?: boolean }[] }
  works: Brut[]
}

export const VOCABULAIRE = {
  genres: catalogue.tags.genre,
  atmospheres: catalogue.tags.atmosphere,
  themes: catalogue.tags.theme.map((t) => t.name),
}

const parNom = (noms: string[]) => [...noms].sort((a, b) => a.localeCompare(b, 'fr'))
const COEUR = new Set(catalogue.tags.theme.filter((t) => t.is_interest).map((t) => t.name))

/**
 * Les 35 œuvres du catalogue, toutes « À découvrir » et « Je ne l'ai pas », sauf celles dont
 * `etats` change la situation (par titre français). Un titre inconnu arrête le test : pas de
 * faute de frappe silencieuse.
 */
export function catalogueEssai(etats: Record<string, Partial<OeuvreIdee>> = {}): OeuvreIdee[] {
  const titres = new Set(catalogue.works.map((w) => w.title_fr))
  for (const titre of Object.keys(etats)) if (!titres.has(titre)) throw new Error(`Titre absent du catalogue : ${titre}`)
  return catalogue.works.map((w) => ({
    id: w.key,
    titre: w.title_fr,
    auteurs: w.authors.filter((a) => a.role === 'auteur').map((a) => a.name),
    forme: w.form as Forme,
    tonalite: w.tone,
    exigence: w.density,
    longueur: w.length as Longueur,
    estSerie: w.is_series,
    // Comme le dépôt : la base ne garde pas d'ordre, les étiquettes arrivent par ordre alphabétique.
    genres: parNom(w.genres),
    themes: parNom(w.themes).map((nom) => ({ nom, coeur: COEUR.has(nom) })),
    atmospheres: parNom(w.atmospheres),
    statut: 'a_decouvrir',
    possession: 'non_possede',
    appreciation: null,
    toucheeLe: null,
    finieLe: null,
    couverture: null,
    ...etats[w.title_fr],
  }))
}
