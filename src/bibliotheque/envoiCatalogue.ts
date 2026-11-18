// Ce que l'appli envoie à la base pour installer le catalogue de départ :
// le vocabulaire et les œuvres, sans les blocs de relecture (sources, remarques) ni les clés de travail.

type Texte = string | null

export type OeuvreEnvoyee = {
  title_fr: string
  title_original: Texte
  original_language: Texte
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
  editions: { publisher: Texte; language: Texte; format: Texte; translator: Texte; isbn: Texte; page_count: number | null }[]
  volumes: { number: number; title: Texte; isbn: Texte }[]
  media: { kind: string; title: Texte; seasons: number | null; episodes_total: number | null }[]
}

export type EnvoiCatalogue = {
  tags: { genre: string[]; atmosphere: string[]; theme: { name: string; is_interest: boolean }[] }
  works: OeuvreEnvoyee[]
}

/** Le fichier du catalogue, tel qu'il est publié : ce dont l'envoi a besoin, plus ce qu'il laisse de côté. */
export type FichierCatalogue = {
  tags: EnvoiCatalogue['tags']
  works: (OeuvreEnvoyee & Record<string, unknown>)[]
}

export function preparerEnvoi(fichier: FichierCatalogue): EnvoiCatalogue {
  return {
    tags: {
      genre: [...fichier.tags.genre],
      atmosphere: [...fichier.tags.atmosphere],
      theme: fichier.tags.theme.map(({ name, is_interest }) => ({ name, is_interest })),
    },
    works: fichier.works.map((o) => ({
      title_fr: o.title_fr,
      title_original: o.title_original,
      original_language: o.original_language,
      first_published_year: o.first_published_year,
      form: o.form,
      is_series: o.is_series,
      authors: o.authors.map(({ name, role }) => ({ name, role })),
      synopsis: o.synopsis,
      tone: o.tone,
      density: o.density,
      length: o.length,
      genres: [...o.genres],
      themes: [...o.themes],
      atmospheres: [...o.atmospheres],
      editions: o.editions.map(({ publisher, language, format, translator, isbn, page_count }) => ({
        publisher,
        language,
        format,
        translator,
        isbn,
        page_count,
      })),
      volumes: o.volumes.map(({ number, title, isbn }) => ({ number, title, isbn })),
      media: o.media.map(({ kind, title, seasons, episodes_total }) => ({ kind, title, seasons, episodes_total })),
    })),
  }
}
