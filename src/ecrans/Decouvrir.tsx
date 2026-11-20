import { EtatVide, Page, TitrePage } from '../composants/Page'

export function Decouvrir() {
  return (
    <Page>
      <TitrePage>Découvrir</TitrePage>
      <section aria-labelledby="envie" className="flex flex-col gap-3">
        <h2 id="envie" className="m-0 font-texte text-[0.9375rem] font-bold text-discret">
          Mon envie du moment
        </h2>
        <EtatVide>
          Dès que ma bibliothèque aura quelques œuvres à découvrir, des idées selon mon humeur apparaîtront ici.
        </EtatVide>
      </section>
    </Page>
  )
}
