import { useEffect, useState } from 'react'
import { ecranDepuisHash, type Ecran } from './routes'

/** Écran courant, d'après le hash de l'adresse (routage compatible GitHub Pages). */
export function useEcran(): Ecran {
  const [ecran, setEcran] = useState<Ecran>(() => ecranDepuisHash(window.location.hash))

  useEffect(() => {
    const surChangement = () => {
      setEcran(ecranDepuisHash(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', surChangement)
    return () => window.removeEventListener('hashchange', surChangement)
  }, [])

  return ecran
}
