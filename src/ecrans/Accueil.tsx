import { BoutonPrincipal, EtatVide, Page, TitrePage } from '../composants/Page'
import { IconeFleche, IconeReglages } from '../composants/Icones'
import { LIENS } from '../navigation/routes'

export function Accueil() {
  return (
    <Page
      entete={
        <div className="flex items-center justify-between tablette:hidden">
          <span className="font-titre text-[1.375rem] italic text-accent-texte">Ichnos</span>
          <a
            href={LIENS.reglages}
            aria-label="Réglages"
            className="flex size-11 items-center justify-center rounded-pilule border border-bordure bg-surface text-discret"
          >
            <IconeReglages taille={20} />
          </a>
        </div>
      }
    >
      <section aria-labelledby="encours" className="flex flex-col gap-[1.125rem]">
        <TitrePage id="encours">En ce moment</TitrePage>
        <EtatVide action={<BoutonPrincipal href={LIENS.bibliotheque}>Parcourir ma bibliothèque</BoutonPrincipal>}>
          Aucune lecture en cours pour l’instant.
        </EtatVide>
      </section>

      <a
        href={LIENS.decouvrir}
        className="flex h-14 max-w-xl items-center justify-between rounded-pilule border border-bordure bg-surface px-5 text-base font-semibold text-encre no-underline"
      >
        Selon mon humeur
        <IconeFleche taille={20} />
      </a>
    </Page>
  )
}
