// Ordre d'affichage des titres d'une œuvre (docs/reference.md §3, « Langue de lecture »).
// Si mon édition est dans la langue d'origine de l'œuvre et que ce n'est pas le français
// (1984 lu en anglais), le titre original passe en premier. Sinon, le titre français d'abord.

export type TitresOeuvre = {
  title_fr: string
  title_original: string | null
  original_language: string | null
}

export type TitresAffiches = { principal: string; secondaire: string | null }

export function titresAffiches(oeuvre: TitresOeuvre, langueEdition: string | null | undefined): TitresAffiches {
  const original = oeuvre.title_original?.trim() || null
  const autre = (titre: string | null, reference: string) => (titre && titre !== reference ? titre : null)

  const luEnVersionOriginale =
    original !== null && !!langueEdition && langueEdition !== 'fr' && langueEdition === oeuvre.original_language

  return luEnVersionOriginale
    ? { principal: original, secondaire: autre(oeuvre.title_fr, original) }
    : { principal: oeuvre.title_fr, secondaire: autre(original, oeuvre.title_fr) }
}
