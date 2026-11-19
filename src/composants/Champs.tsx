import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { IconeChevronBas } from './Icones'

const LIBELLE = 'text-[0.9375rem] font-bold text-encre'
const AIDE = 'text-sm text-discret'
const ERREUR = 'text-sm font-semibold text-accent-texte'
export const CHAMP =
  'min-h-12 w-full rounded-carte border border-bordure bg-surface px-4 text-base text-encre placeholder:text-discret aria-invalid:border-accent-texte aria-invalid:border-2 disabled:opacity-60'

type Commun = { libelle: ReactNode; aide?: ReactNode; erreur?: string | null; className?: string }

/** Aide et erreur reliées au champ pour VoiceOver (aria-describedby). */
function useDescriptions(aide: ReactNode, erreur: string | null | undefined) {
  const id = useId()
  const idAide = aide ? `${id}-aide` : undefined
  const idErreur = erreur ? `${id}-erreur` : undefined
  return { id, idAide, idErreur, decrit: [idErreur, idAide].filter(Boolean).join(' ') || undefined }
}

function Pied({ idAide, idErreur, aide, erreur }: { idAide?: string; idErreur?: string; aide?: ReactNode; erreur?: string | null }) {
  return (
    <>
      {erreur && (
        <span id={idErreur} className={ERREUR}>
          {erreur}
        </span>
      )}
      {aide && (
        <span id={idAide} className={AIDE}>
          {aide}
        </span>
      )}
    </>
  )
}

export function ChampTexte({
  libelle,
  aide,
  erreur,
  className = '',
  ...champ
}: Commun & InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  const { id, idAide, idErreur, decrit } = useDescriptions(aide, erreur)
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={champ.id ?? id} className={LIBELLE}>
        {libelle}
      </label>
      <input id={id} {...champ} aria-invalid={erreur ? true : undefined} aria-describedby={decrit} className={CHAMP} />
      <Pied idAide={idAide} idErreur={idErreur} aide={aide} erreur={erreur} />
    </div>
  )
}

export function ChampLong({ libelle, aide, erreur, className = '', ...champ }: Commun & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { id, idAide, idErreur, decrit } = useDescriptions(aide, erreur)
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className={LIBELLE}>
        {libelle}
      </label>
      <textarea
        id={id}
        {...champ}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={decrit}
        className={`${CHAMP} min-h-40 py-3 leading-relaxed`}
      />
      <Pied idAide={idAide} idErreur={idErreur} aide={aide} erreur={erreur} />
    </div>
  )
}

type Option = { valeur: string; libelle: string }

/** Liste déroulante native : sur iPhone, elle ouvre la roue de sélection du système. */
export function ChampListe({
  libelle,
  aide,
  erreur,
  options,
  className = '',
  ...champ
}: Commun & { options: Option[] } & SelectHTMLAttributes<HTMLSelectElement>) {
  const { id, idAide, idErreur, decrit } = useDescriptions(aide, erreur)
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className={LIBELLE}>
        {libelle}
      </label>
      <div className="relative">
        <select
          id={id}
          {...champ}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit}
          className={`${CHAMP} cursor-pointer appearance-none pr-11`}
        >
          {options.map((option) => (
            <option key={option.valeur} value={option.valeur}>
              {option.libelle}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-discret">
          <IconeChevronBas taille={18} />
        </span>
      </div>
      <Pied idAide={idAide} idErreur={idErreur} aide={aide} erreur={erreur} />
    </div>
  )
}

/** Choix unique présenté en pastilles (boutons radio natifs, donc compris par VoiceOver et le clavier). */
export function Pastilles<T extends string>({
  legende,
  options,
  valeur,
  onChange,
  aide,
  desactive = false,
}: {
  legende: ReactNode
  options: { valeur: T; libelle: string }[]
  valeur: T | null
  onChange: (valeur: T) => void
  aide?: ReactNode
  desactive?: boolean
}) {
  const nom = useId()
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0" disabled={desactive}>
      <legend className={`${LIBELLE} mb-2 p-0`}>{legende}</legend>
      {aide && <p className={`${AIDE} m-0 -mt-1 mb-1`}>{aide}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.valeur}
            className="relative flex min-h-11 cursor-pointer items-center rounded-pilule border border-bordure bg-surface px-4 text-[0.9375rem] font-semibold text-encre transition-colors duration-200 has-checked:border-accent has-checked:bg-accent has-checked:font-bold has-checked:text-sur-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-3 has-focus-visible:outline-accent-texte"
          >
            <input
              type="radio"
              name={nom}
              value={option.valeur}
              checked={valeur === option.valeur}
              onChange={() => onChange(option.valeur)}
              className="absolute inset-0 m-0 cursor-pointer appearance-none rounded-pilule opacity-0"
            />
            {option.libelle}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
