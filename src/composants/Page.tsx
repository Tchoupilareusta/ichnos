import type { ReactNode } from 'react'

/** Cadre commun à tous les écrans : marges, zones de sécurité, place pour la navigation. */
export function Page({ children, entete }: { children: ReactNode; entete?: ReactNode }) {
  return (
    <main
      id="contenu"
      className="mx-auto flex w-full max-w-6xl flex-col gap-10 pr-[max(1.5rem,env(safe-area-inset-right))] pl-[max(1.5rem,env(safe-area-inset-left))] tablette:pr-[max(2.5rem,env(safe-area-inset-right))] tablette:pl-[calc(env(safe-area-inset-left)+18.5rem)]"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)',
        paddingBottom: 'calc(max(env(safe-area-inset-bottom), 1rem) + 7.5rem)',
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
