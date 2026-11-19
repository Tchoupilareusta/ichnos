import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { assistantFictif } from '../ajout/assistant.fictif'
import { depotFictif } from '../bibliotheque/depot.fictif'
import { creerClientRequetes } from '../bibliotheque/requetes'
import { authFictif } from '../session/auth.fictif'
import { FournisseurSession } from '../session/Session'
import { Couverture } from './Couverture'
import { couverturesFictives } from './stockage.fictif'

function Cadre({ children }: { children: ReactNode }) {
  const session = {
    auth: authFictif().auth,
    compte: { email: 'moi@exemple.test' },
    depot: depotFictif().depot,
    assistant: assistantFictif().assistant,
    couvertures: couverturesFictives().couvertures,
  }
  return (
    <QueryClientProvider client={creerClientRequetes()}>
      <FournisseurSession value={session}>{children}</FournisseurSession>
    </QueryClientProvider>
  )
}

function afficher(apercu: string | null = 'blob:essai/etranger') {
  const { container } = render(
    <Cadre>
      <Couverture titre="L’Étranger" auteur="Albert Camus" graine="etranger" apercu={apercu} />
    </Cadre>,
  )
  const cadre = container.firstElementChild as HTMLElement
  return { cadre, image: cadre.querySelector('img'), fond: cadre.querySelector<HTMLElement>('[data-role="fond-image"]') }
}

describe('Couverture', () => {
  it('sans image, montre la couverture typographique', () => {
    const { cadre, image } = afficher(null)
    expect(cadre).toHaveAttribute('data-etat', 'typographique')
    expect(cadre).toHaveTextContent('L’Étranger')
    expect(image).toBeNull()
  })

  it('garde la couverture typographique visible tant que l’image n’est pas chargée', () => {
    const { cadre, fond } = afficher()
    expect(cadre).toHaveAttribute('data-etat', 'typographique')
    expect(fond).toHaveClass('opacity-0')
  })

  it('montre l’image entière, sans la rogner, dans le cadre au format 2:3', () => {
    const { cadre, image } = afficher()
    fireEvent.load(image as HTMLImageElement)
    expect(cadre).toHaveAttribute('data-etat', 'image')
    expect(cadre).toHaveClass('aspect-[2/3]')
    // « contain » : une image plus étroite ou plus large que le cadre garde ses bords.
    expect(image).toHaveClass('object-contain')
    expect(image).not.toHaveClass('object-cover')
  })

  it('une fois l’image chargée, un fond couvre toute la couverture typographique', () => {
    const { image, fond } = afficher()
    fireEvent.load(image as HTMLImageElement)
    // Le fond occupe tout le cadre : le texte typographique ne paraît pas dans les bandes laissées par l'image.
    expect(fond).toHaveClass('absolute', 'inset-0', 'opacity-100')
    expect(fond).toContainElement(image)
    // Sans toile de dessin (ici, dans les tests), la couleur des cartes sert de fond.
    expect(fond?.style.background).toBe('var(--surface)')
  })

  it('reste typographique si l’image ne se charge pas', () => {
    const { cadre, image } = afficher()
    fireEvent.error(image as HTMLImageElement)
    expect(cadre).toHaveAttribute('data-etat', 'typographique')
    expect(cadre.querySelector('img')).toBeNull()
  })

  it('reste décorative : le titre est déjà dit à côté', () => {
    expect(afficher().cadre).toHaveAttribute('aria-hidden', 'true')
  })
})
