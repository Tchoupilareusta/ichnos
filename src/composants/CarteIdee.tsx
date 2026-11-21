import { useId, type ReactNode } from 'react'
import { Couverture } from '../couvertures/Couverture'
import { LIENS } from '../navigation/routes'
import type { Proposition } from '../recommandations/proposer'

/**
 * Une idée de lecture, sur Découvrir et sur l'accueil : la couverture, le titre, l'auteur et la
 * phrase qui dit pourquoi. Toute cette partie est un seul lien vers la fiche (VoiceOver : « Voir la
 * fiche de Momo », puis l'auteur et la phrase). Les boutons de la carte viennent dessous (`children`).
 * Aucun chiffre ni score ici.
 */
export function CarteIdee({
  proposition,
  titreNiveau = 3,
  grande = false,
  children,
}: {
  proposition: Proposition
  titreNiveau?: 2 | 3
  /** Sur l'accueil, une seule idée : couverture et titre un peu plus grands. */
  grande?: boolean
  children?: ReactNode
}) {
  const { oeuvre, phrase } = proposition
  const auteurs = oeuvre.auteurs.join(', ')
  const id = useId()
  const Titre = titreNiveau === 2 ? 'h2' : 'h3'
  return (
    <div className="flex h-full flex-col gap-4 rounded-carte border border-bordure bg-surface p-4 shadow-douce">
      <a
        href={LIENS.oeuvre(oeuvre.id)}
        aria-label={`Voir la fiche de ${oeuvre.titre}`}
        aria-describedby={auteurs ? `${id}-auteur ${id}-phrase` : `${id}-phrase`}
        className="group flex min-w-0 gap-4 rounded-[1rem] text-encre no-underline @3xl/idees:flex-col"
      >
        <Couverture
          titre={oeuvre.titre}
          graine={oeuvre.id}
          chemin={oeuvre.couverture}
          className={`shrink-0 transition-transform duration-300 ease-out group-active:scale-[0.98] ${grande ? 'w-24' : 'w-20'}`}
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <Titre
            className={`m-0 leading-[1.2] [overflow-wrap:anywhere] ${grande ? 'text-[1.375rem]' : 'text-[1.1875rem]'}`}
          >
            {oeuvre.titre}
          </Titre>
          {auteurs && (
            <span id={`${id}-auteur`} className="text-sm text-discret">
              {auteurs}
            </span>
          )}
          <span id={`${id}-phrase`} className="mt-1.5 max-w-[65ch] text-[0.9375rem] leading-[1.45]">
            {phrase}
          </span>
        </span>
      </a>
      {children}
    </div>
  )
}
