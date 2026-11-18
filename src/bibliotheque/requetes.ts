import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '../session/Session'
import type {
  ChoixTomes,
  EchecEcriture,
  EchecFiche,
  Ecriture,
  FicheEnvoi,
  OeuvreDetaillee,
  OeuvreListee,
  Vocabulaire,
} from './depot'
import type { Possession, Statut } from './modele'

/** Échec d'une lecture ou d'une écriture, porté jusqu'à l'écran qui choisit ses mots. */
export class EchecDepot<T extends string = EchecFiche | EchecEcriture> extends Error {
  readonly echec: T
  constructor(echec: T) {
    super(echec)
    this.echec = echec
  }
}

export const CLES = {
  oeuvres: ['oeuvres'] as const,
  oeuvre: (id: string) => ['oeuvre', id] as const,
  vocabulaire: ['vocabulaire'] as const,
}

/**
 * Un cache par session de l'appli. Les données déjà chargées restent consultables
 * hors connexion tant que l'appli est ouverte (le cache qui survit à la fermeture
 * viendra à l'étape 9). Une écriture n'est jamais rejouée toute seule.
 */
export function creerClientRequetes() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Les requêtes partent même hors ligne : l'échec « réseau » s'affiche, au lieu d'une attente muette.
        networkMode: 'always',
        // Pas de nouvelle tentative muette : l'écran explique l'échec et propose « Réessayer ».
        retry: false,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
      },
      mutations: { networkMode: 'always', retry: false },
    },
  })
}

export function useOeuvres() {
  const { depot } = useSession()
  return useQuery<OeuvreListee[], EchecDepot>({
    queryKey: CLES.oeuvres,
    queryFn: async () => {
      const lecture = await depot.listerOeuvres()
      if (!lecture.ok) throw new EchecDepot(lecture.echec)
      return lecture.oeuvres
    },
  })
}

export function useOeuvre(id: string) {
  const { depot } = useSession()
  return useQuery<OeuvreDetaillee, EchecDepot>({
    queryKey: CLES.oeuvre(id),
    queryFn: async () => {
      const lecture = await depot.lireOeuvre(id)
      if (!lecture.ok) throw new EchecDepot(lecture.echec)
      return lecture.oeuvre
    },
  })
}

export function useVocabulaire() {
  const { depot } = useSession()
  return useQuery<Vocabulaire, EchecDepot>({
    queryKey: CLES.vocabulaire,
    queryFn: async () => {
      const lecture = await depot.lireVocabulaire()
      if (!lecture.ok) throw new EchecDepot(lecture.echec)
      return lecture.vocabulaire
    },
  })
}

const verifier = (resultat: Ecriture) => {
  if (!resultat.ok) throw new EchecDepot(resultat.echec)
}

/** Les écritures depuis la fiche. Après chacune, la fiche et la bibliothèque se relisent. */
export function useModifierOeuvre(id: string) {
  const { depot } = useSession()
  const client = useQueryClient()
  const mutationKey = ['modifier', id]
  // Relire seulement quand le dernier changement en cours est terminé : une relecture lancée
  // entre deux changements rapides effacerait un instant l'affichage du second.
  const relire = () =>
    client.isMutating({ mutationKey }) > 1
      ? Promise.resolve()
      : Promise.all([
          client.invalidateQueries({ queryKey: CLES.oeuvre(id) }),
          client.invalidateQueries({ queryKey: CLES.oeuvres }),
        ])

  // Le statut, la possession et mon édition s'affichent tout de suite ; en cas d'échec, l'ancienne valeur revient.
  function optimiste(changer: (oeuvre: OeuvreDetaillee) => OeuvreDetaillee) {
    return async () => {
      await client.cancelQueries({ queryKey: CLES.oeuvre(id) })
      const avant = client.getQueryData<OeuvreDetaillee>(CLES.oeuvre(id))
      if (avant) client.setQueryData(CLES.oeuvre(id), changer(avant))
      return { avant }
    }
  }
  const retablir = (_e: unknown, _v: unknown, contexte: { avant?: OeuvreDetaillee } | undefined) => {
    if (contexte?.avant) client.setQueryData(CLES.oeuvre(id), contexte.avant)
  }

  const statut = useMutation<void, EchecDepot, Statut, { avant?: OeuvreDetaillee }>({
    mutationKey,
    mutationFn: async (valeur) => verifier(await depot.changerStatut(id, valeur)),
    onMutate: (valeur) => optimiste((o) => ({ ...o, statut: valeur }))(),
    onError: retablir,
    onSettled: relire,
  })

  const possession = useMutation<void, EchecDepot, Possession, { avant?: OeuvreDetaillee }>({
    mutationKey,
    mutationFn: async (valeur) => verifier(await depot.changerPossession(id, valeur)),
    onMutate: (valeur) => optimiste((o) => ({ ...o, possession: valeur }))(),
    onError: retablir,
    onSettled: relire,
  })

  const possessionTomes = useMutation<
    void,
    EchecDepot,
    { tomes: ChoixTomes; possession: Possession },
    { avant?: OeuvreDetaillee }
  >({
    mutationKey,
    mutationFn: async ({ tomes, possession: valeur }) => verifier(await depot.changerPossessionTomes(id, tomes, valeur)),
    onMutate: ({ tomes, possession: valeur }) =>
      optimiste((o) => ({
        ...o,
        tomes: o.tomes.map((t) =>
          tomes === 'tous' || (t.numero >= tomes.de && t.numero <= tomes.a) ? { ...t, possession: valeur } : t,
        ),
      }))(),
    onError: retablir,
    onSettled: relire,
  })

  const monEdition = useMutation<void, EchecDepot, string | null, { avant?: OeuvreDetaillee }>({
    mutationKey,
    mutationFn: async (valeur) => verifier(await depot.changerMonEdition(id, valeur)),
    onMutate: (valeur) => optimiste((o) => ({ ...o, monEdition: valeur }))(),
    onError: retablir,
    onSettled: relire,
  })

  const suppression = useMutation<void, EchecDepot, void>({
    mutationFn: async () => verifier(await depot.supprimerOeuvre(id)),
    onSuccess: async () => {
      client.removeQueries({ queryKey: CLES.oeuvre(id) })
      await client.invalidateQueries({ queryKey: CLES.oeuvres })
    },
  })

  return { statut, possession, possessionTomes, monEdition, suppression }
}

/** Enregistrement du formulaire : tout ou rien, puis la fiche, la bibliothèque et le vocabulaire se relisent. */
export function useEnregistrerOeuvre() {
  const { depot } = useSession()
  const client = useQueryClient()
  return useMutation<string, EchecDepot, FicheEnvoi>({
    mutationFn: async (fiche) => {
      const resultat = await depot.enregistrerOeuvre(fiche)
      if (!resultat.ok) throw new EchecDepot(resultat.echec)
      return resultat.id
    },
    onSuccess: async (id) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: CLES.oeuvre(id) }),
        client.invalidateQueries({ queryKey: CLES.oeuvres }),
        client.invalidateQueries({ queryKey: CLES.vocabulaire }),
      ])
    },
  })
}
