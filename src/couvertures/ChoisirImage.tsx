import { useEffect, useRef, useState, type PointerEvent as PointeurReact } from 'react'
import { useRangerCouverture } from '../bibliotheque/requetes'
import { Bouton } from '../composants/Bouton'
import { Feuille } from '../composants/Feuille'
import type { CibleCouverture } from './choix'
import { cadreEntier, COINS, deplacerCoin, lireImage, recadrer, verifierFichier, type Cadre, type Coin, type EchecPhoto, type ImageLue } from './photo'

const ECHECS_PHOTO: Record<EchecPhoto, string> = {
  pas_image: 'Ce fichier n’est pas une image. Je choisis une photo ou une image.',
  trop_lourd: 'Cette image est trop lourde (plus de 30 Mo). J’en choisis une plus légère.',
  illisible: 'Cette image n’a pas pu être lue. J’en essaie une autre.',
}

export const ECHECS_RANGEMENT: Record<string, string> = {
  reseau: 'Pas de connexion à internet : la couverture n’a pas été rangée.',
  introuvable: 'Cette œuvre n’est plus dans ma bibliothèque : la couverture n’a pas été rangée.',
  invalide: 'La couverture n’a pas pu être rangée.',
  inconnu: 'La couverture n’a pas pu être rangée. Je réessaie dans un instant.',
}

/** Où se trouve un coin du cadre, en pourcentage de l'image affichée. */
function positionDe(coin: Coin, cadre: Cadre, image: ImageLue) {
  const x = coin.endsWith('gauche') ? cadre.x : cadre.x + cadre.largeur
  const y = coin.startsWith('haut') ? cadre.y : cadre.y + cadre.hauteur
  return { left: `${(x / image.largeur) * 100}%`, top: `${(y / image.hauteur) * 100}%` }
}

/**
 * « Choisir une image » : un seul bouton, qui ouvre le choix de l'appareil (photothèque, appareil
 * photo ou fichiers). La photo s'affiche entière dans un panneau ; je peux la recadrer en faisant
 * glisser ses quatre coins, ou la garder telle quelle (le chemin accessible au clavier). L'image
 * gardée est réduite, rangée dans mon stockage privé, puis posée sur `cible`. Action immédiate.
 */
export function ChoisirImage({
  oeuvre,
  cible,
  enLigne,
  surRangee,
}: {
  oeuvre: string
  cible: CibleCouverture
  enLigne: boolean
  /** L'image est rangée. Donné, c'est l'appelant qui le dit à l'écran ; sinon, le composant le dit lui-même. */
  surRangee?: () => void
}) {
  const rangement = useRangerCouverture(oeuvre)
  const refChamp = useRef<HTMLInputElement>(null)
  const refZone = useRef<HTMLDivElement>(null)
  const [image, setImage] = useState<ImageLue | null>(null)
  const [cadre, setCadre] = useState<Cadre>(cadreEntier(1, 1))
  const [lecture, setLecture] = useState(false)
  const [preparation, setPreparation] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [erreurPanneau, setErreurPanneau] = useState<string | null>(null)
  const [fait, setFait] = useState(false)
  /** Le coin que je fais glisser : d'où le geste est parti, et le cadre à ce moment-là. */
  const glisse = useRef<{ coin: Coin; x: number; y: number; cadre: Cadre } | null>(null)

  // L'aperçu de la photo est libéré dès qu'il ne sert plus (panneau refermé, écran quitté).
  useEffect(() => () => image?.liberer(), [image])

  async function surFichier(fichier: File | undefined) {
    if (!fichier || !enLigne) return
    setErreur(null)
    setFait(false)
    const verdict = verifierFichier(fichier)
    if (verdict !== 'ok') return setErreur(ECHECS_PHOTO[verdict])
    setLecture(true)
    const lue = await lireImage(fichier)
    setLecture(false)
    if (!lue.ok) return setErreur(ECHECS_PHOTO[lue.echec])
    setErreurPanneau(null)
    setCadre(cadreEntier(lue.image.largeur, lue.image.hauteur))
    setImage(lue.image)
  }

  const fermer = () => {
    glisse.current = null
    setImage(null)
  }

  async function garder() {
    if (!image || preparation || rangement.isPending) return
    setErreurPanneau(null)
    setPreparation(true)
    const recadree = await recadrer(image, cadre)
    setPreparation(false)
    if (!recadree) return setErreurPanneau('L’image n’a pas pu être préparée. J’en essaie une autre.')
    rangement.mutate(
      { image: recadree, cible },
      {
        onSuccess: () => {
          if (surRangee) surRangee()
          else setFait(true)
          fermer()
        },
        onError: (echec) => setErreurPanneau(ECHECS_RANGEMENT[echec.echec] ?? ECHECS_RANGEMENT.inconnu),
      },
    )
  }

  function debutGlisse(coin: Coin, evenement: PointeurReact<HTMLDivElement>) {
    evenement.preventDefault()
    evenement.currentTarget.setPointerCapture?.(evenement.pointerId)
    glisse.current = { coin, x: evenement.clientX, y: evenement.clientY, cadre }
  }
  function mouvement(evenement: PointeurReact<HTMLDivElement>) {
    const depart = glisse.current
    const zone = refZone.current?.getBoundingClientRect()
    if (!depart || !image || !zone || !zone.width || !zone.height) return
    // Du déplacement du doigt à l'écran au déplacement dans l'image.
    const dx = ((evenement.clientX - depart.x) * image.largeur) / zone.width
    const dy = ((evenement.clientY - depart.y) * image.hauteur) / zone.height
    setCadre(deplacerCoin(depart.cadre, depart.coin, dx, dy, image))
  }
  const finGlisse = () => void (glisse.current = null)

  const occupe = preparation || rangement.isPending

  return (
    <>
      <input
        ref={refChamp}
        type="file"
        accept="image/*"
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={(evenement) => {
          const fichier = evenement.target.files?.[0]
          // Vidé tout de suite : la même photo peut être rechoisie.
          evenement.target.value = ''
          void surFichier(fichier)
        }}
      />
      <Bouton variante="secondaire" occupe={!enLigne || lecture} onClick={() => refChamp.current?.click()}>
        {lecture ? 'Je lis l’image…' : 'Choisir une image'}
      </Bouton>
      <p role="alert" className="m-0 text-sm font-semibold text-accent-texte empty:hidden">
        {erreur ?? ''}
      </p>
      {!surRangee && (
        <p role="status" data-etat={fait ? 'ouvert' : 'ferme'} className="m-0 text-sm text-discret empty:hidden">
          {fait ? 'La nouvelle couverture est en place.' : ''}
        </p>
      )}

      <Feuille ouvert={image !== null} titre="Recadrer l’image" fermer={fermer}>
        {image && (
          <div className="flex flex-col gap-5">
            <p className="m-0 text-[0.9375rem] text-discret">
              Je fais glisser les coins pour ne garder que la couverture, ou je garde l’image entière.
            </p>
            {/* La marge laisse la place aux poignées, qui débordent de moitié autour de l'image. */}
            <div className="flex justify-center p-[1.375rem]">
              <div ref={refZone} data-testid="zone-recadrage" className="relative inline-block touch-none select-none">
                <img src={image.apercu} alt="" draggable={false} className="block h-auto max-h-[42dvh] w-auto max-w-full rounded-[3px]" />
                {/* Ce qui sera coupé est assombri ; le cadre clair entoure ce qui sera gardé. */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[3px]">
                  <div
                    data-role="cadre"
                    className="absolute border-2 border-sur-accent"
                    style={{
                      left: `${(cadre.x / image.largeur) * 100}%`,
                      top: `${(cadre.y / image.hauteur) * 100}%`,
                      width: `${(cadre.largeur / image.largeur) * 100}%`,
                      height: `${(cadre.hauteur / image.hauteur) * 100}%`,
                      boxShadow: '0 0 0 9999px rgba(20, 14, 10, 0.55)',
                    }}
                  />
                </div>
                {COINS.map((coin) => (
                  <div
                    key={coin}
                    data-testid={`coin-${coin}`}
                    aria-hidden="true"
                    onPointerDown={(evenement) => debutGlisse(coin, evenement)}
                    onPointerMove={mouvement}
                    onPointerUp={finGlisse}
                    onPointerCancel={finGlisse}
                    className={`absolute flex size-11 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center ${
                      coin === 'haut-gauche' || coin === 'bas-droite' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'
                    }`}
                    style={positionDe(coin, cadre, image)}
                  >
                    <span className="size-5 rounded-pilule border-2 border-sur-accent bg-accent shadow-douce" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Bouton occupe={occupe} onClick={garder}>
                {occupe ? 'Je range l’image…' : 'Garder cette image'}
              </Bouton>
              <Bouton variante="secondaire" onClick={() => setCadre(cadreEntier(image.largeur, image.hauteur))}>
                Image entière
              </Bouton>
            </div>
            <p role="alert" className="m-0 rounded-carte bg-accent-doux px-5 py-4 text-[0.9375rem] font-semibold text-accent-texte empty:hidden">
              {erreurPanneau ?? ''}
            </p>
          </div>
        )}
      </Feuille>
    </>
  )
}
