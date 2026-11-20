import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { assistantFictif } from '../ajout/assistant.fictif'
import { depotFictif } from '../bibliotheque/depot.fictif'
import { creerClientRequetes } from '../bibliotheque/requetes'
import { authFictif } from '../session/auth.fictif'
import { FournisseurSession } from '../session/Session'
import { cadrageDe, type Cadrage } from './cadrage'
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

// La mesure de l'image (toile de dessin, lecture du fichier) est remplacée : ici, on décide du cadrage.
vi.mock('./cadrage', async (origine) => ({ ...(await origine<typeof import('./cadrage')>()), cadrageDe: vi.fn(async () => null) }))
const ENTIERE = { x: 0, y: 0, largeur: 1, hauteur: 1 }
const mesure = (cadrage: Cadrage | null) => vi.mocked(cadrageDe).mockResolvedValue(cadrage)
beforeEach(() => void mesure(null))

/** L'image est chargée : elle est mesurée, puis posée. */
const charger = (image: HTMLImageElement | null) => act(async () => void fireEvent.load(image as HTMLImageElement))

function afficher(apercu: string | null = 'blob:essai/etranger') {
  const { container } = render(
    <Cadre>
      <Couverture titre="L’Étranger" auteur="Albert Camus" graine="etranger" apercu={apercu} />
    </Cadre>,
  )
  const cadre = container.firstElementChild as HTMLElement
  return {
    cadre,
    image: cadre.querySelector('img'),
    livre: cadre.querySelector<HTMLElement>('[data-role="livre"]'),
    typographique: cadre.querySelector<HTMLElement>('[data-role="typographique"]'),
  }
}

describe('Couverture', () => {
  it('sans image, montre la couverture typographique', () => {
    const { cadre, image } = afficher(null)
    expect(cadre).toHaveAttribute('data-etat', 'typographique')
    expect(cadre).toHaveTextContent('L’Étranger')
    expect(image).toBeNull()
  })

  it('garde la couverture typographique visible tant que l’image n’est pas chargée', () => {
    const { cadre, livre, typographique } = afficher()
    expect(cadre).toHaveAttribute('data-etat', 'typographique')
    expect(livre).toHaveClass('opacity-0')
    expect(typographique).toHaveClass('opacity-100')
  })

  it('la case a toujours le format 5:8, avec ou sans image', async () => {
    expect(afficher(null).cadre).toHaveClass('aspect-[5/8]')
    const { cadre, image } = afficher()
    await charger(image)
    expect(cadre).toHaveClass('aspect-[5/8]')
    expect(cadre).not.toHaveClass('aspect-[2/3]')
  })

  it('une image proche du format de la case la remplit, légèrement recadrée au centre', async () => {
    // Un Folio (0,607) : il perd 1,4 % en haut et en bas.
    mesure({ mode: 'remplir', visible: { x: 0, y: 0.0144, largeur: 1, hauteur: 0.9712 }, format: 5 / 8 })
    const { cadre, image, livre } = afficher()
    await charger(image)
    expect(cadre).toHaveAttribute('data-etat', 'image')
    expect(livre).toHaveClass('opacity-100')
    expect(livre?.style.width).toBe('100%')
    expect(livre?.style.height).toBe('100%')
    // L'image dépasse un peu de la case, qui coupe ce qui dépasse.
    expect(livre).toHaveClass('overflow-hidden')
    expect(parseFloat(image?.style.height ?? '')).toBeCloseTo(102.97, 1)
    expect(parseFloat(image?.style.top ?? '')).toBeCloseTo(-1.48, 1)
    expect(image?.style.width).toBe('100%')
  })

  it('une image d’un autre format est posée en bas de la case, centrée, à sa vraie forme', async () => {
    // Un manga (0,70) : plus large que la case, il en prend toute la largeur et laisse le haut vide.
    mesure({ mode: 'etagere', visible: ENTIERE, format: 0.7 })
    const { cadre, image, livre } = afficher()
    await charger(image)
    expect(cadre).toHaveAttribute('data-etat', 'etagere')
    expect(livre).toHaveClass('bottom-0')
    expect(livre?.style.width).toBe('100%')
    expect(parseFloat(livre?.style.height ?? '')).toBeCloseTo(89.29, 1)
    expect(livre?.style.left).toBe('0%')
    expect(image?.style.width).toBe('100%')
    expect(image?.style.height).toBe('100%')
  })

  it('une image étroite posée sur l’étagère est centrée dans la case', async () => {
    mesure({ mode: 'etagere', visible: ENTIERE, format: 0.5 })
    const { image, livre } = afficher()
    await charger(image)
    expect(livre?.style.height).toBe('100%')
    expect(livre?.style.width).toBe('80%')
    expect(livre?.style.left).toBe('10%')
  })

  it('sur l’étagère, aucune bande colorée : le reste de la case est vide', async () => {
    mesure({ mode: 'etagere', visible: ENTIERE, format: 0.7 })
    const { cadre, image, livre, typographique } = afficher()
    await charger(image)
    // La case elle-même n'a ni fond ni ombre : c'est le fond de l'appli qui paraît.
    expect(cadre.style.background).toBe('')
    expect(cadre.style.boxShadow).toBe('')
    expect(cadre.querySelector('[data-role="fond-image"]')).toBeNull()
    // La couverture typographique s'efface ; l'ombre et les coins arrondis suivent la forme de l'image.
    expect(typographique).toHaveClass('opacity-0')
    expect(livre).toHaveClass('rounded-couverture')
    expect(livre?.style.boxShadow).not.toBe('')
  })

  it('une image qu’on ne sait pas mesurer remplit la case, sans être déformée', async () => {
    mesure(null)
    const { cadre, image, livre } = afficher()
    await charger(image)
    expect(cadre).toHaveAttribute('data-etat', 'image')
    expect(livre?.style.width).toBe('100%')
    expect(image).toHaveClass('object-cover')
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
