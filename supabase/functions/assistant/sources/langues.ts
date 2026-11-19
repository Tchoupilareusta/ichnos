// Codes de langue : la BnF et Open Library utilisent trois lettres (ISO 639-2),
// l'appli deux (ISO 639-1, plus « grc » pour le grec ancien). Une langue inconnue reste vide.

const DEPUIS_TROIS_LETTRES: Record<string, string> = {
  fre: 'fr',
  fra: 'fr',
  eng: 'en',
  ger: 'de',
  deu: 'de',
  ita: 'it',
  spa: 'es',
  por: 'pt',
  rus: 'ru',
  jpn: 'ja',
  lat: 'la',
  grc: 'grc',
  gre: 'el',
  ell: 'el',
  ara: 'ar',
  heb: 'he',
  chi: 'zh',
  zho: 'zh',
  kor: 'ko',
  hin: 'hi',
  per: 'fa',
  fas: 'fa',
  tur: 'tr',
  hun: 'hu',
  dut: 'nl',
  nld: 'nl',
  swe: 'sv',
  nor: 'no',
  dan: 'da',
  pol: 'pl',
  cze: 'cs',
  ces: 'cs',
}

const CONNUES = new Set(Object.values(DEPUIS_TROIS_LETTRES))

/** Le code de l'appli pour un code à trois lettres, ou null s'il est inconnu. */
export const langueDepuisTroisLettres = (code: string | null | undefined): string | null =>
  (code && DEPUIS_TROIS_LETTRES[code.trim().toLowerCase()]) || null

/** Un code à deux lettres déjà connu de l'appli, ou null. */
export const langueConnue = (code: string | null | undefined): string | null => {
  const propre = code?.trim().toLowerCase().slice(0, 2)
  return propre && CONNUES.has(propre) ? propre : null
}
