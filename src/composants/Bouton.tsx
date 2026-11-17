import type { ButtonHTMLAttributes } from 'react'

const BASE =
  'flex min-h-12 cursor-pointer items-center justify-center rounded-pilule px-6 text-[0.9375rem] transition-[transform,opacity] duration-200 active:scale-[0.98] aria-disabled:cursor-default aria-disabled:opacity-60 aria-disabled:active:scale-100'

const VARIANTES = {
  principal: 'border border-accent bg-accent font-bold text-sur-accent',
  secondaire: 'border border-bordure bg-surface font-semibold text-encre',
}

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> & {
  variante?: keyof typeof VARIANTES
  /** Action en cours : le bouton reste atteignable au clavier mais n'agit plus. */
  occupe?: boolean
}

export function Bouton({ variante = 'principal', occupe = false, type = 'button', className = '', onClick, ...reste }: Props) {
  return (
    <button
      {...reste}
      type={type}
      aria-disabled={occupe || undefined}
      aria-busy={occupe || undefined}
      onClick={(evenement) => {
        if (occupe) evenement.preventDefault()
        else onClick?.(evenement)
      }}
      className={`${BASE} ${VARIANTES[variante]} ${className}`}
    />
  )
}
