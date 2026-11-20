import { useEffect, useRef, useState } from 'react'
import { progressionDe, suiviDeLaFiche, type OeuvreDetaillee } from '../bibliotheque/depot'
import type { useModifierOeuvre } from '../bibliotheque/requetes'
import {
  MOTS_UNITE,
  UNITES,
  UNITES_LIVRE,
  pas,
  pourcentage,
  texteProgression,
  texteSansTotal,
  totalAtteint,
  totalPropose,
  type Progression,
  type Unite,
} from '../bibliotheque/suivi'
import { Bouton } from '../composants/Bouton'
import { ChampTexte, Pastilles } from '../composants/Champs'
import { Feuille } from '../composants/Feuille'
import { IconeAjouter, IconeMoins } from '../composants/Icones'
import { LIEN_ACTION, Section } from '../composants/Section'

type Modifier = ReturnType<typeof useModifierOeuvre>

/** Délai entre le dernier appui sur − ou + et l'enregistrement : une seule écriture pour plusieurs appuis. */
export const DELAI_ENREGISTREMENT = 1000

const BOUTON_ROND =
  'flex size-[3.25rem] shrink-0 cursor-pointer items-center justify-center rounded-pilule p-0 transition-transform duration-200 active:scale-95 aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:active:scale-100'

/** Fin d'une lecture : tous les tomes lus pour une série, le total atteint pour un livre. */
export function finAtteinte(oeuvre: Pick<OeuvreDetaillee, 'estSerie'> & { tomes: { lecture: string }[] }, p: Progression) {
  return oeuvre.estSerie ? oeuvre.tomes.length > 0 && oeuvre.tomes.every((t) => t.lecture === 'lu') : totalAtteint(p)
}

/** Lire une position saisie : un entier dans les bornes, ou un message calme qui dit pourquoi. */
export function lirePosition(saisie: string, p: Progression, minimum: number): { valeur: number } | { erreur: string } {
  const valeur = Number(saisie.trim())
  if (saisie.trim() === '' || !Number.isInteger(valeur) || valeur < minimum)
    return { erreur: minimum > 0 ? `Un numéro à partir de ${minimum}.` : 'Un nombre entier, à partir de 0.' }
  if (p.total !== null && valeur > p.total) return { erreur: `Au plus ${p.total}.` }
  return { valeur }
}

/**
 * « Ma progression » sur la fiche (maquette Fiche) : − et +, le grand chiffre, la barre,
 * la saisie directe, l'unité et le total. − et + s'enregistrent une seconde après le dernier appui.
 */
export function ProgressionFiche({
  oeuvre,
  titre,
  enLigne,
  modifier,
  terminer,
}: {
  oeuvre: OeuvreDetaillee
  titre: string
  enLigne: boolean
  modifier: Modifier
  /** Passe le livre en « Terminé » (et propose mon ressenti). */
  terminer: () => void
}) {
  const suivi = suiviDeLaFiche(oeuvre)
  const enregistre = progressionDe(suivi)
  const minimum = oeuvre.estSerie ? 1 : 0
  const mots = MOTS_UNITE[enregistre.unite]

  // Le chiffre affiché pendant les appuis rapides, avant l'enregistrement.
  const [brouillon, setBrouillon] = useState<number | undefined>(undefined)
  const [saisie, setSaisie] = useState(false)
  const [reglages, setReglages] = useState(false)
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enAttente = useRef<number | null>(null)
  const version = useRef(0)

  const p: Progression = brouillon === undefined ? enregistre : { ...enregistre, position: brouillon }

  async function enregistrer(valeur: number) {
    // Première progression sans unité choisie : « page » est enregistrée, avec le total de mon édition.
    if (!oeuvre.estSerie && oeuvre.unite === null) await modifier.unite.mutateAsync({ unite: 'page', total: suivi.pagesEdition })
    await modifier.progression.mutateAsync(valeur)
  }

  function lancer(valeur: number) {
    const ma = ++version.current
    enAttente.current = null
    enregistrer(valeur)
      .catch(() => undefined)
      .finally(() => {
        if (version.current === ma) setBrouillon(undefined)
      })
  }

  function avancer(sens: 1 | -1) {
    if (!enLigne) return
    const valeur = pas(p, sens, minimum)
    if (valeur === p.position) return
    setBrouillon(valeur)
    version.current += 1
    enAttente.current = valeur
    if (minuterie.current) clearTimeout(minuterie.current)
    minuterie.current = setTimeout(() => lancer(valeur), DELAI_ENREGISTREMENT)
  }

  // En quittant la fiche, ce qui attendait encore part tout de suite.
  useEffect(
    () => () => {
      if (minuterie.current) clearTimeout(minuterie.current)
      if (enAttente.current !== null) void enregistrer(enAttente.current).catch(() => undefined)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const part = pourcentage(p)
  const grand = texteSansTotal(p)
  const fin = finAtteinte({ estSerie: oeuvre.estSerie, tomes: suivi.tomes }, p)
  const depuisEdition = !oeuvre.estSerie && p.unite === 'page' && p.total !== null && p.total === suivi.pagesEdition

  return (
    <Section
      titre="Ma progression"
      complement={
        !saisie && (
          <button type="button" aria-disabled={!enLigne || undefined} onClick={() => enLigne && setSaisie(true)} className={LIEN_ACTION}>
            {mots.saisir}
          </button>
        )
      }
    >
      {saisie ? (
        <SaisiePosition
          p={p}
          minimum={minimum}
          libelle={mots.jenSuis}
          annuler={() => setSaisie(false)}
          valider={(valeur) => {
            setSaisie(false)
            if (minuterie.current) clearTimeout(minuterie.current)
            setBrouillon(valeur)
            lancer(valeur)
          }}
        />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label={mots.moins}
            aria-disabled={!enLigne || p.position === null || p.position <= minimum || undefined}
            onClick={() => p.position !== null && p.position > minimum && avancer(-1)}
            className={`${BOUTON_ROND} border border-bordure bg-fond text-encre`}
          >
            <IconeMoins taille={18} />
          </button>
          <p
            className="m-0 flex min-w-0 flex-wrap items-baseline justify-center gap-x-2 text-center"
            aria-live="polite"
            aria-atomic="true"
          >
            {grand ? (
              <>
                <span className="sr-only">{texteProgression(p, { long: true })}</span>
                <span aria-hidden="true" className="font-titre text-[2.125rem] leading-none tabular-nums">
                  {grand}
                </span>
                {p.total !== null && p.unite !== 'pourcentage' && (
                  <span aria-hidden="true" className="text-[0.9375rem] text-discret">
                    sur {p.total}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[1.0625rem] text-discret">Rien de noté pour l’instant</span>
            )}
          </p>
          <button
            type="button"
            aria-label={mots.plus}
            aria-disabled={!enLigne || (p.total !== null && p.position !== null && p.position >= p.total) || undefined}
            onClick={() => avancer(1)}
            className={`${BOUTON_ROND} border border-accent bg-accent text-sur-accent`}
          >
            <IconeAjouter taille={18} />
          </button>
        </div>
      )}

      {part !== null && (
        <div
          role="progressbar"
          aria-label={`Progression dans ${titre}`}
          aria-valuemin={0}
          aria-valuemax={p.total ?? 100}
          aria-valuenow={p.position ?? 0}
          aria-valuetext={texteProgression(p, { long: true }) ?? undefined}
          className="h-1.5 overflow-hidden rounded-pilule bg-piste"
        >
          <div className="h-1.5 rounded-pilule bg-barre" style={{ width: `${part}%` }} />
        </div>
      )}

      {!oeuvre.estSerie && (
        <div className="flex flex-wrap items-center gap-x-3 text-[0.9375rem] text-discret">
          <span>
            {descriptionUnite(p)}
            {depuisEdition && ', d’après mon édition'}
          </span>
          <button
            type="button"
            aria-label="Changer l’unité et le total"
            aria-haspopup="dialog"
            aria-disabled={!enLigne || undefined}
            onClick={() => enLigne && setReglages(true)}
            className={LIEN_ACTION}
          >
            Changer
          </button>
        </div>
      )}

      {!enLigne && <p className="m-0 text-sm text-discret">La progression pourra être notée au retour du réseau.</p>}

      {(oeuvre.statut === 'en_cours' || oeuvre.statut === 'en_pause') && (
        <div
          data-etat={fin ? 'visible' : 'cache'}
          className="flex flex-col items-start gap-3 rounded-carte bg-accent-doux p-4 data-[etat=cache]:hidden"
        >
          {fin && (
            <>
              <p className="m-0 text-[1.0625rem] text-encre">
                {oeuvre.estSerie ? 'Tous les tomes sont lus. Marquer la série comme terminée ?' : 'La fin est atteinte. Marquer ce livre comme terminé ?'}
              </p>
              <Bouton occupe={!enLigne} onClick={terminer}>
                {oeuvre.estSerie ? 'Oui, terminée' : 'Oui, terminé'}
              </Bouton>
            </>
          )}
        </div>
      )}

      {!oeuvre.estSerie && (
        <ReglagesUnite
          ouvert={reglages}
          fermer={() => setReglages(false)}
          unite={oeuvre.unite}
          total={oeuvre.total}
          position={oeuvre.position}
          pagesEdition={suivi.pagesEdition}
          enregistrer={(unite, total) => {
            setReglages(false)
            if (unite !== (oeuvre.unite ?? 'page') || oeuvre.unite === null) modifier.unite.mutate({ unite, total })
            else if (total !== oeuvre.total) modifier.total.mutate(total)
          }}
        />
      )}
    </Section>
  )
}

/** « En pages · sur 190 », « En lettres, sans total », « En pourcentage ». */
function descriptionUnite(p: Progression) {
  const u = UNITES.find((x) => x.valeur === p.unite)!
  if (p.unite === 'pourcentage') return 'En pourcentage'
  return p.total !== null ? `En ${u.pluriel} · sur ${p.total}` : `En ${u.pluriel}, sans total`
}

/** La saisie directe du nombre, à la place des boutons − et +. */
export function SaisiePosition({
  p,
  minimum,
  libelle,
  valider,
  annuler,
}: {
  p: Progression
  minimum: number
  libelle: string
  valider: (valeur: number) => void
  annuler: () => void
}) {
  const [texte, setTexte] = useState(p.position === null ? '' : String(p.position))
  const [erreur, setErreur] = useState<string | null>(null)
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const lu = lirePosition(texte, p, minimum)
        if ('erreur' in lu) setErreur(lu.erreur)
        else valider(lu.valeur)
      }}
      className="flex flex-col gap-4"
    >
      <ChampTexte
        libelle={libelle}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        aide={p.total !== null && p.unite !== 'pourcentage' ? `sur ${p.total}` : undefined}
        erreur={erreur}
        autoFocus
      />
      <div className="flex flex-wrap gap-3">
        <Bouton type="submit">Enregistrer</Bouton>
        <Bouton variante="secondaire" onClick={annuler}>
          Annuler
        </Bouton>
      </div>
    </form>
  )
}

function ReglagesUnite({
  ouvert,
  fermer,
  unite,
  total,
  position,
  pagesEdition,
  enregistrer,
}: {
  ouvert: boolean
  fermer: () => void
  unite: Unite | null
  total: number | null
  position: number | null
  pagesEdition: number | null
  enregistrer: (unite: Unite, total: number | null) => void
}) {
  const depart = unite ?? 'page'
  const totalDepart = unite === null ? totalPropose('page', pagesEdition) : total
  const [choix, setChoix] = useState<Unite>(depart)
  const [texte, setTexte] = useState(totalDepart === null ? '' : String(totalDepart))
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    if (!ouvert) return
    setChoix(depart)
    setTexte(totalDepart === null ? '' : String(totalDepart))
    setErreur(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert])

  const change = choix !== depart
  return (
    <Feuille ouvert={ouvert} titre="Comment je compte" fermer={fermer}>
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (choix === 'pourcentage') return enregistrer(choix, null)
          const brut = texte.trim()
          const valeur = brut === '' ? null : Number(brut)
          if (valeur !== null && (!Number.isInteger(valeur) || valeur <= 0)) return setErreur('Un nombre entier, ou rien.')
          if (valeur !== null && !change && position !== null && valeur < position)
            return setErreur(`Au moins ${position} : la lecture en est déjà là.`)
          enregistrer(choix, valeur)
        }}
      >
        <Pastilles
          legende="Je compte en…"
          options={UNITES_LIVRE.map((u) => ({ valeur: u.valeur, libelle: u.libelle }))}
          valeur={choix}
          onChange={(u) => {
            setChoix(u)
            setErreur(null)
            const propose = totalPropose(u, pagesEdition)
            setTexte(u === depart && total !== null ? String(total) : propose === null ? '' : String(propose))
          }}
          aide={change && position !== null ? 'Avec une autre unité, ma position repartira de zéro.' : undefined}
        />
        {choix !== 'pourcentage' && (
          <ChampTexte
            libelle="Total (facultatif)"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            aide={choix === 'page' && pagesEdition !== null ? `Mon édition compte ${pagesEdition} pages.` : 'Vide s’il est inconnu.'}
            erreur={erreur}
          />
        )}
        <Bouton type="submit">Enregistrer</Bouton>
      </form>
    </Feuille>
  )
}
