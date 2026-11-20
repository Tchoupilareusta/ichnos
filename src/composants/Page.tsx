import type { ReactNode } from 'react'
import { useEnSaisie } from '../navigation/saisie'

/**
 * Cadre commun à tous les écrans : marges, zones de sécurité, place pour la navigation.
 * Pendant une saisie, la barre latérale de l'iPad est masquée : le contenu se centre.
 */
export function Page({ children, entete }: { children: ReactNode; entete?: ReactNode }) {
  const enSaisie = useEnSaisie()
  return (
    <main
      id="contenu"
      tabIndex={-1}
      className={`mx-auto outline-none flex w-full flex-col gap-10 pr-[max(1.5rem,env(safe-area-inset-right))] pl-[max(1.5rem,env(safe-area-inset-left))] tablette:pr-[max(2.5rem,env(safe-area-inset-right))] ${
        enSaisie ? 'max-w-5xl tablette:pl-[max(2.5rem,env(safe-area-inset-left))]' : 'max-w-6xl tablette:pl-[calc(env(safe-area-inset-left)+18.5rem)]'
      }`}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)',
        // Assez de place sous le contenu pour la navigation, ou pour la barre d'actions des tomes quand elle est plus haute.
        paddingBottom: 'calc(max(env(safe-area-inset-bottom), 1rem) + max(7.5rem, var(--place-barre, 0px) + 1.5rem))',
      }}
    >
      {entete}
      {children}
    </main>
  )
}

export function TitrePage({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h1 id={id} className="m-0 font-titre text-[2.125rem] leading-[1.1] tablette:text-[2.5rem]">
      {children}
    </h1>
  )
}

/** État vide : quelques mots calmes et, au besoin, un chemin pour continuer. */
export function EtatVide({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex max-w-[65ch] flex-col items-start gap-5 rounded-panneau border border-bordure bg-surface p-6 shadow-douce">
      <p className="m-0 text-base leading-relaxed">{children}</p>
      {action}
    </div>
  )
}

export function BoutonPrincipal({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="flex min-h-12 items-center justify-center rounded-pilule bg-accent px-6 text-[0.9375rem] font-bold text-sur-accent no-underline transition-transform duration-200 active:scale-[0.98]"
    >
      {children}
    </a>
  )
}
