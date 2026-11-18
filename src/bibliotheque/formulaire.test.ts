import { oeuvreFictive } from './depot.fictif'
import { ajusterTomes, etatDepuisOeuvre, etatVide, idChamp, ligneEdition, ligneMedia, valider, versEnvoi } from './formulaire'

describe('formulaire d’une œuvre', () => {
  it('ne complète rien : un formulaire presque vide donne une fiche presque vide', () => {
    const etat = { ...etatVide(), titreFr: '  Momo ' }
    expect(valider(etat)).toEqual({})
    expect(versEnvoi(etat)).toEqual({
      title_fr: 'Momo',
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
    })
  })

  it('exige un titre en français', () => {
    expect(valider(etatVide())).toHaveProperty(idChamp.titreFr)
  })

  it('refuse un ISBN au chiffre de contrôle faux, et une année ou des pages qui ne sont pas des nombres', () => {
    const edition = { ...ligneEdition(), isbn: '978-2-07-036002-5', pageCount: 'deux cents' }
    const erreurs = valider({ ...etatVide(), titreFr: 'X', annee: 'vers 1900', editions: [edition] })
    expect(Object.keys(erreurs).sort()).toEqual([idChamp.annee, idChamp.isbnEdition(edition.cle), idChamp.pagesEdition(edition.cle)].sort())
  })

  it('accepte une année de l’Antiquité', () => {
    expect(valider({ ...etatVide(), titreFr: 'Lettres', annee: '-64' })).toEqual({})
  })

  it('n’accepte pas un total d’épisodes plus petit que ce que j’ai déjà vu', () => {
    const media = { ...ligneMedia(), episodes: '10', episodesVus: 12 }
    expect(valider({ ...etatVide(), titreFr: 'X', medias: [media] })).toHaveProperty(idChamp.episodes(media.cle))
  })

  it('envoie l’ISBN sans tirets, les auteurs sans doublon ni ligne vide, et désigne mon édition', () => {
    const a = { ...ligneEdition(), publisher: ' Gallimard ', isbn: '978-2-07-036002-4', language: 'fr', pageCount: '186' }
    const b = { ...ligneEdition(), publisher: 'Penguin', language: 'en' }
    const etat = {
      ...etatVide(),
      titreFr: 'L’Étranger',
      auteurs: [
        { cle: '1', nom: 'Albert Camus', role: 'auteur' as const },
        { cle: '2', nom: ' Albert Camus ', role: 'auteur' as const },
        { cle: '3', nom: '   ', role: 'auteur' as const },
      ],
      editions: [a, b],
      mienne: b.cle,
    }
    const envoi = versEnvoi(etat, 'w1')
    expect(envoi.id).toBe('w1')
    expect(envoi.authors).toEqual([{ name: 'Albert Camus', role: 'auteur' }])
    expect(envoi.editions).toEqual([
      { isbn: '9782070360024', publisher: 'Gallimard', language: 'fr', format: null, translator: null, page_count: 186, mienne: false },
      { isbn: null, publisher: 'Penguin', language: 'en', format: null, translator: null, page_count: null, mienne: true },
    ])
  })

  it('n’envoie pas de tomes pour une œuvre qui n’est plus une série', () => {
    const etat = { ...etatVide(), titreFr: 'X', estSerie: false, tomes: ajusterTomes([], 3) }
    expect(versEnvoi(etat).volumes).toEqual([])
    expect(versEnvoi({ ...etat, estSerie: true }).volumes).toHaveLength(3)
  })

  it('ajuste le nombre de tomes en gardant ceux qui restent', () => {
    const tomes = [
      { numero: 1, titre: 'Premier', isbn: '' },
      { numero: 2, titre: '', isbn: '' },
    ]
    expect(ajusterTomes(tomes, 4).map((t) => t.numero)).toEqual([1, 2, 3, 4])
    expect(ajusterTomes(tomes, 4)[0].titre).toBe('Premier')
    expect(ajusterTomes(tomes, 1)).toEqual([tomes[0]])
    expect(ajusterTomes(tomes, 0)).toEqual([])
  })

  it('reprend une fiche existante sans rien perdre, et la renvoie à l’identique', () => {
    const oeuvre = oeuvreFictive({
      id: 'w1',
      titreFr: 'Vinland Saga',
      titreOriginal: 'ヴィンランド・サガ',
      langueOriginale: 'ja',
      annee: 2005,
      forme: 'manga',
      synopsis: 'Texte.',
      tonalite: 3,
      exigence: 2,
      longueur: 'long',
      estSerie: true,
      auteurs: [{ nom: 'Makoto Yukimura', role: 'auteur' }],
      etiquettes: [{ genre: 'theme', nom: 'Rédemption', coeur: true }],
      editions: [{ id: 'e1', isbn: null, publisher: 'Kurokawa', language: 'fr', format: 'manga', translator: null, pageCount: null }],
      tomes: [
        { numero: 1, titre: null, isbn: '9782351423554', possession: 'possede' },
        { numero: 2, titre: null, isbn: null, possession: 'non_possede' },
      ],
      medias: [{ id: 'm1', type: 'anime', titre: null, saisons: 2, episodes: 48, episodesVus: 5 }],
      monEdition: 'e1',
    })
    const etat = etatDepuisOeuvre(oeuvre)
    expect(valider(etat)).toEqual({})
    expect(versEnvoi(etat, oeuvre.id)).toEqual({
      id: 'w1',
      title_fr: 'Vinland Saga',
      title_original: 'ヴィンランド・サガ',
      original_language: 'ja',
      first_published_year: 2005,
      form: 'manga',
      synopsis: 'Texte.',
      tone: 3,
      density: 2,
      length: 'long',
      is_series: true,
      authors: [{ name: 'Makoto Yukimura', role: 'auteur' }],
      tags: [{ kind: 'theme', name: 'Rédemption' }],
      editions: [{ id: 'e1', isbn: null, publisher: 'Kurokawa', language: 'fr', format: 'manga', translator: null, page_count: null, mienne: true }],
      volumes: [
        { number: 1, title: null, isbn: '9782351423554' },
        { number: 2, title: null, isbn: null },
      ],
      media: [{ id: 'm1', kind: 'anime', title: null, seasons: 2, episodes_total: 48 }],
    })
  })
})
