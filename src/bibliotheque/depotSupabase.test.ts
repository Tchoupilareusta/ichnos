import { creerDepotSupabase, versOeuvreListee, type ClientDonnees } from './depotSupabase'
import type { FichierCatalogue } from './envoiCatalogue'

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

function fauxClient({ lecture = { data: [] }, appel = {} }: { lecture?: Reponse; appel?: Reponse } = {}) {
  const appels = { from: [] as string[], select: [] as string[], rpc: [] as { nom: string; arguments_: unknown }[] }
  const client = {
    from(table: string) {
      appels.from.push(table)
      return {
        select: async (colonnes: string) => {
          appels.select.push(colonnes)
          return { data: lecture.data ?? null, error: lecture.error ?? null }
        },
      }
    },
    rpc: async (nom: string, arguments_: unknown) => {
      appels.rpc.push({ nom, arguments_ })
      return { data: appel.data ?? null, error: appel.error ?? null }
    },
  } as unknown as ClientDonnees
  return { client, appels }
}

const charger = async () => FICHIER

describe('lecture de la bibliothèque', () => {
  it('rend les œuvres par ordre de titre, avec leurs auteurs', async () => {
    const { client, appels } = fauxClient({
      lecture: {
        data: [
          {
            id: '2',
            title_fr: 'Momo',
            title_original: 'Momo',
            original_language: 'de',
            work_authors: [{ role: 'auteur', authors: { name: 'Michael Ende' } }],
            library_entries: [{ editions: { language: 'fr' } }],
          },
          {
            id: '1',
            title_fr: 'La Chute',
            title_original: null,
            original_language: 'fr',
            work_authors: [
              { role: 'traducteur', authors: { name: 'Quelqu’un' } },
              { role: 'auteur', authors: { name: 'Albert Camus' } },
            ],
            library_entries: [{ editions: { language: 'fr' } }],
          },
        ],
      },
    })
    const lecture = await creerDepotSupabase(client, charger).listerOeuvres()
    expect(appels.from).toEqual(['works'])
    expect(lecture).toEqual({
      ok: true,
      oeuvres: [
        { id: '1', titre: 'La Chute', titreSecondaire: null, auteurs: ['Albert Camus'] },
        { id: '2', titre: 'Momo', titreSecondaire: null, auteurs: ['Michael Ende'] },
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
    expect(versOeuvreListee(ligne)).toEqual({
      id: '3',
      titre: 'Nineteen Eighty-Four',
      titreSecondaire: '1984',
      auteurs: ['George Orwell'],
    })
  })

  it('garde le titre français quand aucune édition n’est reliée', () => {
    const ligne = { id: '4', title_fr: '1984', title_original: 'Nineteen Eighty-Four', original_language: 'en', work_authors: [], library_entries: [] }
    expect(versOeuvreListee(ligne)).toMatchObject({ titre: '1984', titreSecondaire: 'Nineteen Eighty-Four', auteurs: [] })
  })

  it('distingue l’absence de réseau d’une autre erreur', async () => {
    const sansReseau = fauxClient({ lecture: { error: { message: 'TypeError: Failed to fetch' } } })
    expect(await creerDepotSupabase(sansReseau.client, charger).listerOeuvres()).toEqual({ ok: false, echec: 'reseau' })
    const refus = fauxClient({ lecture: { error: { code: '42501', message: 'permission denied' } } })
    expect(await creerDepotSupabase(refus.client, charger).listerOeuvres()).toEqual({ ok: false, echec: 'inconnu' })
  })
})

describe('installation du catalogue', () => {
  it('appelle la fonction de la base avec le catalogue, sans les blocs de relecture', async () => {
    const { client, appels } = fauxClient()
    expect(await creerDepotSupabase(client, charger).installerCatalogue()).toEqual({ ok: true })
    expect(appels.rpc).toHaveLength(1)
    expect(appels.rpc[0].nom).toBe('importer_catalogue')
    const envoye = JSON.stringify(appels.rpc[0].arguments_)
    expect(envoye).toContain('Œuvre d’essai')
    expect(envoye).not.toContain('relecture')
    expect(Object.keys(appels.rpc[0].arguments_ as object)).toEqual(['catalogue'])
  })

  it('reconnaît une bibliothèque déjà remplie', async () => {
    const { client } = fauxClient({ appel: { error: { code: 'IC001', message: 'La bibliothèque contient déjà des œuvres.' } } })
    expect(await creerDepotSupabase(client, charger).installerCatalogue()).toEqual({ ok: false, echec: 'deja' })
  })

  it('n’appelle pas la base si le fichier du catalogue n’arrive pas', async () => {
    const { client, appels } = fauxClient()
    const enPanne = async () => {
      throw new Error('hors ligne')
    }
    expect(await creerDepotSupabase(client, enPanne).installerCatalogue()).toEqual({ ok: false, echec: 'reseau' })
    expect(appels.rpc).toHaveLength(0)
  })

  it('signale les autres échecs sans les confondre avec le réseau', async () => {
    const refus = fauxClient({ appel: { error: { code: 'IC002', message: 'Catalogue vide ou illisible.' } } })
    expect(await creerDepotSupabase(refus.client, charger).installerCatalogue()).toEqual({ ok: false, echec: 'inconnu' })
    const coupure = fauxClient({ appel: { error: { message: 'TypeError: Failed to fetch' } } })
    expect(await creerDepotSupabase(coupure.client, charger).installerCatalogue()).toEqual({ ok: false, echec: 'reseau' })
  })
})
