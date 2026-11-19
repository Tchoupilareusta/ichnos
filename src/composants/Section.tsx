import { useId, type ReactNode } from 'react'

export const TITRE_SECTION = 'm-0 font-titre text-2xl'

/** Une section de la fiche : un titre Lora, un complément éventuel à droite (lien, menu), le contenu. */
export function Section({
  titre,
  children,
  complement,
  ancre,
}: {
  titre: string
  children: ReactNode
  complement?: ReactNode
  /** Identifiant de la section, quand un bouton de la fiche y mène (elle reçoit alors le focus). */
  ancre?: string
}) {
  const id = useId()
  return (
    <section id={ancre} tabIndex={ancre ? -1 : undefined} aria-labelledby={id} className="flex max-w-[65ch] flex-col gap-3 outline-none">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={id} className={TITRE_SECTION}>
          {titre}
        </h2>
        {complement}
      </div>
      {children}
    </section>
  )
}

/** Un lien d'action discret, souligné, à l'accent (« Saisir la page », « Retirer »). */
export const LIEN_ACTION =
  'flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 text-[0.9375rem] font-bold text-accent-texte underline decoration-1 underline-offset-4 aria-disabled:cursor-default aria-disabled:opacity-60'
