import { BoutonPrincipal, EtatVide, Page, TitrePage } from '../composants/Page'
import { LIENS } from '../navigation/routes'

export function Introuvable() {
  return (
    <Page>
      <TitrePage>Page introuvable</TitrePage>
      <EtatVide action={<BoutonPrincipal href={LIENS.accueil}>Revenir à l’accueil</BoutonPrincipal>}>
        Cette page n’existe pas, ou plus.
      </EtatVide>
    </Page>
  )
}
