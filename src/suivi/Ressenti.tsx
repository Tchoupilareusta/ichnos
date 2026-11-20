import { useId } from 'react'
import { APPRECIATIONS, libelleAppreciation, type Appreciation } from '../bibliotheque/suivi'
import { Feuille } from '../composants/Feuille'
import { LIEN_ACTION, Section } from '../composants/Section'

const MOT =
  'flex min-h-11 cursor-pointer items-center rounded-pilule border px-4 text-[0.9375rem] transition-colors duration-200 aria-disabled:cursor-default aria-disabled:opacity-60'
const MOT_LIBRE = `${MOT} border-bordure bg-surface font-semibold text-encre`
const MOT_CHOISI = `${MOT} border-accent bg-accent font-bold text-sur-accent`

/** Les quatre mots (docs/reference.md §6.4). Toucher le mot choisi le retire. */
function Mots({
  valeur,
  choisir,
  desactive,
  libelle,
  retirable = true,
}: {
  valeur: Appreciation | null
  choisir: (valeur: Appreciation | null) => void
  desactive: boolean
  libelle: string
  retirable?: boolean
}) {
  const idAide = useId()
  return (
    <div role="group" aria-label={libelle} className="flex flex-wrap gap-2">
      {APPRECIATIONS.map((a) => {
        const choisi = valeur === a.valeur
        return (
          <button
            key={a.valeur}
            type="button"
            aria-pressed={choisi}
            aria-describedby={choisi && retirable ? idAide : undefined}
            aria-disabled={desactive || undefined}
            onClick={() => !desactive && choisir(choisi ? null : a.valeur)}
            className={choisi ? MOT_CHOISI : MOT_LIBRE}
          >
            {a.libelle}
          </button>
        )
      })}
      <span id={idAide} className="sr-only">
        Toucher deux fois pour retirer
      </span>
    </div>
  )
}

/** « Mon ressenti » sur la fiche : facultatif, se change à tout moment. */
export function MonRessenti({
  valeur,
  choisir,
  enLigne,
}: {
  valeur: Appreciation | null
  choisir: (valeur: Appreciation | null) => void
  enLigne: boolean
}) {
  return (
    <Section titre="Mon ressenti" complement={<span className="mr-auto text-sm text-discret">facultatif</span>}>
      <Mots valeur={valeur} choisir={choisir} desactive={!enLigne} libelle="Mon ressenti" />
      {valeur && (
        <button
          type="button"
          aria-label={`Retirer mon ressenti « ${libelleAppreciation(valeur)} »`}
          aria-disabled={!enLigne || undefined}
          onClick={() => enLigne && choisir(null)}
          className={`${LIEN_ACTION} -mt-1 self-start`}
        >
          Retirer
        </button>
      )}
    </Section>
  )
}

/** Proposé quand je termine un livre : un mot, sans obligation, ou « Plus tard ». */
export function ProposerRessenti({
  ouvert,
  titre,
  valeur,
  choisir,
  fermer,
}: {
  ouvert: boolean
  titre: string
  valeur: Appreciation | null
  choisir: (valeur: Appreciation) => void
  fermer: () => void
}) {
  return (
    <Feuille ouvert={ouvert} titre="Mon ressenti" sousTitre={titre} fermer={fermer} libelleFermer="Plus tard" fermetureDiscrete>
      <ContenuRessenti valeur={valeur} choisir={choisir} />
    </Feuille>
  )
}

/** Le contenu du panneau, partagé avec « Où j'en suis » qui change de contenu au lieu de s'empiler. */
export function ContenuRessenti({ valeur, choisir }: { valeur: Appreciation | null; choisir: (valeur: Appreciation) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[1.0625rem]">Un mot pour garder le souvenir de cette lecture, sans obligation.</p>
      {/* Ici, toucher le mot déjà choisi le garde, simplement. */}
      <Mots valeur={valeur} choisir={(v) => choisir(v ?? (valeur as Appreciation))} desactive={false} libelle="Mon ressenti" retirable={false} />
    </div>
  )
}
