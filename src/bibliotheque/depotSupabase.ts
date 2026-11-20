import type { SupabaseClient } from '@supabase/supabase-js'
import { titresAffiches } from '../catalogue/titres'
import { cibleCouverture, couvertureAffichee } from '../couvertures/choix'
import type { CouvertureRangee, Depot, EchecEcriture, EnCours, Etiquette, ManqueCouverture, OeuvreDetaillee, OeuvreListee } from './depot'
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
import type { Appreciation, Evenement, LectureTome, PrecisionDate, StatutMedia, TypeEvenement, Unite } from './suivi'

/** La seule partie du client Supabase dont la bibliothèque a besoin. */
export type ClientDonnees = Pick<SupabaseClient, 'from' | 'rpc'>

type ErreurBase = { code?: string; message?: string; details?: string | null }

/** Code rendu par la fonction importer_catalogue quand la bibliothèque contient déjà des œuvres. */
const DEJA_INSTALLE = 'IC001'
/** Codes rendus par enregistrer_oeuvre, changer_statut, noter_progression et dater_fin (supabase/migrations). */
const FICHE_INCOHERENTE = 'EO001'
const OEUVRE_INTROUVABLE = 'EO002'
/** Code rendu par noter_achat quand l'ISBN est déjà porté ailleurs dans ma bibliothèque. */
const ISBN_AILLEURS = 'EO003'

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
  cover_path?: string | null
  work_authors: UnOuPlusieurs<LienAuteur>
  work_tags?: UnOuPlusieurs<LienEtiquette>
  volumes?: UnOuPlusieurs<{ number?: number; ownership: Possession; reading_status?: LectureTome; cover_path?: string | null }>
  library_entries: UnOuPlusieurs<{
    reading_status?: Statut
    ownership?: Possession
    editions: UnOuPlusieurs<{ language: string | null; cover_path?: string | null }>
  }>
}

// Les couvertures voyagent avec la liste : aucune requête de plus pour la grille.
const COLONNES =
  'id, title_fr, title_original, original_language, is_series, cover_path, work_authors(role, authors(name)), work_tags(tags(kind, name)), volumes(number, ownership, reading_status, cover_path), library_entries(reading_status, ownership, editions(language, cover_path))'

type TomeIllustre = { number?: number; reading_status?: LectureTome; cover_path?: string | null }
const tomesIllustres = (tomes: UnOuPlusieurs<TomeIllustre>) =>
  tous(tomes).map((t) => ({ numero: t.number ?? 0, lecture: t.reading_status ?? ('a_lire' as const), couverture: t.cover_path ?? null }))

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
    couverture: couvertureAffichee({
      estSerie,
      oeuvre: ligne.cover_path ?? null,
      monEdition: premier(entree?.editions)?.cover_path ?? null,
      tomes: tomesIllustres(ligne.volumes),
    }),
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
  cover_path?: string | null
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
  cover_path?: string | null
}
type LigneTome = {
  number: number
  title: string | null
  isbn: string | null
  ownership: Possession
  reading_status: LectureTome
  cover_path?: string | null
}
type LigneMedia = {
  id: string
  kind: TypeMedia
  title: string | null
  seasons: number | null
  episodes_total: number | null
  episodes_watched: number | null
  status: string
}
type LigneEvenement = { kind: TypeEvenement; value: number | null; occurred_at: string; date_precision: PrecisionDate }
type LigneEntree = {
  reading_status: Statut
  ownership: Possession
  edition_id: string | null
  progress_unit: Unite | null
  progress_current: number | null
  progress_total: number | null
  appreciation: Appreciation | null
  reading_events?: UnOuPlusieurs<LigneEvenement>
}

const COLONNES_ENTREE =
  'reading_status, ownership, edition_id, progress_unit, progress_current, progress_total, appreciation, reading_events(kind, value, occurred_at, date_precision)'

/** « en pause » ou « abandonné » (anciennes valeurs possibles d'un média) se lisent « en cours ». */
const statutMedia = (statut: string): StatutMedia => (statut === 'a_voir' || statut === 'termine' ? statut : 'en_cours')

const versEvenements = (lignes: UnOuPlusieurs<LigneEvenement>): Evenement[] =>
  tous(lignes)
    .map((e) => ({ type: e.kind, valeur: e.value, date: e.occurred_at, precision: e.date_precision }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

// ---------------------------------------------------------------------------
// Lectures en cours (accueil)
// ---------------------------------------------------------------------------

type LigneEnCours = {
  appreciation: Appreciation | null
  progress_unit: Unite | null
  progress_current: number | null
  progress_total: number | null
  editions: UnOuPlusieurs<{ page_count: number | null; language: string | null; cover_path?: string | null }>
  works: UnOuPlusieurs<{
    id: string
    title_fr: string
    title_original: string | null
    original_language: string | null
    is_series: boolean
    cover_path?: string | null
    work_authors: UnOuPlusieurs<LienAuteur>
    volumes: UnOuPlusieurs<{ number: number; reading_status: LectureTome; cover_path?: string | null }>
  }>
}

const COLONNES_EN_COURS =
  'appreciation, progress_unit, progress_current, progress_total, updated_at, editions(page_count, language, cover_path), works(id, title_fr, title_original, original_language, is_series, cover_path, work_authors(role, authors(name)), volumes(number, reading_status, cover_path))'

export function versEnCours(ligne: LigneEnCours): EnCours | null {
  const oeuvre = premier(ligne.works)
  if (!oeuvre) return null
  const edition = premier(ligne.editions)
  return {
    id: oeuvre.id,
    titre: titresAffiches(oeuvre, edition?.language).principal,
    auteurs: nomsAuteurs(oeuvre.work_authors),
    estSerie: oeuvre.is_series,
    unite: ligne.progress_unit,
    position: ligne.progress_current,
    total: ligne.progress_total,
    pagesEdition: edition?.page_count ?? null,
    tomes: tous(oeuvre.volumes)
      .map((v) => ({ numero: v.number, lecture: v.reading_status }))
      .sort((a, b) => a.numero - b.numero),
    appreciation: ligne.appreciation ?? null,
    couverture: couvertureAffichee({
      estSerie: oeuvre.is_series,
      oeuvre: oeuvre.cover_path ?? null,
      monEdition: edition?.cover_path ?? null,
      tomes: tomesIllustres(oeuvre.volumes),
    }),
  }
}

const COLONNES_FICHE =
  'id, title_fr, title_original, original_language, first_published_year, form, synopsis, tone, density, length, is_series, cover_path, work_authors(role, authors(name)), work_tags(tags(kind, name, is_interest))'

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
    couverture: oeuvre.cover_path ?? null,
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
      couverture: e.cover_path ?? null,
    })),
    tomes: [...tomes]
      .sort((a, b) => a.number - b.number)
      .map((t) => ({
        numero: t.number,
        titre: t.title,
        isbn: t.isbn,
        possession: t.ownership,
        lecture: t.reading_status,
        couverture: t.cover_path ?? null,
      })),
    medias: medias.map((m) => ({
      id: m.id,
      type: m.kind,
      titre: m.title,
      saisons: m.seasons,
      episodes: m.episodes_total,
      episodesVus: m.episodes_watched,
      statut: statutMedia(m.status),
    })),
    statut: entree?.reading_status ?? 'a_decouvrir',
    possession: entree?.ownership ?? 'non_possede',
    monEdition: entree?.edition_id ?? null,
    unite: entree?.progress_unit ?? null,
    position: entree?.progress_current ?? null,
    total: entree?.progress_total ?? null,
    appreciation: entree?.appreciation ?? null,
    historique: versEvenements(entree?.reading_events),
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

  /** Une fonction de la base, en tout ou rien. */
  async function appeler(fonction: string, parametres: Record<string, unknown>) {
    const { error } = await client.rpc(fonction, parametres)
    if (error) return { ok: false as const, echec: echecEcriture(error) }
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

    async listerEnCours() {
      const { data, error } = await client
        .from('library_entries')
        .select(COLONNES_EN_COURS)
        .eq('reading_status', 'en_cours')
        .order('updated_at', { ascending: false })
      if (error) return { ok: false, echec: echecLecture(error) }
      const lectures = ((data ?? []) as unknown as LigneEnCours[]).map(versEnCours).filter((l): l is EnCours => l !== null)
      return { ok: true, lectures }
    },

    async lireOeuvre(id) {
      // Cinq lectures en parallèle, chacune limitée à cette œuvre (et, par la RLS, à mes lignes).
      const [oeuvre, editions, tomes, medias, entree] = await Promise.all([
        client.from('works').select(COLONNES_FICHE).eq('id', id).maybeSingle(),
        client.from('editions').select('id, isbn, publisher, language, format, translator, page_count, cover_path, created_at').eq('work_id', id).order('created_at'),
        client.from('volumes').select('number, title, isbn, ownership, reading_status, cover_path').eq('work_id', id).order('number'),
        client.from('media').select('id, kind, title, seasons, episodes_total, episodes_watched, status, created_at').eq('work_id', id).order('created_at'),
        client.from('library_entries').select(COLONNES_ENTREE).eq('work_id', id).maybeSingle(),
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

    changerStatut: (id, statut) => appeler('changer_statut', { oeuvre: id, statut }),

    noterProgression: (id, valeur) => appeler('noter_progression', { oeuvre: id, valeur }),

    // Une nouvelle unité : la position repart de zéro (« p. 75 » ne veut rien dire en lettres).
    changerUnite: (id, unite, total) => ecrireEntree(id, { progress_unit: unite, progress_total: total, progress_current: null }),

    changerTotal: (id, total) => ecrireEntree(id, { progress_total: total }),

    daterFin: (id, date, precision) => appeler('dater_fin', { oeuvre: id, jour: date, precision_date: date ? precision : null }),

    changerAppreciation: (id, appreciation) => ecrireEntree(id, { appreciation }),


    async changerMedia(id, media, valeurs) {
      const changement: Record<string, unknown> = {}
      if (valeurs.vus !== undefined) changement.episodes_watched = valeurs.vus
      if (valeurs.statut !== undefined) changement.status = valeurs.statut
      const { data, error } = await client.from('media').update(changement).eq('id', media).eq('work_id', id).select('id')
      if (error) return { ok: false, echec: echecEcriture(error) }
      if (!data || data.length === 0) return { ok: false, echec: 'introuvable' }
      return { ok: true }
    },

    changerPossession: (id, possession) => ecrireEntree(id, { ownership: possession }),

    changerMonEdition: (id, edition) => ecrireEntree(id, { edition_id: edition }),

    reglerTomes: (id, changements) => appeler('regler_tomes', { oeuvre: id, changements }),

    async noterAchat(id, achat) {
      const { data, error } = await client.rpc('noter_achat', { oeuvre: id, achat })
      if (error) return { ok: false, echec: error.code === ISBN_AILLEURS ? 'isbn_ailleurs' : echecEcriture(error) }
      // L'identifiant de l'édition devenue la mienne, ou rien pour un tome.
      if (data !== null && typeof data !== 'string') return { ok: false, echec: 'inconnu' }
      return { ok: true, edition: data }
    },

    async supprimerOeuvre(id) {
      // Les éditions, tomes, médias, notes et l'historique partent avec l'œuvre (on delete cascade).
      const { data, error } = await client.from('works').delete().eq('id', id).select('id')
      if (error) return { ok: false, echec: echecEcriture(error) }
      if (!data || data.length === 0) return { ok: false, echec: 'introuvable' }
      return { ok: true }
    },

    async definirCouverture(id, cible, chemin) {
      const valeurs = { cover_path: chemin }
      // Chaque écriture vise une ligne de cette œuvre ; la RLS la limite à mes lignes.
      const requete =
        cible.type === 'oeuvre'
          ? client.from('works').update(valeurs).eq('id', id).select('id')
          : cible.type === 'edition'
            ? client.from('editions').update(valeurs).eq('id', cible.edition).eq('work_id', id).select('id')
            : client.from('volumes').update(valeurs).eq('work_id', id).eq('number', cible.numero).select('number')
      const { data, error } = await requete
      if (error) return { ok: false, echec: echecEcriture(error) }
      if (!data || data.length === 0) return { ok: false, echec: 'introuvable' }
      return { ok: true }
    },

    async trouverParIsbn(isbn) {
      const [editions, tomes] = await Promise.all([
        client.from('editions').select('work_id').eq('isbn', isbn),
        client.from('volumes').select('work_id, number').eq('isbn', isbn),
      ])
      const erreur = editions.error ?? tomes.error
      if (erreur) return { ok: false, echec: echecLecture(erreur) }
      const edition = ((editions.data ?? []) as { work_id: string }[])[0]
      if (edition) return { ok: true, trouve: { id: edition.work_id, tome: null } }
      const tome = ((tomes.data ?? []) as { work_id: string; number: number }[])[0]
      return { ok: true, trouve: tome ? { id: tome.work_id, tome: tome.number } : null }
    },

    async listerSansCouverture() {
      // Quatre lectures simples, assemblées ici : mes œuvres, mes éditions, mes tomes, et mon édition de chacune.
      const [oeuvres, entrees, editions, tomes] = await Promise.all([
        client.from('works').select('id, title_fr, is_series, cover_path'),
        client.from('library_entries').select('work_id, edition_id'),
        client.from('editions').select('id, work_id, isbn, cover_path, created_at').order('created_at'),
        client.from('volumes').select('work_id, number, isbn, cover_path').order('number'),
      ])
      const erreur = oeuvres.error ?? entrees.error ?? editions.error ?? tomes.error
      if (erreur) return { ok: false, echec: echecLecture(erreur) }

      type Oeuvre = { id: string; title_fr: string; is_series: boolean; cover_path: string | null }
      type EditionLue = { id: string; work_id: string; isbn: string | null; cover_path: string | null }
      type TomeLu = { work_id: string; number: number; isbn: string | null; cover_path: string | null }
      const monEditionDe = new Map(((entrees.data ?? []) as { work_id: string; edition_id: string | null }[]).map((e) => [e.work_id, e.edition_id]))
      const lesEditions = (editions.data ?? []) as EditionLue[]
      const lesTomes = (tomes.data ?? []) as TomeLu[]

      const manques: ManqueCouverture[] = []
      const parTitre = [...((oeuvres.data ?? []) as Oeuvre[])].sort((a, b) => comparerTitres(a.title_fr, b.title_fr))
      for (const oeuvre of parTitre) {
        if (oeuvre.is_series) {
          for (const tome of lesTomes.filter((t) => t.work_id === oeuvre.id && !t.cover_path).sort((a, b) => a.number - b.number)) {
            manques.push({ oeuvre: oeuvre.id, titre: oeuvre.title_fr, tome: tome.number, isbn: tome.isbn, cible: { type: 'tome', numero: tome.number } })
          }
          continue
        }
        const siennes = lesEditions.filter((e) => e.work_id === oeuvre.id)
        const monEdition = monEditionDe.get(oeuvre.id) ?? null
        const mienne = siennes.find((e) => e.id === monEdition)
        if (oeuvre.cover_path || mienne?.cover_path) continue
        // L'ISBN de mon édition d'abord ; à défaut, celui d'une autre édition de l'œuvre.
        const avecIsbn = mienne?.isbn ? mienne : siennes.find((e) => e.isbn)
        manques.push({
          oeuvre: oeuvre.id,
          titre: oeuvre.title_fr,
          tome: null,
          isbn: avecIsbn?.isbn ?? null,
          cible: cibleCouverture({ edition: avecIsbn?.id ?? null, monEdition }),
        })
      }
      return { ok: true, manques }
    },

    async listerCouvertures() {
      const [oeuvres, editions, tomes] = await Promise.all([
        client.from('works').select('id, title_fr, cover_path'),
        client.from('editions').select('id, work_id, isbn, cover_path, created_at').order('created_at'),
        client.from('volumes').select('work_id, number, isbn, cover_path').order('number'),
      ])
      const erreur = oeuvres.error ?? editions.error ?? tomes.error
      if (erreur) return { ok: false, echec: echecLecture(erreur) }

      type Oeuvre = { id: string; title_fr: string; cover_path: string | null }
      type EditionLue = { id: string; work_id: string; isbn: string | null; cover_path: string | null }
      type TomeLu = { work_id: string; number: number; isbn: string | null; cover_path: string | null }
      const lesEditions = (editions.data ?? []) as EditionLue[]
      const lesTomes = (tomes.data ?? []) as TomeLu[]

      const couvertures: CouvertureRangee[] = []
      const parTitre = [...((oeuvres.data ?? []) as Oeuvre[])].sort((a, b) => comparerTitres(a.title_fr, b.title_fr))
      for (const oeuvre of parTitre) {
        const commun = { oeuvre: oeuvre.id, titre: oeuvre.title_fr }
        // Sur l'œuvre : la couverture n'est celle d'aucune édition précise, donc sans ISBN.
        if (oeuvre.cover_path) couvertures.push({ ...commun, tome: null, chemin: oeuvre.cover_path, isbn: null, cible: { type: 'oeuvre' } })
        for (const edition of lesEditions.filter((e) => e.work_id === oeuvre.id && e.cover_path)) {
          couvertures.push({ ...commun, tome: null, chemin: edition.cover_path as string, isbn: edition.isbn, cible: { type: 'edition', edition: edition.id } })
        }
        for (const tome of lesTomes.filter((t) => t.work_id === oeuvre.id && t.cover_path).sort((a, b) => a.number - b.number)) {
          couvertures.push({ ...commun, tome: tome.number, chemin: tome.cover_path as string, isbn: tome.isbn, cible: { type: 'tome', numero: tome.number } })
        }
      }
      return { ok: true, couvertures }
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
