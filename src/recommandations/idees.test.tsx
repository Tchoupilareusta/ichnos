import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ASSISTANT_ABSENT } from '../ajout/assistant'
import { depotFictif, oeuvreFictive } from '../bibliotheque/depot.fictif'
import { CLES, creerClientRequetes, useIdees, useIdeesDeCote, useModifierOeuvre } from '../bibliotheque/requetes'
import { COUVERTURES_ABSENTES } from '../couvertures/stockage'
import { authFictif } from '../session/auth.fictif'
import { FournisseurSession } from '../session/Session'

// Les requêtes des recommandations : la lecture des idées (gardée en cache, relue quand ma
// bibliothèque change) et « Pas maintenant » / « Annuler », affichés tout de suite.

const MOMO = oeuvreFictive({ id: 'momo', titreFr: 'Momo' })
const SIDDHARTHA = oeuvreFictive({ id: 'sid', titreFr: 'Siddhartha' })

function monter(faux: ReturnType<typeof depotFictif>) {
  const client = creerClientRequetes()
  const enveloppe = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <FournisseurSession
        value={{
          auth: authFictif({ compte: { email: 'moi@exemple.test' } }).auth,
          compte: { email: 'moi@exemple.test' },
          depot: faux.depot,
          assistant: ASSISTANT_ABSENT,
          couvertures: COUVERTURES_ABSENTES,
        }}
      >
        {children}
      </FournisseurSession>
    </QueryClientProvider>
  )
  const rendu = renderHook(() => ({ idees: useIdees(), deCote: useIdeesDeCote(), momo: useModifierOeuvre('momo') }), { wrapper: enveloppe })
  return { client, rendu }
}

const deCote = (rendu: ReturnType<typeof monter>['rendu']) => rendu.result.current.idees.data?.deCote.map((mise) => mise.oeuvre)

describe('lecture des idées', () => {
  it('rend ma bibliothèque vue par l’algorithme et mes idées mises de côté', async () => {
    const { rendu } = monter(depotFictif({ oeuvres: [MOMO, SIDDHARTHA], deCote: [{ oeuvre: 'sid', depuis: '2026-11-10T09:00:00Z' }] }))
    await waitFor(() => expect(rendu.result.current.idees.isSuccess).toBe(true))
    expect(rendu.result.current.idees.data?.oeuvres.map((o) => o.titre)).toEqual(['Momo', 'Siddhartha'])
    expect(rendu.result.current.idees.data?.deCote).toEqual([{ oeuvre: 'sid', depuis: '2026-11-10T09:00:00Z' }])
  })

  it('porte l’échec de lecture jusqu’à l’écran', async () => {
    const { rendu } = monter(depotFictif({ lecture: { ok: false, echec: 'reseau' } }))
    await waitFor(() => expect(rendu.result.current.idees.isError).toBe(true))
    expect(rendu.result.current.idees.error?.echec).toBe('reseau')
  })

  it('se relit quand ma bibliothèque change (un statut, par exemple)', async () => {
    const { rendu } = monter(depotFictif({ oeuvres: [MOMO, SIDDHARTHA] }))
    await waitFor(() => expect(rendu.result.current.idees.isSuccess).toBe(true))
    expect(rendu.result.current.idees.data?.oeuvres.find((o) => o.id === 'momo')?.statut).toBe('a_decouvrir')
    await act(async () => rendu.result.current.momo.statut.mutateAsync('en_cours'))
    await waitFor(() => expect(rendu.result.current.idees.data?.oeuvres.find((o) => o.id === 'momo')?.statut).toBe('en_cours'))
  })
})

describe('« Pas maintenant » et « Annuler »', () => {
  it('met l’idée de côté tout de suite, puis garde la date rendue par la base', async () => {
    const faux = depotFictif({ oeuvres: [MOMO, SIDDHARTHA], maintenant: () => new Date('2026-11-21T09:00:00Z') })
    const { rendu } = monter(faux)
    await waitFor(() => expect(rendu.result.current.idees.isSuccess).toBe(true))

    let ecriture: Promise<unknown> = Promise.resolve()
    act(() => {
      ecriture = rendu.result.current.deCote.mettre.mutateAsync({ id: 'sid', envie: 'reconfortant' })
    })
    // Affichée avant même la réponse de la base.
    await waitFor(() => expect(deCote(rendu)).toEqual(['sid']))
    await act(async () => {
      await ecriture
    })
    await waitFor(() => expect(rendu.result.current.idees.data?.deCote).toEqual([{ oeuvre: 'sid', depuis: '2026-11-21T09:00:00.000Z' }]))
    expect(faux.appels.ecritures).toEqual([{ action: 'ideeDeCote', id: 'sid', valeur: 'reconfortant' }])
  })

  it('« Annuler » la reprend', async () => {
    const faux = depotFictif({ oeuvres: [MOMO, SIDDHARTHA], deCote: [{ oeuvre: 'sid', depuis: '2026-11-21T09:00:00Z' }] })
    const { rendu } = monter(faux)
    await waitFor(() => expect(deCote(rendu)).toEqual(['sid']))
    await act(async () => rendu.result.current.deCote.reprendre.mutateAsync('sid'))
    await waitFor(() => expect(deCote(rendu)).toEqual([]))
    expect(faux.deCote()).toEqual([])
  })

  it('en cas d’échec, rien ne reste de côté, et l’écran reçoit la raison', async () => {
    const faux = depotFictif({ oeuvres: [MOMO, SIDDHARTHA], ecriture: { ok: false, echec: 'reseau' } })
    const { rendu } = monter(faux)
    await waitFor(() => expect(rendu.result.current.idees.isSuccess).toBe(true))
    await act(async () => {
      await rendu.result.current.deCote.mettre.mutateAsync({ id: 'sid', envie: 'surprise' }).catch(() => {})
    })
    await waitFor(() => expect(rendu.result.current.deCote.mettre.isError).toBe(true))
    expect(rendu.result.current.deCote.mettre.error?.echec).toBe('reseau')
    expect(deCote(rendu)).toEqual([])
  })

  it('une reprise qui échoue laisse l’idée de côté', async () => {
    const faux = depotFictif({ oeuvres: [MOMO, SIDDHARTHA], deCote: [{ oeuvre: 'sid', depuis: '2026-11-21T09:00:00Z' }], ecriture: { ok: false, echec: 'reseau' } })
    const { rendu } = monter(faux)
    await waitFor(() => expect(deCote(rendu)).toEqual(['sid']))
    await act(async () => {
      await rendu.result.current.deCote.reprendre.mutateAsync('sid').catch(() => {})
    })
    await waitFor(() => expect(rendu.result.current.deCote.reprendre.isError).toBe(true))
    expect(deCote(rendu)).toEqual(['sid'])
  })

  it('le réseau tombe au milieu : l’écriture et la relecture échouent, et l’affichage revient à l’état d’avant', async () => {
    // Le cas réel d'un « Pas maintenant » dans le métro : sans retour en arrière, l'idée resterait
    // affichée « de côté » alors que la base n'en sait rien.
    const base = depotFictif({ oeuvres: [MOMO, SIDDHARTHA], deCote: [{ oeuvre: 'momo', depuis: '2026-11-20T09:00:00Z' }] })
    let panne = false
    const coupe = { ok: false as const, echec: 'reseau' as const }
    const faux = {
      ...base,
      depot: {
        ...base.depot,
        lireIdees: async () => (panne ? coupe : base.depot.lireIdees()),
        mettreIdeeDeCote: async () => coupe,
        reprendreIdee: async () => coupe,
      },
    }
    const { rendu } = monter(faux)
    await waitFor(() => expect(deCote(rendu)).toEqual(['momo']))
    panne = true

    await act(async () => {
      await rendu.result.current.deCote.mettre.mutateAsync({ id: 'sid', envie: 'surprise' }).catch(() => {})
    })
    await waitFor(() => expect(rendu.result.current.idees.isFetching).toBe(false))
    expect(deCote(rendu)).toEqual(['momo'])

    await act(async () => {
      await rendu.result.current.deCote.reprendre.mutateAsync('momo').catch(() => {})
    })
    await waitFor(() => expect(rendu.result.current.idees.isFetching).toBe(false))
    expect(deCote(rendu)).toEqual(['momo'])
    // Les idées déjà chargées restent consultables.
    expect(rendu.result.current.idees.data?.oeuvres).toHaveLength(2)
  })

  it('les idées ont leur propre place dans le cache, sous celle de la bibliothèque', () => {
    expect(CLES.idees.slice(0, CLES.oeuvres.length)).toEqual([...CLES.oeuvres])
    expect(CLES.idees.length).toBeGreaterThan(CLES.oeuvres.length)
  })
})
