/**
 * Premier élément atteint au clavier : saute la navigation et place le focus sur le contenu.
 * L'adresse sert au routage (#/…), donc on ne suit pas le lien « #contenu » : on déplace
 * le focus directement.
 */
export function AllerAuContenu() {
  return (
    <a
      href="#contenu"
      onClick={(e) => {
        e.preventDefault()
        const contenu = document.getElementById('contenu')
        contenu?.focus()
        contenu?.scrollIntoView({ block: 'start' })
      }}
      className="sr-only rounded-pilule bg-accent text-[0.9375rem] font-bold whitespace-nowrap text-sur-accent no-underline focus:not-sr-only focus:fixed focus:z-40 focus:flex focus:min-h-12 focus:items-center focus:px-5 focus:py-3"
      style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)', left: 'calc(env(safe-area-inset-left) + 1rem)' }}
    >
      Aller au contenu
    </a>
  )
}
