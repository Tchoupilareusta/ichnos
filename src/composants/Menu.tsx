import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { IconeCoche } from './Icones'

type Option<T extends string> = { valeur: T; libelle: string; icone?: ReactNode }

/**
 * Menu à choix unique (statut, possession, tome…) : un bouton qui ouvre une courte liste.
 * Rôles ARIA de menu, flèches haut/bas, Échap pour refermer, retour du focus sur le bouton.
 */
export function Menu<T extends string>({
  nom,
  contenuBouton,
  classeBouton,
  options,
  valeur,
  onChoisir,
  desactive = false,
}: {
  /** Ce que VoiceOver annonce : « Statut de lecture : En cours. Changer ». */
  nom: string
  contenuBouton: ReactNode
  classeBouton: string
  options: Option<T>[]
  valeur: T | null
  onChoisir: (valeur: T) => void
  desactive?: boolean
}) {
  const [ouvert, setOuvert] = useState(false)
  const [decalage, setDecalage] = useState(0)
  const [versLeHaut, setVersLeHaut] = useState(false)
  const bouton = useRef<HTMLButtonElement>(null)
  const liste = useRef<HTMLUListElement>(null)
  const cadre = useRef<HTMLDivElement>(null)
  const id = useId()

  const elements = () => [...(liste.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? [])]

  function fermer(rendreLeFocus = true) {
    setOuvert(false)
    if (rendreLeFocus) bouton.current?.focus()
  }

  // À l'ouverture : la liste reste dans l'écran (au besoin au-dessus du bouton, car la barre
  // de navigation couvre le bas), avant d'être affichée.
  useLayoutEffect(() => {
    if (!ouvert) setVersLeHaut(false)
    if (!ouvert || !liste.current) return
    const rect = liste.current.getBoundingClientRect()
    const marge = 16
    const largeur = document.documentElement.clientWidth
    let suivant = 0
    if (rect.right > largeur - marge) suivant = largeur - marge - rect.right
    else if (rect.left < marge) suivant = marge - rect.left
    setDecalage(suivant)
    const cadreRect = cadre.current?.getBoundingClientRect()
    const bas = window.innerHeight - 112
    setVersLeHaut(!!cadreRect && rect.bottom > bas && cadreRect.top - rect.height > 16)
  }, [ouvert])

  // Puis le focus va sur le choix actuel, une fois la liste à sa place : la page ne saute pas.
  useEffect(() => {
    if (!ouvert) return
    const items = elements()
    ;(items.find((item) => item.getAttribute('aria-checked') === 'true') ?? items[0])?.focus({ preventScroll: true })
  }, [ouvert])

  useEffect(() => {
    if (!ouvert) return
    const dehors = (evenement: PointerEvent) => {
      if (!cadre.current?.contains(evenement.target as Node)) setOuvert(false)
    }
    document.addEventListener('pointerdown', dehors)
    return () => document.removeEventListener('pointerdown', dehors)
  }, [ouvert])

  function clavier(evenement: KeyboardEvent) {
    const items = elements()
    const actuel = items.indexOf(document.activeElement as HTMLButtonElement)
    const aller = (rang: number) => items[(rang + items.length) % items.length]?.focus()
    if (evenement.key === 'ArrowDown') aller(actuel + 1)
    else if (evenement.key === 'ArrowUp') aller(actuel - 1)
    else if (evenement.key === 'Home') aller(0)
    else if (evenement.key === 'End') aller(items.length - 1)
    else if (evenement.key === 'Escape') fermer()
    else {
      if (evenement.key === 'Tab') setOuvert(false)
      return
    }
    evenement.preventDefault()
  }

  return (
    <div ref={cadre} className="relative inline-flex">
      <button
        ref={bouton}
        type="button"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-controls={ouvert ? id : undefined}
        aria-label={nom}
        aria-disabled={desactive || undefined}
        onClick={() => !desactive && setOuvert(!ouvert)}
        onKeyDown={(e) => {
          if (!desactive && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            setOuvert(true)
          }
        }}
        className={`${classeBouton} cursor-pointer aria-disabled:cursor-default aria-disabled:opacity-60`}
      >
        {contenuBouton}
      </button>
      {ouvert && (
        <ul
          ref={liste}
          id={id}
          role="menu"
          aria-label={nom.replace(/\.\s*Changer$/, '')}
          onKeyDown={clavier}
          style={{ translate: `${decalage}px 0` }}
          className={`absolute ${versLeHaut ? 'bottom-[calc(100%+0.5rem)]' : 'top-[calc(100%+0.5rem)]'} left-0 z-40 m-0 flex max-h-[min(24rem,60dvh)] min-w-[14rem] list-none flex-col overflow-y-auto rounded-carte border border-bordure bg-surface p-1.5 text-left shadow-forte`}
        >
          {options.map((option) => {
            const choisi = option.valeur === valeur
            return (
              <li key={option.valeur} role="none">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={choisi}
                  onClick={() => {
                    fermer()
                    if (!choisi) onChoisir(option.valeur)
                  }}
                  className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 rounded-[1.125rem] border-0 px-4 text-left text-[0.9375rem] whitespace-nowrap focus-visible:outline-offset-[-2px] ${
                    choisi ? 'bg-accent-doux font-bold text-accent-texte' : 'bg-transparent font-semibold text-encre hover:bg-fond'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {option.icone}
                    {option.libelle}
                  </span>
                  {choisi && <IconeCoche taille={18} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
