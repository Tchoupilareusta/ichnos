import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Pendant une saisie (« Modifier », le formulaire d'« Ajouter ») : la navigation (barre du bas sur
 * iPhone, barre latérale sur iPad) laisse la place à la barre « Annuler / Enregistrer ». Un toucher
 * sur un onglet ne peut donc plus faire perdre ma saisie. Elle revient dès que je quitte l'écran.
 *
 * Pendant une sélection de tomes, seule la barre du bas de l'iPhone laisse la place à la barre
 * d'actions ; la barre latérale de l'iPad reste.
 */
type Etat = {
  enSaisie: boolean
  setEnSaisie: (enSaisie: boolean) => void
  barreDuBasMasquee: boolean
  setBarreDuBasMasquee: (masquee: boolean) => void
}
const Contexte = createContext<Etat>({ enSaisie: false, setEnSaisie: () => {}, barreDuBasMasquee: false, setBarreDuBasMasquee: () => {} })

export function FournisseurSaisie({ children }: { children: ReactNode }) {
  const [enSaisie, setEnSaisie] = useState(false)
  const [barreDuBasMasquee, setBarreDuBasMasquee] = useState(false)
  return (
    <Contexte.Provider value={{ enSaisie, setEnSaisie, barreDuBasMasquee, setBarreDuBasMasquee }}>{children}</Contexte.Provider>
  )
}

/** Vrai pendant une saisie : la navigation est masquée. */
export const useEnSaisie = () => useContext(Contexte).enSaisie

/** Vrai quand la barre du bas laisse la place à une autre barre (saisie, ou sélection de tomes). */
export const useBarreDuBasMasquee = () => {
  const { enSaisie, barreDuBasMasquee } = useContext(Contexte)
  return enSaisie || barreDuBasMasquee
}

/** À appeler par l'écran de saisie : la navigation est masquée tant qu'il est affiché. */
export function useMasquerNavigation() {
  const { setEnSaisie } = useContext(Contexte)
  useEffect(() => {
    setEnSaisie(true)
    return () => setEnSaisie(false)
  }, [setEnSaisie])
}

/** La barre du bas de l'iPhone est masquée tant que `masquer` est vrai (et rendue en quittant l'écran). */
export function useMasquerBarreDuBas(masquer: boolean) {
  const { setBarreDuBasMasquee } = useContext(Contexte)
  useEffect(() => {
    setBarreDuBasMasquee(masquer)
    return () => setBarreDuBasMasquee(false)
  }, [masquer, setBarreDuBasMasquee])
}
