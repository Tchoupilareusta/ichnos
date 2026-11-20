import { useId, useState, type ReactNode } from 'react'
import { IconeChevronBas } from './Icones'

/**
 * Une section repliée de « Modifier » : ce que je change rarement. Fermée par défaut, elle montre
 * son titre et un résumé d'une ligne de son contenu. Élément natif (details/summary) : VoiceOver
 * et le clavier la comprennent, et son état ouvert ou fermé est porté par l'attribut `open`.
 */
export function Repli({
  titre,
  resume,
  ouvertAuDepart = false,
  children,
}: {
  titre: string
  /** Une ligne : ce que la section contient (« Résumé · Roman, Quête de soi +3 »). */
  resume: string
  ouvertAuDepart?: boolean
  children: ReactNode
}) {
  const [ouvert, setOuvert] = useState(ouvertAuDepart)
  const idTitre = useId()
  return (
    <details open={ouvert} onToggle={(evenement) => setOuvert(evenement.currentTarget.open)} className="group border-t border-bordure first:border-t-0">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span id={idTitre} className="font-titre text-xl leading-tight text-encre">
            {titre}
          </span>
          <span className="truncate text-sm text-discret group-open:hidden">{resume.charAt(0).toLocaleUpperCase('fr') + resume.slice(1)}</span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-discret transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none">
          <IconeChevronBas taille={20} />
        </span>
      </summary>
      <div role="group" aria-labelledby={idTitre} className="flex flex-col gap-6 pt-2 pb-7">
        {children}
      </div>
    </details>
  )
}
