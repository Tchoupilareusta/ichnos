import { assistantFictif, imageFictive } from '../ajout/assistant.fictif'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { chercherCouverturesManquantes, remplacerPetitesCouvertures, type Avancement, type AvancementRemplacement } from './recherche'
import { couverturesFictives } from './stockage.fictif'

const IMAGE = imageFictive()
const edition = (id: string, isbn: string | null) => ({ id, isbn, publisher: null, language: null, format: null, translator: null, pageCount: null })
const tome = (numero: number, isbn: string | null) => ({ numero, titre: null, isbn, possession: 'non_possede' as const, lecture: 'a_lire' as const })

const BIBLIOTHEQUE = () =>
  depotFictif({
    oeuvres: [
      oeuvreFictive({ id: 'momo', titreFr: 'Momo', editions: [edition('e1', '9782747024693')], monEdition: 'e1' }),
      oeuvreFictive({ id: 'prophete', titreFr: 'Le Prophète', editions: [edition('e2', '9782070368228')], monEdition: 'e2' }),
      oeuvreFictive({ id: 'sans', titreFr: 'Sans ISBN', editions: [edition('e3', null)], monEdition: 'e3' }),
      oeuvreFictive({ id: 'vinland', titreFr: 'Vinland Saga', estSerie: true, tomes: [tome(1, '9782351423554'), tome(2, '9782351423561'), tome(3, null)] }),
    ],
  })

function lancer(options: { depot?: ReturnType<typeof depotFictif>; assistant?: ReturnType<typeof assistantFictif>; continuer?: () => boolean } = {}) {
  const depot = options.depot ?? BIBLIOTHEQUE()
  const assistant = options.assistant ?? assistantFictif({ couverture: IMAGE })
  const couvertures = couverturesFictives()
  const pauses: number[] = []
  const etapes: Avancement[] = []
  const fin = chercherCouverturesManquantes({
    depot: depot.depot,
    assistant: assistant.assistant,
    couvertures: couvertures.couvertures,
    attendre: async () => void pauses.push(assistant.appels.couverture.length),
    continuer: options.continuer ?? (() => true),
    surAvancement: (avancement) => etapes.push(avancement),
  })
  return { fin, depot, assistant, couvertures, pauses, etapes }
}

describe('recherche des couvertures manquantes', () => {
  it('cherche par ISBN, une demande à la fois, et range chaque couverture au bon endroit', async () => {
    const { fin, depot, assistant, couvertures } = lancer()
    const bilan = await fin
    expect(assistant.appels.couverture).toEqual([
      { isbn: '9782747024693' },
      { isbn: '9782070368228' },
      { isbn: '9782351423554' },
      { isbn: '9782351423561' },
    ])
    expect(couvertures.deposees).toHaveLength(4)
    expect(depot.appels.ecritures.filter((e) => e.action === 'couverture').map((e) => [e.id, (e.valeur as { cible: unknown }).cible])).toEqual([
      ['momo', { type: 'edition', edition: 'e1' }],
      ['prophete', { type: 'edition', edition: 'e2' }],
      ['vinland', { type: 'tome', numero: 1 }],
      ['vinland', { type: 'tome', numero: 2 }],
    ])
    expect(bilan.arret).toBeNull()
    expect(bilan.termine).toBe(true)
  })

  it('rend, œuvre par œuvre, ce qui a été trouvé ou non', async () => {
    const assistant = assistantFictif({
      couverture: (demande) => ('isbn' in demande && ['9782070368228', '9782351423561'].includes(demande.isbn) ? { ok: true, valeur: null } : IMAGE),
    })
    const bilan = await lancer({ assistant }).fin
    expect(bilan.resultats).toEqual([
      { oeuvre: 'momo', titre: 'Momo', serie: false, cherchees: 1, trouvees: 1, petites: 0, sansIsbn: 0 },
      { oeuvre: 'prophete', titre: 'Le Prophète', serie: false, cherchees: 1, trouvees: 0, petites: 0, sansIsbn: 0 },
      { oeuvre: 'sans', titre: 'Sans ISBN', serie: false, cherchees: 0, trouvees: 0, petites: 0, sansIsbn: 1 },
      { oeuvre: 'vinland', titre: 'Vinland Saga', serie: true, cherchees: 2, trouvees: 1, petites: 0, sansIsbn: 1 },
    ])
  })

  it('compte à part les couvertures trouvées de moins de 450 px de large, qu’elle range quand même', async () => {
    const assistant = assistantFictif({
      couverture: (demande) => ('isbn' in demande && demande.isbn === '9782747024693' ? imageFictive({ largeur: 449, hauteur: 700 }) : imageFictive({ largeur: 450, hauteur: 700 })),
    })
    const { fin, couvertures } = lancer({ assistant })
    const bilan = await fin
    expect(bilan.resultats.map((r) => [r.titre, r.trouvees, r.petites])).toEqual([
      ['Momo', 1, 1],
      ['Le Prophète', 1, 0],
      ['Sans ISBN', 0, 0],
      ['Vinland Saga', 2, 0],
    ])
    expect(couvertures.deposees).toHaveLength(4)
  })

  it('ne dit pas « petite » une couverture dont la taille n’est pas connue', async () => {
    const assistant = assistantFictif({ couverture: imageFictive({ largeur: null, hauteur: null }) })
    const bilan = await lancer({ assistant }).fin
    expect(bilan.resultats.every((r) => r.petites === 0)).toBe(true)
  })

  it('n’utilise jamais l’IA', async () => {
    const { fin, assistant } = lancer()
    await fin
    expect(assistant.appels.proposerFiche).toHaveLength(0)
    expect(assistant.appels.chercherIsbn).toHaveLength(0)
    expect(assistant.appels.chercherTitre).toHaveLength(0)
  })

  it('marque une pause après chaque demande, pour respecter les quotas des catalogues', async () => {
    const { fin, pauses } = lancer()
    await fin
    // Une pause après chacune des quatre demandes, jamais deux demandes de suite.
    expect(pauses).toEqual([1, 2, 3, 4])
  })

  it('dit où elle en est à mesure qu’elle avance', async () => {
    const { fin, etapes } = lancer()
    await fin
    expect(etapes.map((e) => e.enCours)).toContain('Momo')
    expect(etapes.map((e) => e.enCours)).toContain('Vinland Saga, tome 2')
    expect(etapes[etapes.length - 1]).toMatchObject({ enCours: null, termine: true })
  })

  it('s’arrête quand je le demande, sans rien perdre de ce qui est déjà rangé', async () => {
    let demandes = 0
    const { fin, assistant, couvertures } = lancer({ continuer: () => demandes++ < 2 })
    const bilan = await fin
    expect(assistant.appels.couverture).toHaveLength(2)
    expect(couvertures.deposees).toHaveLength(2)
    expect(bilan).toMatchObject({ arret: 'arrete', termine: false })
  })

  it('s’interrompt calmement si le réseau ou l’assistant lâche, sans insister', async () => {
    let appels = 0
    const assistant = assistantFictif({ couverture: () => (++appels === 2 ? { ok: false, echec: 'reseau' } : IMAGE) })
    const bilan = await lancer({ assistant }).fin
    expect(assistant.appels.couverture).toHaveLength(2)
    expect(bilan).toMatchObject({ arret: 'reseau', termine: false })

    const absent = await lancer({ assistant: assistantFictif() }).fin
    expect(absent).toMatchObject({ arret: 'indisponible', termine: false })
  })

  it('ne compte pas comme trouvée une couverture qui n’a pas pu être rangée', async () => {
    const depot = BIBLIOTHEQUE()
    const assistant = assistantFictif({ couverture: IMAGE })
    const pauses: number[] = []
    const bilan = await chercherCouverturesManquantes({
      depot: depot.depot,
      assistant: assistant.assistant,
      couvertures: couverturesFictives({ depot: { ok: false, echec: 'inconnu' } }).couvertures,
      attendre: async () => void pauses.push(1),
      continuer: () => true,
      surAvancement: () => {},
    })
    expect(bilan.resultats.every((r) => r.trouvees === 0)).toBe(true)
    expect(depot.appels.ecritures.filter((e) => e.action === 'couverture')).toHaveLength(0)
  })

  it('n’a rien à faire quand tout a déjà sa couverture', async () => {
    const depot = depotFictif({ oeuvres: [oeuvreFictive({ id: 'a', titreFr: 'Illustrée', couverture: 'moi/x.jpg' })] })
    const { fin, assistant } = lancer({ depot })
    expect(await fin).toEqual({ enCours: null, resultats: [], termine: true, arret: null })
    expect(assistant.appels.couverture).toHaveLength(0)
  })

  it('signale une bibliothèque illisible', async () => {
    const depot = depotFictif({ lecture: { ok: false, echec: 'reseau' } })
    expect(await lancer({ depot }).fin).toMatchObject({ arret: 'reseau', termine: false })
  })
})

describe('remplacement des couvertures de petite taille', () => {
  const MOI = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const chemin = (nom: string) => `${MOI}/${nom.padEnd(32, '0')}.jpg`
  const avecCouverture = (id: string, isbn: string | null, nom: string) => ({ ...edition(id, isbn), couverture: chemin(nom) })

  /** Momo (300 px), Le Prophète (300 px), Grande (800 px), une couverture sur l'œuvre (200 px), et deux tomes. */
  const ILLUSTREE = () =>
    depotFictif({
      oeuvres: [
        oeuvreFictive({ id: 'momo', titreFr: 'Momo', editions: [avecCouverture('e1', '9782747024693', 'momo')], monEdition: 'e1' }),
        oeuvreFictive({ id: 'prophete', titreFr: 'Le Prophète', editions: [avecCouverture('e2', '9782070368228', 'prophete')], monEdition: 'e2' }),
        oeuvreFictive({ id: 'grande', titreFr: 'Grande', editions: [avecCouverture('e3', '9782072878497', 'grande')], monEdition: 'e3' }),
        oeuvreFictive({ id: 'oeuvre', titreFr: 'Sur l’œuvre', couverture: chemin('oeuvre'), editions: [edition('e4', '9782253004226')] }),
        oeuvreFictive({
          id: 'vinland',
          titreFr: 'Vinland Saga',
          estSerie: true,
          tomes: [{ ...tome(1, '9782351423554'), couverture: chemin('tome1') }, { ...tome(2, null), couverture: chemin('tome2') }, tome(3, '9782351423578')],
        }),
      ],
    })
  const LARGEURS: Record<string, number> = { momo: 300, prophete: 300, grande: 800, oeuvre: 200, tome1: 348, tome2: 120 }

  function remplacer(
    options: {
      assistant?: ReturnType<typeof assistantFictif>
      continuer?: () => boolean
      largeurs?: Record<string, number | null>
      depot?: ReturnType<typeof depotFictif>
      couvertures?: ReturnType<typeof couverturesFictives>
    } = {},
  ) {
    const depot = options.depot ?? ILLUSTREE()
    const assistant = options.assistant ?? assistantFictif({ couverture: imageFictive({ largeur: 800, hauteur: 1237 }) })
    const couvertures = options.couvertures ?? couverturesFictives()
    const largeurs = options.largeurs ?? LARGEURS
    const pauses: number[] = []
    const etapes: AvancementRemplacement[] = []
    const mesurees: string[] = []
    const fin = remplacerPetitesCouvertures({
      depot: depot.depot,
      assistant: assistant.assistant,
      couvertures: couvertures.couvertures,
      // La fausse adresse porte le chemin : « blob:fictive/<compte>/<nom>000….jpg ».
      mesurer: async (source) => {
        const adresse = String(source)
        mesurees.push(adresse)
        const nom = Object.keys(largeurs).find((cle) => adresse.includes(`/${cle}0`))
        return nom ? largeurs[nom] : null
      },
      attendre: async () => void pauses.push(assistant.appels.couverture.length),
      continuer: options.continuer ?? (() => true),
      surAvancement: (avancement) => etapes.push(avancement),
    })
    return { fin, depot, assistant, couvertures, pauses, etapes, mesurees }
  }

  it('mesure chaque couverture rangée sur l’appareil, sans rien changer à la base', async () => {
    const assistant = assistantFictif({ couverture: { ok: true, valeur: null } })
    const { fin, depot, mesurees } = remplacer({ assistant })
    await fin
    expect(mesurees).toHaveLength(6)
    expect(depot.appels.ecritures).toHaveLength(0)
  })

  it('ne redemande que les petites couvertures dont l’ISBN est connu, par cet ISBN', async () => {
    const { fin, assistant } = remplacer()
    await fin
    // Ni la grande (800 px), ni celle rangée sur l'œuvre, ni le tome sans ISBN.
    expect(assistant.appels.couverture).toEqual([{ isbn: '9782747024693' }, { isbn: '9782070368228' }, { isbn: '9782351423554' }])
  })

  it('remplace une couverture seulement si l’image trouvée est plus large, et la range au même endroit', async () => {
    const assistant = assistantFictif({
      couverture: (demande) =>
        'isbn' in demande && demande.isbn === '9782747024693'
          ? imageFictive({ largeur: 800, hauteur: 1237 })
          : 'isbn' in demande && demande.isbn === '9782070368228'
            ? imageFictive({ largeur: 300, hauteur: 450 })
            : { ok: true, valeur: null },
    })
    const { fin, depot, couvertures } = remplacer({ assistant })
    const bilan = await fin
    expect(couvertures.deposees).toHaveLength(1)
    expect(depot.appels.ecritures.map((e) => [e.action, e.id, (e.valeur as { cible: unknown }).cible])).toEqual([
      ['couverture', 'momo', { type: 'edition', edition: 'e1' }],
    ])
    expect(bilan.lignes).toEqual([
      { oeuvre: 'momo', titre: 'Momo', tome: null, issue: 'remplacee', avant: 300, apres: 800 },
      { oeuvre: 'prophete', titre: 'Le Prophète', tome: null, issue: 'pas_plus_grande', avant: 300 },
      { oeuvre: 'oeuvre', titre: 'Sur l’œuvre', tome: null, issue: 'sans_isbn', avant: 200 },
      { oeuvre: 'vinland', titre: 'Vinland Saga', tome: 1, issue: 'pas_plus_grande', avant: 348 },
      { oeuvre: 'vinland', titre: 'Vinland Saga', tome: 2, issue: 'sans_isbn', avant: 120 },
    ])
    expect(bilan).toMatchObject({ termine: true, arret: null })
  })

  it('mesure elle-même l’image trouvée quand la fonction ne donne pas sa taille', async () => {
    const assistant = assistantFictif({ couverture: imageFictive({ largeur: null, hauteur: null }) })
    const depot = depotFictif({ oeuvres: [oeuvreFictive({ id: 'momo', titreFr: 'Momo', editions: [avecCouverture('e1', '9782747024693', 'momo')], monEdition: 'e1' })] })
    const etapes: AvancementRemplacement[] = []
    const bilan = await remplacerPetitesCouvertures({
      depot: depot.depot,
      assistant: assistant.assistant,
      couvertures: couverturesFictives().couvertures,
      mesurer: async (source) => (typeof source === 'string' ? 300 : 640),
      attendre: async () => {},
      continuer: () => true,
      surAvancement: (avancement) => etapes.push(avancement),
    })
    expect(bilan.lignes).toEqual([{ oeuvre: 'momo', titre: 'Momo', tome: null, issue: 'remplacee', avant: 300, apres: 640 }])
  })

  it('laisse de côté une couverture qu’elle n’arrive pas à mesurer', async () => {
    const assistant = assistantFictif({ couverture: imageFictive({ largeur: 800, hauteur: 1237 }) })
    const { fin } = remplacer({ assistant, largeurs: { ...LARGEURS, momo: null } })
    const bilan = await fin
    expect(bilan.lignes.some((ligne) => ligne.oeuvre === 'momo')).toBe(false)
    expect(assistant.appels.couverture).not.toContainEqual({ isbn: '9782747024693' })
  })

  it('garde le rythme de la recherche : une demande à la fois, une pause après chacune', async () => {
    const { fin, pauses } = remplacer()
    await fin
    expect(pauses).toEqual([1, 2, 3])
  })

  it('dit où elle en est', async () => {
    const { fin, etapes } = remplacer()
    await fin
    expect(etapes.map((e) => e.enCours)).toContain('Momo')
    expect(etapes.map((e) => e.enCours)).toContain('Vinland Saga, tome 1')
    expect(etapes[etapes.length - 1]).toMatchObject({ enCours: null, termine: true })
  })

  it('s’arrête quand je le demande, et garde ce qui est déjà remplacé', async () => {
    // L'arrêt est demandé pendant la première demande : il vaut aussi pendant les mesures qui suivent.
    const assistant = assistantFictif({ couverture: imageFictive({ largeur: 800, hauteur: 1237 }) })
    const { fin, couvertures } = remplacer({ assistant, continuer: () => assistant.appels.couverture.length < 1 })
    const bilan = await fin
    expect(assistant.appels.couverture).toHaveLength(1)
    expect(couvertures.deposees).toHaveLength(1)
    expect(bilan).toMatchObject({ arret: 'arrete', termine: false })
  })

  it('s’interrompt calmement si le réseau ou l’assistant lâche', async () => {
    const coupe = await remplacer({ assistant: assistantFictif({ couverture: { ok: false, echec: 'reseau' } }) }).fin
    expect(coupe).toMatchObject({ arret: 'reseau', termine: false })
    const muet = await remplacer({ assistant: assistantFictif() }).fin
    expect(muet).toMatchObject({ arret: 'indisponible', termine: false })
    const illisible = await remplacer({ depot: depotFictif({ lecture: { ok: false, echec: 'reseau' } }) }).fin
    expect(illisible).toMatchObject({ arret: 'reseau', termine: false })
  })

  it('ne dit pas « remplacée » une couverture qui n’a pas pu être rangée', async () => {
    const { fin, depot } = remplacer({ couvertures: couverturesFictives({ depot: { ok: false, echec: 'inconnu' } }) })
    const bilan = await fin
    expect(bilan.lignes.some((ligne) => ligne.issue === 'remplacee')).toBe(false)
    expect(depot.appels.ecritures).toHaveLength(0)
  })

  it('n’utilise jamais l’IA', async () => {
    const { fin, assistant } = remplacer()
    await fin
    expect(assistant.appels.proposerFiche).toHaveLength(0)
    expect(assistant.appels.chercherIsbn).toHaveLength(0)
  })
})
