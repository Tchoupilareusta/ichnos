import { useCallback, useEffect, useRef, useState, type PointerEvent as EvenementPointeur } from 'react'
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
import { IconeCoche, IconeSignet } from '../composants/Icones'
import { IconePossession } from '../composants/IconesLecture'
import { Isbn } from '../composants/Isbn'
import { MessageTemporaire, type Message } from '../composants/MessageTemporaire'
import { LIEN_ACTION, Section } from '../composants/Section'
import { ChoisirImage } from '../couvertures/ChoisirImage'
import { Couverture } from '../couvertures/Couverture'
import { useMasquerBarreDuBas } from '../navigation/saisie'

type Modifier = ReturnType<typeof useModifierOeuvre>

export const ANCRE_TOMES = 'mes-tomes'

/** Sans bouger pendant ce temps, un appui sur un tome ouvre ses détails. */
export const DUREE_APPUI_LONG = 500
/** Distance (en points) au-delà de laquelle un appui devient un glissement. */
const SEUIL_GLISSEMENT = 8

/** Le remplissage du cercle dit la possession : plein, pointillé, vide. */
const STYLE_TOME: Record<Possession, string> = {
  possede: 'border border-accent bg-accent font-bold text-sur-accent',
  a_acheter: 'border-2 border-dashed border-accent-texte bg-surface font-bold text-accent-texte',
  non_possede: 'border border-bordure bg-transparent font-semibold text-discret',
}

const PASTILLE_LECTURE = 'flex size-[1.125rem] items-center justify-center rounded-full border border-bordure bg-surface text-accent-texte'

/** La marque de lecture d'un tome, posée dans son coin : une coche s'il est lu, un signet s'il est en cours. */
function MarqueLecture({ lecture, dansLaLegende = false }: { lecture: LectureTome; dansLaLegende?: boolean }) {
  if (lecture === 'a_lire') return null
  return (
    <span aria-hidden="true" className={`${PASTILLE_LECTURE} ${dansLaLegende ? '' : 'pointer-events-none absolute -top-1.5 -right-1.5'}`}>
      {lecture === 'lu' ? <IconeCoche taille={12} /> : <IconeSignet taille={10} />}
    </span>
  )
}

const MESSAGES_ECHEC: Record<string, string> = {
  reseau: 'Pas de connexion à internet : rien n’a changé.',
  introuvable: 'Ces tomes ne sont plus dans la bibliothèque : rien n’a changé.',
}
const texteEchec = (erreur: EchecDepot) => MESSAGES_ECHEC[erreur.echec] ?? 'Ce changement n’a pas pu être enregistré : rien n’a changé.'

/**
 * « Mes tomes » : sélectionner d'abord, puis appliquer (comme Photos). Toucher un tome le
 * sélectionne ou le désélectionne ; glisser le doigt en sélectionne plusieurs ; un appui long
 * ouvre ses détails. Dès qu'un tome est sélectionné, la barre d'actions remplace la barre du bas.
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

  useMasquerBarreDuBas(selection.size > 0)

  // Un tome retiré (depuis « Modifier ») quitte la sélection.
  const cleNumeros = numeros.join(',')
  useEffect(() => {
    setSelection((avant) => {
      const restants = [...avant].filter((n) => numeros.includes(n))
      return restants.length === avant.size ? avant : new Set(restants)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleNumeros])

  const vider = useCallback(() => setSelection(new Set()), [])

  // Échap vide la sélection (clavier de l'iPad), sauf si un panneau ouvert la réclame.
  useEffect(() => {
    if (selection.size === 0) return
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('dialog[open]')) return
      vider()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [selection.size, vider])

  const effacerMessage = useCallback(() => setMessage(null), [])

  function signaler(texte: string, annuler?: () => void) {
    setMessage({ cle: Date.now(), texte, annuler, nomAnnuler: annuler ? `Annuler : ${texte}` : undefined })
  }

  function executer(choix: ChoixTomes, { changements, annulation }: ReturnType<typeof preparerChangement>) {
    const texte = texteApplique(changements.length, choix)
    modifier.tomes.mutate(changements, { onError: (erreur) => signaler(texteEchec(erreur)) })
    signaler(texte, () => modifier.tomes.mutate(annulation, { onError: (erreur) => signaler(texteEchec(erreur)) }))
    vider()
    // La barre disparaît avec la sélection : le focus revient sur la section, et le message est annoncé.
    refSection.current?.closest('section')?.focus({ preventScroll: true })
  }

  function appliquer(choix: ChoixTomes) {
    if (!enLigne || selection.size === 0) return
    const preparation = preparerChangement(tomes, selection, choix)
    if (preparation.changements.length === 0) return signaler(texteRienAChanger(selection.size, choix))
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

  const gestes = useGestesGrille({ numeros, selection, setSelection, ouvrirDetails: setDetails, poserAncre: setAncre })
  const tomeDetaille = tomes.find((t) => t.numero === details) ?? null
  const tous = selection.size === tomes.length

  return (
    <Section
      titre="Mes tomes"
      ancre={ANCRE_TOMES}
      complement={
        selection.size === 0 && (
          <button type="button" onClick={() => setSelection(new Set(numeros))} className={LIEN_ACTION}>
            Tout sélectionner
          </button>
        )
      }
    >
      <div ref={refSection} className="flex flex-col gap-3">
        <Legende />
        {/* Toujours affichée : la faire disparaître à la première sélection ferait remonter la grille sous le doigt. */}
        <p id="aide-tomes" className="m-0 text-sm text-discret">
          Toucher les tomes à changer, ou glisser le doigt dessus. Appui long : les détails d’un tome.
        </p>
        <ul
          ref={gestes.refGrille}
          aria-label={`Tomes de ${titre}`}
          aria-describedby="aide-tomes"
          onPointerDown={gestes.surDebut}
          onPointerMove={gestes.surMouvement}
          onPointerUp={gestes.surFin}
          onPointerCancel={gestes.surFin}
          onContextMenu={gestes.surMenuContextuel}
          className="m-0 grid touch-pan-y list-none grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-3 p-0 pt-2 select-none [-webkit-touch-callout:none]"
        >
          {tomes.map((tome) => {
            const choisi = selection.has(tome.numero)
            const appuye = gestes.appui === tome.numero
            return (
              <li key={tome.numero} className="relative flex">
                <button
                  type="button"
                  data-numero={tome.numero}
                  data-etat={choisi ? 'selectionne' : 'libre'}
                  aria-pressed={choisi}
                  aria-label={`Tome ${tome.numero}${tome.titre ? `, ${tome.titre}` : ''}, ${libelleLectureTome(tome.lecture).toLocaleLowerCase('fr')}, ${libellePossession(tome.possession).toLocaleLowerCase('fr')}`}
                  onClick={(e) => {
                    if (gestes.clicAIgnorer()) return
                    basculer(tome.numero, e.shiftKey)
                  }}
                  className={`flex h-11 w-full min-w-11 cursor-pointer items-center justify-center rounded-pilule text-[0.9375rem] tabular-nums ring-offset-2 ring-offset-fond select-none focus-visible:outline-offset-[7px] [-webkit-touch-callout:none] data-[etat=selectionne]:ring-3 data-[etat=selectionne]:ring-anneau ${STYLE_TOME[tome.possession]} ${
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
      </div>

      <BarreTomes
        selection={selection}
        tous={tous}
        enLigne={enLigne}
        appliquer={appliquer}
        toutSelectionner={() => setSelection(new Set(numeros))}
        vider={vider}
        ouvrirDetails={() => setDetails([...selection][0])}
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

/** La légende, en deux lignes : la possession (le cercle), puis la lecture (la marque). */
function Legende() {
  const element = 'flex items-center gap-1.5 whitespace-nowrap'
  return (
    <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5 text-sm text-discret">
      <dt className="font-semibold text-encre">Possession</dt>
      <dd className="m-0 flex flex-wrap gap-x-3 gap-y-1">
        {POSSESSIONS.map((p) => (
          <span key={p.valeur} className={element}>
            <span aria-hidden="true" className={`inline-block size-3.5 shrink-0 rounded-full ${STYLE_TOME[p.valeur]}`} />
            {p.libelle}
          </span>
        ))}
      </dd>
      <dt className="font-semibold text-encre">Lecture</dt>
      <dd className="m-0 flex flex-wrap gap-x-3 gap-y-1">
        {(['lu', 'en_cours'] as const).map((lecture) => (
          <span key={lecture} className={element}>
            <MarqueLecture lecture={lecture} dansLaLegende />
            {libelleLectureTome(lecture)}
          </span>
        ))}
        <span className={element}>À lire : rien</span>
      </dd>
    </dl>
  )
}

/**
 * Les gestes sur la grille, distingués du défilement de la page :
 *  · un toucher sans bouger (le « clic ») sélectionne ou désélectionne le tome ;
 *  · un glissement parti d'un tome, d'abord plutôt horizontal (sur les 8 premiers points),
 *    sélectionne tous les tomes parcourus, comme dans Photos ; plutôt vertical, la page défile ;
 *  · avec une souris, tout glissement sélectionne (rien à faire défiler) ;
 *  · un appui d'une demi-seconde sans bouger ouvre les détails du tome (au doigt), comme le clic
 *    droit (à la souris), sans changer la sélection.
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
    id: number
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

  const arreterMinuterie = () => {
    if (minuterie.current) clearTimeout(minuterie.current)
    minuterie.current = null
  }

  // Pendant une sélection au doigt, la page ne défile pas ; après un appui long, le toucher qui
  // se termine ne devient pas un clic (il fermerait le panneau qui vient de s'ouvrir).
  useEffect(() => {
    const grille = refGrille.current
    if (!grille) return
    const surMouvement = (e: TouchEvent) => {
      if (geste.current?.mode === 'selection') e.preventDefault()
    }
    const surFin = (e: TouchEvent) => {
      if (geste.current?.long || geste.current?.mode === 'selection') e.preventDefault()
    }
    grille.addEventListener('touchmove', surMouvement, { passive: false })
    grille.addEventListener('touchend', surFin, { passive: false })
    return () => {
      grille.removeEventListener('touchmove', surMouvement)
      grille.removeEventListener('touchend', surFin)
    }
  }, [])

  useEffect(() => arreterMinuterie, [])

  const numeroDe = (cible: EventTarget | null) => {
    const bouton = cible instanceof Element ? cible.closest<HTMLElement>('[data-numero]') : null
    return bouton && refGrille.current?.contains(bouton) ? Number(bouton.dataset.numero) : null
  }

  function surDebut(e: EvenementPointeur<HTMLUListElement>) {
    const souris = e.pointerType === 'mouse'
    if (souris && e.button !== 0) return
    const numero = numeroDe(e.target)
    if (numero === null) return
    // Un nouveau toucher : le clic d'un geste précédent ne peut plus arriver.
    ignorerJusqua.current = 0
    geste.current = { id: e.pointerId, x: e.clientX, y: e.clientY, depart: numero, avant: new Set(selection), souris, mode: 'indecis', long: false }
    if (souris) return
    setAppui(numero)
    arreterMinuterie()
    minuterie.current = setTimeout(() => {
      const g = geste.current
      if (!g || g.mode !== 'indecis') return
      g.long = true
      setAppui(null)
      ouvrirDetails(numero)
    }, DUREE_APPUI_LONG)
  }

  function surMouvement(e: EvenementPointeur<HTMLUListElement>) {
    const g = geste.current
    if (!g || e.pointerId !== g.id || g.long) return
    if (g.mode === 'indecis') {
      const dx = e.clientX - g.x
      const dy = e.clientY - g.y
      if (Math.hypot(dx, dy) < SEUIL_GLISSEMENT) return
      arreterMinuterie()
      setAppui(null)
      if (g.souris || Math.abs(dx) >= Math.abs(dy)) {
        g.mode = 'selection'
        // À la souris, la grille garde le pointeur même s'il en sort un instant.
        if (g.souris) {
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            // Pointeur déjà relâché : rien à garder.
          }
        }
      } else {
        g.mode = 'defilement'
        return
      }
    }
    if (g.mode !== 'selection') return
    const sous = document.elementFromPoint(e.clientX, e.clientY)
    const courant = numeroDe(sous)
    if (courant === null || courant === g.courant) return
    g.courant = courant
    setSelection(selectionGlissee(numeros, g.avant, g.depart, courant))
  }

  function surFin(e: EvenementPointeur<HTMLUListElement>) {
    const g = geste.current
    if (!g || e.pointerId !== g.id) return
    arreterMinuterie()
    setAppui(null)
    if (g.mode === 'selection') poserAncre(g.depart)
    if (g.mode === 'selection' || g.long) ignorerJusqua.current = performance.now() + 600
    // Le clic qui suit le geste est ignoré ; le geste lui-même est oublié juste après.
    setTimeout(() => {
      if (geste.current === g) geste.current = null
    }, 0)
  }

  function surMenuContextuel(e: React.MouseEvent<HTMLUListElement>) {
    // Ni menu « Copier / Chercher », ni menu du navigateur sur la grille.
    e.preventDefault()
    const numero = numeroDe(e.target)
    if (numero === null || geste.current?.long) return
    ouvrirDetails(numero)
  }

  return {
    refGrille,
    appui,
    surDebut,
    surMouvement,
    surFin,
    surMenuContextuel,
    /** Vrai si le clic vient d'un glissement ou d'un appui long : il ne change rien. */
    clicAIgnorer: () => {
      const oui = performance.now() < ignorerJusqua.current
      ignorerJusqua.current = 0
      return oui
    },
  }
}

/**
 * La barre d'actions : le nombre de tomes sélectionnés, les bulles Possession et Lecture, les
 * détails d'un tome, « Tout sélectionner » et « Annuler la sélection ». Juste au-dessus, le
 * message temporaire « 4 tomes marqués « Je l’ai » · Annuler ».
 */
function BarreTomes({
  selection,
  tous,
  enLigne,
  appliquer,
  toutSelectionner,
  vider,
  ouvrirDetails,
  message,
  effacerMessage,
}: {
  selection: Set<number>
  tous: boolean
  enLigne: boolean
  appliquer: (choix: ChoixTomes) => void
  toutSelectionner: () => void
  vider: () => void
  ouvrirDetails: () => void
  message: Message | null
  effacerMessage: () => void
}) {
  const ouverte = selection.size > 0
  const refBarre = useRef<HTMLDivElement>(null)
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

  // La page garde assez de place en bas pour que la barre ne cache jamais la fin de la fiche.
  useEffect(() => {
    const barre = refBarre.current
    const racine = document.documentElement
    if (!barre || !ouverte) return
    const mesurer = () => racine.style.setProperty('--place-barre', `${barre.offsetHeight}px`)
    mesurer()
    const observateur = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(mesurer)
    observateur?.observe(barre)
    return () => {
      observateur?.disconnect()
      racine.style.removeProperty('--place-barre')
    }
  }, [ouverte])

  const bulle =
    'flex min-h-11 cursor-pointer items-center gap-1 rounded-pilule border border-bordure bg-fond px-3 text-[0.875rem] font-semibold text-encre transition-transform duration-200 active:scale-[0.97] aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:active:scale-100'
  const titreGroupe = 'm-0 text-[0.8125rem] font-bold tracking-wide text-discret'

  return (
    // Sans sélection, la barre du bas de l'iPhone est revenue : le message se pose juste au-dessus d'elle.
    <div
      className={`fixed z-30 flex flex-col items-stretch gap-2.5 left-[calc(env(safe-area-inset-left)+1rem)] right-[calc(env(safe-area-inset-right)+1rem)] tablette:right-[max(2.5rem,env(safe-area-inset-right))] tablette:left-[calc(env(safe-area-inset-left)+18.5rem)] tablette:bottom-[max(env(safe-area-inset-bottom),1rem)] ${
        ouverte ? 'bottom-[max(env(safe-area-inset-bottom),1rem)]' : 'bottom-[calc(max(env(safe-area-inset-bottom),1rem)+min(4.5rem,80px)+0.625rem)]'
      }`}
    >
      <div className="flex flex-col items-stretch gap-2.5 tablette:mx-auto tablette:w-full tablette:max-w-[28rem]">
        <MessageTemporaire message={message} effacer={effacerMessage} />
        <p role="status" className="sr-only">
          {annonce.current.texte}
        </p>
        <div
          ref={refBarre}
          role="region"
          aria-label="Actions sur les tomes sélectionnés"
          data-etat={ouverte ? 'ouvert' : 'ferme'}
          hidden={!ouverte}
          className="flex max-h-[calc(100dvh-env(safe-area-inset-top)-2rem)] flex-col gap-3 overflow-y-auto overscroll-contain rounded-panneau border border-bordure bg-surface p-3.5 shadow-forte [&[hidden]]:hidden"
        >
          {ouverte && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-x-3">
                <p className="m-0 text-[1.0625rem] font-bold" aria-hidden="true">
                  {texteSelection(selection.size)}
                </p>
                {!tous && (
                  <button type="button" onClick={toutSelectionner} className={LIEN_ACTION}>
                    Tout sélectionner
                  </button>
                )}
              </div>

              <div role="group" aria-labelledby="groupe-possession" className="flex flex-col gap-1.5">
                <p id="groupe-possession" className={titreGroupe}>
                  Possession
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {BULLES_POSSESSION.map((p) => (
                    <button
                      key={p.valeur}
                      type="button"
                      aria-disabled={!enLigne || undefined}
                      onClick={() => appliquer({ type: 'possession', valeur: p.valeur })}
                      className={bulle}
                    >
                      <IconePossession possession={p.valeur} />
                      {p.libelle}
                    </button>
                  ))}
                </div>
              </div>

              <div role="group" aria-labelledby="groupe-lecture" className="flex flex-col gap-1.5">
                <p id="groupe-lecture" className={titreGroupe}>
                  Lecture
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {BULLES_LECTURE.map((l) => (
                    <button
                      key={l.valeur}
                      type="button"
                      aria-disabled={!enLigne || undefined}
                      onClick={() => appliquer({ type: 'lecture', valeur: l.valeur })}
                      className={bulle}
                    >
                      {l.valeur === 'lu' && <IconeCoche taille={16} />}
                      {l.valeur === 'en_cours' && <IconeSignet taille={15} />}
                      {l.libelle}
                    </button>
                  ))}
                </div>
              </div>

              {!enLigne && (
                <p className="m-0 text-sm text-discret">Hors connexion : les tomes pourront changer au retour du réseau.</p>
              )}

              <div className="flex flex-wrap gap-2">
                {selection.size === 1 && (
                  <Bouton variante="secondaire" aria-haspopup="dialog" onClick={ouvrirDetails} className="flex-1 basis-auto px-4 whitespace-nowrap">
                    Détails du tome
                  </Bouton>
                )}
                <Bouton variante="secondaire" onClick={vider} className="flex-1 basis-auto px-4 whitespace-nowrap">
                  Annuler la sélection
                </Bouton>
              </div>
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
