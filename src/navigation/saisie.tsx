import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * Pendant une saisie (« Modifier », le formulaire d'« Ajouter ») : la navigation (barre du bas sur
 * iPhone, barre latérale sur iPad) laisse la place à la barre « Annuler / Enregistrer ». Un toucher
 * sur un onglet ne peut donc plus faire perdre ma saisie. Elle revient dès que je quitte l'écran.
 */
const Contexte = createContext<{ enSaisie: boolean; setEnSaisie: (enSaisie: boolean) => void }>({ enSaisie: false, setEnSaisie: () => {} })

export function FournisseurSaisie({ children }: { children: ReactNode }) {
  const [enSaisie, setEnSaisie] = useState(false)
  return <Contexte.Provider value={{ enSaisie, setEnSaisie }}>{children}</Contexte.Provider>
}

/** Vrai pendant une saisie : la navigation est masquée. */
export const useEnSaisie = () => useContext(Contexte).enSaisie

/** À appeler par l'écran de saisie : la navigation est masquée tant qu'il est affiché. */
export function useMasquerNavigation() {
  const { setEnSaisie } = useContext(Contexte)
  useEffect(() => {
    setEnSaisie(true)
    return () => setEnSaisie(false)
  }, [setEnSaisie])
}
