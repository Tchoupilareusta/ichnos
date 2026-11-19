import { useId, useState } from 'react'
import { progressionDe, type EnCours } from '../bibliotheque/depot'
import { useModifierOeuvre } from '../bibliotheque/requetes'
import { MOTS_UNITE, pas, type Progression } from '../bibliotheque/suivi'
import { Bouton } from '../composants/Bouton'
import { Feuille } from '../composants/Feuille'
import { IconeAjouter, IconeMoins } from '../composants/Icones'
import { lirePosition } from './ProgressionFiche'
import { ContenuRessenti } from './Ressenti'

const MESSAGES: Record<string, string> = {
  reseau: 'Pas de connexion à internet : rien n’a été enregistré.',
  introuvable: 'Ce livre n’est plus dans ma bibliothèque : rien n’a été enregistré.',
  invalide: 'Ce nombre n’a pas été accepté : rien n’a été enregistré.',
  inconnu: 'Rien n’a pu être enregistré. Je réessaie dans un instant.',
}

const BOUTON_ROND =
  'flex size-14 shrink-0 cursor-pointer items-center justify-center rounded-pilule border border-bordure bg-fond p-0 text-encre transition-transform duration-200 active:scale-95 aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:active:scale-100'
const BOUTON_DOUX =
  'flex min-h-11 cursor-pointer items-center rounded-pilule border border-bordure bg-transparent px-4 text-[0.9375rem] font-semibold text-encre aria-disabled:cursor-default aria-disabled:opacity-60'

/**
 * Le panneau « Où j'en suis » de l'accueil (maquette MiseAJour) : saisie directe, − et +, Enregistrer,
 * « J'ai terminé ce livre », « Le mettre en pause ». Après « J'ai terminé », le même panneau propose
 * mon ressenti (il change de contenu au lieu de s'empiler : data-etape le dit, pour l'étape 9).
 */
export function OuJenSuis({
  lecture,
  ouvert,
  fermer,
  enLigne,
  annoncer,
}: {
  lecture: EnCours
  ouvert: boolean
  fermer: () => void
  enLigne: boolean
  /** Un mot calme pour VoiceOver quand le livre quitte « En ce moment ». */
  annoncer: (message: string) => void
}) {
  const modifier = useModifierOeuvre(lecture.id)
  const enregistre = progressionDe(lecture)
  const minimum = lecture.estSerie ? 1 : 0
  const mots = MOTS_UNITE[enregistre.unite]
  const idChamp = useId()
  const idTotal = useId()

  const [etape, setEtape] = useState<'progression' | 'ressenti'>('progression')
  const [texte, setTexte] = useState(enregistre.position === null ? '' : String(enregistre.position))
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)

  const lu = lirePosition(texte, enregistre, minimum)
  const courant: Progression = { ...enregistre, position: 'valeur' in lu ? lu.valeur : enregistre.position }

  const sousTitre =
    lecture.estSerie && enregistre.total !== null
      ? `${enregistre.total} tomes`
      : lecture.pagesEdition !== null
        ? `Mon édition · ${lecture.pagesEdition} pages`
        : lecture.auteurs.join(', ') || undefined

  /** Enregistre la position saisie si elle a changé. Rend false si elle est invalide ou refusée. */
  async function enregistrerPosition(): Promise<boolean> {
    if (texte.trim() === '' && enregistre.position === null) return true
    if ('erreur' in lu) {
      setErreur(lu.erreur)
      return false
    }
    if (lu.valeur === enregistre.position) return true
    try {
      if (!lecture.estSerie && lecture.unite === null)
        await modifier.unite.mutateAsync({ unite: 'page', total: lecture.pagesEdition })
      await modifier.progression.mutateAsync(lu.valeur)
      return true
    } catch (e) {
      setErreur(MESSAGES[(e as { echec?: string }).echec ?? 'inconnu'] ?? MESSAGES.inconnu)
      return false
    }
  }

  async function agir(action: () => Promise<void>) {
    if (!enLigne || occupe) return
    setOccupe(true)
    setErreur(null)
    try {
      await action()
    } catch (e) {
      setErreur(MESSAGES[(e as { echec?: string }).echec ?? 'inconnu'] ?? MESSAGES.inconnu)
    } finally {
      setOccupe(false)
    }
  }

  if (etape === 'ressenti')
    return (
      <Feuille ouvert={ouvert} titre="Mon ressenti" sousTitre={lecture.titre} fermer={fermer} libelleFermer="Plus tard">
        <div data-etape="ressenti" className="flex flex-col gap-4">
          <ContenuRessenti
            valeur={lecture.appreciation}
            choisir={(valeur) => {
              if (valeur !== lecture.appreciation) modifier.appreciation.mutate(valeur)
              fermer()
            }}
          />
        </div>
      </Feuille>
    )

  return (
    <Feuille ouvert={ouvert} titre={lecture.titre} sousTitre={sousTitre} fermer={fermer}>
      <form
        noValidate
        data-etape="progression"
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          void agir(async () => {
            if (await enregistrerPosition()) fermer()
          })
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <label htmlFor={idChamp} className="text-[0.9375rem] font-bold text-discret">
            {mots.jenSuis}
          </label>
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label={mots.moins}
              aria-disabled={!enLigne || courant.position === null || courant.position <= minimum || undefined}
              onClick={() => {
                if (!enLigne || courant.position === null || courant.position <= minimum) return
                setTexte(String(pas(courant, -1, minimum)))
                setErreur(null)
              }}
              className={BOUTON_ROND}
            >
              <IconeMoins taille={20} />
            </button>
            <input
              id={idChamp}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={texte}
              onChange={(e) => {
                setTexte(e.target.value)
                setErreur(null)
              }}
              aria-describedby={enregistre.total !== null && enregistre.unite !== 'pourcentage' ? idTotal : undefined}
              aria-invalid={erreur ? true : undefined}
              disabled={!enLigne}
              className="h-[4.75rem] w-32 rounded-carte border-[1.5px] border-bordure bg-fond text-center font-titre text-[2.5rem] text-encre tabular-nums aria-invalid:border-accent-texte disabled:opacity-60"
            />
            <button
              type="button"
              aria-label={mots.plus}
              aria-disabled={!enLigne || (courant.total !== null && courant.position !== null && courant.position >= courant.total) || undefined}
              onClick={() => {
                if (!enLigne) return
                const suivant = pas(courant, 1, minimum)
                if (suivant !== courant.position) setTexte(String(suivant))
                setErreur(null)
              }}
              className={BOUTON_ROND}
            >
              <IconeAjouter taille={20} />
            </button>
          </div>
          {enregistre.total !== null && enregistre.unite !== 'pourcentage' && (
            <p id={idTotal} className="m-0 text-[0.9375rem] text-discret">
              sur {enregistre.total}
            </p>
          )}
          <p role="alert" className="m-0 text-center text-sm font-semibold text-accent-texte empty:hidden">
            {erreur ?? ''}
          </p>
        </div>

        <Bouton type="submit" occupe={!enLigne || occupe} className="min-h-14 text-[1.0625rem]">
          Enregistrer
        </Bouton>

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            aria-disabled={!enLigne || occupe || undefined}
            onClick={() =>
              void agir(async () => {
                if (!(await enregistrerPosition())) return
                await modifier.statut.mutateAsync('termine')
                annoncer(`${lecture.titre} est rangé dans « Terminé ».`)
                setEtape('ressenti')
              })
            }
            className={BOUTON_DOUX}
          >
            {lecture.estSerie ? 'J’ai terminé cette série' : 'J’ai terminé ce livre'}
          </button>
          <button
            type="button"
            aria-disabled={!enLigne || occupe || undefined}
            onClick={() =>
              void agir(async () => {
                if (!(await enregistrerPosition())) return
                await modifier.statut.mutateAsync('en_pause')
                annoncer(`${lecture.titre} est en pause. Je le retrouverai dans ma bibliothèque.`)
                fermer()
              })
            }
            className={BOUTON_DOUX}
          >
            Le mettre en pause
          </button>
        </div>
        {!enLigne && <p className="m-0 text-center text-sm text-discret">Je pourrai noter où j’en suis au retour du réseau.</p>}
      </form>
    </Feuille>
  )
}
