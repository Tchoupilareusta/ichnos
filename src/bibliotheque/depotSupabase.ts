import type { SupabaseClient } from '@supabase/supabase-js'
import { titresAffiches } from '../catalogue/titres'
import type { Depot, OeuvreListee } from './depot'
import { preparerEnvoi, type FichierCatalogue } from './envoiCatalogue'

/** La seule partie du client Supabase dont la bibliothèque a besoin. */
export type ClientDonnees = Pick<SupabaseClient, 'from' | 'rpc'>

type ErreurBase = { code?: string; message?: string; details?: string | null }

/** Code rendu par la fonction importer_catalogue quand la bibliothèque contient déjà des œuvres. */
const DEJA_INSTALLE = 'IC001'

// Sans réseau, supabase-js ne reçoit aucune réponse : l'erreur n'a pas de code et rapporte l'échec de la requête.
const estSansReseau = (erreur: ErreurBase) =>
  !erreur.code && /failed to fetch|load failed|networkerror|fetch/i.test(`${erreur.message ?? ''} ${erreur.details ?? ''}`)

// Selon la relation, l'API rend un objet ou une liste : on accepte les deux.
type UnOuPlusieurs<T> = T | T[] | null
const premier = <T>(valeur: UnOuPlusieurs<T>): T | null => (Array.isArray(valeur) ? (valeur[0] ?? null) : valeur)
const tous = <T>(valeur: UnOuPlusieurs<T>): T[] => (Array.isArray(valeur) ? valeur : valeur ? [valeur] : [])

type LigneOeuvre = {
  id: string
  title_fr: string
  title_original: string | null
  original_language: string | null
  work_authors: UnOuPlusieurs<{ role: string; authors: UnOuPlusieurs<{ name: string }> }>
  library_entries: UnOuPlusieurs<{ editions: UnOuPlusieurs<{ language: string | null }> }>
}

const COLONNES =
  'id, title_fr, title_original, original_language, work_authors(role, authors(name)), library_entries(editions(language))'

export function versOeuvreListee(ligne: LigneOeuvre): OeuvreListee {
  const langueEdition = premier(premier(ligne.library_entries)?.editions ?? null)?.language
  const { principal, secondaire } = titresAffiches(ligne, langueEdition)
  const auteurs = tous(ligne.work_authors)
    .filter((lien) => lien.role === 'auteur')
    .map((lien) => premier(lien.authors)?.name)
    .filter((nom): nom is string => !!nom)
  return { id: ligne.id, titre: principal, titreSecondaire: secondaire, auteurs }
}

/**
 * La bibliothèque sur Supabase. Chaque lecture et chaque écriture passe par la RLS :
 * le compte connecté ne voit et ne modifie que ses propres lignes.
 * `chargerCatalogue` va chercher le fichier public du catalogue de départ, au moment de l'installer.
 */
export function creerDepotSupabase(client: ClientDonnees, chargerCatalogue: () => Promise<FichierCatalogue>): Depot {
  return {
    async listerOeuvres() {
      const { data, error } = await client.from('works').select(COLONNES)
      if (error) return { ok: false, echec: estSansReseau(error) ? 'reseau' : 'inconnu' }
      const oeuvres = ((data ?? []) as unknown as LigneOeuvre[])
        .map(versOeuvreListee)
        .sort((a, b) => a.titre.localeCompare(b.titre, 'fr', { numeric: true, sensitivity: 'base' }))
      return { ok: true, oeuvres }
    },

    async installerCatalogue() {
      let fichier: FichierCatalogue
      try {
        fichier = await chargerCatalogue()
      } catch {
        // Le fichier du catalogue se télécharge depuis le site : sans réseau, il n'arrive pas.
        return { ok: false, echec: 'reseau' }
      }
      const { error } = await client.rpc('importer_catalogue', { catalogue: preparerEnvoi(fichier) })
      if (!error) return { ok: true }
      if (error.code === DEJA_INSTALLE) return { ok: false, echec: 'deja' }
      return { ok: false, echec: estSansReseau(error) ? 'reseau' : 'inconnu' }
    },
  }
}
