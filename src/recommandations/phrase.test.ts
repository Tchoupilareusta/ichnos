import { catalogueEssai } from './catalogue.fictif'
import { ENVIES, type Envie, type OeuvreIdee } from './modele'
import { morceauxDe } from './phrase'
import { proposer } from './proposer'
import { contexteDe, noter } from './score'

// La phrase d'explication (docs/reference.md §7.4) et sa voix (§3), sur mon vrai catalogue.

const JOUR = 86_400_000
const T = new Date('2026-11-21T12:00:00Z')
const ilYA = (jours: number) => new Date(T.getTime() - jours * JOUR).toISOString()
const TOUTES: Envie[] = ENVIES.map((e) => e.valeur)

const RIEN_DE_LU = catalogueEssai()
const APRES_CRIME = catalogueEssai({ 'Crime et Châtiment': { statut: 'termine', finieLe: ilYA(2) } })
const APRES_MOMO = catalogueEssai({
  Momo: { statut: 'termine', finieLe: ilYA(3), appreciation: 'beau_moment' },
  'Le Petit Prince': { statut: 'termine', finieLe: ilYA(20), appreciation: 'marque' },
})
const VIVANTE = catalogueEssai({
  '1984': { statut: 'termine', finieLe: ilYA(5) },
  'Vinland Saga': { statut: 'en_cours', toucheeLe: ilYA(1) },
  'Lettres à Lucilius': { statut: 'en_pause' },
  Siddhartha: { statut: 'envie_de_lire', possession: 'possede' },
})
const SITUATIONS = [RIEN_DE_LU, APRES_CRIME, APRES_MOMO, VIVANTE]

/** Les trois propositions du jour, comme l'appli les calcule (graine : la date et l'envie). */
const duJour = (oeuvres: OeuvreIdee[], envie: Envie, graine = '2026-11-21') => proposer({ oeuvres, deCote: [] }, { envie, graine: `${graine}|${envie}`, maintenant: T }).propositions
const phrases = (oeuvres: OeuvreIdee[], envie: Envie) => duJour(oeuvres, envie).map((p) => [p.oeuvre.titre, p.phrase])

/** Les morceaux de la phrase d'une œuvre, seule (rien de déjà dit dans le groupe). */
const morceaux = (oeuvres: OeuvreIdee[], titre: string, envie: Envie = 'surprise') => {
  const contexte = contexteDe(oeuvres, T)
  return morceauxDe(noter(oeuvres.find((o) => o.titre === titre) as OeuvreIdee, envie, 'essai', contexte), envie, contexte, new Set())
}

describe('exemples figés, tirés de mon catalogue', () => {
  it('après Crime et Châtiment, « Quelque chose de réconfortant »', () => {
    expect(phrases(APRES_CRIME, 'reconfortant')).toEqual([
      ['La Maison au milieu de la mer céruléenne', 'Lumineux, après Crime et Châtiment. Atmosphère chaleureuse et douce.'],
      ['Jonathan Livingston le goéland', 'Atmosphère sereine et poétique. Parmi mes thèmes de cœur : compassion et liberté.'],
      // « Atmosphère chaleureuse et douce. » est déjà dit plus haut : le même morceau ne revient pas.
      ['Un psaume pour les recyclés sauvages', 'Récit humaniste, atmosphère chaleureuse et contemplative. Au cœur du livre : acceptation de soi et beauté des choses simples.'],
    ])
  })

  it('après Crime et Châtiment, « Surprends-moi »', () => {
    expect(phrases(APRES_CRIME, 'surprise')).toEqual([
      ['Un psaume pour les recyclés sauvages', 'Lumineux, après Crime et Châtiment. Parmi mes thèmes de cœur : acceptation de soi et beauté des choses simples.'],
      ['Découvrir un sens à sa vie', 'Témoignage, atmosphère âpre et introspective. Au cœur du livre : dignité et liberté.'],
      ['1984', 'Dystopie, atmosphère dérangeante et oppressante. Au cœur du livre : liberté et propagande.'],
    ])
  })

  it('premier jour, rien de lu, « Une réflexion philosophique »', () => {
    expect(phrases(RIEN_DE_LU, 'philosophique')).toEqual([
      ['La Bibliothèque de minuit', 'Roman philosophique, atmosphère introspective et douce. Parmi mes thèmes de cœur : acceptation de soi et quête de sens.'],
      ['La Chute', 'Littérature existentielle, atmosphère introspective et dérangeante. Au cœur du livre : conscience morale et culpabilité.'],
      ['Découvrir un sens à sa vie', 'Philosophie, atmosphère introspective et âpre. Au cœur du livre : dignité et liberté.'],
    ])
  })

  it('après Momo et Le Petit Prince, « Remets mes idées en question »', () => {
    expect(phrases(APRES_MOMO, 'remise_en_question')).toEqual([
      ['La Ferme des animaux', 'Plus grave, après Momo. Critique sociale, atmosphère dérangeante et ironique.'],
      ['Le Meilleur des mondes', 'Dystopie, atmosphère dérangeante et ironique. Parmi mes thèmes de cœur : liberté ; technologie et attention.'],
      ['La Métamorphose', 'Atmosphère dérangeante et oppressante. Au cœur du livre : aliénation et différence.'],
    ])
  })

  it('Vinland Saga en cours et 1984 terminé, « Changer d’univers »', () => {
    expect(phrases(VIVANTE, 'changer_d_univers')).toEqual([
      ['Siddhartha', 'Un autre registre, après Vinland Saga : roman philosophique. Parmi mes thèmes de cœur : paix intérieure et quête de sens.'],
      ['La Maison au milieu de la mer céruléenne', 'Fantasy et merveilleux, atmosphère chaleureuse et douce. Au cœur du livre : acceptation de soi et compassion.'],
      ['Le Désert des Tartares', 'Littérature existentielle, atmosphère contemplative et mélancolique. Au cœur du livre : attente et quête de sens.'],
    ])
  })

  it('après Crime et Châtiment, « Une lecture courte » : « Court. » seul pour un roman court', () => {
    expect(phrases(APRES_CRIME, 'lecture_courte')).toEqual([
      ['Un psaume pour les recyclés sauvages', 'Lumineux, après Crime et Châtiment. Court.'],
      ['Le Petit Prince', 'Court : un conte. Parmi mes thèmes de cœur : beauté des choses simples et relations humaines.'],
      ['Jonathan Livingston le goéland', 'Spiritualité, atmosphère poétique et sereine. Au cœur du livre : compassion et courage.'],
    ])
  })
})

describe('les morceaux de la phrase', () => {
  it('le contraste de tonalité avec ma dernière lecture', () => {
    expect(morceaux(APRES_CRIME, 'Un psaume pour les recyclés sauvages')[0]).toBe('Lumineux, après Crime et Châtiment.')
    expect(morceaux(APRES_CRIME, 'Momo')[0]).toBe('Plus lumineux, après Crime et Châtiment.')
    expect(morceaux(APRES_MOMO, '1984')[0]).toBe('Plus grave, après Momo.')
    // Un seul cran d'écart : rien à dire de la tonalité. Sans genre commun, c'est le registre qui change.
    expect(morceaux(APRES_MOMO, 'Un psaume pour les recyclés sauvages')[0]).toBe('Un autre registre, après Momo : récit humaniste.')
    // Un seul cran d'écart et un genre commun (le merveilleux) : on ne parle pas de Momo.
    expect(morceaux(APRES_MOMO, 'La Maison au milieu de la mer céruléenne').join(' ')).not.toContain('après')
  })

  it('un titre qui finit par une ponctuation ne reçoit pas un point de plus', () => {
    const question = APRES_CRIME.map((o) => (o.titre === 'Crime et Châtiment' ? { ...o, titre: 'Que faire ?' } : o))
    expect(morceaux(question, 'Un psaume pour les recyclés sauvages')[0]).toBe('Lumineux, après Que faire ?')
  })

  it('ce qui fait entrer l’œuvre dans l’envie', () => {
    expect(morceaux(RIEN_DE_LU, 'Le Petit Prince', 'lecture_courte')[0]).toBe('Court : un conte.')
    expect(morceaux(RIEN_DE_LU, 'Le Joueur d’échecs', 'lecture_courte')[0]).toBe('Court : une nouvelle.')
    expect(morceaux(RIEN_DE_LU, 'Le Prophète', 'lecture_courte')[0]).toBe('Court : de la poésie.')
    expect(morceaux(RIEN_DE_LU, 'La Métamorphose', 'lecture_courte')[0]).toBe('Court.')
    expect(morceaux(RIEN_DE_LU, 'Momo', 'reconfortant')[0]).toBe('Atmosphère douce et onirique.')
    expect(morceaux(RIEN_DE_LU, 'Fahrenheit 451', 'remise_en_question')[0]).toBe('Dystopie, atmosphère oppressante et poétique.')
    // Sa Majesté des mouches n'est ni une dystopie ni une critique sociale : c'est son atmosphère qui dérange.
    expect(morceaux(RIEN_DE_LU, 'Sa Majesté des mouches', 'remise_en_question')[0]).toBe('Atmosphère dérangeante et âpre.')
    expect(morceaux(RIEN_DE_LU, 'Des fleurs pour Algernon', 'philosophique')[0]).toBe('Atmosphère introspective et mélancolique.')
  })

  it('une œuvre que j’ai aimée, quand deux thèmes au moins sont communs', () => {
    const aimee = catalogueEssai({ Momo: { statut: 'termine', appreciation: 'marque' } })
    expect(morceaux(aimee, 'Le Petit Prince')).toContain('Des thèmes proches de Momo : amitié et beauté des choses simples.')
    // Un seul thème commun (l'enfance) : on ne parle pas de Momo.
    expect(morceaux(aimee, 'Sa Majesté des mouches').join(' ')).not.toContain('Momo')
  })

  it('ce qui est déjà à moi : la première personne', () => {
    const envie = catalogueEssai({ 'La Ferme des animaux': { statut: 'envie_de_lire' } })
    expect(morceaux(envie, 'La Ferme des animaux')).toEqual(['Au cœur du livre : hypocrisie et pouvoir.', 'Déjà dans mes envies de lire.'])
    const possede = catalogueEssai({ 'La Ferme des animaux': { possession: 'possede' } })
    expect(morceaux(possede, 'La Ferme des animaux')).toEqual(['Au cœur du livre : hypocrisie et pouvoir.', 'Je l’ai déjà.'])
    const partielle = catalogueEssai({ 'Chainsaw Man': { possession: 'partielle' } })
    expect(morceaux(partielle, 'Chainsaw Man')).toEqual(['Au cœur du livre : absurde et désir.', 'J’en ai déjà une partie.'])
  })

  it('le genre nommé est celui qui distingue l’œuvre, pas « Classique »', () => {
    expect(morceaux(RIEN_DE_LU, '1984')[0]).toBe('Dystopie, atmosphère dérangeante et oppressante.')
    expect(morceaux(RIEN_DE_LU, 'Le Désert des Tartares')[0]).toBe('Littérature existentielle, atmosphère contemplative et mélancolique.')
  })

  it('un livre en pause : une question, pas un rappel', () => {
    expect(morceaux(VIVANTE, 'Lettres à Lucilius', 'philosophique')).toEqual([
      'En pause pour l’instant. Le reprendre ?',
      'Philosophie, atmosphère introspective et sereine.',
    ])
  })
})

describe('règles de voix et de sobriété', () => {
  const GRAINES = Array.from({ length: 100 }, (_, i) => `g${i}`)
  const groupes = SITUATIONS.flatMap((oeuvres) => TOUTES.flatMap((envie) => GRAINES.map((graine) => ({ oeuvres, propositions: duJour(oeuvres, envie, graine) }))))
  const TITRES = RIEN_DE_LU.map((o) => o.titre).sort((a, b) => b.length - a.length)
  /** La phrase sans les titres qu'elle cite (« après 1984 » contient un chiffre qui n'est pas de moi). */
  const sansTitres = (phrase: string) => TITRES.reduce((texte, titre) => texte.split(titre).join('…'), phrase)

  it('couvrent beaucoup de phrases différentes', () => {
    expect(new Set(groupes.flatMap((g) => g.propositions.map((p) => p.phrase))).size).toBeGreaterThan(150)
  })

  it('deux morceaux au plus, jamais vide', () => {
    for (const { propositions } of groupes)
      for (const p of propositions) {
        expect(p.morceaux.length).toBeGreaterThanOrEqual(1)
        expect(p.morceaux.length).toBeLessThanOrEqual(2)
        expect(p.phrase).toBe(p.morceaux.join(' '))
        expect(p.phrase.trim().length).toBeGreaterThan(5)
      }
  })

  it('jamais de chiffre, de note ni de pourcentage', () => {
    for (const { propositions } of groupes) for (const p of propositions) expect(sansTitres(p.phrase), p.phrase).not.toMatch(/[0-9%]/)
  })

  it('jamais de « tu », de « vous », ni d’impératif', () => {
    for (const { propositions } of groupes)
      for (const p of propositions) {
        const texte = sansTitres(p.phrase)
        expect(texte, p.phrase).not.toMatch(/(^|[\s’'])(tu|toi|te|ton|ta|tes|vous|votre|vos)([\s,.?!]|$)/i)
        expect(texte, p.phrase).not.toMatch(/(^|\. )(Lis|Découvre|Essaie|Plonge|Reprends|Commence|Laisse|Lisez|Découvrez)\b/)
      }
  })

  it('une formule n’est dite qu’une fois par groupe de trois, et jamais deux fois le même morceau', () => {
    for (const { propositions } of groupes) {
      expect(propositions.filter((p) => p.phrase.includes(', après ')).length).toBeLessThanOrEqual(1)
      expect(propositions.filter((p) => p.phrase.includes('Parmi mes thèmes de cœur')).length).toBeLessThanOrEqual(1)
      const tous = propositions.flatMap((p) => p.morceaux)
      expect(new Set(tous).size, tous.join(' | ')).toBe(tous.length)
    }
  })

  it('ne cite que ma dernière lecture ou une œuvre que j’ai aimée, jamais l’œuvre proposée', () => {
    for (const { oeuvres, propositions } of groupes) {
      const contexte = contexteDe(oeuvres, T)
      const permis = new Set([contexte.recentes[0]?.titre, ...contexte.aimees.map((o) => o.titre)])
      for (const p of propositions)
        for (const titre of TITRES) {
          // « Momo » ne doit pas être reconnu dans un autre mot : on cherche le titre entouré de ponctuation ou d'espaces.
          const cite = new RegExp(`(^|[\\s:])${titre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s.:,]|$)`).test(p.phrase)
          if (cite) expect(permis.has(titre), `${p.oeuvre.titre} : ${p.phrase}`).toBe(true)
          if (cite) expect(titre).not.toBe(p.oeuvre.titre)
        }
    }
  })

  it('« Le reprendre ? » ne vient que pour un livre en pause', () => {
    for (const { propositions } of groupes) for (const p of propositions) expect(p.phrase.includes('Le reprendre ?')).toBe(p.oeuvre.statut === 'en_pause')
  })
})
