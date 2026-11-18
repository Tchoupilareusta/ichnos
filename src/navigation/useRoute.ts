import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'
import { routeDepuisHash, type Route } from './routes'

// Position de défilement de chaque adresse visitée : « Retour » vers la bibliothèque retrouve
// l'endroit de la grille où j'étais, au lieu de remonter en haut.
const positions = new Map<string, number>()
let pagesVisitees = 0
let retourEnCours = false

/** Vrai si une page de l'appli précède celle-ci dans l'historique : « Retour » peut y revenir. */
export const peutRevenir = () => pagesVisitees > 0

/** Revient à la page précédente de l'appli, ou ouvre `repli` si l'appli vient d'être ouverte sur cette page. */
export function revenir(repli: string) {
  if (peutRevenir()) window.history.back()
  else window.location.replace(repli)
}

/** Remplace la page actuelle de l'historique (après un enregistrement, le formulaire ne doit pas revenir). */
export function remplacer(adresse: string) {
  window.location.replace(adresse)
}

/** Route courante, d'après le hash de l'adresse (routage compatible GitHub Pages). */
export function useRouteCourante(): Route {
  const [etat, setEtat] = useState(() => ({ hash: window.location.hash, defilement: 0 }))

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
    let hashActuel = window.location.hash
    // Sur « Retour » ou « Suivant », le navigateur émet popstate juste avant hashchange.
    const surPopstate = () => {
      retourEnCours = true
    }
    const surChangement = () => {
      positions.set(hashActuel, window.scrollY)
      hashActuel = window.location.hash
      pagesVisitees += 1
      const defilement = retourEnCours ? (positions.get(hashActuel) ?? 0) : 0
      retourEnCours = false
      setEtat({ hash: hashActuel, defilement })
    }
    window.addEventListener('popstate', surPopstate)
    window.addEventListener('hashchange', surChangement)
    return () => {
      window.removeEventListener('popstate', surPopstate)
      window.removeEventListener('hashchange', surChangement)
    }
  }, [])

  // Après l'affichage de la nouvelle page : la position retrouvée, ou le haut.
  useLayoutEffect(() => {
    window.scrollTo(0, etat.defilement)
  }, [etat])

  return routeDepuisHash(etat.hash)
}

const ContexteRoute = createContext<Route | null>(null)
export const FournisseurRoute = ContexteRoute.Provider

export function useRoute(): Route {
  const route = useContext(ContexteRoute)
  if (!route) throw new Error('useRoute doit être utilisé sous FournisseurRoute')
  return route
}
