import { useEffect } from 'react'
import { BarreDuBas, BarreLaterale } from './navigation/Navigation'
import { useEcran } from './navigation/useEcran'
import type { Ecran } from './navigation/routes'
import { HorsConnexion } from './composants/HorsConnexion'
import { Accueil } from './ecrans/Accueil'
import { Bibliotheque } from './ecrans/Bibliotheque'
import { Decouvrir } from './ecrans/Decouvrir'
import { Ajouter } from './ecrans/Ajouter'
import { Reglages } from './ecrans/Reglages'
import { Introuvable } from './ecrans/Introuvable'

const ECRANS: Record<Ecran, () => React.JSX.Element> = {
  accueil: Accueil,
  bibliotheque: Bibliotheque,
  decouvrir: Decouvrir,
  ajouter: Ajouter,
  reglages: Reglages,
  introuvable: Introuvable,
}

const TITRES: Record<Ecran, string> = {
  accueil: 'Ichnos',
  bibliotheque: 'Ma bibliothèque · Ichnos',
  decouvrir: 'Découvrir · Ichnos',
  ajouter: 'Ajouter une œuvre · Ichnos',
  reglages: 'Réglages · Ichnos',
  introuvable: 'Page introuvable · Ichnos',
}

export function App() {
  const ecran = useEcran()
  const Contenu = ECRANS[ecran]

  useEffect(() => {
    document.title = TITRES[ecran]
  }, [ecran])

  return (
    <>
      <HorsConnexion />
      <BarreLaterale ecran={ecran} />
      <Contenu />
      <BarreDuBas ecran={ecran} />
    </>
  )
}
