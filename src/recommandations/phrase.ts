// La phrase d'explication (§7.4) : deux morceaux courts au plus, tirés des raisons réelles du
// score. Voix (§3) : la première personne pour ce qui m'appartient (« mes thèmes de cœur »,
// « Je l'ai déjà »), une tournure neutre pour décrire le livre, l'infinitif pour la question
// (« Le reprendre ? »). Jamais de chiffre, jamais de « tu ».
//
// Les tournures évitent les pièges de grammaire : « après Titre » ne se contracte jamais ; les
// thèmes viennent après deux-points, sans article ; les atmosphères, au féminin dans mon
// vocabulaire, s'accordent avec « atmosphère ».
import type { Forme } from '../bibliotheque/modele'
import { ATMOSPHERES, ATMOSPHERES_DOUCES, GENRES, GENRES_PHILOSOPHIQUES, GENRES_QUI_DERANGENT, norme } from './envies'
import type { Envie, OeuvreIdee } from './modele'
import { genreDistinctif, ressemblanceDe, type Contexte, type Note } from './score'

/** Deux crans de tonalité (sur cinq) : en dessous, on ne parle pas de contraste. */
const ECART_NET = 2

const minuscule = (texte: string) => texte.charAt(0).toLocaleLowerCase('fr') + texte.slice(1)
/** « a et b ». Si un nom contient déjà « et » (« technologie et attention »), un point-virgule sépare : « liberté ; technologie et attention ». */
const liste = (elements: string[]) => {
  if (elements.length <= 1) return elements.join('')
  if (elements.some((element) => / et /.test(element))) return elements.join(' ; ')
  return `${elements.slice(0, -1).join(', ')} et ${elements[elements.length - 1]}`
}
/** Termine par un point, sauf si le texte (un titre) finit déjà par une ponctuation. */
const point = (texte: string) => (/[.?!…]$/.test(texte) ? texte : `${texte}.`)

/** Ce que « Court : … » dit du type d'œuvre. Un roman court se dit « Court. » tout seul. */
const EN_BREF: Partial<Record<Forme, string>> = {
  conte: 'un conte',
  nouvelle: 'une nouvelle',
  poesie: 'de la poésie',
  essai: 'un essai',
  philosophie: 'de la philosophie',
  roman: 'un roman',
  manga: 'un manga',
}

/** « Dystopie, atmosphère dérangeante et ironique. », ou seulement l'un des deux. */
function decrire(genre: string | null, atmospheres: string[]): string | null {
  const ambiance = atmospheres.length > 0 ? `tmosphère ${liste(atmospheres.map(minuscule))}.` : null
  if (genre && ambiance) return `${genre}, a${ambiance}`
  if (genre) return `${genre}.`
  return ambiance ? `A${ambiance}` : null
}

/** Les atmosphères de l'œuvre, celles qui comptent pour l'envie d'abord ; deux au plus. */
function atmospheresDabord(o: OeuvreIdee, dabord: string[]): string[] {
  const compte = (nom: string) => dabord.some((d) => norme(d) === norme(nom))
  return [...o.atmospheres.filter(compte), ...o.atmospheres.filter((nom) => !compte(nom))].slice(0, 2)
}

const genreParmi = (o: OeuvreIdee, noms: string[]) => noms.map((nom) => o.genres.find((g) => norme(g) === norme(nom))).find((g) => g !== undefined) ?? null

/** Ce qui distingue l'œuvre de ma dernière lecture, si quelque chose la distingue nettement. */
function morceauApres(note: Note, derniere: OeuvreIdee, envie: Envie, contexte: Contexte): string | null {
  const o = note.oeuvre
  if (note.ecartTon !== null && note.ecartTon >= ECART_NET) return point(`${o.tonalite === 5 ? 'Lumineux' : 'Plus lumineux'}, après ${derniere.titre}`)
  if (note.ecartTon !== null && note.ecartTon <= -ECART_NET) return point(`Plus grave, après ${derniere.titre}`)
  if ((envie === 'surprise' || envie === 'changer_d_univers') && ressemblanceDe(o.genres, derniere.genres) === 0)
    return `Un autre registre, après ${derniere.titre} : ${minuscule(genreDistinctif(o, contexte) ?? o.genres[0])}.`
  return null
}

/** Ce qui fait entrer l'œuvre dans l'envie choisie. */
function morceauEnvie(o: OeuvreIdee, envie: Envie): string | null {
  switch (envie) {
    case 'lecture_courte': {
      const forme = EN_BREF[o.forme]
      return forme ? `Court : ${forme}.` : 'Court.'
    }
    case 'reconfortant':
      return decrire(null, atmospheresDabord(o, ATMOSPHERES_DOUCES)) ?? decrire(genreParmi(o, [GENRES.humaniste]), [])
    case 'philosophique':
      return decrire(genreParmi(o, GENRES_PHILOSOPHIQUES), atmospheresDabord(o, [ATMOSPHERES.introspective]))
    case 'remise_en_question':
      return decrire(genreParmi(o, GENRES_QUI_DERANGENT), atmospheresDabord(o, [ATMOSPHERES.derangeante]))
    default:
      return null
  }
}

/** L'œuvre aimée qui partage le plus de thèmes avec celle-ci (deux au moins). */
function morceauProche(o: OeuvreIdee, contexte: Contexte): string | null {
  let meilleure: { titre: string; communs: string[] } | null = null
  for (const aimee of contexte.aimees) {
    if (aimee.id === o.id) continue
    const communs = o.themes.filter((t) => aimee.themes.some((autre) => norme(autre.nom) === norme(t.nom))).map((t) => t.nom)
    if (communs.length >= 2 && (!meilleure || communs.length > meilleure.communs.length)) meilleure = { titre: aimee.titre, communs }
  }
  return meilleure ? `Des thèmes proches de ${meilleure.titre} : ${liste(meilleure.communs.slice(0, 2).map(minuscule))}.` : null
}

/**
 * Les morceaux de la phrase d'une proposition, deux au plus. `dites` retient ce qui a déjà été
 * dit dans le même groupe de trois : une même formule (« Plus grave, après Momo. », « Parmi mes
 * thèmes de cœur ») n'est gardée que sur la première carte, et jamais deux fois le même texte.
 */
export function morceauxDe(note: Note, envie: Envie, contexte: Contexte, dites: Set<string>): string[] {
  const o = note.oeuvre
  // Chaque morceau retenu garde sa place dans la phrase : ce qui distingue l'œuvre (0), ce
  // qu'elle est (1), ce dont elle parle (2), ce qui est déjà à moi (3). L'ordre des appels
  // ci-dessous, lui, est celui des priorités : les deux premiers morceaux possibles sont gardés.
  const retenus: { place: number; texte: string }[] = []
  /** Retient un morceau s'il reste de la place ; `formule` : une tournure à ne dire qu'une fois par groupe. */
  const dire = (place: number, texte: string | null, formule?: string): boolean => {
    if (!texte || retenus.length >= 2 || dites.has(texte) || (formule && dites.has(formule))) return false
    retenus.push({ place, texte })
    dites.add(texte)
    if (formule) dites.add(formule)
    return true
  }

  // 1. Ce qui la distingue maintenant : la pause, le contraste avec ma dernière lecture, l'envie choisie.
  const derniere = contexte.recentes[0]
  let apres = false
  if (o.statut === 'en_pause') retenus.push({ place: 0, texte: 'En pause pour l’instant. Le reprendre ?' })
  else if (derniere) apres = dire(0, morceauApres(note, derniere, envie, contexte), 'formule:apres')
  const dEnvie = dire(1, morceauEnvie(o, envie))

  // 2. Ce qui me la rapproche : une œuvre aimée, mes thèmes de cœur, mon envie de la lire, ma bibliothèque.
  const coeur = o.themes.filter((t) => t.coeur).map((t) => minuscule(t.nom))
  const desThemes =
    dire(2, morceauProche(o, contexte)) || (coeur.length > 0 && dire(2, `Parmi mes thèmes de cœur : ${liste(coeur.slice(0, 2))}.`, 'formule:coeur'))
  if (o.statut === 'envie_de_lire') dire(3, 'Déjà dans mes envies de lire.')
  else if (o.possession === 'possede') dire(3, 'Je l’ai déjà.')
  else if (o.possession === 'partielle') dire(3, 'J’en ai déjà une partie.')

  // 3. S'il reste de la place : ce dont le livre parle, puis ce qu'il est.
  if (!desThemes && o.themes.length > 0) dire(2, `Au cœur du livre : ${liste(o.themes.slice(0, 2).map((t) => minuscule(t.nom)))}.`)
  if (!dEnvie && !apres) dire(1, decrire(genreDistinctif(o, contexte), o.atmospheres.slice(0, 2)))
  if (retenus.length === 0) return ['Une idée parmi mes livres à découvrir.']
  return retenus.sort((a, b) => a.place - b.place).map((morceau) => morceau.texte)
}
