import fichier from '../../catalogue/catalogue-initial.json'
import { preparerEnvoi, type FichierCatalogue } from './envoiCatalogue'

const envoi = preparerEnvoi(fichier as unknown as FichierCatalogue)

describe('envoi du catalogue de départ', () => {
  it('envoie les 35 œuvres et tout le vocabulaire', () => {
    expect(envoi.works).toHaveLength(35)
    expect(envoi.tags.genre).toEqual(fichier.tags.genre)
    expect(envoi.tags.atmosphere).toEqual(fichier.tags.atmosphere)
    expect(envoi.tags.theme).toEqual(fichier.tags.theme)
  })

  it('laisse de côté les blocs de relecture et les clés de travail', () => {
    const champs = new Set<string>()
    JSON.stringify(envoi, (cle, valeur: unknown) => {
      champs.add(cle)
      return valeur
    })
    for (const absent of ['relecture', 'relecture_generale', 'key', 'sources', 'remarques', 'a_propos', 'etat']) {
      expect(champs.has(absent), absent).toBe(false)
    }
  })

  it('n’envoie aucun statut personnel', () => {
    const texte = JSON.stringify(envoi)
    for (const interdit of ['reading_status', 'ownership', 'appreciation', 'progress_', 'user_id', '"status"']) {
      expect(texte.includes(interdit), interdit).toBe(false)
    }
  })

  it('garde pour chaque œuvre son édition de référence, ses tomes et ses étiquettes', () => {
    const vinland = envoi.works.find((o) => o.title_fr === 'Vinland Saga')!
    expect(vinland.volumes).toHaveLength(29)
    expect(vinland.media).toEqual([{ kind: 'anime', title: 'Vinland Saga', seasons: 2, episodes_total: 48 }])
    expect(vinland.editions).toHaveLength(1)

    const mil984 = envoi.works.find((o) => o.title_fr === '1984')!
    expect(mil984.editions[0]).toMatchObject({ language: 'en', isbn: '9780008442613' })

    const vocabulaire = {
      genres: envoi.tags.genre,
      atmospheres: envoi.tags.atmosphere,
      themes: envoi.tags.theme.map((t) => t.name),
    }
    for (const o of envoi.works) {
      for (const liste of ['genres', 'atmospheres', 'themes'] as const) {
        for (const nom of o[liste]) expect(vocabulaire[liste], `${o.title_fr} : ${nom}`).toContain(nom)
      }
    }
  })
})
