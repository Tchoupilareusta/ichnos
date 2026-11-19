import { useEffect, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BarreDuBas, BarreLaterale } from './navigation/Navigation'
import { FournisseurRoute, useRouteCourante } from './navigation/useRoute'
import { ongletDe, type Ecran } from './navigation/routes'
import { HorsConnexion } from './composants/HorsConnexion'
import { AllerAuContenu } from './composants/AllerAuContenu'
import { BandeauHaut } from './composants/BandeauHaut'
import { Accueil } from './ecrans/Accueil'
import { Bibliotheque } from './ecrans/Bibliotheque'
import { Decouvrir } from './ecrans/Decouvrir'
import { Ajouter } from './ecrans/Ajouter'
import { Modifier } from './ecrans/Formulaire'
import { Fiche } from './ecrans/Fiche'
import { Reglages } from './ecrans/Reglages'
import { Introuvable } from './ecrans/Introuvable'
import { Connexion, NonConfigure } from './ecrans/Connexion'
import { ASSISTANT_ABSENT, type Assistant } from './ajout/assistant'
import { assistantParDefaut } from './ajout/assistantParDefaut'
import { DEPOT_ABSENT, type Depot } from './bibliotheque/depot'
import { depotParDefaut } from './bibliotheque/depotParDefaut'
import { couverturesParDefaut } from './couvertures/couverturesParDefaut'
import { COUVERTURES_ABSENTES, type Couvertures } from './couvertures/stockage'
import type { Auth } from './session/auth'
import { authParDefaut } from './session/authParDefaut'
import { FournisseurSession, useEtatSession } from './session/Session'
import { creerClientRequetes } from './bibliotheque/requetes'

const ECRANS: Record<Ecran, () => React.JSX.Element> = {
  accueil: Accueil,
  bibliotheque: Bibliotheque,
  decouvrir: Decouvrir,
  ajouter: Ajouter,
  reglages: Reglages,
  oeuvre: Fiche,
  modifier: Modifier,
  introuvable: Introuvable,
}

// null : l'écran choisit lui-même son titre (celui de l'œuvre, par exemple).
const TITRES: Record<Ecran, string | null> = {
  accueil: 'Ichnos',
  bibliotheque: 'Ma bibliothèque · Ichnos',
  decouvrir: 'Découvrir · Ichnos',
  ajouter: null,
  reglages: 'Réglages · Ichnos',
  oeuvre: null,
  modifier: null,
  introuvable: 'Page introuvable · Ichnos',
}

/** L'appli entière est réservée au compte connecté : sans session, seul l'écran de connexion s'affiche. */
export function App({
  auth = authParDefaut,
  depot = depotParDefaut,
  assistant = assistantParDefaut,
  couvertures = couverturesParDefaut,
}: {
  auth?: Auth | null
  depot?: Depot | null
  assistant?: Assistant | null
  couvertures?: Couvertures | null
}) {
  if (!auth) {
    return (
      <>
        <BandeauHaut />
        <HorsConnexion />
        <NonConfigure />
      </>
    )
  }
  return (
    <AppReservee
      auth={auth}
      depot={depot ?? DEPOT_ABSENT}
      assistant={assistant ?? ASSISTANT_ABSENT}
      couvertures={couvertures ?? COUVERTURES_ABSENTES}
    />
  )
}

function AppReservee({ auth, depot, assistant, couvertures }: { auth: Auth; depot: Depot; assistant: Assistant; couvertures: Couvertures }) {
  const session = useEtatSession(auth)
  const route = useRouteCourante()
  const ecran = route.ecran
  const Contenu = ECRANS[ecran]
  // Un cache de données par session ouverte : rien ne passe d'un compte à l'autre.
  const [requetes, setRequetes] = useState(creerClientRequetes)
  const compte = session.statut === 'connecte' ? session.compte.email : null
  useEffect(() => {
    if (!compte) setRequetes((actuel) => (actuel.clear(), creerClientRequetes()))
  }, [compte])

  useEffect(() => {
    if (session.statut === 'chargement') return
    if (session.statut !== 'connecte') document.title = 'Connexion · Ichnos'
    else if (TITRES[ecran]) document.title = TITRES[ecran]
  }, [ecran, session.statut])

  // Le temps de relire la session gardée sur l'appareil (quelques millisecondes) : le fond seul.
  if (session.statut === 'chargement') return null

  if (session.statut === 'deconnecte') {
    return (
      <>
        <BandeauHaut />
        <HorsConnexion />
        <Connexion auth={auth} />
      </>
    )
  }

  return (
    <QueryClientProvider client={requetes}>
      <FournisseurSession value={{ auth, compte: session.compte, depot, assistant, couvertures }}>
        <FournisseurRoute value={route}>
          <AllerAuContenu />
          <BandeauHaut />
          <HorsConnexion />
          <BarreLaterale ecran={ongletDe(ecran)} />
          {/* Une adresse, un écran neuf : la bibliothèque relit ses filtres, le formulaire repart de la fiche. */}
          <Contenu key={`${ecran}/${route.id ?? ''}?${route.parametres}`} />
          <BarreDuBas ecran={ongletDe(ecran)} />
        </FournisseurRoute>
      </FournisseurSession>
    </QueryClientProvider>
  )
}
