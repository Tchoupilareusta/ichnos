import { useId, type ReactNode } from 'react'
import { Couverture } from '../couvertures/Couverture'
import { LIENS } from '../navigation/routes'
import type { Proposition } from '../recommandations/proposer'

/**
 * Une idée de lecture, sur Découvrir et sur l'accueil : la couverture, le titre, l'auteur et la
 * phrase qui dit pourquoi. Toute cette partie est un seul lien vers la fiche (VoiceOver : « Voir la
 * fiche de Momo », puis l'auteur et la phrase). Les boutons de la carte viennent dessous (`children`).
 * Aucun chiffre ni score ici.
 *
 * Mise en page : la couverture garde son format 5:8, une largeur fixe en pixels et reste alignée en
 * haut (elle ne s'étire jamais à la hauteur du texte). Les marges internes sont en pixels aussi :
 * quand la taille du texte grandit dans les réglages de l'iPhone, c'est le texte qui prend la place.
 * Quand la carte devient trop étroite pour ce texte (très grandes tailles), la couverture passe
 * au-dessus du texte.
 */
export function CarteIdee({
  proposition,
  grande = false,
  children,
}: {
  proposition: Proposition
  /** Sur l'accueil, une seule idée : couverture et titre un peu plus grands. */
  grande?: boolean
  children?: ReactNode
}) {
  const { oeuvre, phrase } = proposition
  const auteurs = oeuvre.auteurs.join(', ')
  const id = useId()
  return (
    <div className="@container/carte flex h-full flex-col gap-[14px] rounded-carte border border-bordure bg-surface p-[16px] shadow-douce">
      <a
        href={LIENS.oeuvre(oeuvre.id)}
        aria-label={`Voir la fiche de ${oeuvre.titre}`}
        aria-describedby={auteurs ? `${id}-auteur ${id}-phrase` : `${id}-phrase`}
        className="group flex min-w-0 items-start gap-[14px] rounded-[1rem] text-encre no-underline @max-[11rem]/carte:flex-col @3xl/idees:flex-col"
      >
        <Couverture
          titre={oeuvre.titre}
          graine={oeuvre.id}
          chemin={oeuvre.couverture}
          className={`shrink-0 self-start transition-transform duration-300 ease-out group-active:scale-[0.98] ${grande ? 'w-[100px]' : 'w-[88px]'}`}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className={`coupure-francaise m-0 leading-[1.2] ${grande ? 'text-[1.25rem]' : 'text-[1.0625rem]'}`}>{oeuvre.titre}</h3>
          {auteurs && (
            <span id={`${id}-auteur`} className="text-sm text-discret">
              {auteurs}
            </span>
          )}
          <span id={`${id}-phrase`} className="mt-1 max-w-[65ch] text-[0.9375rem] leading-[1.4]">
            {phrase}
          </span>
        </span>
      </a>
      {children}
    </div>
  )
}
