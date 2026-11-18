import type { SupabaseClient } from '@supabase/supabase-js'
import { titresAffiches } from '../catalogue/titres'
import type { ChoixTomes, Depot, EchecEcriture, Etiquette, OeuvreDetaillee, OeuvreListee } from './depot'
import { preparerEnvoi, type FichierCatalogue } from './envoiCatalogue'
import {
  comparerTitres,
  possessionAffichee,
  possessionsFiltrables,
  type Forme,
  type GenreEtiquette,
  type Longueur,
  type Possession,
  type Role,
  type Statut,
  type TypeMedia,
} from './modele'

/** La seule partie du client Supabase dont la bibliothèque a besoin. */
export type ClientDonnees = Pick<SupabaseClient, 'from' | 'rpc'>

type ErreurBase = { code?: string; message?: string; details?: string | null }

/** Code rendu par la fonction importer_catalogue quand la bibliothèque contient déjà des œuvres. */
const DEJA_INSTALLE = 'IC001'
/** Codes rendus par la fonction enregistrer_oeuvre (supabase/migrations). */
const FICHE_INCOHERENTE = 'EO001'
const OEUVRE_INTROUVABLE = 'EO002'

// Sans réseau, supabase-js ne reçoit aucune réponse : l'erreur n'a pas de code et rapporte l'échec de la requête.
const estSansReseau = (erreur: ErreurBase) =>
  !erreur.code && /failed to fetch|load failed|networkerror|fetch/i.test(`${erreur.message ?? ''} ${erreur.details ?? ''}`)

const echecLecture = (erreur: ErreurBase) => (estSansReseau(erreur) ? ('reseau' as const) : ('inconnu' as const))

function echecEcriture(erreur: ErreurBase): EchecEcriture {
  if (estSansReseau(erreur)) return 'reseau'
  if (erreur.code === OEUVRE_INTROUVABLE) return 'introuvable'
  // Fiche incohérente, contrainte d'une table, valeur mal formée : la base a refusé une valeur.
  if (erreur.code === FICHE_INCOHERENTE || erreur.code === '23514' || erreur.code === '23505' || erreur.code?.startsWith('22'))
    return 'invalide'
  return 'inconnu'
}

// Selon la relation, l'API rend un objet ou une liste : on accepte les deux.
type UnOuPlusieurs<T> = T | T[] | null | undefined
const premier = <T>(valeur: UnOuPlusieurs<T>): T | null => (Array.isArray(valeur) ? (valeur[0] ?? null) : (valeur ?? null))
const tous = <T>(valeur: UnOuPlusieurs<T>): T[] => (Array.isArray(valeur) ? valeur : valeur ? [valeur] : [])

type LienAuteur = { role: string; authors: UnOuPlusieurs<{ name: string }> }
type LienEtiquette = { tags: UnOuPlusieurs<{ kind: string; name: string; is_interest?: boolean }> }

const nomsAuteurs = (liens: UnOuPlusieurs<LienAuteur>) =>
  tous(liens)
    .filter((lien) => lien.role === 'auteur')
    .map((lien) => premier(lien.authors)?.name)
    .filter((nom): nom is string => !!nom)

const etiquettes = (liens: UnOuPlusieurs<LienEtiquette>): Etiquette[] =>
  tous(liens)
    .map((lien) => premier(lien.tags))
    .filter((tag): tag is { kind: string; name: string; is_interest?: boolean } => !!tag)
    .map((tag) => ({ genre: tag.kind as GenreEtiquette, nom: tag.name, coeur: !!tag.is_interest }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

const nomsDuGenre = (liste: Etiquette[], genre: GenreEtiquette) => liste.filter((e) => e.genre === genre).map((e) => e.nom)

// ---------------------------------------------------------------------------
// Liste de la bibliothèque
// ---------------------------------------------------------------------------

type LigneOeuvre = {
  id: string
  title_fr: string
  title_original: string | null
  original_language: string | null
  is_series?: boolean
  work_authors: UnOuPlusieurs<LienAuteur>
  work_tags?: UnOuPlusieurs<LienEtiquette>
  volumes?: UnOuPlusieurs<{ ownership: Possession }>
  library_entries: UnOuPlusieurs<{
    reading_status?: Statut
    ownership?: Possession
    editions: UnOuPlusieurs<{ language: string | null }>
  }>
}

const COLONNES =
  'id, title_fr, title_original, original_language, is_series, work_authors(role, authors(name)), work_tags(tags(kind, name)), volumes(ownership), library_entries(reading_status, ownership, editions(language))'

export function versOeuvreListee(ligne: LigneOeuvre): OeuvreListee {
  const entree = premier(ligne.library_entries)
  const { principal, secondaire } = titresAffiches(ligne, premier(entree?.editions)?.language)
  const lesEtiquettes = etiquettes(ligne.work_tags)
  const possession = entree?.ownership ?? 'non_possede'
  const estSerie = !!ligne.is_series
  const tomes = tous(ligne.volumes).map((tome) => tome.ownership)
  return {
    id: ligne.id,
    titre: principal,
    titreSecondaire: secondaire,
    auteurs: nomsAuteurs(ligne.work_authors),
    genres: nomsDuGenre(lesEtiquettes, 'genre'),
    themes: nomsDuGenre(lesEtiquettes, 'theme'),
    atmospheres: nomsDuGenre(lesEtiquettes, 'atmosphere'),
    statut: entree?.reading_status ?? 'a_decouvrir',
    possession: possessionAffichee(possession, estSerie, tomes),
    possessionsFiltrables: possessionsFiltrables(possession, estSerie, tomes),
  }
}

// ---------------------------------------------------------------------------
// Fiche d'une œuvre
// ---------------------------------------------------------------------------

type LigneFiche = {
  id: string
  title_fr: string
  title_original: string | null
  original_language: string | null
  first_published_year: number | null
  form: Forme
  synopsis: string | null
  tone: number | null
  density: number | null
  length: Longueur | null
  is_series: boolean
  work_authors: UnOuPlusieurs<LienAuteur>
  work_tags: UnOuPlusieurs<LienEtiquette>
}
type LigneEdition = {
  id: string
  isbn: string | null
  publisher: string | null
  language: string | null
  format: string | null
  translator: string | null
  page_count: number | null
}
type LigneTome = { number: number; title: string | null; isbn: string | null; ownership: Possession }
type LigneMedia = {
  id: string
  kind: TypeMedia
  title: string | null
  seasons: number | null
  episodes_total: number | null
  episodes_watched: number | null
}
type LigneEntree = { reading_status: Statut; ownership: Possession; edition_id: string | null }

const COLONNES_FICHE =
  'id, title_fr, title_original, original_language, first_published_year, form, synopsis, tone, density, length, is_series, work_authors(role, authors(name)), work_tags(tags(kind, name, is_interest))'

const ORDRE_ROLES: Record<string, number> = { auteur: 0, illustrateur: 1, traducteur: 2 }

export function versOeuvreDetaillee(
  oeuvre: LigneFiche,
  editions: LigneEdition[],
  tomes: LigneTome[],
  medias: LigneMedia[],
  entree: LigneEntree | null,
): OeuvreDetaillee {
  return {
    id: oeuvre.id,
    titreFr: oeuvre.title_fr,
    titreOriginal: oeuvre.title_original,
    langueOriginale: oeuvre.original_language,
    annee: oeuvre.first_published_year,
    forme: oeuvre.form,
    synopsis: oeuvre.synopsis,
    tonalite: oeuvre.tone,
    exigence: oeuvre.density,
    longueur: oeuvre.length,
    estSerie: oeuvre.is_series,
    auteurs: tous(oeuvre.work_authors)
      .map((lien) => ({ nom: premier(lien.authors)?.name ?? '', role: lien.role as Role }))
      .filter((auteur) => auteur.nom)
      .sort((a, b) => (ORDRE_ROLES[a.role] ?? 9) - (ORDRE_ROLES[b.role] ?? 9)),
    etiquettes: etiquettes(oeuvre.work_tags),
    editions: editions.map((e) => ({
      id: e.id,
      isbn: e.isbn,
      publisher: e.publisher,
      language: e.language,
      format: e.format,
      translator: e.translator,
      pageCount: e.page_count,
    })),
    tomes: [...tomes]
      .sort((a, b) => a.number - b.number)
      .map((t) => ({ numero: t.number, titre: t.title, isbn: t.isbn, possession: t.ownership })),
    medias: medias.map((m) => ({
      id: m.id,
      type: m.kind,
      titre: m.title,
      saisons: m.seasons,
      episodes: m.episodes_total,
      episodesVus: m.episodes_watched,
    })),
    statut: entree?.reading_status ?? 'a_decouvrir',
    possession: entree?.ownership ?? 'non_possede',
    monEdition: entree?.edition_id ?? null,
  }
}

/**
 * La bibliothèque sur Supabase. Chaque lecture et chaque écriture passe par la RLS :
 * le compte connecté ne voit et ne modifie que ses propres lignes.
 * `chargerCatalogue` va chercher le fichier public du catalogue de départ, au moment de l'installer.
 */
export function creerDepotSupabase(client: ClientDonnees, chargerCatalogue: () => Promise<FichierCatalogue>): Depot {
  /** Une écriture sur une seule ligne : si la RLS la cache (autre compte, œuvre supprimée), rien ne change. */
  async function ecrireEntree(id: string, valeurs: Record<string, unknown>) {
    const { data, error } = await client.from('library_entries').update(valeurs).eq('work_id', id).select('work_id')
    if (error) return { ok: false as const, echec: echecEcriture(error) }
    if (!data || data.length === 0) return { ok: false as const, echec: 'introuvable' as const }
    return { ok: true as const }
  }

  return {
    async listerOeuvres() {
      const { data, error } = await client.from('works').select(COLONNES)
      if (error) return { ok: false, echec: echecLecture(error) }
      const oeuvres = ((data ?? []) as unknown as LigneOeuvre[])
        .map(versOeuvreListee)
        .sort((a, b) => comparerTitres(a.titre, b.titre))
      return { ok: true, oeuvres }
    },

    async lireOeuvre(id) {
      // Cinq lectures en parallèle, chacune limitée à cette œuvre (et, par la RLS, à mes lignes).
      const [oeuvre, editions, tomes, medias, entree] = await Promise.all([
        client.from('works').select(COLONNES_FICHE).eq('id', id).maybeSingle(),
        client.from('editions').select('id, isbn, publisher, language, format, translator, page_count, created_at').eq('work_id', id).order('created_at'),
        client.from('volumes').select('number, title, isbn, ownership').eq('work_id', id).order('number'),
        client.from('media').select('id, kind, title, seasons, episodes_total, episodes_watched, created_at').eq('work_id', id).order('created_at'),
        client.from('library_entries').select('reading_status, ownership, edition_id').eq('work_id', id).maybeSingle(),
      ])
      const erreur = [oeuvre, editions, tomes, medias, entree].find((reponse) => reponse.error)?.error
      if (erreur) return { ok: false, echec: echecLecture(erreur) }
      if (!oeuvre.data) return { ok: false, echec: 'introuvable' }
      return {
        ok: true,
        oeuvre: versOeuvreDetaillee(
          oeuvre.data as unknown as LigneFiche,
          (editions.data ?? []) as LigneEdition[],
          (tomes.data ?? []) as LigneTome[],
          (medias.data ?? []) as LigneMedia[],
          (entree.data ?? null) as LigneEntree | null,
        ),
      }
    },

    async lireVocabulaire() {
      const [tags, auteurs] = await Promise.all([
        client.from('tags').select('kind, name, is_interest').order('name'),
        client.from('authors').select('name').order('name'),
      ])
      const erreur = tags.error ?? auteurs.error
      if (erreur) return { ok: false, echec: echecLecture(erreur) }
      return {
        ok: true,
        vocabulaire: {
          etiquettes: ((tags.data ?? []) as { kind: GenreEtiquette; name: string; is_interest: boolean }[]).map((t) => ({
            genre: t.kind,
            nom: t.name,
            coeur: t.is_interest,
          })),
          auteurs: ((auteurs.data ?? []) as { name: string }[]).map((a) => a.name),
        },
      }
    },

    async enregistrerOeuvre(fiche) {
      const { data, error } = await client.rpc('enregistrer_oeuvre', { fiche })
      if (error) return { ok: false, echec: echecEcriture(error) }
      if (typeof data !== 'string') return { ok: false, echec: 'inconnu' }
      return { ok: true, id: data }
    },

    changerStatut: (id, statut) => ecrireEntree(id, { reading_status: statut }),

    changerPossession: (id, possession) => ecrireEntree(id, { ownership: possession }),

    changerMonEdition: (id, edition) => ecrireEntree(id, { edition_id: edition }),

    async changerPossessionTomes(id: string, tomes: ChoixTomes, possession: Possession) {
      let requete = client.from('volumes').update({ ownership: possession }).eq('work_id', id)
      if (tomes !== 'tous') requete = requete.gte('number', tomes.de).lte('number', tomes.a)
      const { data, error } = await requete.select('number')
      if (error) return { ok: false, echec: echecEcriture(error) }
      if (!data || data.length === 0) return { ok: false, echec: 'introuvable' }
      return { ok: true }
    },

    async supprimerOeuvre(id) {
      // Les éditions, tomes, médias, notes et l'historique partent avec l'œuvre (on delete cascade).
      const { data, error } = await client.from('works').delete().eq('id', id).select('id')
      if (error) return { ok: false, echec: echecEcriture(error) }
      if (!data || data.length === 0) return { ok: false, echec: 'introuvable' }
      return { ok: true }
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
