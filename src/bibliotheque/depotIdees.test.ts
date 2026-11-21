import { creerDepotSupabase, type ClientDonnees } from './depotSupabase'
import { depotFictif, oeuvreFictive, versIdee } from './depot.fictif'
import type { FichierCatalogue } from './envoiCatalogue'

// Recommandations (docs/reference.md §7) : ce que le dépôt lit pour l'algorithme, et les deux
// écritures de « Pas maintenant » et de son « Annuler ». Sur Supabase, puis dans le faux dépôt.

type Reponse = { data?: unknown; error?: { code?: string; message?: string } | null }
type Requete = { table: string; etapes: [string, ...unknown[]][] }

/** Faux client Supabase : chaque requête enregistre ses étapes et rend la réponse prévue pour sa table. */
function fauxClient(reponses: Record<string, Reponse> = {}, appel: Reponse = {}) {
  const requetes: Requete[] = []
  const rpc: { nom: string; arguments_: unknown }[] = []
  const client = {
    from(table: string) {
      const requete: Requete = { table, etapes: [] }
      requetes.push(requete)
      const chaine: Record<string, unknown> = {}
      for (const etape of ['select', 'eq', 'order']) {
        chaine[etape] = (...args: unknown[]) => {
          requete.etapes.push([etape, ...args])
          return chaine
        }
      }
      chaine.then = (suite: (r: unknown) => unknown, echec: (e: unknown) => unknown) => {
        const reponse = reponses[table] ?? {}
        return Promise.resolve({ data: reponse.data ?? null, error: reponse.error ?? null }).then(suite, echec)
      }
      return chaine
    },
    rpc: async (nom: string, arguments_: unknown) => {
      rpc.push({ nom, arguments_ })
      return { data: appel.data ?? null, error: appel.error ?? null }
    },
  } as unknown as ClientDonnees
  return { client, requetes, rpc }
}

const depotSur = (client: ClientDonnees) => creerDepotSupabase(client, async () => ({}) as FichierCatalogue)
const SANS_RESEAU = { message: 'TypeError: Failed to fetch' }

const MOMO = {
  id: 'w1',
  title_fr: 'Momo',
  title_original: 'Momo',
  original_language: 'de',
  form: 'roman',
  tone: 4,
  density: 1,
  length: 'moyen',
  is_series: false,
  cover_path: null,
  work_authors: [
    { role: 'traducteur', authors: { name: 'Une traductrice' } },
    { role: 'auteur', authors: { name: 'Michael Ende' } },
  ],
  work_tags: [
    { tags: { kind: 'theme', name: 'Rapport au temps', is_interest: true } },
    { tags: { kind: 'genre', name: 'Fable et allégorie' } },
    { tags: { kind: 'theme', name: 'Amitié', is_interest: false } },
    { tags: { kind: 'atmosphere', name: 'Poétique' } },
    { tags: { kind: 'atmosphere', name: 'Douce' } },
  ],
  volumes: [],
  library_entries: [
    {
      reading_status: 'termine',
      ownership: 'possede',
      appreciation: 'beau_moment',
      finished_at: '2026-11-18',
      updated_at: '2026-11-18T20:00:00+00:00',
      editions: { language: 'fr', cover_path: 'moi/abc.jpg' },
    },
  ],
}
const VINLAND = {
  id: 'w2',
  title_fr: 'Vinland Saga',
  title_original: null,
  original_language: 'ja',
  form: 'manga',
  tone: 3,
  density: 2,
  length: 'long',
  is_series: true,
  cover_path: 'moi/serie.jpg',
  work_authors: [{ role: 'auteur', authors: { name: 'Makoto Yukimura' } }],
  work_tags: [],
  volumes: [
    { number: 1, ownership: 'possede', reading_status: 'lu', cover_path: 'moi/t1.jpg' },
    { number: 2, ownership: 'non_possede', reading_status: 'en_cours', cover_path: null },
  ],
  library_entries: [{ reading_status: 'en_cours', ownership: 'non_possede', appreciation: null, finished_at: null, updated_at: '2026-11-20T08:00:00+00:00', editions: null }],
}
// Une œuvre sans ligne dans library_entries : les valeurs par défaut de la base.
const NUE = {
  id: 'w3',
  title_fr: 'Autre œuvre',
  title_original: null,
  original_language: null,
  form: 'autre',
  tone: null,
  density: null,
  length: null,
  is_series: false,
  work_authors: [],
  work_tags: [],
  volumes: [],
  library_entries: [],
}

describe('sur Supabase', () => {
  it('lit en une fois ce que l’algorithme utilise, et mes idées mises de côté', async () => {
    const { client, requetes } = fauxClient({
      works: { data: [VINLAND, MOMO, NUE] },
      recommendation_log: { data: [{ work_id: 'w3', shown_at: '2026-11-20T10:00:00+00:00' }] },
    })
    const lecture = await depotSur(client).lireIdees()
    expect(requetes.map((r) => r.table)).toEqual(['works', 'recommendation_log'])
    expect(requetes[1].etapes).toContainEqual(['eq', 'response', 'ignoree'])
    // Rien de plus que nécessaire : ni synopsis, ni notes, ni historique, ni ISBN.
    const colonnes = String(requetes[0].etapes[0][1])
    for (const absent of ['synopsis', 'notes', 'reading_events', 'isbn']) expect(colonnes).not.toContain(absent)
    expect(lecture).toEqual({
      ok: true,
      idees: {
        // Par ordre de titre, comme la bibliothèque.
        oeuvres: [
          {
            id: 'w3',
            titre: 'Autre œuvre',
            auteurs: [],
            forme: 'autre',
            tonalite: null,
            exigence: null,
            longueur: null,
            estSerie: false,
            genres: [],
            themes: [],
            atmospheres: [],
            statut: 'a_decouvrir',
            possession: 'non_possede',
            appreciation: null,
            toucheeLe: null,
            finieLe: null,
            couverture: null,
          },
          {
            id: 'w1',
            titre: 'Momo',
            // Le traducteur n'est pas un auteur.
            auteurs: ['Michael Ende'],
            forme: 'roman',
            tonalite: 4,
            exigence: 1,
            longueur: 'moyen',
            estSerie: false,
            genres: ['Fable et allégorie'],
            themes: [
              { nom: 'Amitié', coeur: false },
              { nom: 'Rapport au temps', coeur: true },
            ],
            atmospheres: ['Douce', 'Poétique'],
            statut: 'termine',
            possession: 'possede',
            appreciation: 'beau_moment',
            toucheeLe: '2026-11-18T20:00:00+00:00',
            finieLe: '2026-11-18',
            couverture: 'moi/abc.jpg',
          },
          {
            id: 'w2',
            titre: 'Vinland Saga',
            auteurs: ['Makoto Yukimura'],
            forme: 'manga',
            tonalite: 3,
            exigence: 2,
            longueur: 'long',
            estSerie: true,
            genres: [],
            themes: [],
            atmospheres: [],
            statut: 'en_cours',
            // Calculée à partir des tomes : un tome sur deux.
            possession: 'partielle',
            appreciation: null,
            toucheeLe: '2026-11-20T08:00:00+00:00',
            finieLe: null,
            // La même règle que partout dans l'appli pour une série (couvertures/choix.ts) : ici, celle du tome 1.
            couverture: 'moi/t1.jpg',
          },
        ],
        deCote: [{ oeuvre: 'w3', depuis: '2026-11-20T10:00:00+00:00' }],
      },
    })
  })

  it('une bibliothèque vide se lit sans erreur', async () => {
    const { client } = fauxClient({ works: { data: [] }, recommendation_log: { data: null } })
    expect(await depotSur(client).lireIdees()).toEqual({ ok: true, idees: { oeuvres: [], deCote: [] } })
  })

  it('signale un échec de lecture, d’où qu’il vienne', async () => {
    const oeuvres = fauxClient({ works: { error: SANS_RESEAU } })
    expect(await depotSur(oeuvres.client).lireIdees()).toEqual({ ok: false, echec: 'reseau' })
    const deCote = fauxClient({ works: { data: [] }, recommendation_log: { error: { code: '42501', message: 'refus' } } })
    expect(await depotSur(deCote.client).lireIdees()).toEqual({ ok: false, echec: 'inconnu' })
  })

  it('met une idée de côté par la seule fonction mettre_idee_de_cote, et rend la date de la base', async () => {
    const { client, rpc, requetes } = fauxClient({}, { data: '2026-11-21T09:30:00+00:00' })
    expect(await depotSur(client).mettreIdeeDeCote('w1', 'reconfortant')).toEqual({ ok: true, depuis: '2026-11-21T09:30:00+00:00' })
    expect(rpc).toEqual([{ nom: 'mettre_idee_de_cote', arguments_: { oeuvre: 'w1', envie: 'reconfortant' } }])
    expect(requetes).toHaveLength(0)
  })

  it('sans date rendue par la base, la mise de côté n’est pas tenue pour faite', async () => {
    const { client } = fauxClient({}, { data: null })
    expect(await depotSur(client).mettreIdeeDeCote('w1', 'surprise')).toEqual({ ok: false, echec: 'inconnu' })
  })

  it('reprend une idée par la seule fonction reprendre_idee', async () => {
    const { client, rpc, requetes } = fauxClient({}, { data: 1 })
    expect(await depotSur(client).reprendreIdee('w1')).toEqual({ ok: true })
    expect(rpc).toEqual([{ nom: 'reprendre_idee', arguments_: { oeuvre: 'w1' } }])
    expect(requetes).toHaveLength(0)
  })

  it('rend les refus de la base dans les mots de l’appli', async () => {
    const introuvable = fauxClient({}, { error: { code: 'EO002', message: 'Œuvre introuvable.' } })
    expect(await depotSur(introuvable.client).mettreIdeeDeCote('w1', 'surprise')).toEqual({ ok: false, echec: 'introuvable' })
    expect(await depotSur(introuvable.client).reprendreIdee('w1')).toEqual({ ok: false, echec: 'introuvable' })
    const invalide = fauxClient({}, { error: { code: 'EO001', message: 'Envie inconnue.' } })
    expect(await depotSur(invalide.client).mettreIdeeDeCote('w1', 'surprise')).toEqual({ ok: false, echec: 'invalide' })
    const reseau = fauxClient({}, { error: SANS_RESEAU })
    expect(await depotSur(reseau.client).mettreIdeeDeCote('w1', 'surprise')).toEqual({ ok: false, echec: 'reseau' })
    expect(await depotSur(reseau.client).reprendreIdee('w1')).toEqual({ ok: false, echec: 'reseau' })
  })
})

describe('dans le faux dépôt des tests', () => {
  const momo = oeuvreFictive({
    id: 'momo',
    titreFr: 'Momo',
    tonalite: 4,
    auteurs: [
      { nom: 'Michael Ende', role: 'auteur' },
      { nom: 'Une traductrice', role: 'traducteur' },
    ],
    etiquettes: [
      { genre: 'theme', nom: 'Rapport au temps', coeur: true },
      { genre: 'theme', nom: 'Amitié', coeur: false },
      { genre: 'genre', nom: 'Fable et allégorie', coeur: false },
      { genre: 'atmosphere', nom: 'Douce', coeur: false },
    ],
    statut: 'termine',
    possession: 'possede',
    appreciation: 'beau_moment',
    historique: [
      { type: 'commence', valeur: null, date: '2026-11-01T10:00:00Z', precision: 'jour' },
      { type: 'termine', valeur: null, date: '2026-11-18T20:00:00Z', precision: 'jour' },
    ],
  })
  const siddhartha = oeuvreFictive({ id: 'sid', titreFr: 'Siddhartha' })

  it('rend une œuvre comme l’algorithme la lit', () => {
    expect(versIdee(momo)).toEqual({
      id: 'momo',
      titre: 'Momo',
      auteurs: ['Michael Ende'],
      forme: 'roman',
      tonalite: 4,
      exigence: null,
      longueur: null,
      estSerie: false,
      genres: ['Fable et allégorie'],
      themes: [
        { nom: 'Amitié', coeur: false },
        { nom: 'Rapport au temps', coeur: true },
      ],
      atmospheres: ['Douce'],
      statut: 'termine',
      possession: 'possede',
      appreciation: 'beau_moment',
      toucheeLe: '2026-11-18T20:00:00Z',
      finieLe: '2026-11-18',
      couverture: null,
    })
    // Un livre terminé sans date dans son parcours (lu autrefois) : pas de date de fin.
    expect(versIdee({ ...momo, historique: [] }).finieLe).toBeNull()
    // Une date de fin ne vaut que pour un livre terminé (une relecture est en cours : la fin d'avant ne compte pas).
    expect(versIdee({ ...momo, statut: 'en_cours' }).finieLe).toBeNull()
  })

  it('met une idée de côté (une seule ligne par œuvre), puis la reprend', async () => {
    const faux = depotFictif({ oeuvres: [momo, siddhartha], maintenant: () => new Date('2026-11-21T09:00:00Z') })
    expect(await faux.depot.lireIdees()).toMatchObject({ ok: true, idees: { deCote: [] } })

    expect(await faux.depot.mettreIdeeDeCote('sid', 'surprise')).toEqual({ ok: true, depuis: '2026-11-21T09:00:00.000Z' })
    expect(await faux.depot.mettreIdeeDeCote('sid', 'reconfortant')).toEqual({ ok: true, depuis: '2026-11-21T09:00:00.000Z' })
    const lecture = await faux.depot.lireIdees()
    expect(lecture.ok && lecture.idees.deCote).toEqual([{ oeuvre: 'sid', depuis: '2026-11-21T09:00:00.000Z' }])
    expect(lecture.ok && lecture.idees.oeuvres.map((o) => o.titre)).toEqual(['Momo', 'Siddhartha'])

    expect(await faux.depot.reprendreIdee('sid')).toEqual({ ok: true })
    expect(faux.deCote()).toEqual([])
    expect(faux.appels.ecritures).toEqual([
      { action: 'ideeDeCote', id: 'sid', valeur: 'surprise' },
      { action: 'ideeDeCote', id: 'sid', valeur: 'reconfortant' },
      { action: 'ideeReprise', id: 'sid' },
    ])
  })

  it('refuse une œuvre inconnue, et rend l’échec imposé par le test', async () => {
    const faux = depotFictif({ oeuvres: [momo] })
    expect(await faux.depot.mettreIdeeDeCote('absente', 'surprise')).toEqual({ ok: false, echec: 'introuvable' })
    expect(await faux.depot.reprendreIdee('absente')).toEqual({ ok: false, echec: 'introuvable' })
    const enPanne = depotFictif({ oeuvres: [momo], ecriture: { ok: false, echec: 'reseau' } })
    expect(await enPanne.depot.mettreIdeeDeCote('momo', 'surprise')).toEqual({ ok: false, echec: 'reseau' })
    expect(enPanne.deCote()).toEqual([])
  })

  it('part des mises de côté données au départ, et oublie celle d’une œuvre supprimée', async () => {
    const faux = depotFictif({ oeuvres: [momo, siddhartha], deCote: [{ oeuvre: 'sid', depuis: '2026-11-10T09:00:00Z' }] })
    const avant = await faux.depot.lireIdees()
    expect(avant.ok && avant.idees.deCote).toEqual([{ oeuvre: 'sid', depuis: '2026-11-10T09:00:00Z' }])
    await faux.depot.supprimerOeuvre('sid')
    const apres = await faux.depot.lireIdees()
    expect(apres.ok && apres.idees.deCote).toEqual([])
  })
})
