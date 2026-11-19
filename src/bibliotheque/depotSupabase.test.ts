import { creerDepotSupabase, versOeuvreListee, type ClientDonnees } from './depotSupabase'
import type { FichierCatalogue } from './envoiCatalogue'
import type { FicheEnvoi } from './depot'

const FICHIER = {
  tags: { genre: ['Genre'], atmosphere: [], theme: [{ name: 'Thème', is_interest: true }] },
  works: [
    {
      key: 'essai',
      title_fr: 'Œuvre d’essai',
      title_original: null,
      original_language: 'fr',
      first_published_year: null,
      form: 'roman',
      is_series: false,
      authors: [{ name: 'Auteur', role: 'auteur' }],
      synopsis: 'Texte.',
      tone: 3,
      density: 3,
      length: 'court',
      genres: ['Genre'],
      themes: ['Thème'],
      atmospheres: [],
      editions: [],
      volumes: [],
      media: [],
      relecture: { sources: [] },
    },
  ],
} as unknown as FichierCatalogue

type Reponse = { data?: unknown; error?: { code?: string; message?: string } | null }
type Requete = { table: string; etapes: [string, ...unknown[]][] }

/**
 * Faux client Supabase : chaque requête enregistre ses étapes (select, update, eq…) et rend
 * la réponse prévue pour sa table et son opération (« works.select », « volumes.update »…).
 */
function fauxClient(reponses: Record<string, Reponse> = {}, appel: Reponse = {}) {
  const requetes: Requete[] = []
  const rpc: { nom: string; arguments_: unknown }[] = []
  const client = {
    from(table: string) {
      const requete: Requete = { table, etapes: [] }
      requetes.push(requete)
      let operation = 'select'
      const chaine: Record<string, unknown> = {}
      for (const etape of ['select', 'update', 'delete', 'eq', 'gte', 'lte', 'order', 'maybeSingle']) {
        chaine[etape] = (...args: unknown[]) => {
          requete.etapes.push([etape, ...args])
          if (etape === 'update' || etape === 'delete') operation = etape
          return chaine
        }
      }
      chaine.then = (suite: (r: unknown) => unknown, echec: (e: unknown) => unknown) => {
        const reponse = reponses[`${table}.${operation}`] ?? {}
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

const charger = async () => FICHIER
const SANS_RESEAU = { message: 'TypeError: Failed to fetch' }

describe('lecture de la bibliothèque', () => {
  it('rend les œuvres par ordre de titre, avec auteurs, étiquettes, statut et possession', async () => {
    const { client, requetes } = fauxClient({
      'works.select': {
        data: [
          {
            id: '2',
            title_fr: 'Momo',
            title_original: 'Momo',
            original_language: 'de',
            is_series: false,
            work_authors: [{ role: 'auteur', authors: { name: 'Michael Ende' } }],
            work_tags: [{ tags: { kind: 'theme', name: 'Temps' } }, { tags: { kind: 'genre', name: 'Conte' } }],
            volumes: [],
            library_entries: [{ reading_status: 'envie_de_lire', ownership: 'possede', editions: { language: 'fr' } }],
          },
          {
            id: '1',
            title_fr: 'L’Étranger',
            title_original: null,
            original_language: 'fr',
            is_series: false,
            work_authors: [
              { role: 'traducteur', authors: { name: 'Quelqu’un' } },
              { role: 'auteur', authors: { name: 'Albert Camus' } },
            ],
            work_tags: [],
            volumes: [],
            library_entries: [{ reading_status: 'a_decouvrir', ownership: 'non_possede', editions: { language: 'fr' } }],
          },
        ],
      },
    })
    const lecture = await creerDepotSupabase(client, charger).listerOeuvres()
    expect(requetes.map((r) => r.table)).toEqual(['works'])
    expect(lecture).toEqual({
      ok: true,
      oeuvres: [
        {
          id: '1',
          titre: 'L’Étranger',
          titreSecondaire: null,
          auteurs: ['Albert Camus'],
          genres: [],
          themes: [],
          atmospheres: [],
          statut: 'a_decouvrir',
          possession: 'non_possede',
          possessionsFiltrables: ['non_possede'],
        },
        {
          id: '2',
          titre: 'Momo',
          titreSecondaire: null,
          auteurs: ['Michael Ende'],
          genres: ['Conte'],
          themes: ['Temps'],
          atmospheres: [],
          statut: 'envie_de_lire',
          possession: 'possede',
          possessionsFiltrables: ['possede'],
        },
      ],
    })
  })

  it('met le titre original en premier quand mon édition est en anglais', () => {
    const ligne = {
      id: '3',
      title_fr: '1984',
      title_original: 'Nineteen Eighty-Four',
      original_language: 'en',
      work_authors: [{ role: 'auteur', authors: { name: 'George Orwell' } }],
      // L'API peut rendre un objet seul au lieu d'une liste : les deux formes sont comprises.
      library_entries: { editions: { language: 'en' } },
    }
    expect(versOeuvreListee(ligne)).toMatchObject({
      id: '3',
      titre: 'Nineteen Eighty-Four',
      titreSecondaire: '1984',
      auteurs: ['George Orwell'],
      statut: 'a_decouvrir',
      possession: 'non_possede',
    })
  })

  it('garde le titre français quand aucune édition n’est reliée', () => {
    const ligne = { id: '4', title_fr: '1984', title_original: 'Nineteen Eighty-Four', original_language: 'en', work_authors: [], library_entries: [] }
    expect(versOeuvreListee(ligne)).toMatchObject({ titre: '1984', titreSecondaire: 'Nineteen Eighty-Four', auteurs: [] })
  })

  it('calcule la possession d’une série à partir de ses tomes', () => {
    const serie = (tomes: string[]) =>
      versOeuvreListee({
        id: 's',
        title_fr: 'Série',
        title_original: null,
        original_language: 'ja',
        is_series: true,
        work_authors: [],
        volumes: tomes.map((ownership) => ({ ownership })) as never,
        library_entries: [{ ownership: 'non_possede', editions: null }],
      })
    expect(serie(['possede', 'a_acheter', 'non_possede'])).toMatchObject({
      possession: 'partielle',
      possessionsFiltrables: ['possede', 'a_acheter', 'non_possede'],
    })
    expect(serie(['possede', 'possede'])).toMatchObject({ possession: 'possede', possessionsFiltrables: ['possede'] })
  })

  it('distingue l’absence de réseau d’une autre erreur', async () => {
    const sansReseau = fauxClient({ 'works.select': { error: SANS_RESEAU } })
    expect(await creerDepotSupabase(sansReseau.client, charger).listerOeuvres()).toEqual({ ok: false, echec: 'reseau' })
    const refus = fauxClient({ 'works.select': { error: { code: '42501', message: 'permission denied' } } })
    expect(await creerDepotSupabase(refus.client, charger).listerOeuvres()).toEqual({ ok: false, echec: 'inconnu' })
  })
})

describe('fiche d’une œuvre', () => {
  const OEUVRE = {
    id: 'w1',
    title_fr: 'Série d’essai',
    title_original: 'Shirīzu',
    original_language: 'ja',
    first_published_year: 2001,
    form: 'manga',
    synopsis: null,
    tone: 3,
    density: null,
    length: 'long',
    is_series: true,
    work_authors: [
      { role: 'traducteur', authors: { name: 'T' } },
      { role: 'auteur', authors: { name: 'A' } },
    ],
    work_tags: [{ tags: { kind: 'theme', name: 'Rédemption', is_interest: true } }],
  }

  it('lit l’œuvre, ses éditions, ses tomes, ses médias et ma relation, limités à cette œuvre', async () => {
    const { client, requetes } = fauxClient({
      'works.select': { data: OEUVRE },
      'editions.select': {
        data: [{ id: 'e1', isbn: null, publisher: 'Éditeur', language: 'fr', format: 'manga', translator: null, page_count: null }],
      },
      'volumes.select': {
        data: [
          { number: 2, title: null, isbn: null, ownership: 'a_acheter', reading_status: 'a_lire' },
          { number: 1, title: 'Premier', isbn: null, ownership: 'possede', reading_status: 'lu' },
        ],
      },
      'media.select': {
        data: [{ id: 'm1', kind: 'anime', title: null, seasons: 2, episodes_total: 48, episodes_watched: 14, status: 'en_pause' }],
      },
      'library_entries.select': {
        data: {
          reading_status: 'en_cours',
          ownership: 'non_possede',
          edition_id: 'e1',
          progress_unit: null,
          progress_current: null,
          progress_total: null,
          appreciation: 'beau_moment',
          reading_events: [
            { kind: 'termine', value: null, occurred_at: '2026-04-20T10:00:00+00:00', date_precision: 'jour' },
            { kind: 'commence', value: null, occurred_at: '2026-03-03T10:00:00+00:00', date_precision: 'jour' },
          ],
        },
      },
    })
    const lecture = await creerDepotSupabase(client, charger).lireOeuvre('w1')
    expect(requetes.map((r) => r.table).sort()).toEqual(['editions', 'library_entries', 'media', 'volumes', 'works'])
    for (const requete of requetes) {
      const colonne = requete.table === 'works' ? 'id' : 'work_id'
      expect(requete.etapes).toContainEqual(['eq', colonne, 'w1'])
    }
    expect(lecture.ok && lecture.oeuvre).toMatchObject({
      id: 'w1',
      titreFr: 'Série d’essai',
      estSerie: true,
      auteurs: [
        { nom: 'A', role: 'auteur' },
        { nom: 'T', role: 'traducteur' },
      ],
      etiquettes: [{ genre: 'theme', nom: 'Rédemption', coeur: true }],
      editions: [{ id: 'e1', publisher: 'Éditeur', pageCount: null }],
      tomes: [
        { numero: 1, titre: 'Premier', possession: 'possede', lecture: 'lu' },
        { numero: 2, titre: null, possession: 'a_acheter', lecture: 'a_lire' },
      ],
      // Un ancien statut « en pause » d'un média se lit « en cours ».
      medias: [{ id: 'm1', type: 'anime', saisons: 2, episodes: 48, episodesVus: 14, statut: 'en_cours' }],
      statut: 'en_cours',
      monEdition: 'e1',
      appreciation: 'beau_moment',
      historique: [
        { type: 'commence', date: '2026-03-03T10:00:00+00:00', precision: 'jour' },
        { type: 'termine', date: '2026-04-20T10:00:00+00:00', precision: 'jour' },
      ],
    })
  })

  it('liste mes lectures en cours, la plus récemment touchée d’abord', async () => {
    const { client, requetes } = fauxClient({
      'library_entries.select': {
        data: [
          {
            progress_unit: 'lettre',
            progress_current: 12,
            progress_total: null,
            editions: { page_count: 980, language: 'fr' },
            works: {
              id: 'w2',
              title_fr: 'Lettres à Lucilius',
              title_original: 'Epistulae',
              original_language: 'la',
              is_series: false,
              work_authors: [{ role: 'auteur', authors: { name: 'Sénèque' } }],
              volumes: [],
            },
          },
        ],
      },
    })
    const lecture = await creerDepotSupabase(client, charger).listerEnCours()
    expect(requetes[0].etapes).toContainEqual(['eq', 'reading_status', 'en_cours'])
    expect(requetes[0].etapes).toContainEqual(['order', 'updated_at', { ascending: false }])
    expect(lecture).toEqual({
      ok: true,
      lectures: [
        {
          id: 'w2',
          titre: 'Lettres à Lucilius',
          auteurs: ['Sénèque'],
          estSerie: false,
          unite: 'lettre',
          position: 12,
          total: null,
          pagesEdition: 980,
          tomes: [],
          appreciation: null,
        },
      ],
    })
  })

  it('rend « introuvable » quand la RLS ne laisse rien voir (œuvre d’un autre compte ou supprimée)', async () => {
    const { client } = fauxClient({ 'works.select': { data: null } })
    expect(await creerDepotSupabase(client, charger).lireOeuvre('w1')).toEqual({ ok: false, echec: 'introuvable' })
  })

  it('signale l’absence de réseau', async () => {
    const { client } = fauxClient({ 'volumes.select': { error: SANS_RESEAU } })
    expect(await creerDepotSupabase(client, charger).lireOeuvre('w1')).toEqual({ ok: false, echec: 'reseau' })
  })
})

describe('vocabulaire', () => {
  it('lit mes étiquettes et mes auteurs', async () => {
    const { client } = fauxClient({
      'tags.select': { data: [{ kind: 'theme', name: 'Temps', is_interest: true }] },
      'authors.select': { data: [{ name: 'Michael Ende' }] },
    })
    expect(await creerDepotSupabase(client, charger).lireVocabulaire()).toEqual({
      ok: true,
      vocabulaire: { etiquettes: [{ genre: 'theme', nom: 'Temps', coeur: true }], auteurs: ['Michael Ende'] },
    })
  })
})

describe('écritures', () => {
  const FICHE: FicheEnvoi = {
    title_fr: 'Titre',
    title_original: null,
    original_language: null,
    first_published_year: null,
    form: 'roman',
    synopsis: null,
    tone: null,
    density: null,
    length: null,
    is_series: false,
    authors: [],
    tags: [],
    editions: [],
    volumes: [],
    media: [],
  }

  it('enregistre une œuvre par la seule fonction enregistrer_oeuvre, et rend son identifiant', async () => {
    const { client, rpc, requetes } = fauxClient({}, { data: 'nouvel-id' })
    expect(await creerDepotSupabase(client, charger).enregistrerOeuvre(FICHE)).toEqual({ ok: true, id: 'nouvel-id' })
    expect(rpc).toEqual([{ nom: 'enregistrer_oeuvre', arguments_: { fiche: FICHE } }])
    expect(requetes).toHaveLength(0)
  })

  it.each([
    ['EO002', 'introuvable'],
    ['EO001', 'invalide'],
    ['23514', 'invalide'],
    ['42501', 'inconnu'],
  ])('traduit le refus %s de la base en « %s »', async (code, echec) => {
    const { client } = fauxClient({}, { error: { code, message: 'refus' } })
    expect(await creerDepotSupabase(client, charger).enregistrerOeuvre(FICHE)).toEqual({ ok: false, echec })
  })

  it('reconnaît une coupure de réseau pendant l’enregistrement', async () => {
    const { client } = fauxClient({}, { error: SANS_RESEAU })
    expect(await creerDepotSupabase(client, charger).enregistrerOeuvre(FICHE)).toEqual({ ok: false, echec: 'reseau' })
  })

  it('change le statut par la fonction changer_statut, en tout ou rien', async () => {
    const { client, rpc, requetes } = fauxClient()
    expect(await creerDepotSupabase(client, charger).changerStatut('w1', 'envie_de_lire')).toEqual({ ok: true })
    expect(rpc).toEqual([{ nom: 'changer_statut', arguments_: { oeuvre: 'w1', statut: 'envie_de_lire' } }])
    expect(requetes).toHaveLength(0)
  })

  it('note la progression par la fonction noter_progression', async () => {
    const { client, rpc } = fauxClient()
    expect(await creerDepotSupabase(client, charger).noterProgression('w1', 75)).toEqual({ ok: true })
    expect(rpc).toEqual([{ nom: 'noter_progression', arguments_: { oeuvre: 'w1', valeur: 75 } }])
  })

  it('rend les refus de la base dans les mots de l’appli', async () => {
    const introuvable = fauxClient({}, { error: { code: 'EO002', message: 'Œuvre introuvable.' } })
    expect(await creerDepotSupabase(introuvable.client, charger).noterProgression('w1', 3)).toEqual({ ok: false, echec: 'introuvable' })
    const invalide = fauxClient({}, { error: { code: 'EO001', message: 'Statut inconnu.' } })
    expect(await creerDepotSupabase(invalide.client, charger).changerStatut('w1', 'en_cours')).toEqual({ ok: false, echec: 'invalide' })
    const reseau = fauxClient({}, { error: SANS_RESEAU })
    expect(await creerDepotSupabase(reseau.client, charger).changerStatut('w1', 'en_cours')).toEqual({ ok: false, echec: 'reseau' })
  })

  it('date la fin à l’année près, ou la retire', async () => {
    const { client, rpc } = fauxClient()
    const depot = creerDepotSupabase(client, charger)
    await depot.daterFin('w1', '2019-01-01', 'annee')
    await depot.daterFin('w1', null, 'annee')
    expect(rpc).toEqual([
      { nom: 'dater_fin', arguments_: { oeuvre: 'w1', jour: '2019-01-01', precision_date: 'annee' } },
      { nom: 'dater_fin', arguments_: { oeuvre: 'w1', jour: null, precision_date: null } },
    ])
  })

  it('change l’unité en remettant la position à zéro', async () => {
    const { client, requetes } = fauxClient({ 'library_entries.update': { data: [{ work_id: 'w1' }] } })
    expect(await creerDepotSupabase(client, charger).changerUnite('w1', 'lettre', 124)).toEqual({ ok: true })
    expect(requetes[0].etapes[0]).toEqual(['update', { progress_unit: 'lettre', progress_total: 124, progress_current: null }])
  })

  it('change mon ressenti, ou le retire', async () => {
    const { client, requetes } = fauxClient({ 'library_entries.update': { data: [{ work_id: 'w1' }] } })
    await creerDepotSupabase(client, charger).changerAppreciation('w1', null)
    expect(requetes[0].etapes[0]).toEqual(['update', { appreciation: null }])
  })

  it('change la lecture d’une plage de tomes', async () => {
    const { client, requetes } = fauxClient({ 'volumes.update': { data: [{ number: 1 }] } })
    expect(await creerDepotSupabase(client, charger).changerLectureTomes('w1', { de: 1, a: 8 }, 'lu')).toEqual({ ok: true })
    expect(requetes[0].etapes).toEqual([
      ['update', { reading_status: 'lu' }],
      ['eq', 'work_id', 'w1'],
      ['gte', 'number', 1],
      ['lte', 'number', 8],
      ['select', 'number'],
    ])
  })

  it('note les épisodes vus d’un média de cette œuvre seulement', async () => {
    const { client, requetes } = fauxClient({ 'media.update': { data: [{ id: 'm1' }] } })
    expect(await creerDepotSupabase(client, charger).changerMedia('w1', 'm1', { vus: 14, statut: 'en_cours' })).toEqual({ ok: true })
    expect(requetes[0].etapes).toEqual([
      ['update', { episodes_watched: 14, status: 'en_cours' }],
      ['eq', 'id', 'm1'],
      ['eq', 'work_id', 'w1'],
      ['select', 'id'],
    ])
  })

  it('rend « introuvable » quand la RLS cache la ligne à modifier', async () => {
    const { client } = fauxClient({ 'library_entries.update': { data: [] } })
    expect(await creerDepotSupabase(client, charger).changerPossession('w1', 'possede')).toEqual({ ok: false, echec: 'introuvable' })
  })

  it('choisit mon édition', async () => {
    const { client, requetes } = fauxClient({ 'library_entries.update': { data: [{ work_id: 'w1' }] } })
    expect(await creerDepotSupabase(client, charger).changerMonEdition('w1', 'e2')).toEqual({ ok: true })
    expect(requetes[0].etapes[0]).toEqual(['update', { edition_id: 'e2' }])
  })

  it('change la possession d’une plage de tomes, ou de tous', async () => {
    const plage = fauxClient({ 'volumes.update': { data: [{ number: 1 }] } })
    expect(await creerDepotSupabase(plage.client, charger).changerPossessionTomes('w1', { de: 1, a: 8 }, 'possede')).toEqual({ ok: true })
    expect(plage.requetes[0].etapes).toEqual([
      ['update', { ownership: 'possede' }],
      ['eq', 'work_id', 'w1'],
      ['gte', 'number', 1],
      ['lte', 'number', 8],
      ['select', 'number'],
    ])
    const tous = fauxClient({ 'volumes.update': { data: [{ number: 1 }] } })
    await creerDepotSupabase(tous.client, charger).changerPossessionTomes('w1', 'tous', 'a_acheter')
    expect(tous.requetes[0].etapes.map(([etape]) => etape)).toEqual(['update', 'eq', 'select'])
  })

  it('supprime l’œuvre (ses éditions, tomes et notes partent avec elle dans la base)', async () => {
    const { client, requetes } = fauxClient({ 'works.delete': { data: [{ id: 'w1' }] } })
    expect(await creerDepotSupabase(client, charger).supprimerOeuvre('w1')).toEqual({ ok: true })
    expect(requetes[0]).toEqual({ table: 'works', etapes: [['delete'], ['eq', 'id', 'w1'], ['select', 'id']] })
    const absente = fauxClient({ 'works.delete': { data: [] } })
    expect(await creerDepotSupabase(absente.client, charger).supprimerOeuvre('w1')).toEqual({ ok: false, echec: 'introuvable' })
  })
})

describe('installation du catalogue', () => {
  it('appelle la fonction de la base avec le catalogue, sans les blocs de relecture', async () => {
    const { client, rpc } = fauxClient()
    expect(await creerDepotSupabase(client, charger).installerCatalogue()).toEqual({ ok: true })
    expect(rpc).toHaveLength(1)
    expect(rpc[0].nom).toBe('importer_catalogue')
    const envoye = JSON.stringify(rpc[0].arguments_)
    expect(envoye).toContain('Œuvre d’essai')
    expect(envoye).not.toContain('relecture')
    expect(Object.keys(rpc[0].arguments_ as object)).toEqual(['catalogue'])
  })

  it('reconnaît une bibliothèque déjà remplie', async () => {
    const { client } = fauxClient({}, { error: { code: 'IC001', message: 'La bibliothèque contient déjà des œuvres.' } })
    expect(await creerDepotSupabase(client, charger).installerCatalogue()).toEqual({ ok: false, echec: 'deja' })
  })

  it('n’appelle pas la base si le fichier du catalogue n’arrive pas', async () => {
    const { client, rpc } = fauxClient()
    const enPanne = async () => {
      throw new Error('hors ligne')
    }
    expect(await creerDepotSupabase(client, enPanne).installerCatalogue()).toEqual({ ok: false, echec: 'reseau' })
    expect(rpc).toHaveLength(0)
  })

  it('signale les autres échecs sans les confondre avec le réseau', async () => {
    const refus = fauxClient({}, { error: { code: 'IC002', message: 'Catalogue vide ou illisible.' } })
    expect(await creerDepotSupabase(refus.client, charger).installerCatalogue()).toEqual({ ok: false, echec: 'inconnu' })
    const coupure = fauxClient({}, { error: SANS_RESEAU })
    expect(await creerDepotSupabase(coupure.client, charger).installerCatalogue()).toEqual({ ok: false, echec: 'reseau' })
  })
})
