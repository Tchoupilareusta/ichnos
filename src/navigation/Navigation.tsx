import type { Ecran } from './routes'
import { LIENS } from './routes'
import { useEnSaisie } from './saisie'
import { IconeAccueil, IconeAjouter, IconeBibliotheque, IconeDecouvrir, IconeReglages } from '../composants/Icones'

const ONGLETS = [
  { ecran: 'accueil', libelle: 'Accueil', Icone: IconeAccueil },
  { ecran: 'bibliotheque', libelle: 'Bibliothèque', Icone: IconeBibliotheque },
  { ecran: 'decouvrir', libelle: 'Découvrir', Icone: IconeDecouvrir },
] as const

/** Barre du bas (iPhone), en forme de pilule flottante comme dans les maquettes. Masquée pendant une saisie. */
export function BarreDuBas({ ecran }: { ecran: Ecran }) {
  if (useEnSaisie()) return null
  return (
    <nav
      aria-label="Navigation principale"
      className="tablette:hidden fixed z-20 flex h-[min(4.5rem,80px)] items-center justify-between rounded-pilule border border-bordure bg-surface px-2.5 shadow-forte"
      style={{
        left: 'calc(env(safe-area-inset-left) + 1rem)',
        right: 'calc(env(safe-area-inset-right) + 1rem)',
        bottom: 'max(env(safe-area-inset-bottom), 1rem)',
      }}
    >
      {ONGLETS.map(({ ecran: cible, libelle, Icone }) => {
        const actif = ecran === cible
        return (
          <a
            key={cible}
            href={LIENS[cible]}
            aria-current={actif ? 'page' : undefined}
            className={`flex h-[min(3.375rem,60px)] min-w-0 max-w-[6.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-pilule px-1 text-[min(0.75rem,13px)] no-underline transition-colors duration-200 ${
              actif ? 'bg-accent-doux font-bold text-accent-texte' : 'font-semibold text-discret'
            }`}
          >
            <Icone />
            {libelle}
          </a>
        )
      })}
      <a
        href={LIENS.ajouter}
        aria-label="Ajouter une œuvre"
        aria-current={ecran === 'ajouter' ? 'page' : undefined}
        className="flex size-[min(3.375rem,60px)] shrink-0 items-center justify-center rounded-pilule bg-accent text-sur-accent transition-transform duration-200 active:scale-95"
      >
        <IconeAjouter />
      </a>
    </nav>
  )
}

/** Barre latérale (iPad et ordinateur, à partir de 768 px). Masquée pendant une saisie. */
export function BarreLaterale({ ecran }: { ecran: Ecran }) {
  if (useEnSaisie()) return null
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed z-20 hidden w-60 flex-col gap-2 rounded-panneau border border-bordure bg-surface p-3 shadow-douce tablette:flex"
      style={{
        top: 'calc(env(safe-area-inset-top) + 1rem)',
        bottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
        left: 'calc(env(safe-area-inset-left) + 1rem)',
      }}
    >
      <a href={LIENS.accueil} className="mb-4 rounded-pilule px-4 pt-3 pb-1 font-titre text-[1.375rem] italic text-accent-texte no-underline">
        Ichnos
      </a>
      {ONGLETS.map(({ ecran: cible, libelle, Icone }) => {
        const actif = ecran === cible
        return (
          <a
            key={cible}
            href={LIENS[cible]}
            aria-current={actif ? 'page' : undefined}
            className={`flex min-h-12 items-center gap-3 rounded-pilule px-4 text-base no-underline transition-colors duration-200 ${
              actif ? 'bg-accent-doux font-bold text-accent-texte' : 'font-semibold text-discret hover:text-encre'
            }`}
          >
            <Icone />
            {libelle}
          </a>
        )
      })}
      <a
        href={LIENS.ajouter}
        aria-current={ecran === 'ajouter' ? 'page' : undefined}
        className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-pilule bg-accent px-4 text-base font-bold text-sur-accent no-underline transition-transform duration-200 active:scale-[0.98]"
      >
        <IconeAjouter taille={20} />
        Ajouter une œuvre
      </a>
      <a
        href={LIENS.reglages}
        aria-current={ecran === 'reglages' ? 'page' : undefined}
        className={`mt-auto flex min-h-12 items-center gap-3 rounded-pilule px-4 text-base no-underline transition-colors duration-200 ${
          ecran === 'reglages' ? 'bg-accent-doux font-bold text-accent-texte' : 'font-semibold text-discret hover:text-encre'
        }`}
      >
        <IconeReglages />
        Réglages
      </a>
    </nav>
  )
}
