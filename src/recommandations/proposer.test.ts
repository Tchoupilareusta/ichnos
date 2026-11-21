import { catalogueEssai, VOCABULAIRE } from './catalogue.fictif'
import { ETIQUETTES_DES_ENVIES, REGLES } from './envies'
import { graineDuJour, hasard } from './hasard'
import { ENVIES, JOURS_DE_COTE, estEnvie, type Envie, type OeuvreIdee } from './modele'
import { messageDe, proposer, type Demande } from './proposer'
import { contexteDe, dernieresLectures, noter } from './score'

// L'algorithme des recommandations (docs/reference.md §7.1 à §7.5), sur mon vrai catalogue.
// Les situations de lecture sont des hypothèses écrites ici ; le hasard est fixé par la graine.

const JOUR = 86_400_000
const T = new Date('2026-11-21T12:00:00Z')
const ilYA = (jours: number) => new Date(T.getTime() - jours * JOUR).toISOString()
const dans = (jours: number) => new Date(T.getTime() + jours * JOUR)
const GRAINES = Array.from({ length: 300 }, (_, i) => `g${i}`)
const TOUTES: Envie[] = ENVIES.map((e) => e.valeur)
const A_FILTRE: Envie[] = ['reconfortant', 'philosophique', 'remise_en_question', 'lecture_courte']

const tirer = (oeuvres: OeuvreIdee[], demande: Partial<Demande> = {}, deCote: { oeuvre: string; depuis: string }[] = []) =>
  proposer({ oeuvres, deCote }, { envie: 'surprise', graine: 'essai', maintenant: T, ...demande })
/** Toutes les idées d'une envie, page après page (une seule page ne montre pas tout : la variété écarte les œuvres trop proches). */
function toutesLesIdees(oeuvres: OeuvreIdee[], demande: Partial<Demande> = {}, deCote: { oeuvre: string; depuis: string }[] = []): string[] {
  const vues: string[] = []
  for (let page = 0; page < 60; page++) {
    const resultat = tirer(oeuvres, { ...demande, dejaVues: vues }, deCote)
    vues.push(...resultat.propositions.map((p) => p.oeuvre.id))
    if (resultat.suite !== 'autres') break
  }
  return vues
}
const titres = (resultat: ReturnType<typeof tirer>) => resultat.propositions.map((p) => p.oeuvre.titre)
const lumineuse = (o: OeuvreIdee) => (o.tonalite ?? 0) >= 4
const memesGenres = (a: OeuvreIdee, b: OeuvreIdee) => [...a.genres].sort().join('|') === [...b.genres].sort().join('|')

const RIEN_DE_LU = catalogueEssai()
const APRES_CRIME = catalogueEssai({ 'Crime et Châtiment': { statut: 'termine', finieLe: ilYA(1) } })
/** Une bibliothèque déjà vivante : des lectures récentes, une pause, une envie, un livre à moi. */
const VIVANTE = catalogueEssai({
  'Vinland Saga': { statut: 'en_cours', toucheeLe: ilYA(1) },
  '1984': { statut: 'termine', finieLe: ilYA(5) },
  Momo: { statut: 'termine', finieLe: ilYA(40), appreciation: 'beau_moment' },
  'Lettres à Lucilius': { statut: 'en_pause' },
  Siddhartha: { statut: 'envie_de_lire', possession: 'possede' },
  'La Peste': { statut: 'envie_de_lire' },
})

describe('hasard doux', () => {
  it('rend toujours le même nombre pour la même graine, entre 0 et 1', () => {
    expect(hasard('2026-11-21|surprise', 'momo')).toBe(hasard('2026-11-21|surprise', 'momo'))
    for (const graine of GRAINES) {
      const tirage = hasard(graine, 'momo')
      expect(tirage).toBeGreaterThanOrEqual(0)
      expect(tirage).toBeLessThan(1)
    }
  })

  it('change avec la graine et avec l’œuvre, sans pencher d’un côté', () => {
    const tirages = GRAINES.map((graine) => hasard(graine, 'momo'))
    expect(new Set(tirages).size).toBe(300)
    const moyenne = tirages.reduce((somme, x) => somme + x, 0) / tirages.length
    expect(moyenne).toBeGreaterThan(0.4)
    expect(moyenne).toBeLessThan(0.6)
    expect(hasard('g1', 'momo')).not.toBe(hasard('g1', 'siddhartha'))
  })

  it('tire la graine du jour de la date locale et de l’envie', () => {
    expect(graineDuJour(new Date(2026, 10, 21, 8, 0), 'surprise')).toBe('2026-11-21|surprise')
    expect(graineDuJour(new Date(2026, 10, 21, 23, 59), 'surprise')).toBe('2026-11-21|surprise')
    expect(graineDuJour(new Date(2026, 10, 22, 0, 1), 'surprise')).toBe('2026-11-22|surprise')
    expect(graineDuJour(new Date(2026, 0, 5, 8, 0), 'lecture_courte')).toBe('2026-01-05|lecture_courte')
  })

  it('même graine, mêmes propositions et mêmes phrases ; d’autres graines, d’autres idées', () => {
    expect(tirer(VIVANTE, { graine: 'a' })).toEqual(tirer(VIVANTE, { graine: 'a' }))
    const premieres = new Set(GRAINES.map((graine) => titres(tirer(RIEN_DE_LU, { graine })).join(' / ')))
    expect(premieres.size).toBeGreaterThan(30)
  })
})

describe('les six envies', () => {
  it('portent les mêmes codes que la table des propositions, dans l’ordre de la référence', () => {
    expect(TOUTES).toEqual(['surprise', 'reconfortant', 'philosophique', 'remise_en_question', 'lecture_courte', 'changer_d_univers'])
    expect(ENVIES.map((e) => e.libelle)).toEqual([
      'Surprends-moi',
      'Quelque chose de réconfortant',
      'Une réflexion philosophique',
      'Remets mes idées en question',
      'Une lecture courte',
      'Changer d’univers',
    ])
    expect(estEnvie('reconfortant')).toBe(true)
    expect(estEnvie('autre')).toBe(false)
    expect(estEnvie(null)).toBe(false)
  })

  it('ne citent que des étiquettes de mon vocabulaire', () => {
    for (const genre of ETIQUETTES_DES_ENVIES.genres) expect(VOCABULAIRE.genres).toContain(genre)
    for (const atmosphere of ETIQUETTES_DES_ENVIES.atmospheres) expect(VOCABULAIRE.atmospheres).toContain(atmosphere)
  })

  it('ont assez de candidats dans le catalogue de départ', () => {
    const candidats = (envie: Envie) => RIEN_DE_LU.filter((o) => REGLES[envie].filtre(o)).length
    expect({
      reconfortant: candidats('reconfortant'),
      philosophique: candidats('philosophique'),
      remise_en_question: candidats('remise_en_question'),
      lecture_courte: candidats('lecture_courte'),
    }).toEqual({ reconfortant: 15, philosophique: 19, remise_en_question: 10, lecture_courte: 9 })
  })

  it('une lecture courte n’est jamais une série', () => {
    for (const graine of GRAINES) for (const p of tirer(RIEN_DE_LU, { envie: 'lecture_courte', graine }).propositions) expect(p.oeuvre.estSerie).toBe(false)
  })

  it('ne proposent jamais une œuvre hors sujet', () => {
    for (const bibliotheque of [RIEN_DE_LU, VIVANTE])
      for (const envie of A_FILTRE)
        for (const graine of GRAINES)
          for (const p of tirer(bibliotheque, { envie, graine }).propositions) expect(REGLES[envie].filtre(p.oeuvre), `${envie} : ${p.oeuvre.titre}`).toBe(true)
  })
})

describe('candidats', () => {
  it('jamais une œuvre « En cours » ou « Terminé »', () => {
    for (const envie of TOUTES)
      for (const graine of GRAINES)
        for (const p of tirer(VIVANTE, { envie, graine }).propositions) expect(['a_decouvrir', 'envie_de_lire', 'en_pause']).toContain(p.oeuvre.statut)
  })

  it('trois propositions au plus, sauf demande contraire', () => {
    expect(tirer(RIEN_DE_LU).propositions).toHaveLength(3)
    expect(tirer(RIEN_DE_LU, { combien: 1 }).propositions).toHaveLength(1)
  })
})

describe('mes dernières lectures', () => {
  it('ce sont mes lectures en cours et mes lectures terminées depuis moins de six mois, la plus récente d’abord', () => {
    expect(dernieresLectures(VIVANTE, T).map((o) => o.titre)).toEqual(['Vinland Saga', '1984', 'Momo'])
  })

  it('trois au plus', () => {
    const bibliotheque = catalogueEssai({
      Momo: { statut: 'termine', finieLe: ilYA(2) },
      '1984': { statut: 'termine', finieLe: ilYA(3) },
      'La Peste': { statut: 'termine', finieLe: ilYA(4) },
      'La Chute': { statut: 'termine', finieLe: ilYA(5) },
    })
    expect(dernieresLectures(bibliotheque, T).map((o) => o.titre)).toEqual(['Momo', '1984', 'La Peste'])
  })

  it('un livre terminé sans date, ou depuis plus de six mois, n’est pas une lecture récente', () => {
    const bibliotheque = catalogueEssai({
      Momo: { statut: 'termine', finieLe: null },
      '1984': { statut: 'termine', finieLe: ilYA(200) },
      'La Peste': { statut: 'termine', finieLe: '2019-01-01' },
    })
    expect(dernieresLectures(bibliotheque, T)).toEqual([])
  })
})

describe('après une lecture sombre, les lumineuses remontent', () => {
  it('le contraste des œuvres lumineuses passe au-dessus du neutre, pas celui des œuvres sombres', () => {
    const avant = contexteDe(RIEN_DE_LU, T)
    const apres = contexteDe(APRES_CRIME, T)
    const candidates = APRES_CRIME.filter((o) => o.statut === 'a_decouvrir')
    expect(candidates).toHaveLength(34)
    for (const o of candidates) {
      expect(noter(o, 'surprise', 'essai', avant).contraste).toBe(0.5)
      const contraste = noter(o, 'surprise', 'essai', apres).contraste
      if (lumineuse(o)) expect(contraste, o.titre).toBeGreaterThan(0.5)
      if ((o.tonalite ?? 3) <= 2) expect(contraste, o.titre).toBeLessThanOrEqual(0.5)
    }
  })

  it('« Surprends-moi » commence presque toujours par une œuvre lumineuse, et en propose davantage qu’avant', () => {
    let avant = 0
    let apres = 0
    let premieres = 0
    let premieresAvant = 0
    for (const graine of GRAINES) {
      const resultat = tirer(APRES_CRIME, { graine })
      if (lumineuse(resultat.propositions[0].oeuvre)) premieres++
      if (lumineuse(tirer(RIEN_DE_LU, { graine }).propositions[0].oeuvre)) premieresAvant++
      apres += resultat.propositions.filter((p) => lumineuse(p.oeuvre)).length
      avant += tirer(RIEN_DE_LU, { graine }).propositions.filter((p) => lumineuse(p.oeuvre)).length
    }
    expect(apres).toBeGreaterThan(avant)
    // Le hasard doux garde sa part (30 % en « Surprends-moi ») : presque toujours, pas toujours.
    expect(premieres).toBeGreaterThan(GRAINES.length * 0.9)
    expect(premieres).toBeGreaterThan(premieresAvant)

    // La variété garde une place à un autre ton : pas trois lumineuses à chaque fois.
    expect(apres).toBeLessThan(3 * GRAINES.length)
  })

  it('l’alternance n’est qu’un coup de pouce : la famille suivante n’est jamais imposée', () => {
    // Après Crime et Châtiment (philosophique), la famille suivante est « réconfortant ».
    const familles = new Set<string>()
    for (const graine of GRAINES) for (const p of tirer(APRES_CRIME, { graine }).propositions) familles.add(p.oeuvre.id)
    const horsFamille = APRES_CRIME.filter((o) => familles.has(o.id) && !REGLES.reconfortant.filtre(o))
    expect(horsFamille.length).toBeGreaterThan(3)
  })
})

describe('les trois propositions diffèrent entre elles', () => {
  it('jamais deux fois la même œuvre, le même auteur, ni les mêmes genres avec la même tonalité', () => {
    for (const bibliotheque of [RIEN_DE_LU, VIVANTE])
      for (const envie of TOUTES)
        for (const graine of GRAINES) {
          const { propositions } = tirer(bibliotheque, { envie, graine })
          for (let i = 0; i < propositions.length; i++)
            for (let j = i + 1; j < propositions.length; j++) {
              const [a, b] = [propositions[i].oeuvre, propositions[j].oeuvre]
              const cas = `${envie} ${graine} : ${a.titre} / ${b.titre}`
              expect(a.id, cas).not.toBe(b.id)
              expect(a.auteurs.some((auteur) => b.auteurs.includes(auteur)), cas).toBe(false)
              expect(memesGenres(a, b) && a.tonalite === b.tonalite, cas).toBe(false)
            }
        }
  })

  it('« Surprends-moi » mêle les tonalités plus souvent qu’une envie à filtre', () => {
    let melanges = 0
    for (const graine of GRAINES) {
      const tons = new Set(tirer(RIEN_DE_LU, { graine }).propositions.map((p) => lumineuse(p.oeuvre)))
      if (tons.size === 2) melanges++
    }
    expect(melanges).toBeGreaterThan(GRAINES.length * 0.7)
  })
})

describe('une envie sans assez de candidats', () => {
  const COURTES = RIEN_DE_LU.filter((o) => REGLES.lecture_courte.filtre(o)).map((o) => o.titre)
  const sauf = (gardees: string[]) =>
    catalogueEssai(Object.fromEntries(COURTES.filter((titre) => !gardees.includes(titre)).map((titre) => [titre, { statut: 'termine' as const }])))

  it('aucune idée : rien n’est proposé, et une phrase calme le dit', () => {
    const resultat = tirer(sauf([]), { envie: 'lecture_courte' })
    expect(resultat.propositions).toEqual([])
    expect(resultat.situation).toBe('aucune')
    expect(resultat.suite).toBeNull()
    expect(messageDe(resultat)).toBe('Aucune idée pour cette envie pour l’instant.')
  })

  it('deux idées : deux propositions, jamais une troisième hors sujet pour remplir', () => {
    for (const graine of GRAINES) {
      const resultat = tirer(sauf(['Le Petit Prince', 'La Chute']), { envie: 'lecture_courte', graine })
      expect(titres(resultat).sort()).toEqual(['La Chute', 'Le Petit Prince'])
      expect(resultat.situation).toBe('peu')
      expect(resultat.suite).toBeNull()
      expect(messageDe(resultat)).toBe('Deux idées seulement pour cette envie, pour l’instant.')
    }
  })

  it('une seule idée', () => {
    const resultat = tirer(sauf(['Le Petit Prince']), { envie: 'lecture_courte' })
    expect(titres(resultat)).toEqual(['Le Petit Prince'])
    expect(messageDe(resultat)).toBe('Une seule idée pour cette envie, pour l’instant.')
  })

  it('trois idées ou plus : aucune phrase', () => {
    const resultat = tirer(RIEN_DE_LU, { envie: 'lecture_courte' })
    expect(resultat.situation).toBe('normal')
    expect(messageDe(resultat)).toBeNull()
  })

  it('« Changer d’univers » part de mes dernières lectures : sans lecture récente, rien', () => {
    const resultat = tirer(RIEN_DE_LU, { envie: 'changer_d_univers' })
    expect(resultat.propositions).toEqual([])
    expect(resultat.situation).toBe('sans_lecture_recente')
    expect(messageDe(resultat)).toBe('Cette envie part de mes dernières lectures : rien de récent pour l’instant.')
  })

  it('« Changer d’univers » ne propose que ce qui change vraiment', () => {
    const contexte = contexteDe(VIVANTE, T)
    for (const graine of GRAINES) {
      const { propositions } = tirer(VIVANTE, { envie: 'changer_d_univers', graine })
      expect(propositions.length).toBeGreaterThan(0)
      for (const p of propositions) expect(noter(p.oeuvre, 'changer_d_univers', graine, contexte).contraste, p.oeuvre.titre).toBeGreaterThanOrEqual(0.5)
    }
  })

  it('tout est lu ou en cours : une phrase, et rien à proposer', () => {
    const toutLu = RIEN_DE_LU.map((o) => ({ ...o, statut: 'termine' as const }))
    for (const envie of TOUTES) {
      const resultat = tirer(toutLu, { envie })
      expect(resultat.propositions).toEqual([])
      expect(resultat.situation).toBe('rien_a_decouvrir')
      expect(messageDe(resultat)).toBe('Tout ce qui est dans ma bibliothèque est lu ou en cours.')
    }
  })

  it('bibliothèque vide : la phrase du premier lancement', () => {
    const resultat = tirer([])
    expect(resultat.situation).toBe('bibliotheque_vide')
    expect(messageDe(resultat)).toBe('Dès que ma bibliothèque aura quelques œuvres à découvrir, des idées selon mon humeur apparaîtront ici.')
  })
})

describe('un livre « En pause », avec douceur', () => {
  // Peu de candidats philosophiques restent : Lettres à Lucilius, en pause, a sa chance.
  const PHILOSOPHIQUES = RIEN_DE_LU.filter((o) => REGLES.philosophique.filtre(o)).map((o) => o.titre)
  const RESTENT = ['Lettres à Lucilius', 'Siddhartha', 'La Peste', 'Le Gai Savoir']
  const PEU = catalogueEssai({
    ...Object.fromEntries(PHILOSOPHIQUES.filter((titre) => !RESTENT.includes(titre)).map((titre) => [titre, { statut: 'termine' as const }])),
    'Lettres à Lucilius': { statut: 'en_pause' },
  })

  it('il peut être proposé, jamais en premier, et un seul à la fois', () => {
    let vu = 0
    const deuxPauses = PEU.map((o) => (o.titre === 'Le Gai Savoir' ? { ...o, statut: 'en_pause' as const } : o))
    for (const graine of GRAINES) {
      const { propositions } = tirer(PEU, { envie: 'philosophique', graine })
      expect(propositions[0].oeuvre.statut).not.toBe('en_pause')
      if (propositions.some((p) => p.oeuvre.statut === 'en_pause')) vu++
      const avecDeux = tirer(deuxPauses, { envie: 'philosophique', graine }).propositions
      expect(avecDeux[0].oeuvre.statut).not.toBe('en_pause')
      expect(avecDeux.filter((p) => p.oeuvre.statut === 'en_pause').length).toBeLessThanOrEqual(1)
    }
    // Contre-épreuve : il a bien été proposé, sinon ce test ne prouverait rien.
    expect(vu).toBeGreaterThan(0)
  })

  it('sa phrase pose une question, sans insister', () => {
    for (const graine of GRAINES) {
      const pause = tirer(PEU, { envie: 'philosophique', graine }).propositions.find((p) => p.oeuvre.statut === 'en_pause')
      if (pause) expect(pause.phrase.startsWith('En pause pour l’instant. Le reprendre ?')).toBe(true)
    }
  })

  it('sa note est un peu réduite : il ne passe pas devant à mérite égal', () => {
    const contexte = contexteDe(PEU, T)
    const enPause = PEU.find((o) => o.titre === 'Lettres à Lucilius') as OeuvreIdee
    const note = noter(enPause, 'philosophique', 'essai', contexte)
    const sansPause = noter({ ...enPause, statut: 'a_decouvrir' }, 'philosophique', 'essai', contexte)
    expect(note.score).toBeCloseTo(sansPause.score * 0.8, 10)
  })

  it('jamais dans la suggestion de l’accueil', () => {
    for (const graine of GRAINES)
      for (const p of tirer(PEU, { combien: 1, sansPause: true, graine }).propositions) expect(p.oeuvre.statut).not.toBe('en_pause')
    const quePauses = RIEN_DE_LU.map((o) => ({ ...o, statut: 'en_pause' as const }))
    expect(tirer(quePauses, { combien: 1, sansPause: true }).propositions).toEqual([])
  })

  it('s’il ne reste que des livres en pause, un seul est proposé', () => {
    const quePauses = RIEN_DE_LU.map((o) => ({ ...o, statut: 'en_pause' as const }))
    const { propositions } = tirer(quePauses)
    expect(propositions).toHaveLength(1)
  })
})

describe('une idée mise de côté', () => {
  const DE_COTE = [{ oeuvre: 'momo', depuis: T.toISOString() }]
  const presente = (maintenant: Date, envie: Envie = 'surprise') => toutesLesIdees(RIEN_DE_LU, { envie, maintenant }, DE_COTE).includes('momo')

  it('n’est pas reproposée pendant trois semaines, pour aucune envie', () => {
    expect(JOURS_DE_COTE).toBe(21)
    // Contre-épreuve : sans mise de côté, Momo fait bien partie des idées.
    expect(toutesLesIdees(RIEN_DE_LU)).toContain('momo')
    expect(toutesLesIdees(RIEN_DE_LU)).toHaveLength(35)
    for (const jours of [0, 1, 20, 20.9]) {
      expect(presente(dans(jours)), `jour ${jours}`).toBe(false)
      expect(presente(dans(jours), 'reconfortant'), `jour ${jours}`).toBe(false)
    }
  })

  it('revient ensuite, avec exactement la même note qu’avant', () => {
    expect(presente(dans(21))).toBe(true)
    expect(presente(dans(60), 'reconfortant')).toBe(true)
    const momo = RIEN_DE_LU.find((o) => o.id === 'momo') as OeuvreIdee
    const contexte = contexteDe(RIEN_DE_LU, dans(21))
    expect(tirer(RIEN_DE_LU, { maintenant: dans(21) }, DE_COTE)).toEqual(tirer(RIEN_DE_LU, { maintenant: dans(21) }))
    expect(toutesLesIdees(RIEN_DE_LU, { maintenant: dans(21) }, DE_COTE)).toEqual(toutesLesIdees(RIEN_DE_LU, { maintenant: dans(21) }))
    expect(noter(momo, 'surprise', 'essai', contexte).score).toBeGreaterThan(0)
  })

  it('quand toute une envie est de côté, la phrase calme le dit', () => {
    const courtes = RIEN_DE_LU.filter((o) => REGLES.lecture_courte.filtre(o)).map((o) => ({ oeuvre: o.id, depuis: T.toISOString() }))
    const resultat = tirer(RIEN_DE_LU, { envie: 'lecture_courte' }, courtes)
    expect(resultat.propositions).toEqual([])
    expect(resultat.situation).toBe('aucune')
  })
})

describe('« D’autres idées »', () => {
  it('montre les suivantes, sans jamais redonner une œuvre déjà vue, puis propose de revenir au début', () => {
    for (const envie of ['remise_en_question', 'surprise'] as Envie[]) {
      const vues: string[] = []
      let resultat = tirer(RIEN_DE_LU, { envie })
      let pages = 0
      while (resultat.suite === 'autres') {
        for (const p of resultat.propositions) expect(vues).not.toContain(p.oeuvre.id)
        vues.push(...resultat.propositions.map((p) => p.oeuvre.id))
        resultat = tirer(RIEN_DE_LU, { envie, dejaVues: vues })
        expect(++pages).toBeLessThan(40)
      }
      vues.push(...resultat.propositions.map((p) => p.oeuvre.id))
      // Tout a été vu, une fois chacun.
      expect(new Set(vues).size).toBe(vues.length)
      expect(vues).toHaveLength(RIEN_DE_LU.filter((o) => REGLES[envie].filtre(o)).length)
      expect(resultat.suite).toBe('debut')
      expect(messageDe(resultat)).toBe('Toutes les idées pour cette envie ont été vues.')
      const fin = tirer(RIEN_DE_LU, { envie, dejaVues: vues })
      expect(fin.propositions).toEqual([])
      expect(fin.situation).toBe('tout_vu')
      expect(fin.suite).toBe('debut')
    }
  })

  it('garde la page affichée telle quelle, dans son ordre', () => {
    const page = tirer(VIVANTE, { envie: 'philosophique' }).propositions.map((p) => p.oeuvre.id)
    const inverse = [...page].reverse()
    const epinglee = tirer(VIVANTE, { envie: 'philosophique', imposees: inverse, completer: false, dejaVues: page })
    expect(epinglee.propositions.map((p) => p.oeuvre.id)).toEqual(inverse)
  })

  it('remplace une idée mise de côté par la suivante, en gardant les deux autres', () => {
    const page = tirer(VIVANTE, { envie: 'philosophique' }).propositions.map((p) => p.oeuvre.id)
    const [ecartee, ...gardees] = page
    const suite = tirer(VIVANTE, { envie: 'philosophique', imposees: gardees, dejaVues: page }, [{ oeuvre: ecartee, depuis: T.toISOString() }])
    const ids = suite.propositions.map((p) => p.oeuvre.id)
    expect(ids).toHaveLength(3)
    expect(ids.slice(0, 2)).toEqual(gardees)
    expect(page).not.toContain(ids[2])
  })

  it('une œuvre épinglée qui n’est plus candidate (commencée entre-temps) disparaît de la page', () => {
    const page = tirer(VIVANTE, { envie: 'philosophique' }).propositions.map((p) => p.oeuvre.id)
    const commencee = VIVANTE.map((o) => (o.id === page[0] ? { ...o, statut: 'en_cours' as const } : o))
    const epinglee = tirer(commencee, { envie: 'philosophique', imposees: page, completer: false })
    expect(epinglee.propositions.map((p) => p.oeuvre.id)).toEqual(page.slice(1))
  })
})

describe('affinité', () => {
  const affinite = (bibliotheque: OeuvreIdee[], titre: string) =>
    noter(bibliotheque.find((o) => o.titre === titre) as OeuvreIdee, 'surprise', 'essai', contexteDe(bibliotheque, T)).affinite

  it('monte avec la part de mes thèmes de cœur', () => {
    // Un psaume : 4 thèmes de cœur sur 5. La Ferme des animaux : aucun.
    expect(affinite(RIEN_DE_LU, 'Un psaume pour les recyclés sauvages')).toBeCloseTo(0.6 * (4 / 5), 10)
    expect(affinite(RIEN_DE_LU, 'La Ferme des animaux')).toBe(0)
  })

  it('« M’a marqué », « Beau moment » et « À relire un jour » rapprochent les œuvres aux thèmes communs', () => {
    for (const appreciation of ['marque', 'beau_moment', 'a_relire'] as const) {
      const aimee = catalogueEssai({ Momo: { statut: 'termine', appreciation } })
      // Le Petit Prince partage l'amitié, la beauté des choses simples et l'enfance avec Momo.
      expect(affinite(aimee, 'Le Petit Prince'), appreciation).toBeGreaterThan(affinite(RIEN_DE_LU, 'Le Petit Prince'))
      // 1984 ne partage aucun thème avec Momo.
      expect(affinite(aimee, '1984')).toBe(affinite(RIEN_DE_LU, '1984'))
    }
  })

  it('« Pas pour moi, pas maintenant » atténue un peu, sans jamais écarter une œuvre', () => {
    const ecartee = catalogueEssai({ Momo: { statut: 'termine', appreciation: 'pas_pour_moi' } })
    const avant = affinite(RIEN_DE_LU, 'Le Petit Prince')
    const apres = affinite(ecartee, 'Le Petit Prince')
    expect(apres).toBeLessThan(avant)
    expect(avant - apres).toBeLessThanOrEqual(0.2)
    expect(toutesLesIdees(ecartee)).toContain('le-petit-prince')
  })

  it('« Envie de lire » et « Je l’ai » donnent un léger avantage', () => {
    const contexte = contexteDe(RIEN_DE_LU, T)
    const momo = RIEN_DE_LU.find((o) => o.id === 'momo') as OeuvreIdee
    const base = noter(momo, 'surprise', 'essai', contexte).score
    expect(noter({ ...momo, statut: 'envie_de_lire' }, 'surprise', 'essai', contexte).score).toBeCloseTo(base + 0.1, 10)
    expect(noter({ ...momo, possession: 'possede' }, 'surprise', 'essai', contexte).score).toBeCloseTo(base + 0.05, 10)
    expect(noter({ ...momo, possession: 'partielle' }, 'surprise', 'essai', contexte).score).toBeCloseTo(base + 0.05, 10)
  })
})

describe('une œuvre ajoutée à la main, presque sans étiquettes', () => {
  const NUE: OeuvreIdee = {
    id: 'nue',
    titre: 'Sans étiquette',
    auteurs: [],
    forme: 'autre',
    tonalite: null,
    exigence: null,
    longueur: null,
    estSerie: false,
    genres: [],
    themes: [],
    atmospheres: [],
    statut: 'a_decouvrir',
    possession: 'non_possede',
    appreciation: null,
    toucheeLe: null,
    finieLe: null,
    couverture: null,
  }

  it('reste proposable, avec une note neutre et une phrase qui ne prétend rien', () => {
    const contexte = contexteDe([...APRES_CRIME, NUE], T)
    const note = noter(NUE, 'surprise', 'essai', contexte)
    expect(note.affinite).toBe(0)
    expect(note.contraste).toBe(0.5)
    const { propositions } = tirer([NUE])
    expect(propositions).toHaveLength(1)
    expect(propositions[0].phrase).toBe('Une idée parmi mes livres à découvrir.')
  })

  it('n’entre dans aucune envie à filtre', () => {
    for (const envie of A_FILTRE) expect(REGLES[envie].filtre(NUE)).toBe(false)
  })
})
