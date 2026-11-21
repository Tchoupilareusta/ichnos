// Le choix des propositions (§7.1 à §7.5) : candidats, mises de côté, variété, livre en pause,
// « D'autres idées ». Calcul pur et déterministe : mêmes entrées, mêmes sorties.
import { REGLES } from './envies'
import { JOURS_DE_COTE, type Envie, type Idees, type OeuvreIdee } from './modele'
import { morceauxDe } from './phrase'
import { JOUR, contexteDe, ecartDeTonalite, familleDe, noter, ressemblanceDe, type Note } from './score'

export type Demande = {
  envie: Envie
  /** Fixe le hasard. Dans l'appli : `graineDuJour` ; dans les tests : un texte écrit en dur. */
  graine: string
  maintenant: Date
  /** Les œuvres déjà vues depuis l'ouverture de l'écran : « D'autres idées » ne les redonne pas. */
  dejaVues?: readonly string[]
  /** Combien de propositions au plus (3 sur Découvrir, 1 sur l'accueil). */
  combien?: number
  /** Jamais de livre « En pause » (la suggestion de l'accueil). */
  sansPause?: boolean
  /**
   * Des œuvres à placer d'abord, dans cet ordre, si elles sont encore candidates : la page déjà
   * affichée, qu'on ne veut pas voir changer sous le doigt. Elles passent avant « déjà vues ».
   */
  imposees?: readonly string[]
  /** Compléter après les œuvres imposées jusqu'à `combien` (vrai par défaut). */
  completer?: boolean
}

export type Proposition = {
  oeuvre: OeuvreIdee
  /** La phrase d'explication (§7.4). */
  phrase: string
  /** Ses morceaux, deux au plus. */
  morceaux: string[]
}

/**
 * Où en est l'envie, pour que l'écran choisisse sa phrase calme :
 * `normal` ; `peu` (une ou deux idées en tout pour cette envie) ; `aucune` (rien pour cette envie :
 * tout est lu, en cours ou de côté) ; `tout_vu` (tout a déjà été montré) ; `sans_lecture_recente`
 * (« Changer d'univers » n'a pas de point de départ) ; `rien_a_decouvrir` (aucune œuvre à
 * découvrir dans toute la bibliothèque) ; `bibliotheque_vide`.
 */
export type Situation = 'normal' | 'peu' | 'aucune' | 'tout_vu' | 'sans_lecture_recente' | 'rien_a_decouvrir' | 'bibliotheque_vide'

export type Resultat = {
  propositions: Proposition[]
  situation: Situation
  /**
   * Ce que « D'autres idées » peut faire : `autres` (il reste des idées pas encore vues) ;
   * `debut` (tout a été vu : revoir depuis le début) ; null (pas d'autres idées : pas de bouton).
   */
  suite: 'autres' | 'debut' | null
}

const CANDIDATS = ['a_decouvrir', 'envie_de_lire', 'en_pause']
const parNote = (a: Note, b: Note) => b.score - a.score || (a.oeuvre.id < b.oeuvre.id ? -1 : 1)
const memeAuteur = (a: OeuvreIdee, b: OeuvreIdee) => a.auteurs.some((auteur) => b.auteurs.includes(auteur))

/** Les œuvres mises de côté depuis moins de trois semaines. Passé ce délai, elles reviennent sans pénalité. */
function encoreDeCote(idees: Idees, maintenant: Date): Set<string> {
  const instant = maintenant.getTime()
  const deCote = new Set<string>()
  for (const mise of idees.deCote) {
    const depuis = Date.parse(mise.depuis)
    if (Number.isNaN(depuis) || instant - depuis < JOURS_DE_COTE * JOUR) deCote.add(mise.oeuvre)
  }
  return deCote
}

export function proposer(idees: Idees, demande: Demande): Resultat {
  const { envie, graine, maintenant, combien = 3, sansPause = false, completer = true } = demande
  const dejaVues = new Set(demande.dejaVues ?? [])
  const regle = REGLES[envie]
  const contexte = contexteDe(idees.oeuvres, maintenant)
  const deCote = encoreDeCote(idees, maintenant)

  const aDecouvrir = idees.oeuvres.filter((o) => CANDIDATS.includes(o.statut) && !(sansPause && o.statut === 'en_pause'))
  // Le filtre de l'envie s'applique d'abord : ce qui reste est ce qui peut être proposé, rien d'autre.
  const notes = aDecouvrir
    .filter((o) => !deCote.has(o.id) && regle.filtre(o))
    .map((o) => noter(o, envie, graine, contexte))
    .filter((note) => regle.seuilContraste === undefined || (contexte.recentes.length > 0 && note.contraste >= regle.seuilContraste))
    .sort(parNote)

  // La page déjà affichée d'abord, telle quelle.
  const choisies: Note[] = []
  for (const id of demande.imposees ?? []) {
    const note = notes.find((n) => n.oeuvre.id === id)
    if (note && !choisies.includes(note) && choisies.length < combien) choisies.push(note)
  }
  const fond = notes.filter((n) => !choisies.includes(n) && !dejaVues.has(n.oeuvre.id))

  // Variété (§7.2) : les propositions sont choisies une à une ; une candidate perd des points si
  // elle ressemble à une proposition déjà retenue, et deux règles fermes s'ajoutent.
  const estPause = (n: Note) => n.oeuvre.statut === 'en_pause'
  const choisir = (pauseEnPremier: boolean) => {
    while (completer && choisies.length < combien) {
      let meilleure: Note | null = null
      let valeur = -Infinity
      for (const candidate of fond) {
        if (choisies.includes(candidate)) continue
        const o = candidate.oeuvre
        // Jamais deux œuvres du même auteur, ni deux œuvres aux mêmes genres et à la même tonalité.
        if (choisies.some((c) => memeAuteur(c.oeuvre, o))) continue
        if (choisies.some((c) => c.oeuvre.tonalite === o.tonalite && ressemblanceDe(c.oeuvre.genres, o.genres) === 1)) continue
        // Un livre en pause : jamais en premier, et un seul par groupe.
        if (estPause(candidate) && ((choisies.length === 0 && !pauseEnPremier) || choisies.some(estPause))) continue
        let ressemblance = 0
        let memeFamille = 0
        for (const c of choisies) {
          const genres = ressemblanceDe(c.oeuvre.genres, o.genres) ?? 0
          ressemblance = Math.max(ressemblance, 0.6 * genres + 0.4 * (1 - ecartDeTonalite(c.oeuvre.tonalite, o.tonalite)))
          if (familleDe(c.oeuvre) === familleDe(o)) memeFamille = 1
        }
        const v = candidate.score - regle.variete.ressemblance * ressemblance - regle.variete.famille * memeFamille
        if (v > valeur) {
          meilleure = candidate
          valeur = v
        }
      }
      if (!meilleure) break
      choisies.push(meilleure)
    }
  }
  choisir(false)
  // S'il ne reste que des livres en pause, un seul peut être proposé, sans insister.
  if (choisies.length === 0) choisir(true)

  const dites = new Set<string>()
  const propositions = choisies.map((note) => {
    const morceaux = morceauxDe(note, envie, contexte, dites)
    return { oeuvre: note.oeuvre, phrase: morceaux.join(' '), morceaux }
  })

  const reste = fond.filter((n) => !choisies.includes(n)).length
  const dejaMontrees = notes.some((n) => dejaVues.has(n.oeuvre.id) && !choisies.includes(n))
  const suite = reste > 0 ? 'autres' : dejaMontrees ? 'debut' : null

  let situation: Situation = 'normal'
  if (idees.oeuvres.length === 0) situation = 'bibliotheque_vide'
  else if (notes.length === 0) {
    if (aDecouvrir.length === 0) situation = 'rien_a_decouvrir'
    else if (regle.seuilContraste !== undefined && contexte.recentes.length === 0) situation = 'sans_lecture_recente'
    else situation = 'aucune'
  } else if (propositions.length === 0) situation = 'tout_vu'
  else if (suite === null && propositions.length < Math.min(combien, 3)) situation = 'peu'

  return { propositions, situation, suite }
}

/** La phrase calme qui accompagne un résultat, ou null quand il n'y a rien à dire. Jamais un chiffre de trop, jamais une pression. */
export function messageDe(resultat: Resultat): string | null {
  switch (resultat.situation) {
    case 'bibliotheque_vide':
      return 'Dès que ma bibliothèque aura quelques œuvres à découvrir, des idées selon mon humeur apparaîtront ici.'
    case 'rien_a_decouvrir':
      return 'Tout ce qui est dans ma bibliothèque est lu ou en cours.'
    case 'sans_lecture_recente':
      return 'Cette envie part de mes dernières lectures : rien de récent pour l’instant.'
    case 'aucune':
      return 'Aucune idée pour cette envie pour l’instant.'
    case 'tout_vu':
      return 'Toutes les idées pour cette envie ont été vues.'
    case 'peu':
      return resultat.propositions.length === 1 ? 'Une seule idée pour cette envie, pour l’instant.' : 'Deux idées seulement pour cette envie, pour l’instant.'
    case 'normal':
      return resultat.suite === 'debut' ? 'Toutes les idées pour cette envie ont été vues.' : null
  }
}
