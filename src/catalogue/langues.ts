// Noms français des langues, d'après leur code (ISO 639-1 ; « grc » pour le grec ancien).
// Les codes sont ceux de works.original_language et de editions.language.

const NOMS: Record<string, string> = {
  fr: 'français',
  en: 'anglais',
  de: 'allemand',
  it: 'italien',
  es: 'espagnol',
  pt: 'portugais',
  ru: 'russe',
  ja: 'japonais',
  la: 'latin',
  grc: 'grec ancien',
  el: 'grec',
  ar: 'arabe',
  he: 'hébreu',
  zh: 'chinois',
  ko: 'coréen',
  hi: 'hindi',
  fa: 'persan',
  tr: 'turc',
  hu: 'hongrois',
  nl: 'néerlandais',
  sv: 'suédois',
  no: 'norvégien',
  da: 'danois',
  pl: 'polonais',
  cs: 'tchèque',
}

// Le h de « hébreu » est muet (de l’hébreu) ; celui de « hongrois » ou « hindi » est aspiré (du hongrois).
const H_MUETS = ['hébreu']

export function nomLangue(code: string | null | undefined): string | null {
  return code ? (NOMS[code] ?? null) : null
}

/** « de l’anglais », « du japonais » : élision devant une voyelle ou un h muet. */
export function deLaLangue(nom: string): string {
  const elision = /^[aàâeéèêëiîïoôuùûyœ]/i.test(nom) || H_MUETS.includes(nom.toLowerCase())
  return elision ? `de l’${nom}` : `du ${nom}`
}

/** « traduit de l’allemand ». Rien si la langue est inconnue : mieux vaut se taire que mal dire. */
export function traduitDe(code: string | null | undefined): string | null {
  const nom = nomLangue(code)
  return nom ? `traduit ${deLaLangue(nom)}` : null
}

/**
 * Vrai quand le champ « traduction » d'une édition précise lui-même d'où vient le texte
 * (« … (à partir de la version anglaise) »). Dire en plus « traduit de l’allemand » serait alors faux :
 * la mention automatique est omise. Cas connu : Découvrir un sens à sa vie, de Viktor Frankl.
 */
export function traductionIndirecte(traducteur: string | null | undefined): boolean {
  return /à partir d[e’']/i.test(traducteur ?? '')
}

/** La mention à afficher pour une édition traduite, ou rien si elle n'a pas lieu d'être. */
export function mentionTraduction(
  langueOrigine: string | null | undefined,
  langueEdition: string | null | undefined,
  traducteur?: string | null,
): string | null {
  if (!langueOrigine || !langueEdition || langueOrigine === langueEdition) return null
  return traductionIndirecte(traducteur) ? null : traduitDe(langueOrigine)
}
