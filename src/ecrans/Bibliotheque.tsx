import { BoutonPrincipal, EtatVide, Page, TitrePage } from '../composants/Page'
import { LIENS } from '../navigation/routes'

export function Bibliotheque() {
  return (
    <Page>
      <TitrePage>Ma bibliothèque</TitrePage>
      <EtatVide action={<BoutonPrincipal href={LIENS.ajouter}>Ajouter une œuvre</BoutonPrincipal>}>
        Ma bibliothèque est encore vide.
      </EtatVide>
    </Page>
  )
}
