import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '../session/Session'
import type {
  ChoixTomes,
  EchecEcriture,
  EchecFiche,
  Ecriture,
  EnCours,
  FicheEnvoi,
  OeuvreDetaillee,
  OeuvreListee,
  Vocabulaire,
} from './depot'
import type { CibleCouverture } from '../couvertures/choix'
import type { Possession, Statut } from './modele'
import { historiqueAvecFin, type Appreciation, type LectureTome, type PrecisionDate, type StatutMedia, type Unite } from './suivi'

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
  enCours: ['en-cours'] as const,
  vocabulaire: ['vocabulaire'] as const,
  couverture: (chemin: string) => ['couverture', chemin] as const,
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

export function useEnCours() {
  const { depot } = useSession()
  return useQuery<EnCours[], EchecDepot>({
    queryKey: CLES.enCours,
    queryFn: async () => {
      const lecture = await depot.listerEnCours()
      if (!lecture.ok) throw new EchecDepot(lecture.echec)
      return lecture.lectures
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

/**
 * L'adresse affichable d'une couverture rangée, ou null (pas de couverture, pas encore chargée,
 * ou jamais vue et hors connexion). Une image trouvée est gardée ; un échec est retenté plus tard.
 */
export function useAdresseCouverture(chemin: string | null | undefined): string | null {
  const { couvertures } = useSession()
  const requete = useQuery<string | null>({
    queryKey: CLES.couverture(chemin ?? ''),
    queryFn: () => couvertures.adresse(chemin as string),
    enabled: !!chemin,
    staleTime: (q) => (q.state.data ? Infinity : 0),
    gcTime: Infinity,
  })
  return chemin ? (requete.data ?? null) : null
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

type Contexte = { avant?: OeuvreDetaillee; liste?: EnCours[] }

/** Noter le tome N d'une série (comme noter_progression) : N en cours, les précédents lus, un suivant en cours repasse à lire. */
function tomesApres<T extends { numero: number; lecture: LectureTome }>(tomes: T[], valeur: number | null): T[] {
  if (valeur === null) return tomes
  return tomes.map((t) => ({
    ...t,
    lecture: t.numero < valeur ? 'lu' : t.numero === valeur ? 'en_cours' : t.lecture === 'en_cours' ? 'a_lire' : t.lecture,
  }))
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
          client.invalidateQueries({ queryKey: CLES.enCours }),
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
  const retablir = (_e: unknown, _v: unknown, contexte: Contexte | undefined) => {
    if (contexte?.avant) client.setQueryData(CLES.oeuvre(id), contexte.avant)
    if (contexte?.liste) client.setQueryData(CLES.enCours, contexte.liste)
  }

  /** Une écriture de la fiche ou du panneau « Où j'en suis » : affichée tout de suite, annulée en cas d'échec. */
  function ecriture<V>(
    ecrire: (valeur: V) => Promise<Ecriture>,
    surLaFiche: (oeuvre: OeuvreDetaillee, valeur: V) => OeuvreDetaillee,
    surLaListe?: (lecture: EnCours, valeur: V) => EnCours,
  ) {
    return {
      mutationKey,
      mutationFn: async (valeur: V) => verifier(await ecrire(valeur)),
      onMutate: async (valeur: V): Promise<Contexte> => {
        const { avant } = await optimiste((o) => surLaFiche(o, valeur))()
        let liste: EnCours[] | undefined
        if (surLaListe) {
          await client.cancelQueries({ queryKey: CLES.enCours })
          liste = client.getQueryData<EnCours[]>(CLES.enCours)
          if (liste) client.setQueryData(CLES.enCours, liste.map((l) => (l.id === id ? surLaListe(l, valeur) : l)))
        }
        return { avant, liste }
      },
      onError: retablir,
      onSettled: relire,
    }
  }

  const statut = useMutation<void, EchecDepot, Statut, Contexte>({
    mutationKey,
    mutationFn: async (valeur) => verifier(await depot.changerStatut(id, valeur)),
    onMutate: (valeur) => optimiste((o) => ({ ...o, statut: valeur }))(),
    onError: retablir,
    onSettled: relire,
  })

  const possession = useMutation<void, EchecDepot, Possession, Contexte>({
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

  const monEdition = useMutation<void, EchecDepot, string | null, Contexte>({
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

  const progression = useMutation<void, EchecDepot, number | null, Contexte>(
    ecriture(
      (valeur) => depot.noterProgression(id, valeur),
      (o, valeur) => (o.estSerie ? { ...o, tomes: tomesApres(o.tomes, valeur) } : { ...o, position: valeur }),
      (l, valeur) => (l.estSerie ? { ...l, tomes: tomesApres(l.tomes, valeur) } : { ...l, position: valeur }),
    ),
  )

  const unite = useMutation<void, EchecDepot, { unite: Unite; total: number | null }, Contexte>(
    ecriture(
      ({ unite: u, total }) => depot.changerUnite(id, u, total),
      (o, { unite: u, total }) => ({ ...o, unite: u, total, position: null }),
      (l, { unite: u, total }) => ({ ...l, unite: u, total, position: null }),
    ),
  )

  const total = useMutation<void, EchecDepot, number | null, Contexte>(
    ecriture(
      (valeur) => depot.changerTotal(id, valeur),
      (o, valeur) => ({ ...o, total: valeur }),
      (l, valeur) => ({ ...l, total: valeur }),
    ),
  )

  const dateFin = useMutation<void, EchecDepot, { date: string | null; precision: PrecisionDate }, Contexte>(
    ecriture(
      ({ date, precision }) => depot.daterFin(id, date, precision),
      (o, { date, precision }) => ({ ...o, historique: historiqueAvecFin(o.historique, date, precision) }),
    ),
  )

  const appreciation = useMutation<void, EchecDepot, Appreciation | null, Contexte>(
    ecriture(
      (valeur) => depot.changerAppreciation(id, valeur),
      (o, valeur) => ({ ...o, appreciation: valeur }),
    ),
  )

  const lectureTomes = useMutation<void, EchecDepot, { tomes: ChoixTomes; lecture: LectureTome }, Contexte>(
    ecriture(
      ({ tomes, lecture }) => depot.changerLectureTomes(id, tomes, lecture),
      (o, { tomes, lecture }) => ({
        ...o,
        tomes: o.tomes.map((t) => (tomes === 'tous' || (t.numero >= tomes.de && t.numero <= tomes.a) ? { ...t, lecture } : t)),
      }),
    ),
  )

  const media = useMutation<void, EchecDepot, { media: string; vus?: number | null; statut?: StatutMedia }, Contexte>(
    ecriture(
      ({ media: m, ...valeurs }) => depot.changerMedia(id, m, valeurs),
      (o, { media: m, vus, statut: s }) => ({
        ...o,
        medias: o.medias.map((x) =>
          x.id === m ? { ...x, episodesVus: vus !== undefined ? vus : x.episodesVus, statut: s ?? x.statut } : x,
        ),
      }),
    ),
  )

  return {
    statut,
    possession,
    possessionTomes,
    monEdition,
    suppression,
    progression,
    unite,
    total,
    dateFin,
    appreciation,
    lectureTomes,
    media,
  }
}

/**
 * Enregistrement du formulaire : tout ou rien, puis la fiche, la bibliothèque et le vocabulaire se relisent.
 * `apres` s'exécute une fois la fiche enregistrée et avant la relecture (ranger la couverture trouvée) :
 * son échec ne défait pas l'enregistrement.
 */
export function useEnregistrerOeuvre() {
  const { depot } = useSession()
  const client = useQueryClient()
  return useMutation<string, EchecDepot, { fiche: FicheEnvoi; apres?: (id: string) => Promise<void> }>({
    mutationFn: async ({ fiche, apres }) => {
      const resultat = await depot.enregistrerOeuvre(fiche)
      if (!resultat.ok) throw new EchecDepot(resultat.echec)
      await apres?.(resultat.id).catch(() => {})
      return resultat.id
    },
    onSuccess: async (id) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: CLES.oeuvre(id) }),
        client.invalidateQueries({ queryKey: CLES.oeuvres }),
        client.invalidateQueries({ queryKey: CLES.enCours }),
        client.invalidateQueries({ queryKey: CLES.vocabulaire }),
      ])
    },
  })
}

/** Retire une couverture (de l'œuvre, d'une édition ou d'un tome), puis relit la fiche et les listes. */
export function useRetirerCouverture(id: string) {
  const { depot } = useSession()
  const client = useQueryClient()
  return useMutation<void, EchecDepot, CibleCouverture[]>({
    mutationFn: async (cibles) => {
      for (const cible of cibles) verifier(await depot.definirCouverture(id, cible, null))
    },
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: CLES.oeuvre(id) }),
        client.invalidateQueries({ queryKey: CLES.oeuvres }),
        client.invalidateQueries({ queryKey: CLES.enCours }),
      ]),
  })
}
