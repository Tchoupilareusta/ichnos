import { useState } from 'react'
import { progressionDe, type EnCours } from '../bibliotheque/depot'
import { useEnCours } from '../bibliotheque/requetes'
import { texteProgression } from '../bibliotheque/suivi'
import { Bouton } from '../composants/Bouton'
import { IconeFleche, IconeReglages, IconeSignet } from '../composants/Icones'
import { BoutonPrincipal, EtatVide, Page, TitrePage } from '../composants/Page'
import { Couverture } from '../couvertures/Couverture'
import { LIENS } from '../navigation/routes'
import { useEnLigne } from '../navigation/useEnLigne'
import { OuJenSuis } from '../suivi/OuJenSuis'

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
      <EnCeMoment />

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

/** « En ce moment » : mes lectures en cours, en couvertures, avec la progression écrite en mots (jamais de barre ici). */
function EnCeMoment() {
  const requete = useEnCours()
  const enLigne = useEnLigne()
  // La lecture du panneau est gardée telle qu'à l'ouverture : terminée ou mise en pause,
  // elle quitte la liste, mais le panneau reste là le temps de proposer mon ressenti.
  const [cible, setCible] = useState<EnCours | null>(null)
  const [ouvert, setOuvert] = useState(false)
  const [annonce, setAnnonce] = useState('')
  const lectures = requete.data

  return (
    <section aria-labelledby="encours" className="flex flex-col gap-[1.125rem]">
      <TitrePage id="encours">En ce moment</TitrePage>

      {requete.isPending && (
        <p role="status" className="m-0 text-discret">
          Chargement de mes lectures…
        </p>
      )}

      {requete.isError && !lectures && (
        <EtatVide
          action={
            <Bouton variante="secondaire" onClick={() => void requete.refetch()}>
              Réessayer
            </Bouton>
          }
        >
          <span role="alert">
            {requete.error.echec === 'reseau'
              ? 'Pas de connexion à internet : mes lectures en cours s’afficheront au retour du réseau.'
              : 'Mes lectures en cours n’ont pas pu s’afficher. Réessayer dans un instant.'}
          </span>
        </EtatVide>
      )}

      {lectures && lectures.length === 0 && (
        <EtatVide action={<BoutonPrincipal href={LIENS.bibliotheque}>Parcourir ma bibliothèque</BoutonPrincipal>}>
          Aucune lecture en cours pour l’instant.
        </EtatVide>
      )}

      {lectures && lectures.length > 0 && (
        <ul
          aria-label="Mes lectures en cours"
          className="-mx-6 m-0 flex list-none snap-x snap-mandatory scroll-px-6 gap-[1.125rem] overflow-x-auto px-6 pt-1 pb-2 tablette:mx-0 tablette:px-0 tablette:scroll-px-0"
        >
          {lectures.map((lecture) => (
            <CarteEnCours
              key={lecture.id}
              lecture={lecture}
              enLigne={enLigne}
              ouvrir={() => {
                setCible(lecture)
                setOuvert(true)
              }}
            />
          ))}
        </ul>
      )}

      {lectures && lectures.length > 0 && !enLigne && (
        <p className="m-0 text-sm text-discret">La progression pourra être notée au retour du réseau.</p>
      )}

      <p role="status" className="sr-only">
        {annonce}
      </p>

      {cible && (
        <OuJenSuis
          key={cible.id}
          lecture={cible}
          ouvert={ouvert}
          fermer={() => setOuvert(false)}
          enLigne={enLigne}
          annoncer={setAnnonce}
        />
      )}
    </section>
  )
}

function CarteEnCours({ lecture, enLigne, ouvrir }: { lecture: EnCours; enLigne: boolean; ouvrir: () => void }) {
  const p = progressionDe(lecture)
  const court = texteProgression(p)
  const long = texteProgression(p, { long: true })
  const auteurs = lecture.auteurs.join(', ')
  return (
    <li className="flex w-[9.75rem] shrink-0 snap-start flex-col gap-3 tablette:w-[11rem]">
      <a href={LIENS.oeuvre(lecture.id)} className="flex flex-col gap-3 text-encre no-underline">
        <Couverture titre={lecture.titre} auteur={auteurs || null} graine={lecture.id} chemin={lecture.couverture} className="w-full" />
        <span className="flex flex-col gap-0.5">
          <span className="text-[0.9375rem] leading-tight font-bold">{lecture.titre}</span>
          {court && court === long ? (
            <span className="text-sm text-discret">{court}</span>
          ) : court ? (
            // « p. 75 » se lit « Page 75 » pour VoiceOver.
            <>
              <span aria-hidden="true" className="text-sm text-discret">
                {court}
              </span>
              <span className="sr-only">{long}</span>
            </>
          ) : (
            auteurs && <span className="text-sm text-discret">{auteurs}</span>
          )}
        </span>
      </a>
      <button
        type="button"
        aria-label={`Noter où j’en suis dans ${lecture.titre}`}
        aria-haspopup="dialog"
        aria-disabled={!enLigne || undefined}
        onClick={() => enLigne && ouvrir()}
        className="flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-pilule border border-bordure bg-surface pr-4 pl-3.5 text-sm font-bold text-encre aria-disabled:cursor-default aria-disabled:opacity-60"
      >
        <IconeSignet taille={16} />
        Où j’en suis
      </button>
    </li>
  )
}
