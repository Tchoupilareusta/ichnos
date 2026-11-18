import { useEffect } from 'react'
import { BarreDuBas, BarreLaterale } from './navigation/Navigation'
import { useEcran } from './navigation/useEcran'
import type { Ecran } from './navigation/routes'
import { HorsConnexion } from './composants/HorsConnexion'
import { AllerAuContenu } from './composants/AllerAuContenu'
import { Accueil } from './ecrans/Accueil'
import { Bibliotheque } from './ecrans/Bibliotheque'
import { Decouvrir } from './ecrans/Decouvrir'
import { Ajouter } from './ecrans/Ajouter'
import { Reglages } from './ecrans/Reglages'
import { Introuvable } from './ecrans/Introuvable'
import { Connexion, NonConfigure } from './ecrans/Connexion'
import { DEPOT_ABSENT, type Depot } from './bibliotheque/depot'
import { depotParDefaut } from './bibliotheque/depotParDefaut'
import type { Auth } from './session/auth'
import { authParDefaut } from './session/authParDefaut'
import { FournisseurSession, useEtatSession } from './session/Session'

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

/** L'appli entière est réservée au compte connecté : sans session, seul l'écran de connexion s'affiche. */
export function App({ auth = authParDefaut, depot = depotParDefaut }: { auth?: Auth | null; depot?: Depot | null }) {
  if (!auth) {
    return (
      <>
        <HorsConnexion />
        <NonConfigure />
      </>
    )
  }
  return <AppReservee auth={auth} depot={depot ?? DEPOT_ABSENT} />
}

function AppReservee({ auth, depot }: { auth: Auth; depot: Depot }) {
  const session = useEtatSession(auth)
  const ecran = useEcran()
  const Contenu = ECRANS[ecran]

  useEffect(() => {
    if (session.statut === 'chargement') return
    document.title = session.statut === 'connecte' ? TITRES[ecran] : 'Connexion · Ichnos'
  }, [ecran, session.statut])

  // Le temps de relire la session gardée sur l'appareil (quelques millisecondes) : le fond seul.
  if (session.statut === 'chargement') return null

  if (session.statut === 'deconnecte') {
    return (
      <>
        <HorsConnexion />
        <Connexion auth={auth} />
      </>
    )
  }

  return (
    <FournisseurSession value={{ auth, compte: session.compte, depot }}>
      <AllerAuContenu />
      <HorsConnexion />
      <BarreLaterale ecran={ecran} />
      <Contenu />
      <BarreDuBas ecran={ecran} />
    </FournisseurSession>
  )
}
