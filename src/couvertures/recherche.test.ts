import { assistantFictif } from '../ajout/assistant.fictif'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { chercherCouverturesManquantes, type Avancement } from './recherche'
import { couverturesFictives } from './stockage.fictif'

const IMAGE = { ok: true as const, valeur: { image: new Blob(['image'], { type: 'image/jpeg' }), source: 'open_library' as const } }
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
      { oeuvre: 'momo', titre: 'Momo', serie: false, cherchees: 1, trouvees: 1, sansIsbn: 0 },
      { oeuvre: 'prophete', titre: 'Le Prophète', serie: false, cherchees: 1, trouvees: 0, sansIsbn: 0 },
      { oeuvre: 'sans', titre: 'Sans ISBN', serie: false, cherchees: 0, trouvees: 0, sansIsbn: 1 },
      { oeuvre: 'vinland', titre: 'Vinland Saga', serie: true, cherchees: 2, trouvees: 1, sansIsbn: 1 },
    ])
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
