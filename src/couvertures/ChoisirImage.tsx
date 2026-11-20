import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as PointeurReact, type Ref } from 'react'
import { useRangerCouverture } from '../bibliotheque/requetes'
import { Bouton } from '../composants/Bouton'
import { ActionsFeuille, Feuille } from '../composants/Feuille'
import type { CibleCouverture } from './choix'
import { CONSEIL_PHOTO, conseilAMontrer, noterPhotoPrise } from './conseil'
import { lireImage, verifierFichier, type EchecPhoto, type ImageLue } from './photo'
// Seulement des types : le module de redressement n'est chargé qu'à l'ouverture du panneau.
import type { Quad } from './redressement/geometrie.ts'
import type { Redressee } from './redressement/index.ts'

const ECHECS_PHOTO: Record<EchecPhoto, string> = {
  pas_image: 'Ce fichier n’est pas une image. Choisir une photo ou une image.',
  trop_lourd: 'Cette image est trop lourde (plus de 30 Mo). En choisir une plus légère.',
  illisible: 'Cette image n’a pas pu être lue. En essayer une autre.',
}

export const ECHECS_RANGEMENT: Record<string, string> = {
  reseau: 'Pas de connexion à internet : la couverture n’a pas été rangée.',
  introuvable: 'Cette œuvre n’est plus dans ma bibliothèque : la couverture n’a pas été rangée.',
  invalide: 'La couverture n’a pas pu être rangée.',
  inconnu: 'La couverture n’a pas pu être rangée. Réessayer dans un instant.',
}

export type SourceImage = 'photo' | 'phototheque'
export type OuvrirImage = { ouvrir: (source?: SourceImage) => void }

/** Les quatre coins, dans l'ordre du quadrilatère : c'est ainsi que VoiceOver les nomme. */
const NOMS_DES_COINS = ['Coin en haut à gauche', 'Coin en haut à droite', 'Coin en bas à droite', 'Coin en bas à gauche']

const DETECTION = {
  en_cours: 'Recherche des coins du livre…',
  trouve: 'Les coins sont placés sur le livre. Les ajuster si besoin.',
  non_trouve: 'Livre introuvable sur la photo : placer les coins à la main.',
}

/** La loupe : un disque de 104 px qui montre la photo agrandie deux fois et demie, centrée sur le coin. */
const LOUPE = 104
const AGRANDISSEMENT = 2.5
/** Elle se tient au-dessus du doigt, qui cache le coin. */
const AU_DESSUS = 84

const coinsDeLaPhoto = (image: { largeur: number; hauteur: number }): Quad => [
  { x: 0, y: 0 },
  { x: image.largeur, y: 0 },
  { x: image.largeur, y: image.hauteur },
  { x: 0, y: image.hauteur },
]

const borner = (valeur: number, min: number, max: number) => Math.min(Math.max(valeur, min), max)

/** Le module de redressement (environ 15 Ko), chargé à la demande et une seule fois. */
const chargerRedressement = () => import('./redressement/index.ts')

/** Le conseil de lumière, sous un bouton de photo : affiché les trois premières fois seulement. */
export function ConseilPhoto({ className = '' }: { className?: string }) {
  if (!conseilAMontrer()) return null
  return <p className={`m-0 text-sm text-discret ${className}`}>{CONSEIL_PHOTO}</p>
}

/**
 * « Choisir une image » : une photo de mon exemplaire devient une couverture, à la manière du
 * scanner de documents de l'iPhone. Le panneau se déroule en deux temps.
 *   1. « Redresser la photo » : les quatre coins sont placés sur le livre trouvé ; je les ajuste
 *      au doigt (une loupe suit le coin) ou aux flèches du clavier, ou je garde l'image entière.
 *   2. « Vérifier la couverture » : la couverture droite, sans la table autour, sa lumière
 *      légèrement corrigée ; « Couleurs d'origine » retire cette correction.
 * « Reprendre la photo » est toujours là. L'image validée est rangée dans mon stockage privé et
 * posée sur `cible` ; avec `surImage`, elle est rendue à l'appelant, qui la rangera lui-même.
 */
export function ChoisirImage({
  oeuvre = '',
  cible,
  enLigne,
  surRangee,
  ref,
  sansBouton = false,
  surImage,
}: {
  /** L'œuvre et l'endroit où ranger l'image. Inutiles avec `surImage`. */
  oeuvre?: string
  cible?: CibleCouverture
  enLigne: boolean
  /** L'image est rangée. Donné, c'est l'appelant qui le dit à l'écran ; sinon, le composant le dit lui-même. */
  surRangee?: () => void
  /** Pour l'ouvrir depuis un menu ou un autre bouton (« Prendre une photo », « Choisir dans mes photos »). */
  ref?: Ref<OuvrirImage>
  /** Le bouton « Choisir une image » est remplacé par un menu ou un bouton de l'appelant. */
  sansBouton?: boolean
  /** Donné : l'image validée est rendue à l'appelant, qui la rangera au bon moment. Rien n'est rangé ici. */
  surImage?: (image: Blob) => void
}) {
  const rangement = useRangerCouverture(oeuvre)
  const refChamp = useRef<HTMLInputElement>(null)
  const refZone = useRef<HTMLDivElement>(null)
  const idAide = useId()
  const [image, setImage] = useState<ImageLue | null>(null)
  const [coins, setCoins] = useState<Quad>(coinsDeLaPhoto({ largeur: 1, hauteur: 1 }))
  const [detection, setDetection] = useState<keyof typeof DETECTION>('en_cours')
  const [redressee, setRedressee] = useState<Redressee | null>(null)
  const [couleursOrigine, setCouleursOrigine] = useState(false)
  const [lecture, setLecture] = useState(false)
  const [preparation, setPreparation] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [erreurPanneau, setErreurPanneau] = useState<string | null>(null)
  const [fait, setFait] = useState(false)
  /** Le coin que je fais glisser : d'où le geste est parti, où était le coin, et la taille de la photo à l'écran. */
  const glisse = useRef<{ coin: number; x: number; y: number; depart: Quad } | null>(null)
  const [loupe, setLoupe] = useState<{ coin: number; largeur: number; hauteur: number; place: number } | null>(null)
  /** Change à chaque photo et à chaque fermeture : une détection arrivée trop tard est ignorée. */
  const tour = useRef(0)

  // L'aperçu de la photo est libéré dès qu'il ne sert plus (panneau refermé, écran quitté).
  useEffect(() => () => image?.liberer(), [image])
  // Les deux formes de la couverture redressée, affichables tout de suite.
  const adresses = useMemo(
    () => (redressee ? { origine: URL.createObjectURL(redressee.origine), amelioree: URL.createObjectURL(redressee.amelioree) } : null),
    [redressee],
  )
  useEffect(
    () => () => {
      if (!adresses) return
      URL.revokeObjectURL(adresses.origine)
      URL.revokeObjectURL(adresses.amelioree)
    },
    [adresses],
  )

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
    noterPhotoPrise()
    const ceTour = ++tour.current
    setErreurPanneau(null)
    setRedressee(null)
    setCouleursOrigine(false)
    setCoins(coinsDeLaPhoto(lue.image))
    setDetection('en_cours')
    setImage(lue.image)
    // Le livre est cherché sur la photo : les coins se placent d'eux-mêmes, sans rien bloquer.
    let trouves: { coins: Quad; trouve: boolean } | null = null
    try {
      trouves = (await chargerRedressement()).trouverCoins(lue.image)
    } catch {
      trouves = null
    }
    if (tour.current !== ceTour) return
    if (trouves?.trouve) setCoins(trouves.coins)
    setDetection(trouves?.trouve ? 'trouve' : 'non_trouve')
  }

  const fermer = () => {
    tour.current += 1
    glisse.current = null
    setLoupe(null)
    setRedressee(null)
    setImage(null)
  }

  /** « photo » ouvre directement l'appareil photo ; « phototheque » laisse l'iPhone proposer ses photos. */
  function ouvrir(source: SourceImage = 'phototheque') {
    const champ = refChamp.current
    if (!champ || !enLigne || lecture) return
    if (source === 'photo') champ.setAttribute('capture', 'environment')
    else champ.removeAttribute('capture')
    champ.click()
  }
  useImperativeHandle(ref, () => ({ ouvrir }))

  /** La photo ne convient pas (ombre, reflet, flou) : on repart de l'appareil photo, ou du même choix qu'avant. */
  function reprendre() {
    fermer()
    if (enLigne) refChamp.current?.click()
  }

  async function redresser() {
    if (!image || preparation) return
    setErreurPanneau(null)
    setPreparation(true)
    let produite: Redressee | null = null
    try {
      produite = await (await chargerRedressement()).redresser(image, coins)
    } catch {
      produite = null
    }
    setPreparation(false)
    if (!produite) return setErreurPanneau('L’image n’a pas pu être redressée. Replacer les coins, ou reprendre la photo.')
    setRedressee(produite)
  }

  function valider() {
    if (!redressee || rangement.isPending) return
    const gardee = couleursOrigine ? redressee.origine : redressee.amelioree
    setErreurPanneau(null)
    if (surImage) {
      surImage(gardee)
      return fermer()
    }
    if (!cible) return
    rangement.mutate(
      { image: gardee, cible },
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

  /** Un coin à sa nouvelle place, sans jamais sortir de la photo. Les trois autres ne bougent pas. */
  const deplacer = (depuis: Quad, coin: number, dx: number, dy: number, dans: ImageLue): Quad =>
    depuis.map((point, rang) =>
      rang === coin ? { x: Math.round(borner(point.x + dx, 0, dans.largeur)), y: Math.round(borner(point.y + dy, 0, dans.hauteur)) } : point,
    ) as Quad

  function debutGlisse(coin: number, evenement: PointeurReact<HTMLButtonElement>) {
    evenement.preventDefault()
    try {
      // Le geste reste attaché à la poignée, même si le doigt en sort.
      evenement.currentTarget.setPointerCapture?.(evenement.pointerId)
    } catch {
      // Pointeur déjà relâché : le geste se poursuit tant qu'il reste sur la poignée.
    }
    glisse.current = { coin, x: evenement.clientX, y: evenement.clientY, depart: coins }
  }
  function mouvement(evenement: PointeurReact<HTMLButtonElement>) {
    const depart = glisse.current
    const zone = refZone.current?.getBoundingClientRect()
    if (!depart || !image || !zone || !zone.width || !zone.height) return
    // Du déplacement du doigt à l'écran au déplacement dans la photo.
    const dx = ((evenement.clientX - depart.x) * image.largeur) / zone.width
    const dy = ((evenement.clientY - depart.y) * image.hauteur) / zone.height
    setCoins(deplacer(depart.depart, depart.coin, dx, dy, image))
    // La place au-dessus de la photo, jusqu'au haut du panneau : la loupe peut y déborder.
    const panneau = refZone.current?.closest('dialog')?.getBoundingClientRect().top ?? 0
    setLoupe({ coin: depart.coin, largeur: zone.width, hauteur: zone.height, place: zone.top - panneau })
  }
  const finGlisse = () => {
    glisse.current = null
    setLoupe(null)
  }

  function auClavier(coin: number, evenement: KeyboardEvent<HTMLButtonElement>) {
    const sens: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const direction = sens[evenement.key]
    if (!direction || !image) return
    evenement.preventDefault()
    // Un pas : un demi-centième du grand côté de la photo ; cinq fois plus avec Majuscule.
    const pas = Math.max(1, Math.round(Math.max(image.largeur, image.hauteur) / 200)) * (evenement.shiftKey ? 5 : 1)
    setCoins((avant) => deplacer(avant, coin, direction[0] * pas, direction[1] * pas, image))
  }

  const occupe = preparation || rangement.isPending
  const trace = coins.map((coin) => `${coin.x} ${coin.y}`).join(' L')
  // La loupe : centrée sur le coin, au-dessus du doigt qui le cache (en dessous seulement si elle sortait du panneau).
  const viseur = loupe && image ? { x: (coins[loupe.coin].x / image.largeur) * loupe.largeur, y: (coins[loupe.coin].y / image.hauteur) * loupe.hauteur } : null

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
      {sansBouton ? (
        <p role="status" className="m-0 text-sm text-discret empty:hidden">
          {lecture ? 'Lecture de l’image…' : ''}
        </p>
      ) : (
        <>
          <Bouton variante="secondaire" occupe={!enLigne || lecture} onClick={() => ouvrir()}>
            {lecture ? 'Lecture de l’image…' : 'Choisir une image'}
          </Bouton>
          <ConseilPhoto />
        </>
      )}
      {erreur && (
        <p role="alert" className="m-0 text-sm font-semibold text-accent-texte">
          {erreur}
        </p>
      )}
      {!surRangee && !surImage && (
        <p role="status" data-etat={fait ? 'ouvert' : 'ferme'} className="m-0 text-sm text-discret empty:hidden">
          {fait ? 'La nouvelle couverture est en place.' : ''}
        </p>
      )}

      <Feuille ouvert={image !== null} titre={redressee ? 'Vérifier la couverture' : 'Redresser la photo'} fermer={fermer}>
        {image && !redressee && (
          <div data-etat="coins" className="flex flex-col gap-5">
            <p className="m-0 text-[0.9375rem] text-discret">Placer les quatre coins sur ceux de la couverture.</p>
            {/* La marge laisse la place aux poignées, qui débordent de moitié autour de la photo. */}
            <div className="flex justify-center p-[1.375rem]">
              <div ref={refZone} data-testid="zone-redressement" className="relative inline-block touch-none select-none">
                <img src={image.apercu} alt="La photo choisie" draggable={false} className="block h-auto max-h-[42dvh] w-auto max-w-full rounded-[3px]" />
                {/* Ce qui sera retiré est assombri ; le trait clair entoure ce qui sera gardé. */}
                <svg
                  aria-hidden="true"
                  viewBox={`0 0 ${image.largeur} ${image.hauteur}`}
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 size-full rounded-[3px]"
                >
                  <path fillRule="evenodd" fill="rgba(20, 14, 10, 0.55)" d={`M0 0H${image.largeur}V${image.hauteur}H0Z M${trace}Z`} />
                  <path data-role="cadre" fill="none" stroke="var(--sur-accent)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" d={`M${trace}Z`} />
                </svg>
                {coins.map((coin, rang) => (
                  <button
                    key={NOMS_DES_COINS[rang]}
                    type="button"
                    aria-label={NOMS_DES_COINS[rang]}
                    aria-describedby={idAide}
                    onPointerDown={(evenement) => debutGlisse(rang, evenement)}
                    onPointerMove={mouvement}
                    onPointerUp={finGlisse}
                    onPointerCancel={finGlisse}
                    // Geste repris par le système (appel, notification) sans « pointerup » : il est abandonné.
                    onLostPointerCapture={finGlisse}
                    onKeyDown={(evenement) => auClavier(rang, evenement)}
                    className="absolute flex size-11 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-pilule border-0 bg-transparent p-0 active:cursor-grabbing"
                    style={{ left: `${(coin.x / image.largeur) * 100}%`, top: `${(coin.y / image.hauteur) * 100}%` }}
                  >
                    <span className="size-5 rounded-pilule border-2 border-sur-accent bg-accent shadow-douce" />
                  </button>
                ))}
                {loupe && viseur && (
                  <div
                    data-testid="loupe"
                    aria-hidden="true"
                    className="pointer-events-none absolute z-10 rounded-pilule bg-surface"
                    style={{
                      width: LOUPE,
                      height: LOUPE,
                      left: borner(viseur.x - LOUPE / 2, -22, loupe.largeur - LOUPE + 22),
                      top: loupe.place + viseur.y - AU_DESSUS - LOUPE / 2 < 8 ? viseur.y + AU_DESSUS - LOUPE / 2 : viseur.y - AU_DESSUS - LOUPE / 2,
                      backgroundImage: `url(${image.apercu})`,
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: `${loupe.largeur * AGRANDISSEMENT}px ${loupe.hauteur * AGRANDISSEMENT}px`,
                      backgroundPosition: `${-(viseur.x * AGRANDISSEMENT - LOUPE / 2)}px ${-(viseur.y * AGRANDISSEMENT - LOUPE / 2)}px`,
                      boxShadow: '0 0 0 2px var(--sur-accent), 0 12px 34px var(--ombre-forte)',
                    }}
                  >
                    {/* Le point visé : là où se trouve le coin. */}
                    <span className="absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-pilule border-2 border-sur-accent bg-accent" />
                  </div>
                )}
              </div>
            </div>
            <p id={idAide} className="sr-only">
              Le déplacer avec les flèches du clavier ; plus vite avec la touche Majuscule.
            </p>
            <p role="status" aria-label="Détection du livre" className="m-0 -mt-2 text-center text-sm text-discret">
              {DETECTION[detection]}
            </p>
            <ActionsFeuille>
              <Bouton occupe={occupe} onClick={redresser}>
                {preparation ? 'Redressement de l’image…' : 'Redresser'}
              </Bouton>
              <Bouton variante="secondaire" onClick={() => setCoins(coinsDeLaPhoto(image))}>
                Image entière
              </Bouton>
              <Bouton variante="secondaire" occupe={!enLigne} onClick={reprendre}>
                Reprendre la photo
              </Bouton>
            </ActionsFeuille>
            <details className="group -mt-1">
              <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center text-[0.9375rem] font-semibold text-discret [&::-webkit-details-marker]:hidden">
                Conseils pour la photo
              </summary>
              <p className="m-0 pb-1 text-[0.9375rem] text-discret">{CONSEIL_PHOTO} Une ombre nette ou un reflet restent sur l’image : mieux vaut alors reprendre la photo.</p>
            </details>
          </div>
        )}

        {image && redressee && adresses && (
          <div data-etat="resultat" className="flex flex-col gap-5">
            <div className="flex justify-center">
              <img
                src={couleursOrigine ? adresses.origine : adresses.amelioree}
                alt="La couverture redressée"
                className="block h-auto max-h-[42dvh] w-auto max-w-full rounded-couverture shadow-forte"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 text-[0.9375rem] font-bold">
                Couleurs d’origine
                <input
                  type="checkbox"
                  role="switch"
                  aria-describedby={`${idAide}-lumiere`}
                  checked={couleursOrigine}
                  onChange={(evenement) => setCouleursOrigine(evenement.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="relative h-8 w-[3.25rem] shrink-0 rounded-pilule border border-bordure bg-piste transition-colors duration-200 peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-accent-texte after:absolute after:top-[3px] after:left-[3px] after:size-6 after:rounded-pilule after:bg-discret after:transition-transform after:duration-200 peer-checked:after:translate-x-5 peer-checked:after:bg-sur-accent"
                />
              </label>
              <p id={`${idAide}-lumiere`} className="m-0 text-sm text-discret">
                La lumière a été légèrement corrigée. « Couleurs d’origine » rend la photo telle qu’elle a été prise.
              </p>
            </div>
            <ActionsFeuille>
              <Bouton occupe={rangement.isPending} onClick={valider}>
                {rangement.isPending ? 'Rangement de l’image…' : 'Valider'}
              </Bouton>
              <Bouton variante="secondaire" onClick={() => setRedressee(null)}>
                Revoir les coins
              </Bouton>
              <Bouton variante="secondaire" occupe={!enLigne} onClick={reprendre}>
                Reprendre la photo
              </Bouton>
            </ActionsFeuille>
          </div>
        )}

        <p role="alert" className="m-0 rounded-carte bg-accent-doux px-5 py-4 text-[0.9375rem] font-semibold text-accent-texte empty:hidden">
          {erreurPanneau ?? ''}
        </p>
      </Feuille>
    </>
  )
}
