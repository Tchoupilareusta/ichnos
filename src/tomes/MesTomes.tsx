import { useCallback, useEffect, useRef, useState, type MouseEvent as EvenementSouris, type PointerEvent as EvenementPointeur, type ReactNode } from 'react'
import type { OeuvreDetaillee, Tome } from '../bibliotheque/depot'
import { POSSESSIONS, libellePossession, type Possession } from '../bibliotheque/modele'
import type { EchecDepot, useModifierOeuvre } from '../bibliotheque/requetes'
import { LECTURES_TOME, libelleLectureTome, type LectureTome } from '../bibliotheque/suivi'
import {
  BULLES_LECTURE,
  BULLES_POSSESSION,
  SEUIL_CONFIRMATION,
  preparerChangement,
  selectionGlissee,
  selectionPlage,
  texteApplique,
  texteConfirmation,
  texteRienAChanger,
  texteSelection,
  titreConfirmation,
  type ChoixTomes,
} from '../bibliotheque/tomes'
import { Bouton } from '../composants/Bouton'
import { Dialogue } from '../composants/Dialogue'
import { ActionsFeuille, Feuille } from '../composants/Feuille'
import { IconeCoche, IconeFermer, IconeSignet } from '../composants/Icones'
import { IconeLivre, IconePossession } from '../composants/IconesLecture'
import { Isbn } from '../composants/Isbn'
import { MessageTemporaire, type Message } from '../composants/MessageTemporaire'
import { Section } from '../composants/Section'
import { ChoisirImage } from '../couvertures/ChoisirImage'
import { Couverture } from '../couvertures/Couverture'
import { useMasquerBarreDuBas } from '../navigation/saisie'

type Modifier = ReturnType<typeof useModifierOeuvre>

export const ANCRE_TOMES = 'mes-tomes'

/** Sans bouger pendant ce temps, un appui sur un tome ouvre ses détails. */
export const DUREE_APPUI_LONG = 500
/** Au-delà de cette distance (en points), l'appui n'est plus immobile : l'appui long est annulé, et le geste devient un glissement. */
const SEUIL_GLISSEMENT = 10

/** Le remplissage du cercle dit la possession : plein, pointillé, vide. */
const STYLE_TOME: Record<Possession, string> = {
  possede: 'border border-accent bg-accent font-bold text-sur-accent',
  a_acheter: 'border-2 border-dashed border-accent-texte bg-surface font-bold text-accent-texte',
  // Le contour atteint 3:1 sur le fond (clair et sombre), sans peser autant qu'un tome que j'ai.
  non_possede: 'border border-contour bg-transparent font-semibold text-discret',
}

const PASTILLE_LECTURE = 'flex items-center justify-center rounded-full border border-bordure bg-surface text-accent-texte'

/** La marque de lecture d'un tome, posée en haut à droite du cercle : une coche s'il est lu, un signet s'il est en cours. */
function MarqueLecture({ lecture, dansLaLegende = false }: { lecture: LectureTome; dansLaLegende?: boolean }) {
  if (lecture === 'a_lire') return null
  return (
    <span
      aria-hidden="true"
      className={`${PASTILLE_LECTURE} ${dansLaLegende ? 'size-4' : 'pointer-events-none absolute -top-0.5 -right-0.5 size-5 shadow-douce'}`}
    >
      {lecture === 'lu' ? <IconeCoche taille={dansLaLegende ? 11 : 13} /> : <IconeSignet taille={dansLaLegende ? 9 : 11} />}
    </span>
  )
}

/** L'icône d'un choix, dans le menu et dans le message qui le confirme. */
function IconeChoix({ choix, taille = 16 }: { choix: ChoixTomes; taille?: number }) {
  if (choix.type === 'possession') return <IconePossession possession={choix.valeur} taille={taille} />
  if (choix.valeur === 'lu') return <IconeCoche taille={taille} />
  if (choix.valeur === 'en_cours') return <IconeSignet taille={taille - 1} />
  return <IconeLivre taille={taille} />
}

const MESSAGES_ECHEC: Record<string, string> = {
  reseau: 'Pas de connexion : rien n’a changé.',
  introuvable: 'Tomes introuvables : rien n’a changé.',
}
const texteEchec = (erreur: EchecDepot) => MESSAGES_ECHEC[erreur.echec] ?? 'Échec de l’enregistrement : rien n’a changé.'

/** Une touche du clavier ouvre les détails du tome qui a le focus (iPad avec clavier). */
const estToucheDetails = (e: React.KeyboardEvent) => e.key === 'i' || e.key === 'I' || e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')

/**
 * « Mes tomes » : sélectionner d'abord, puis appliquer (comme Photos). Toucher un tome le
 * sélectionne ou le désélectionne ; glisser le doigt en sélectionne plusieurs ; un appui long
 * ouvre ses détails. Le doigt levé, le menu de sélection remplace la barre du bas.
 */
export function MesTomes({
  oeuvre,
  titre,
  enLigne,
  modifier,
  acheter,
}: {
  oeuvre: OeuvreDetaillee
  titre: string
  enLigne: boolean
  modifier: Modifier
  /** Ouvre « Je l'ai acheté » pour ce tome. */
  acheter: (numero: number) => void
}) {
  const tomes = oeuvre.tomes
  const numeros = tomes.map((t) => t.numero)
  const [selection, setSelection] = useState<Set<number>>(() => new Set())
  const [ancre, setAncre] = useState<number | null>(null)
  const [details, setDetails] = useState<number | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const [confirmation, setConfirmation] = useState<{ choix: ChoixTomes; preparation: ReturnType<typeof preparerChangement> } | null>(null)
  const refSection = useRef<HTMLDivElement>(null)
  const refMenu = useRef<HTMLDivElement>(null)

  const gestes = useGestesGrille({ numeros, selection, setSelection, ouvrirDetails: setDetails, poserAncre: setAncre })
  // Le menu n'apparaît que le doigt levé : pendant un glissement, rien ne couvre la grille.
  const menuOuvert = selection.size > 0 && !gestes.enCours

  useMasquerBarreDuBas(menuOuvert)

  // Un tome retiré (depuis « Modifier ») quitte la sélection.
  const cleNumeros = numeros.join(',')
  useEffect(() => {
    setSelection((avant) => {
      const restants = [...avant].filter((n) => numeros.includes(n))
      return restants.length === avant.size ? avant : new Set(restants)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleNumeros])

  const vider = useCallback(() => {
    setSelection(new Set())
    setMessage(null)
  }, [])

  // Échap vide la sélection (clavier de l'iPad), sauf si un panneau ouvert la réclame. Un toucher
  // ailleurs que sur la grille ou le menu la vide aussi ; un défilement n'est pas un toucher (il ne
  // produit pas de clic).
  useEffect(() => {
    if (selection.size === 0) return
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('dialog[open]')) return
      vider()
    }
    const surClic = (e: MouseEvent) => {
      const cible = e.target as Node | null
      if (!cible || document.querySelector('dialog[open]')) return
      if (gestes.refGrille.current?.contains(cible) || refMenu.current?.contains(cible)) return
      vider()
    }
    window.addEventListener('keydown', surTouche)
    document.addEventListener('click', surClic, true)
    return () => {
      window.removeEventListener('keydown', surTouche)
      document.removeEventListener('click', surClic, true)
    }
  }, [selection.size, vider, gestes.refGrille])

  const effacerMessage = useCallback(() => setMessage(null), [])

  function signaler(texte: string, options: { icone?: ReactNode; annuler?: () => void } = {}) {
    setMessage({ cle: Date.now(), texte, icone: options.icone, annuler: options.annuler, nomAnnuler: options.annuler ? `Annuler : ${texte.replace(' : ', ', ')}` : undefined })
  }

  function executer(choix: ChoixTomes, { changements, annulation }: ReturnType<typeof preparerChangement>) {
    const texte = texteApplique(
      changements.map((c) => c.numero),
      choix,
    )
    const echec = (erreur: EchecDepot) => signaler(texteEchec(erreur))
    modifier.tomes.mutate(changements, { onError: echec })
    signaler(texte, { icone: <IconeChoix choix={choix} />, annuler: () => modifier.tomes.mutate(annulation, { onError: echec }) })
  }

  function appliquer(choix: ChoixTomes) {
    if (!enLigne || selection.size === 0) return
    const preparation = preparerChangement(tomes, selection, choix)
    if (preparation.changements.length === 0) return signaler(texteRienAChanger(choix), { icone: <IconeChoix choix={choix} /> })
    if (preparation.changements.length > SEUIL_CONFIRMATION) return setConfirmation({ choix, preparation })
    executer(choix, preparation)
  }

  const basculer = (numero: number, avecMaj: boolean) => {
    setSelection((avant) => {
      if (avecMaj && ancre !== null && ancre !== numero) return selectionPlage(numeros, avant, ancre, numero)
      const apres = new Set(avant)
      if (apres.has(numero)) apres.delete(numero)
      else apres.add(numero)
      return apres
    })
    setAncre(numero)
  }

  const tomeDetaille = tomes.find((t) => t.numero === details) ?? null
  const choisis = tomes.filter((t) => selection.has(t.numero))
  const commun = <K extends 'possession' | 'lecture'>(cle: K): Tome[K] | null =>
    choisis.length > 0 && choisis.every((t) => t[cle] === choisis[0][cle]) ? choisis[0][cle] : null

  return (
    <Section titre="Mes tomes" ancre={ANCRE_TOMES}>
      <div ref={refSection} className="flex flex-col gap-3">
        <p id="aide-tomes" className="m-0 text-[0.9375rem] text-discret">
          Toucher ou glisser pour sélectionner.
        </p>
        <ul
          ref={gestes.refGrille}
          aria-label={`Tomes de ${titre}`}
          aria-describedby="aide-tomes"
          onPointerDown={gestes.surPointeurDebut}
          onPointerMove={gestes.surPointeurMouvement}
          onPointerUp={gestes.surPointeurFin}
          onPointerCancel={gestes.surPointeurFin}
          onContextMenu={gestes.surMenuContextuel}
          // Cinq colonnes sur iPhone (des cercles d'environ 58 points à 393) ; sur iPad, des cercles
          // de taille fixe, et autant de colonnes que la largeur en permet.
          className="m-0 grid touch-manipulation list-none grid-cols-5 gap-3 p-0 pt-1 select-none [-webkit-touch-callout:none] tablette:grid-cols-[repeat(auto-fill,3.75rem)]"
        >
          {tomes.map((tome) => {
            const choisi = selection.has(tome.numero)
            const appuye = gestes.appui === tome.numero
            return (
              <li key={tome.numero} className="relative">
                <button
                  type="button"
                  data-numero={tome.numero}
                  data-etat={choisi ? 'selectionne' : 'libre'}
                  aria-pressed={choisi}
                  aria-keyshortcuts="I"
                  aria-label={`Tome ${tome.numero}${tome.titre ? `, ${tome.titre}` : ''}, ${libelleLectureTome(tome.lecture).toLocaleLowerCase('fr')}, ${libellePossession(tome.possession).toLocaleLowerCase('fr')}`}
                  onClick={(e) => {
                    if (gestes.clicAIgnorer()) return
                    basculer(tome.numero, e.shiftKey)
                  }}
                  onKeyDown={(e) => {
                    if (!estToucheDetails(e)) return
                    e.preventDefault()
                    setDetails(tome.numero)
                  }}
                  className={`flex aspect-square w-full cursor-pointer items-center justify-center rounded-full p-0 text-base tabular-nums ring-offset-2 ring-offset-fond select-none focus-visible:outline-offset-[7px] [-webkit-touch-callout:none] data-[etat=selectionne]:ring-3 data-[etat=selectionne]:ring-anneau ${STYLE_TOME[tome.possession]} ${
                    appuye
                      ? 'scale-[0.88] transition-transform duration-500 ease-out motion-reduce:scale-100 motion-reduce:opacity-70'
                      : 'transition-transform duration-200'
                  }`}
                >
                  {tome.numero}
                </button>
                <MarqueLecture lecture={tome.lecture} />
              </li>
            )
          })}
        </ul>
        <Legende />
      </div>

      <MenuTomes
        refMenu={refMenu}
        selection={menuOuvert ? selection : new Set<number>()}
        tous={selection.size === tomes.length}
        possessionActuelle={commun('possession')}
        lectureActuelle={commun('lecture')}
        enLigne={enLigne}
        appliquer={appliquer}
        toutSelectionner={() => setSelection(new Set(numeros))}
        vider={vider}
        message={message}
        effacerMessage={effacerMessage}
      />

      <Dialogue
        ouvert={confirmation !== null}
        titre={confirmation ? titreConfirmation(confirmation.preparation.changements.length) : ''}
        confirmer="Changer"
        onAnnuler={() => setConfirmation(null)}
        onConfirmer={() => {
          if (confirmation) executer(confirmation.choix, confirmation.preparation)
          setConfirmation(null)
        }}
      >
        {confirmation && texteConfirmation(confirmation.preparation.changements.length, confirmation.choix)}
      </Dialogue>

      <PanneauTome
        tome={tomeDetaille}
        oeuvre={oeuvre.id}
        titre={titre}
        enLigne={enLigne}
        fermer={() => setDetails(null)}
        acheter={(numero) => {
          setDetails(null)
          acheter(numero)
        }}
      />
    </Section>
  )
}

/**
 * La légende, sous la grille, en petit : c'est une référence, pas la première chose à lire. La
 * possession (le cercle), la lecture (la marque ; un tome sans marque est à lire, et l'étiquette
 * VoiceOver de chaque tome le dit), puis l'appui long.
 */
function Legende() {
  const element = 'flex items-center gap-1.5 whitespace-nowrap'
  return (
    <div className="flex flex-col gap-1 pt-1 text-[0.8125rem] text-discret">
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
        <dt className="font-semibold">Possession</dt>
        <dd className="m-0 flex flex-wrap gap-x-3 gap-y-1">
          {POSSESSIONS.map((p) => (
            <span key={p.valeur} className={element}>
              <span aria-hidden="true" className={`inline-block size-3 shrink-0 rounded-full ${STYLE_TOME[p.valeur]}`} />
              {p.libelle}
            </span>
          ))}
        </dd>
        <dt className="font-semibold">Lecture</dt>
        <dd className="m-0 flex flex-wrap gap-x-3 gap-y-1">
          {(['lu', 'en_cours'] as const).map((lecture) => (
            <span key={lecture} className={element}>
              <MarqueLecture lecture={lecture} dansLaLegende />
              {libelleLectureTome(lecture)}
            </span>
          ))}
        </dd>
      </dl>
      <p className="m-0">Appui long sur un tome : ses détails.</p>
    </div>
  )
}

/**
 * Les gestes sur la grille, distingués du défilement de la page.
 *
 * Au doigt, tout passe par les événements tactiles (touchstart, touchmove, touchend). Sur iPhone,
 * Safari cesse d'envoyer les événements de pointeur dès qu'il prend le geste pour un défilement,
 * sans toujours envoyer pointercancel : un minuteur d'appui long armé sur pointerdown restait alors
 * armé et ouvrait les détails au milieu d'un glissement. Les touchmove, eux, continuent d'arriver,
 * et un preventDefault() sur touchmove est le moyen fiable d'empêcher le défilement.
 *  · Un toucher sans bouger (le clic qui suit) sélectionne ou désélectionne le tome.
 *  · Un glissement parti d'un tome, d'abord plutôt horizontal, sélectionne les tomes parcourus,
 *    comme dans Photos ; plutôt vertical, la page défile normalement.
 *  · Un appui immobile d'une demi-seconde ouvre les détails du tome ; le moindre mouvement
 *    (10 points) ou un défilement l'annule.
 * À la souris (iPad avec trackpad, ordinateur), les événements de pointeur : tout glissement
 * sélectionne, et le clic droit ouvre les détails.
 */
function useGestesGrille({
  numeros,
  selection,
  setSelection,
  ouvrirDetails,
  poserAncre,
}: {
  numeros: number[]
  selection: Set<number>
  setSelection: (selection: Set<number>) => void
  ouvrirDetails: (numero: number) => void
  poserAncre: (numero: number) => void
}) {
  const refGrille = useRef<HTMLUListElement>(null)
  const geste = useRef<{
    x: number
    y: number
    depart: number
    avant: Set<number>
    souris: boolean
    mode: 'indecis' | 'selection' | 'defilement'
    long: boolean
    /** Le dernier tome survolé : rien à recalculer tant que le doigt reste dessus. */
    courant?: number
  } | null>(null)
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Le clic qui suit un glissement ou un appui long ne doit rien changer. Il n'atteint pas toujours
  // le bouton (fin du glissement sur un autre tome) : une courte fenêtre de temps, plutôt qu'un drapeau
  // qui resterait levé et ferait perdre le toucher suivant.
  const ignorerJusqua = useRef(0)
  const [appui, setAppui] = useState<number | null>(null)
  // Vrai pendant un glissement qui sélectionne : le menu attend que le doigt se lève.
  const [enCours, setEnCours] = useState(false)
  // Les écouteurs tactiles sont posés une fois : ils lisent les dernières valeurs ici.
  const derniers = useRef({ numeros, selection, setSelection, ouvrirDetails, poserAncre })
  derniers.current = { numeros, selection, setSelection, ouvrirDetails, poserAncre }

  const arreterMinuterie = () => {
    if (minuterie.current) clearTimeout(minuterie.current)
    minuterie.current = null
  }

  const numeroDe = (cible: EventTarget | null) => {
    const bouton = cible instanceof Element ? cible.closest<HTMLElement>('[data-numero]') : null
    return bouton && refGrille.current?.contains(bouton) ? Number(bouton.dataset.numero) : null
  }

  /** Commencer un geste sur un tome ; au doigt, l'appui long s'arme. */
  function commencer(numero: number, x: number, y: number, souris: boolean) {
    ignorerJusqua.current = 0
    arreterMinuterie()
    geste.current = { x, y, depart: numero, avant: new Set(derniers.current.selection), souris, mode: 'indecis', long: false }
    if (souris) return
    setAppui(numero)
    minuterie.current = setTimeout(() => {
      const g = geste.current
      if (!g || g.mode !== 'indecis') return
      g.long = true
      setAppui(null)
      derniers.current.ouvrirDetails(numero)
    }, DUREE_APPUI_LONG)
  }

  /** Suivre le doigt ou la souris ; rend vrai quand la page ne doit pas défiler. */
  function suivre(x: number, y: number): boolean {
    const g = geste.current
    if (!g) return false
    if (g.long) return true
    if (g.mode === 'indecis') {
      const dx = x - g.x
      const dy = y - g.y
      // Tant que le geste n'est pas décidé, la page ne défile pas s'il penche vers l'horizontale.
      if (Math.hypot(dx, dy) < SEUIL_GLISSEMENT) return !g.souris && Math.abs(dx) > Math.abs(dy)
      arreterMinuterie()
      setAppui(null)
      if (!g.souris && Math.abs(dx) < Math.abs(dy)) {
        g.mode = 'defilement'
        return false
      }
      g.mode = 'selection'
      setEnCours(true)
    }
    if (g.mode !== 'selection') return false
    const courant = numeroDe(document.elementFromPoint(x, y))
    if (courant !== null && courant !== g.courant) {
      g.courant = courant
      const { numeros: liste, setSelection: choisir } = derniers.current
      choisir(selectionGlissee(liste, g.avant, g.depart, courant))
    }
    return true
  }

  /** Fin du geste ; rend vrai quand le clic qui suit doit être ignoré. */
  function finir(): boolean {
    const g = geste.current
    arreterMinuterie()
    setAppui(null)
    setEnCours(false)
    geste.current = null
    if (!g) return false
    if (g.mode === 'selection') derniers.current.poserAncre(g.depart)
    const ignorer = g.mode === 'selection' || g.long
    if (ignorer) ignorerJusqua.current = performance.now() + 600
    return ignorer
  }

  // Au doigt : les événements tactiles, non passifs pour pouvoir empêcher le défilement.
  useEffect(() => {
    const grille = refGrille.current
    if (!grille) return
    const surDebut = (e: TouchEvent) => {
      const numero = numeroDe(e.target)
      if (e.touches.length !== 1 || numero === null) {
        if (geste.current && !geste.current.souris) finir()
        return
      }
      commencer(numero, e.touches[0].clientX, e.touches[0].clientY, false)
    }
    const surMouvement = (e: TouchEvent) => {
      if (!geste.current || geste.current.souris || e.touches.length !== 1) return
      if (suivre(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault()
    }
    const surFin = (e: TouchEvent) => {
      if (!geste.current || geste.current.souris) return
      // Après un glissement ou un appui long, le doigt levé ne devient pas un clic.
      if (finir() && e.cancelable) e.preventDefault()
    }
    const surAnnulation = () => {
      if (geste.current && !geste.current.souris) finir()
    }
    // Si la page défile quand même, l'appui n'est plus immobile : l'appui long est annulé.
    const surDefilement = () => {
      const g = geste.current
      if (g && !g.souris && g.mode === 'indecis') {
        arreterMinuterie()
        setAppui(null)
        g.mode = 'defilement'
      }
    }
    grille.addEventListener('touchstart', surDebut, { passive: true })
    grille.addEventListener('touchmove', surMouvement, { passive: false })
    grille.addEventListener('touchend', surFin, { passive: false })
    grille.addEventListener('touchcancel', surAnnulation)
    window.addEventListener('scroll', surDefilement, { passive: true })
    return () => {
      grille.removeEventListener('touchstart', surDebut)
      grille.removeEventListener('touchmove', surMouvement)
      grille.removeEventListener('touchend', surFin)
      grille.removeEventListener('touchcancel', surAnnulation)
      window.removeEventListener('scroll', surDefilement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => arreterMinuterie, [])

  // À la souris : les événements de pointeur. Ceux d'un doigt ou d'un stylet sont laissés aux
  // événements tactiles ci-dessus (Safari les envoie aussi, mais pas jusqu'au bout d'un geste).
  function surPointeurDebut(e: EvenementPointeur<HTMLUListElement>) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const numero = numeroDe(e.target)
    if (numero === null) return
    commencer(numero, e.clientX, e.clientY, true)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Pointeur déjà relâché : rien à garder.
    }
  }

  function surPointeurMouvement(e: EvenementPointeur<HTMLUListElement>) {
    if (e.pointerType !== 'mouse' || !geste.current?.souris) return
    suivre(e.clientX, e.clientY)
  }

  function surPointeurFin(e: EvenementPointeur<HTMLUListElement>) {
    if (e.pointerType !== 'mouse' || !geste.current?.souris) return
    finir()
  }

  function surMenuContextuel(e: EvenementSouris<HTMLUListElement>) {
    // Ni menu « Copier / Chercher », ni menu du navigateur sur la grille.
    e.preventDefault()
    const numero = numeroDe(e.target)
    if (numero === null || (geste.current && !geste.current.souris)) return
    derniers.current.ouvrirDetails(numero)
  }

  return {
    refGrille,
    appui,
    enCours,
    surPointeurDebut,
    surPointeurMouvement,
    surPointeurFin,
    surMenuContextuel,
    /** Vrai si le clic vient d'un glissement ou d'un appui long : il ne change rien. */
    clicAIgnorer: () => {
      const oui = performance.now() < ignorerJusqua.current
      ignorerJusqua.current = 0
      return oui
    },
  }
}

/** Une rangée de choix en contrôle segmenté : une seule pilule, des segments séparés par un filet. */
function Segments({
  nom,
  options,
  actuel,
  enLigne,
  appliquer,
}: {
  nom: string
  options: ChoixTomes[]
  /** La valeur commune à tous les tomes sélectionnés, ou null s'ils sont mélangés. */
  actuel: string | null
  enLigne: boolean
  appliquer: (choix: ChoixTomes) => void
}) {
  return (
    <div role="group" aria-label={nom} className="flex rounded-pilule border border-bordure bg-fond">
      {options.map((choix, i) => {
        const choisi = choix.valeur === actuel
        return (
          <button
            key={choix.valeur}
            type="button"
            data-etat={choisi ? 'actuel' : 'libre'}
            aria-disabled={!enLigne || undefined}
            onClick={() => appliquer(choix)}
            // Le choix actuel a le style des bulles actives de l'appli (fond d'accent, texte sur accent).
            className={`flex min-h-11 flex-auto cursor-pointer items-center justify-center gap-1 px-2 text-[0.875rem] whitespace-nowrap transition-colors duration-150 first:rounded-l-pilule last:rounded-r-pilule focus-visible:outline-offset-[-3px] aria-disabled:cursor-default aria-disabled:opacity-50 ${
              choisi ? 'bg-accent font-bold text-sur-accent' : 'font-semibold text-encre active:bg-accent-doux aria-disabled:active:bg-transparent'
            } ${i > 0 ? (choisi ? 'border-l border-accent' : 'border-l border-bordure') : ''}`}
          >
            <IconeChoix choix={choix} />
            {choix.type === 'possession'
              ? BULLES_POSSESSION.find((p) => p.valeur === choix.valeur)!.libelle
              : BULLES_LECTURE.find((l) => l.valeur === choix.valeur)!.libelle}
            {choisi && <span className="sr-only">, choisi</span>}
          </button>
        )
      })}
    </div>
  )
}

const CHOIX_POSSESSION: ChoixTomes[] = BULLES_POSSESSION.map((p) => ({ type: 'possession', valeur: p.valeur }))
const CHOIX_LECTURE: ChoixTomes[] = BULLES_LECTURE.map((l) => ({ type: 'lecture', valeur: l.valeur }))

/**
 * Le menu de sélection, compact pour laisser voir la grille : le nombre de tomes sélectionnés,
 * « Tout sélectionner » et la croix qui annule la sélection ; puis la possession et la lecture,
 * chacune sur une ligne, le choix actuel mis en avant quand tous les tomes sélectionnés le partagent.
 * Après un choix, la sélection reste : le message « 6 tomes : Je l'ai · Annuler » s'affiche en haut du menu.
 */
function MenuTomes({
  refMenu,
  selection,
  tous,
  possessionActuelle,
  lectureActuelle,
  enLigne,
  appliquer,
  toutSelectionner,
  vider,
  message,
  effacerMessage,
}: {
  refMenu: React.RefObject<HTMLDivElement | null>
  selection: Set<number>
  tous: boolean
  possessionActuelle: string | null
  lectureActuelle: string | null
  enLigne: boolean
  appliquer: (choix: ChoixTomes) => void
  toutSelectionner: () => void
  vider: () => void
  message: Message | null
  effacerMessage: () => void
}) {
  const ouvert = selection.size > 0
  const refPanneau = useRef<HTMLDivElement>(null)
  // La première annonce dit où sont les actions ; les suivantes, seulement le nombre. Le texte ne
  // change qu'avec le nombre de tomes sélectionnés (un nouveau rendu ne le refait pas).
  const annonce = useRef({ taille: 0, texte: '' })
  if (annonce.current.taille !== selection.size) {
    const apparition = annonce.current.taille === 0
    annonce.current = {
      taille: selection.size,
      texte: selection.size === 0 ? '' : `${texteSelection(selection.size)}${apparition ? '. Actions en bas de l’écran.' : ''}`,
    }
  }

  // La page garde assez de place en bas pour que le menu ne cache jamais la fin de la fiche.
  useEffect(() => {
    const panneau = refPanneau.current
    const racine = document.documentElement
    if (!panneau || !ouvert) return
    const mesurer = () => racine.style.setProperty('--place-barre', `${panneau.offsetHeight}px`)
    mesurer()
    const observateur = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(mesurer)
    observateur?.observe(panneau)
    return () => {
      observateur?.disconnect()
      racine.style.removeProperty('--place-barre')
    }
  }, [ouvert])

  return (
    // Sans sélection, la barre du bas de l'iPhone est revenue : le message se pose juste au-dessus d'elle.
    <div
      className={`fixed z-30 flex flex-col items-stretch gap-2.5 left-[calc(env(safe-area-inset-left)+1rem)] right-[calc(env(safe-area-inset-right)+1rem)] tablette:right-[max(2.5rem,env(safe-area-inset-right))] tablette:left-[calc(env(safe-area-inset-left)+18.5rem)] tablette:bottom-[max(env(safe-area-inset-bottom),1rem)] ${
        'bottom-[max(env(safe-area-inset-bottom),1rem)]'
      }`}
    >
      <div ref={refMenu} className="flex flex-col items-stretch gap-2.5 tablette:mx-auto tablette:w-full tablette:max-w-[26rem]">
        <p role="status" className="sr-only">
          {annonce.current.texte}
        </p>
        <div
          ref={refPanneau}
          role="region"
          aria-label="Actions sur les tomes sélectionnés"
          data-etat={ouvert ? 'ouvert' : 'ferme'}
          hidden={!ouvert}
          className="flex max-h-[calc(100dvh-env(safe-area-inset-top)-2rem)] flex-col gap-2 overflow-y-auto overscroll-contain rounded-panneau border border-bordure bg-surface p-2.5 shadow-forte [&[hidden]]:hidden"
        >
          {ouvert && (
            <>
              {/* Le message se loge dans le menu, en haut : il ne recouvre ni la grille, ni la légende, ni les choix. */}
              <MessageTemporaire message={message} effacer={effacerMessage} />
              <div className="flex items-center gap-1.5">
                <p className="m-0 min-w-0 flex-1 truncate pl-1.5 text-[0.875rem] font-bold" aria-hidden="true">
                  {texteSelection(selection.size)}
                </p>
                {!tous && (
                  <button
                    type="button"
                    onClick={toutSelectionner}
                    className="flex min-h-11 shrink-0 cursor-pointer items-center rounded-pilule border border-bordure bg-fond px-3 text-[0.8125rem] font-semibold whitespace-nowrap text-encre transition-transform duration-200 active:scale-[0.97]"
                  >
                    Tout sélectionner
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Annuler la sélection"
                  onClick={vider}
                  className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pilule border border-bordure bg-fond text-encre transition-transform duration-200 active:scale-[0.97]"
                >
                  <IconeFermer taille={18} />
                </button>
              </div>
              <Segments nom="Possession" options={CHOIX_POSSESSION} actuel={possessionActuelle} enLigne={enLigne} appliquer={appliquer} />
              <Segments nom="Lecture" options={CHOIX_LECTURE} actuel={lectureActuelle} enLigne={enLigne} appliquer={appliquer} />
              {!enLigne && <p className="m-0 px-1.5 text-sm text-discret">Hors connexion : les tomes pourront changer au retour du réseau.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Les détails d'un tome : sa couverture, son état, son ISBN, « Je l'ai acheté », sa photo. */
function PanneauTome({
  tome,
  oeuvre,
  titre,
  enLigne,
  fermer,
  acheter,
}: {
  tome: Tome | null
  oeuvre: string
  titre: string
  enLigne: boolean
  fermer: () => void
  acheter: (numero: number) => void
}) {
  return (
    <Feuille ouvert={tome !== null} titre={tome ? `Tome ${tome.numero}` : ''} sousTitre={tome?.titre ?? undefined} fermer={fermer}>
      {tome && (
        <div className="flex flex-col gap-6">
          {tome.couverture && (
            <Couverture titre={titre} graine={`${titre}-${tome.numero}`} chemin={tome.couverture} className="w-28 self-center" />
          )}
          <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-2 text-[0.9375rem]">
            <dt className="text-discret">Possession</dt>
            <dd className="m-0 flex items-center gap-1.5">
              <IconePossession possession={tome.possession} />
              {POSSESSIONS.find((p) => p.valeur === tome.possession)?.libelle}
            </dd>
            <dt className="text-discret">Lecture</dt>
            <dd className="m-0">{LECTURES_TOME.find((l) => l.valeur === tome.lecture)?.libelle}</dd>
            {tome.isbn && (
              <>
                <dt className="text-discret">ISBN</dt>
                <dd className="m-0 [overflow-wrap:anywhere]">
                  <Isbn valeur={tome.isbn} />
                </dd>
              </>
            )}
          </dl>
          {/* Mon exemplaire : son ISBN quand je l'achète, et sa photo, la voie sûre pour la couverture d'un tome. */}
          <ActionsFeuille>
            {tome.possession !== 'possede' && (
              <Bouton variante="secondaire" aria-haspopup="dialog" occupe={!enLigne} onClick={() => acheter(tome.numero)}>
                Je l’ai acheté
              </Bouton>
            )}
            <ChoisirImage oeuvre={oeuvre} cible={{ type: 'tome', numero: tome.numero }} enLigne={enLigne} />
          </ActionsFeuille>
          {!enLigne && <p className="m-0 text-sm text-discret">Hors connexion : ce tome pourra changer au retour du réseau.</p>}
        </div>
      )}
    </Feuille>
  )
}
