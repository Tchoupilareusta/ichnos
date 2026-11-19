// Le suivi de lecture (docs/reference.md §5, §6.1, §6.3, §6.4) : unités, progression écrite
// en mots, parcours, ressenti, tomes et média. Règles pures, sans base ni écran.

export type Unite = 'page' | 'chapitre' | 'tome' | 'lettre' | 'section' | 'pourcentage'
export type Appreciation = 'marque' | 'beau_moment' | 'pas_pour_moi' | 'a_relire'
export type LectureTome = 'a_lire' | 'en_cours' | 'lu'
export type StatutMedia = 'a_voir' | 'en_cours' | 'termine'
export type PrecisionDate = 'jour' | 'mois' | 'annee'
export type TypeEvenement = 'commence' | 'progression' | 'mis_en_pause' | 'repris' | 'termine'

/** Un événement de l'historique discret : jamais montré en statistique. */
export type Evenement = { type: TypeEvenement; valeur: number | null; date: string; precision: PrecisionDate }

/** Où j'en suis, dans l'unité choisie. Pour une série, tiré des tomes. */
export type Progression = { unite: Unite; position: number | null; total: number | null }

/** Unités, dans l'ordre du menu. « tome » n'est proposé que pour une série, où il est la seule unité. */
export const UNITES: { valeur: Unite; libelle: string; pluriel: string; abrege?: string }[] = [
  { valeur: 'page', libelle: 'Page', pluriel: 'pages', abrege: 'p.' },
  { valeur: 'chapitre', libelle: 'Chapitre', pluriel: 'chapitres' },
  { valeur: 'lettre', libelle: 'Lettre', pluriel: 'lettres' },
  { valeur: 'section', libelle: 'Section', pluriel: 'sections' },
  { valeur: 'pourcentage', libelle: 'Pourcentage', pluriel: 'pour cent' },
  { valeur: 'tome', libelle: 'Tome', pluriel: 'tomes' },
]
export const UNITES_LIVRE = UNITES.filter((u) => u.valeur !== 'tome')

export const APPRECIATIONS: { valeur: Appreciation; libelle: string }[] = [
  { valeur: 'marque', libelle: 'M’a marqué' },
  { valeur: 'beau_moment', libelle: 'Beau moment' },
  { valeur: 'pas_pour_moi', libelle: 'Pas pour moi, pas maintenant' },
  { valeur: 'a_relire', libelle: 'À relire un jour' },
]

export const LECTURES_TOME: { valeur: LectureTome; libelle: string }[] = [
  { valeur: 'a_lire', libelle: 'À lire' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'lu', libelle: 'Lu' },
]

export const STATUTS_MEDIA: { valeur: StatutMedia; libelle: string }[] = [
  { valeur: 'a_voir', libelle: 'À voir' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'termine', libelle: 'Vu' },
]

const libelle = <T extends string>(liste: { valeur: T; libelle: string }[], valeur: T | null | undefined) =>
  liste.find((e) => e.valeur === valeur)?.libelle ?? ''

export const libelleUnite = (unite: Unite) => libelle(UNITES, unite)
export const libelleAppreciation = (a: Appreciation) => libelle(APPRECIATIONS, a)
export const libelleLectureTome = (l: LectureTome) => libelle(LECTURES_TOME, l)
export const libelleStatutMedia = (s: StatutMedia) => libelle(STATUTS_MEDIA, s)

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

/** Le tome courant d'une série : le plus haut tome en cours, ou à défaut le plus haut tome lu. */
export function progressionSerie(tomes: { numero: number; lecture: LectureTome }[]): Progression {
  const plusHaut = (lecture: LectureTome) =>
    tomes.filter((t) => t.lecture === lecture).reduce<number | null>((max, t) => (max === null || t.numero > max ? t.numero : max), null)
  return { unite: 'tome', position: plusHaut('en_cours') ?? plusHaut('lu'), total: tomes.length || null }
}

/**
 * La progression d'un livre. Sans unité choisie, l'appli propose « page », avec pour total
 * le nombre de pages de mon édition s'il est connu (jamais deviné). Une fois l'unité choisie,
 * seul le total enregistré compte : si je l'ai vidé, il reste vide.
 */
export function progressionLivre(
  unite: Unite | null,
  position: number | null,
  total: number | null,
  pagesEdition: number | null,
): Progression {
  const choisie = unite ?? 'page'
  if (choisie === 'pourcentage') return { unite: choisie, position, total: 100 }
  return { unite: choisie, position, total: total ?? (unite === null ? pagesEdition : null) }
}

/** Le total qu'on me propose quand je choisis une unité : le nombre de pages de mon édition, pour « page ». */
export function totalPropose(unite: Unite, pagesEdition: number | null): number | null {
  if (unite === 'pourcentage') return null
  return unite === 'page' ? pagesEdition : null
}

/** La progression en mots : « p. 75 sur 230 », « Lettre 12 », « Tome 4 sur 29 », « 42 % ». Null si rien n'est noté. */
export function texteProgression(p: Progression, { long = false }: { long?: boolean } = {}): string | null {
  if (p.position === null) return null
  if (p.unite === 'pourcentage') return long ? `${p.position} pour cent` : `${p.position} %`
  const u = UNITES.find((x) => x.valeur === p.unite)!
  const debut = !long && u.abrege ? `${u.abrege} ${p.position}` : `${u.libelle} ${p.position}`
  return p.total !== null ? `${debut} sur ${p.total}` : debut
}

/** Part lue, de 0 à 100 : seulement si un total est connu. */
export function pourcentage(p: Progression): number | null {
  if (p.position === null || p.total === null || p.total <= 0) return null
  return Math.min(100, Math.max(0, Math.round((p.position / p.total) * 100)))
}

export const totalAtteint = (p: Progression) => p.position !== null && p.total !== null && p.position >= p.total

/** La position suivante ou précédente, sans sortir de 0…total (ni du premier au dernier tome). Le premier + mène à 1. */
export function pas(p: Progression, sens: 1 | -1, minimum = 0): number {
  const plafond = p.total ?? Number.POSITIVE_INFINITY
  if (p.position === null) return sens === 1 ? Math.min(plafond, Math.max(minimum, 1)) : minimum
  return Math.min(plafond, Math.max(minimum, p.position + sens))
}

/** Les mots de chaque unité, pour les boutons et les champs (lus par VoiceOver). */
export const MOTS_UNITE: Record<Unite, { plus: string; moins: string; jenSuis: string; saisir: string }> = {
  page: { plus: 'Une page de plus', moins: 'Une page de moins', jenSuis: 'J’en suis à la page', saisir: 'Saisir la page' },
  chapitre: { plus: 'Un chapitre de plus', moins: 'Un chapitre de moins', jenSuis: 'J’en suis au chapitre', saisir: 'Saisir le chapitre' },
  lettre: { plus: 'Une lettre de plus', moins: 'Une lettre de moins', jenSuis: 'J’en suis à la lettre', saisir: 'Saisir la lettre' },
  section: { plus: 'Une section de plus', moins: 'Une section de moins', jenSuis: 'J’en suis à la section', saisir: 'Saisir la section' },
  tome: { plus: 'Un tome de plus', moins: 'Un tome de moins', jenSuis: 'J’en suis au tome', saisir: 'Saisir le tome' },
  pourcentage: { plus: 'Un pour cent de plus', moins: 'Un pour cent de moins', jenSuis: 'J’en suis à (pour cent)', saisir: 'Saisir le pourcentage' },
}

/** Le grand chiffre de la fiche, sans le total : « Page 75 », « Lettre 12 », « 42 % ». */
export function texteSansTotal(p: Progression): string | null {
  return texteProgression({ ...p, total: null }, { long: true })?.replace(' pour cent', ' %') ?? null
}

// ---------------------------------------------------------------------------
// Mon parcours
// ---------------------------------------------------------------------------

export type DateFin = { date: string; precision: PrecisionDate }
export type LectureFaite = { debut: string | null; fin: DateFin | null }

/** Les lectures, dans l'ordre : chaque « commencé » en ouvre une ; un « terminé » la ferme. */
export function lecturesFaites(historique: Evenement[]): LectureFaite[] {
  const lectures: LectureFaite[] = []
  const ordonne = [...historique].sort((a, b) => a.date.localeCompare(b.date))
  for (const ev of ordonne) {
    const courante = lectures[lectures.length - 1]
    if (ev.type === 'commence') lectures.push({ debut: ev.date, fin: null })
    else if (ev.type === 'termine') {
      if (courante && courante.fin === null) courante.fin = { date: ev.date, precision: ev.precision }
      else lectures.push({ debut: null, fin: { date: ev.date, precision: ev.precision } })
    }
  }
  return lectures
}

const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' })

/**
 * Une date en mots, dans le fuseau de l'appareil : « le 3 mars », « le 1er mars 2025 », « en mars 2019 », « en 2019 ».
 * Une date approximative est lue en UTC (elle est enregistrée à midi UTC).
 */
export function texteDate(iso: string, precision: PrecisionDate, aujourdhui = new Date()): string {
  const d = new Date(iso)
  if (precision === 'annee') return `en ${d.getUTCFullYear()}`
  if (precision === 'mois') return `en ${MOIS.format(d)} ${d.getUTCFullYear()}`
  const jour = d.getDate()
  const mois = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(d)
  const annee = d.getFullYear() === aujourdhui.getFullYear() ? '' : ` ${d.getFullYear()}`
  return `le ${jour === 1 ? '1er' : jour} ${mois}${annee}`
}

/** « Commencé le 3 mars · terminé le 20 avril » ; « Terminé en 2019 » ; « Relecture commencée le 2 juin ». */
export function texteParcours(lectures: LectureFaite[], aujourdhui = new Date()): string[] {
  return lectures.map((l, rang) => {
    const relecture = rang > 0
    const debut = l.debut ? `${relecture ? 'commencée' : 'commencé'} ${texteDate(l.debut, 'jour', aujourdhui)}` : null
    const fin = l.fin ? `${relecture ? 'terminée' : 'terminé'} ${texteDate(l.fin.date, l.fin.precision, aujourdhui)}` : null
    const corps = [debut, fin].filter(Boolean).join(' · ')
    const phrase = relecture ? `Relecture ${corps}` : corps
    return phrase.charAt(0).toUpperCase() + phrase.slice(1)
  })
}

/** La date de fin de la dernière lecture, si elle est notée (pour « Modifier » ou « Retirer »). */
export function derniereFin(historique: Evenement[]): DateFin | null {
  const lectures = lecturesFaites(historique)
  return lectures[lectures.length - 1]?.fin ?? null
}

/** Une date saisie (jour, mois ou année) en date ISO du premier jour, ou null si elle est incomplète ou à venir. */
export function dateSaisie(
  precision: PrecisionDate,
  champs: { jour?: string; mois?: string; annee?: string },
  aujourdhui = new Date(),
): string | null {
  let iso: string | null = null
  if (precision === 'jour') iso = /^\d{4}-\d{2}-\d{2}$/.test(champs.jour ?? '') ? champs.jour! : null
  else {
    const annee = Number(champs.annee)
    if (!/^\d{4}$/.test(champs.annee ?? '') || annee < 1900) return null
    const mois = precision === 'mois' ? Number(champs.mois) : 1
    if (!Number.isInteger(mois) || mois < 1 || mois > 12) return null
    iso = `${annee}-${String(mois).padStart(2, '0')}-01`
  }
  if (!iso) return null
  const limite = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`
  return iso > limite ? null : iso
}

// ---------------------------------------------------------------------------
// Média associé
// ---------------------------------------------------------------------------

/** « Épisode 14 sur 48 », « Épisode 14 ». Null avant le premier épisode. */
export function texteEpisodes(vus: number | null, total: number | null): string | null {
  if (vus === null || vus === 0) return null
  return total !== null ? `Épisode ${vus} sur ${total}` : `Épisode ${vus}`
}

/** L'historique après avoir saisi (ou retiré) la date de fin de la dernière lecture, comme le fait dater_fin. */
export function historiqueAvecFin(historique: Evenement[], date: string | null, precision: PrecisionDate): Evenement[] {
  const types = historique.map((e) => e.type)
  const fin = types.lastIndexOf('termine')
  const debut = types.lastIndexOf('commence')
  const sans = fin > debut ? historique.filter((_, i) => i !== fin) : historique
  if (date === null) return sans
  const evenement: Evenement = { type: 'termine', valeur: null, date: `${date}T12:00:00.000Z`, precision }
  return [...sans, evenement].sort((a, b) => a.date.localeCompare(b.date))
}
