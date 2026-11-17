import fichier from '../../catalogue/catalogue-initial.json'

// Contrôle du fichier public catalogue/catalogue-initial.json (docs/reference.md §9) :
// rien de personnel, rien d'inventé qui ne tienne pas debout, et des valeurs que la base acceptera.

type Edition = {
  publisher: string | null
  language: string
  format: string | null
  translator: string | null
  isbn: string | null
  page_count: number | null
}
type Oeuvre = {
  key: string
  title_fr: string
  title_original: string | null
  original_language: string | null
  first_published_year: number | null
  form: string
  is_series: boolean
  authors: { name: string; role: string }[]
  synopsis: string
  tone: number
  density: number
  length: string
  genres: string[]
  themes: string[]
  atmospheres: string[]
  editions: Edition[]
  volumes: { number: number; title: string | null; isbn: string | null }[]
  media: { kind: string; title: string | null; seasons: number | null; episodes_total: number | null }[]
  relecture: { sources: { label: string; url: string }[]; a_trancher?: string }
}
type Catalogue = {
  relecture_generale: { themes_proposes: { name: string; pour: string[]; raison: string }[]; points: string[] }
  tags: { genre: string[]; atmosphere: string[]; theme: { name: string; is_interest: boolean }[] }
  works: Oeuvre[]
}

const catalogue = fichier as unknown as Catalogue

// Mêmes listes que les contraintes de supabase/migrations/20261117100000_catalogue.sql.
const FORMES = ['roman', 'roman_court', 'nouvelle', 'conte', 'poesie', 'essai', 'philosophie', 'manga', 'autre']
const LONGUEURS = ['court', 'moyen', 'long']
const ROLES = ['auteur', 'traducteur', 'illustrateur']
const MEDIAS = ['anime', 'film', 'serie', 'autre']
const FORMAT_ISBN = /^(97[89][0-9]{10}|[0-9]{9}[0-9X])$/

// Les deux seules œuvres dont l'édition de référence est en anglais (docs/reference.md §3, « Langue de lecture »).
const EDITIONS_ANGLAISES = ['1984', 'la-ferme-des-animaux']

function cleIsbnValide(isbn: string): boolean {
  if (isbn.length === 13) {
    const somme = [...isbn].reduce((total, chiffre, i) => total + Number(chiffre) * (i % 2 === 0 ? 1 : 3), 0)
    return somme % 10 === 0
  }
  const somme = [...isbn].reduce((total, c, i) => total + (c === 'X' ? 10 : Number(c)) * (10 - i), 0)
  return somme % 11 === 0
}

function tousLesIsbn(oeuvre: Oeuvre): string[] {
  return [...oeuvre.editions.map((e) => e.isbn), ...oeuvre.volumes.map((v) => v.isbn)].filter(
    (isbn): isbn is string => isbn !== null,
  )
}

describe('catalogue de départ', () => {
  it('compte les 35 œuvres prévues : 32 du cahier des charges et 3 mangas ajoutés', () => {
    expect(catalogue.works).toHaveLength(35)
  })

  it('ne contient rien de personnel', () => {
    // Statut, possession, progression, appréciation, notes : ces mots ne doivent apparaître nulle part comme champ.
    const champsInterdits = [
      'user_id',
      'reading_status',
      'ownership',
      'progress_unit',
      'progress_current',
      'progress_total',
      'appreciation',
      'started_at',
      'finished_at',
      'notes',
      'episodes_watched',
      'status',
    ]
    const champs = new Set<string>()
    JSON.stringify(catalogue, (cle, valeur: unknown) => {
      champs.add(cle)
      return valeur
    })
    for (const interdit of champsInterdits) expect(champs.has(interdit), interdit).toBe(false)
  })

  it('a un vocabulaire sans doublon, où seuls des thèmes sont des centres d’intérêt', () => {
    const { genre, atmosphere, theme } = catalogue.tags
    for (const liste of [genre, atmosphere, theme.map((t) => t.name)]) {
      expect(new Set(liste).size).toBe(liste.length)
      for (const nom of liste) expect(nom.trim()).toBe(nom)
    }
    expect(theme.some((t) => t.is_interest)).toBe(true)
  })

  it('ne glisse aucun thème proposé dans le vocabulaire avant validation', () => {
    const themes = catalogue.tags.theme.map((t) => t.name)
    const cles = catalogue.works.map((o) => o.key)
    for (const propose of catalogue.relecture_generale.themes_proposes) {
      expect(themes).not.toContain(propose.name)
      for (const cle of propose.pour) expect(cles).toContain(cle)
    }
  })

  it('identifie chaque œuvre par une clé et un titre uniques', () => {
    const cles = catalogue.works.map((o) => o.key)
    const titres = catalogue.works.map((o) => o.title_fr)
    expect(new Set(cles).size).toBe(cles.length)
    expect(new Set(titres).size).toBe(titres.length)
  })

  it('n’a d’édition anglaise que pour 1984 et La Ferme des animaux', () => {
    const anglaises = catalogue.works.filter((o) => o.editions.some((e) => e.language !== 'fr')).map((o) => o.key)
    expect(anglaises.sort()).toEqual([...EDITIONS_ANGLAISES].sort())
  })

  describe.each(catalogue.works.map((oeuvre) => [oeuvre.title_fr, oeuvre] as const))('%s', (_titre, oeuvre) => {
    it('a des valeurs que la base acceptera', () => {
      expect(oeuvre.title_fr.trim()).not.toBe('')
      expect(FORMES).toContain(oeuvre.form)
      expect(LONGUEURS).toContain(oeuvre.length)
      for (const echelle of [oeuvre.tone, oeuvre.density]) {
        expect(Number.isInteger(echelle)).toBe(true)
        expect(echelle).toBeGreaterThanOrEqual(1)
        expect(echelle).toBeLessThanOrEqual(5)
      }
      if (oeuvre.first_published_year !== null) expect(Number.isInteger(oeuvre.first_published_year)).toBe(true)
      expect(oeuvre.authors.length).toBeGreaterThan(0)
      for (const auteur of oeuvre.authors) {
        expect(auteur.name.trim()).not.toBe('')
        expect(ROLES).toContain(auteur.role)
      }
      for (const media of oeuvre.media) expect(MEDIAS).toContain(media.kind)
      for (const edition of oeuvre.editions) {
        if (edition.page_count !== null) expect(edition.page_count).toBeGreaterThan(0)
      }
    })

    it('a une seule édition de référence, dans une langue que je lis', () => {
      expect(oeuvre.editions).toHaveLength(1)
      expect(['fr', 'en']).toContain(oeuvre.editions[0].language)
      // Une édition anglaise n'a de sens ici que pour une œuvre écrite en anglais.
      if (oeuvre.editions[0].language === 'en') expect(oeuvre.original_language).toBe('en')
    })

    it('a un synopsis rédigé', () => {
      expect(oeuvre.synopsis.length).toBeGreaterThan(150)
      expect(oeuvre.synopsis.length).toBeLessThan(700)
    })

    it('n’utilise que des étiquettes du vocabulaire, dans les quantités prévues', () => {
      const { genre, atmosphere, theme } = catalogue.tags
      for (const nom of oeuvre.genres) expect(genre).toContain(nom)
      for (const nom of oeuvre.atmospheres) expect(atmosphere).toContain(nom)
      for (const nom of oeuvre.themes) expect(theme.map((t) => t.name)).toContain(nom)
      for (const liste of [oeuvre.genres, oeuvre.atmospheres, oeuvre.themes]) expect(new Set(liste).size).toBe(liste.length)
      expect(oeuvre.genres.length).toBeGreaterThanOrEqual(1)
      expect(oeuvre.genres.length).toBeLessThanOrEqual(2)
      expect(oeuvre.themes.length).toBeGreaterThanOrEqual(3)
      expect(oeuvre.themes.length).toBeLessThanOrEqual(5)
      expect(oeuvre.atmospheres.length).toBeGreaterThanOrEqual(2)
      expect(oeuvre.atmospheres.length).toBeLessThanOrEqual(3)
    })

    it('n’a que des ISBN à 13 chiffres, à la clé de contrôle juste', () => {
      for (const isbn of tousLesIsbn(oeuvre)) {
        expect(isbn, isbn).toMatch(FORMAT_ISBN)
        expect(isbn, isbn).toHaveLength(13)
        expect(cleIsbnValide(isbn), isbn).toBe(true)
      }
    })

    it('numérote ses tomes sans trou ni doublon, et seulement si c’est une série', () => {
      const numeros = oeuvre.volumes.map((v) => v.number)
      expect(numeros).toEqual(numeros.map((_, i) => i + 1))
      expect(numeros.length > 0).toBe(oeuvre.is_series)
    })

    it('cite au moins une source', () => {
      expect(oeuvre.relecture.sources.length).toBeGreaterThan(0)
      for (const source of oeuvre.relecture.sources) expect(source.url).toMatch(/^https:\/\//)
    })
  })

  it('n’attribue jamais deux fois le même ISBN', () => {
    const isbn = catalogue.works.flatMap(tousLesIsbn)
    expect(new Set(isbn).size).toBe(isbn.length)
  })
})
