import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useIdees, useIdeesDeCote, useModifierOeuvre } from '../bibliotheque/requetes'
import { Bouton } from '../composants/Bouton'
import { CarteIdee } from '../composants/CarteIdee'
import { Dialogue } from '../composants/Dialogue'
import { IconeChevronBas } from '../composants/Icones'
import { IconeStatut } from '../composants/IconesLecture'
import { Menu } from '../composants/Menu'
import { MessageTemporaire, type Message } from '../composants/MessageTemporaire'
import { BoutonPrincipal, EtatVide, Page, TitrePage } from '../composants/Page'
import { LIENS } from '../navigation/routes'
import { useEnLigne } from '../navigation/useEnLigne'
import { useRoute } from '../navigation/useRoute'
import { useMasquerBarreDuBas } from '../navigation/saisie'
import { graineDuJour } from '../recommandations/hasard'
import { ENVIES, estEnvie, libelleEnvie, type Envie } from '../recommandations/modele'
import { messageDe, messagePeu, proposer, type Proposition, type Resultat } from '../recommandations/proposer'

// Écran Découvrir (docs/reference.md §5 et §7) : « Mon envie du moment », trois idées expliquées,
// « Pas maintenant » (avec « Annuler »), « Commencer » (avec une confirmation), « D'autres idées ».
// Aucun chiffre, aucun score. L'envie est portée par l'adresse (#/decouvrir?envie=reconfortant) :
// changer d'envie remonte l'écran, et les idées vues repartent de zéro.

/** Après un changement d'envie, l'écran remonte : le focus revient sur le sélecteur, pas en haut de la page. */
let rendreLeFocusAuSelecteur = false

/** Une case de la page : une idée proposée, ou la ligne calme d'une idée que je viens de commencer. */
type Case = { id: string; proposition: Proposition; commencee: boolean }

export function Decouvrir() {
  const { parametres } = useRoute()
  const brute = parametres.get('envie')
  const envie: Envie = estEnvie(brute) ? brute : 'surprise'
  const requete = useIdees()
  const enLigne = useEnLigne()
  const { mettre, reprendre } = useIdeesDeCote()
  // L'heure est prise une fois, à l'ouverture : les idées ne changent pas sous le doigt.
  const [maintenant] = useState(() => new Date())
  const base = { envie, graine: graineDuJour(maintenant, envie), maintenant }
  // `vues` : les pages précédentes ; `page` : les identifiants affichés, gardés tels quels.
  const [vues, setVues] = useState<string[]>([])
  const [page, setPage] = useState<string[] | null>(null)
  const [commencees, setCommencees] = useState<Map<string, Proposition>>(() => new Map())
  const [message, setMessage] = useState<Message | null>(null)
  const effacerMessage = useCallback(() => setMessage(null), [])
  useMasquerBarreDuBas(message !== null)
  const [annonce, setAnnonce] = useState('')
  const annoncerLaPage = useRef(false)
  // L'idée à montrer et à qui donner le focus après « Pas maintenant » ou « Annuler ».
  const [aMontrer, setAMontrer] = useState<{ id: string | null } | null>(null)
  const refMessage = useRef<HTMLDivElement>(null)
  // La phrase de chaque carte est gardée telle qu'à son arrivée : commencer une idée (qui devient
  // une « dernière lecture ») ne réécrit pas sous mes yeux la phrase des cartes voisines.
  const phrases = useRef(new Map<string, Pick<Proposition, 'phrase' | 'titres'>>())
  const idees = requete.data

  // La page affichée, recalculée à chaque relecture des données mais sans bouger.
  let resultat: Resultat | null = null
  let cases: Case[] = []
  let fraiche = false
  if (idees) {
    if (page && page.length > 0) {
      const r = proposer(idees, { ...base, imposees: page, completer: false, dejaVues: vues })
      resultat = r
      cases = page.flatMap((id): Case[] => {
        const commencee = commencees.get(id)
        if (commencee) return [{ id, proposition: commencee, commencee: true }]
        const proposition = r.propositions.find((p) => p.oeuvre.id === id)
        if (!proposition) return []
        if (!phrases.current.has(id)) phrases.current.set(id, { phrase: proposition.phrase, titres: proposition.titres })
        return [{ id, proposition: { ...proposition, ...phrases.current.get(id) }, commencee: false }]
      })
    }
    if (cases.length === 0) {
      fraiche = true
      resultat = proposer(idees, { ...base, dejaVues: vues })
      cases = resultat.propositions.map((p) => ({ id: p.oeuvre.id, proposition: p, commencee: false }))
    }
  }
  const affichees = cases.map((c) => c.id).join('|')

  // Une page neuve est retenue telle quelle : les relectures suivantes ne la changent plus.
  useEffect(() => {
    if (!fraiche || !idees) return
    const ids = affichees ? affichees.split('|') : []
    setPage(ids.length > 0 ? ids : null)
    if (annoncerLaPage.current && ids.length > 0) {
      annoncerLaPage.current = false
      setAnnonce(`${ids.length === 1 ? 'Nouvelle idée' : 'Nouvelles idées'} : ${cases.map((c) => c.proposition.oeuvre.titre).join(', ')}.`)
    }
  }, [fraiche, affichees, !!idees])

  useEffect(() => {
    if (!rendreLeFocusAuSelecteur) return
    rendreLeFocusAuSelecteur = false
    document.querySelector<HTMLButtonElement>('[data-selecteur-envie] button')?.focus({ preventScroll: true })
  }, [])

  // Tant que le message est là, la page garde assez de place en bas pour qu'il ne cache rien
  // durablement (la même variable que la barre d'actions des tomes).
  useLayoutEffect(() => {
    const cadre = refMessage.current?.firstElementChild?.firstElementChild
    if (!message || !cadre) return
    const racine = document.documentElement
    racine.style.setProperty('--place-barre', `${Math.max(0, window.innerHeight - cadre.getBoundingClientRect().top - 16)}px`)
    return () => {
      racine.style.removeProperty('--place-barre')
    }
  }, [message])

  // Après « Pas maintenant » ou « Annuler » : l'idée arrivée à cette place reçoit le focus et reste
  // visible au-dessus du message (défilement minimal, seulement si elle est dessous).
  useLayoutEffect(() => {
    if (!aMontrer) return
    const carte = aMontrer.id ? document.querySelector<HTMLElement>(`[data-idee="${aMontrer.id}"]`) : null
    // Après « Annuler », l'idée ne revient qu'une fois retirée des mises de côté : attendre ce rendu-là.
    if (aMontrer.id && !carte) return
    setAMontrer(null)
    const cible = carte?.querySelector<HTMLElement>('a') ?? refMessage.current?.querySelector<HTMLElement>('button')
    cible?.focus({ preventScroll: true })
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    carte?.scrollIntoView?.({ block: 'nearest', behavior: reduit ? 'auto' : 'smooth' })
  }, [aMontrer, affichees])

  function pasMaintenant(id: string) {
    if (!idees || !page) return
    const avant = { page, vues }
    const titre = cases.find((c) => c.id === id)?.proposition.oeuvre.titre ?? ''
    // L'idée suivante prend sa place ; rien de ce qui est affiché ne revient.
    const suite = proposer(idees, { ...base, imposees: page.filter((x) => x !== id), dejaVues: [...vues, ...page] })
    const nouvelle = suite.propositions.find((p) => !page.includes(p.oeuvre.id))?.oeuvre.id ?? null
    const apres = page.flatMap((x) => (x === id ? (nouvelle ? [nouvelle] : []) : [x]))
    if (apres.length > 0) setPage(apres)
    else {
      setVues([...vues, ...page])
      setPage(null)
    }
    setAMontrer({ id: nouvelle ?? apres[0] ?? null })
    setMessage({
      cle: Date.now(),
      texte: 'Idée mise de côté',
      nomAnnuler: `Annuler : reprendre ${titre}`,
      annuler: () => {
        reprendre.mutate(id)
        setVues(avant.vues)
        setPage(avant.page)
        setAMontrer({ id })
      },
    })
    mettre.mutate(
      { id, envie },
      {
        onError: () => {
          setVues(avant.vues)
          setPage(avant.page)
          setMessage({ cle: Date.now(), texte: 'L’idée n’a pas pu être mise de côté.' })
        },
      },
    )
  }

  function commencer(proposition: Proposition) {
    setCommencees((actuel) => new Map(actuel).set(proposition.oeuvre.id, proposition))
    setAnnonce(`${proposition.oeuvre.titre} : en cours.`)
  }

  function echecCommencer(proposition: Proposition) {
    setCommencees((actuel) => {
      const suivant = new Map(actuel)
      suivant.delete(proposition.oeuvre.id)
      return suivant
    })
    setMessage({ cle: Date.now(), texte: 'Le statut n’a pas pu changer.' })
  }

  function autresIdees() {
    if (!resultat) return
    setMessage(null)
    setCommencees(new Map())
    phrases.current.clear()
    annoncerLaPage.current = true
    if (resultat.suite === 'debut') setVues([])
    else setVues([...vues, ...cases.map((c) => c.id)])
    setPage(null)
  }

  let messagePage: string | null = null
  if (resultat) {
    if (cases.length === 0) messagePage = messageDe(resultat)
    else if (resultat.suite === 'debut') messagePage = messageDe({ ...resultat, situation: 'tout_vu' })
    else if (resultat.suite === null && cases.length < 3) messagePage = messagePeu(cases.length)
  }
  const boutonSuite = resultat?.suite === 'debut' ? 'Revoir depuis le début' : 'D’autres idées'

  return (
    <Page>
      <TitrePage>Découvrir</TitrePage>
      <section aria-labelledby="envie" className="flex flex-col gap-6">
        <div className="flex max-w-xl flex-col gap-3">
          <h2 id="envie" className="m-0 font-texte text-[0.9375rem] font-bold text-discret">
            Mon envie du moment
          </h2>
          <SelecteurEnvie envie={envie} />
        </div>

        {requete.isPending && (
          <p role="status" className="m-0 text-discret">
            Chargement des idées…
          </p>
        )}

        {requete.isError && !idees && (
          <EtatVide
            action={
              <Bouton variante="secondaire" onClick={() => void requete.refetch()}>
                Réessayer
              </Bouton>
            }
          >
            <span role="alert">
              {requete.error.echec === 'reseau'
                ? 'Pas de connexion à internet : les idées s’afficheront au retour du réseau.'
                : 'Les idées n’ont pas pu s’afficher. Réessayer dans un instant.'}
            </span>
          </EtatVide>
        )}

        {resultat && cases.length === 0 && messagePage && (
          <EtatVide
            action={
              resultat.situation === 'rien_a_decouvrir' ? (
                <BoutonPrincipal href={LIENS.ajouter}>Ajouter une œuvre</BoutonPrincipal>
              ) : resultat.suite ? (
                <Bouton variante="secondaire" onClick={autresIdees}>
                  {boutonSuite}
                </Bouton>
              ) : undefined
            }
          >
            {messagePage}
          </EtatVide>
        )}

        {cases.length > 0 && (
          <>
            <div className="@container/idees">
              <ul aria-label="Idées de lecture" className="m-0 grid list-none gap-4 p-0 @3xl/idees:grid-cols-3">
                {cases.map((c) => (
                  <li key={c.id} data-idee={c.id} data-etat={c.commencee ? 'commencee' : 'proposee'} className="min-w-0">
                    <CarteDecouvrir
                      proposition={c.proposition}
                      commencee={c.commencee}
                      enLigne={enLigne}
                      pasMaintenant={() => pasMaintenant(c.id)}
                      commencer={() => commencer(c.proposition)}
                      echec={() => echecCommencer(c.proposition)}
                    />
                  </li>
                ))}
              </ul>
            </div>

            {messagePage && <p className="m-0 max-w-[65ch] text-[0.9375rem] text-discret">{messagePage}</p>}

            {resultat?.suite && (
              <Bouton variante="secondaire" onClick={autresIdees} className="tablette:self-start">
                {boutonSuite}
              </Bouton>
            )}

            {cases.some((c) => !c.commencee) && (
              <p className="m-0 max-w-[65ch] text-sm text-discret">
                {enLigne
                  ? '« Pas maintenant » met l’idée de côté quelques semaines. Rien d’autre ne change.'
                  : 'Hors connexion : ces choix reviendront avec le réseau.'}
              </p>
            )}
          </>
        )}
      </section>

      <p role="status" className="sr-only">
        {annonce}
      </p>

      {/* Le message « Idée mise de côté · Annuler » : sur iPhone, il prend la place de la barre du
          bas le temps de son affichage, pour ne recouvrir aucune carte ; sur iPad, en bas de la
          colonne de contenu. Seule la pilule reçoit les touchers. */}
      <div
        ref={refMessage}
        className="pointer-events-none fixed z-30 flex min-h-[min(4.5rem,80px)] items-center justify-center left-[calc(env(safe-area-inset-left)+1rem)] right-[calc(env(safe-area-inset-right)+1rem)] bottom-[max(env(safe-area-inset-bottom),1rem)] tablette:right-[max(2.5rem,env(safe-area-inset-right))] tablette:left-[calc(env(safe-area-inset-left)+18.5rem)] [&>*>*]:pointer-events-auto"
      >
        <MessageTemporaire message={message} effacer={effacerMessage} />
      </div>
    </Page>
  )
}

/** « Mon envie du moment » : une seule grande bulle, qui ouvre le menu des six envies. */
function SelecteurEnvie({ envie }: { envie: Envie }) {
  const libelle = libelleEnvie(envie)
  return (
    <div data-selecteur-envie className="flex flex-col">
      <Menu
        nom={`Mon envie du moment : ${libelle}. Changer`}
        nomListe="Mon envie du moment"
        contenuBouton={
          <>
            <span className="min-w-0 font-titre text-[1.375rem] leading-[1.2]">{libelle}</span>
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-pilule bg-accent text-sur-accent">
              <IconeChevronBas taille={18} />
            </span>
          </>
        }
        classeBouton="flex min-h-16 w-full items-center justify-between gap-3 rounded-[1.625rem] border border-bordure bg-surface py-3 pr-3 pl-[1.375rem] text-left text-encre shadow-douce"
        options={ENVIES}
        valeur={envie}
        onChoisir={(choisie) => {
          rendreLeFocusAuSelecteur = true
          window.location.hash = `#/decouvrir?envie=${choisie}`
        }}
      />
    </div>
  )
}

const CLASSE_BOUTON_CARTE =
  'flex min-h-11 min-w-0 cursor-pointer items-center justify-center rounded-pilule py-1.5 text-center text-[min(0.9375rem,17px)] leading-tight transition-transform duration-200 active:scale-[0.97] aria-disabled:cursor-default aria-disabled:opacity-60 aria-disabled:active:scale-100'

/**
 * Une idée et ses deux boutons. « Commencer » (ou « Reprendre » pour un livre en pause) est en
 * avant, sur le fond d'action (jeton « action », au moins 3:1 sur la carte dans les deux thèmes) ; « Pas maintenant » reste discret, juste un contour. Une fois commencée,
 * la carte laisse place à une ligne calme, à la même place.
 */
function CarteDecouvrir({
  proposition,
  commencee,
  enLigne,
  pasMaintenant,
  commencer,
  echec,
}: {
  proposition: Proposition
  commencee: boolean
  enLigne: boolean
  pasMaintenant: () => void
  commencer: () => void
  echec: () => void
}) {
  const { oeuvre } = proposition
  const { statut } = useModifierOeuvre(oeuvre.id)
  const [confirmer, setConfirmer] = useState(false)
  const ligne = useRef<HTMLDivElement>(null)
  const verbe = oeuvre.statut === 'en_pause' ? 'Reprendre' : 'Commencer'

  useEffect(() => {
    if (commencee) ligne.current?.focus({ preventScroll: true })
  }, [commencee])

  if (commencee) {
    return (
      <div
        ref={ligne}
        tabIndex={-1}
        className="flex items-center justify-between gap-3 rounded-carte border border-bordure bg-surface py-3 pr-3 pl-4 shadow-douce outline-none focus-visible:outline-2"
      >
        <p className="m-0 flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className="flex shrink-0 text-accent-texte">
            <IconeStatut statut="en_cours" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="coupure-francaise leading-tight font-bold">{oeuvre.titre}</span>
            <span className="text-sm text-discret">En cours.</span>
          </span>
        </p>
        <a
          href={LIENS.oeuvre(oeuvre.id)}
          aria-label={`Voir la fiche de ${oeuvre.titre}`}
          className={`${CLASSE_BOUTON_CARTE} shrink-0 border border-bordure bg-surface px-4 font-semibold whitespace-nowrap text-encre no-underline`}
        >
          Voir la fiche
        </a>
      </div>
    )
  }

  return (
    <CarteIdee proposition={proposition}>
      <div className="mt-auto flex items-stretch gap-2 @3xl/idees:flex-col">
        <button
          type="button"
          aria-label={`${verbe} ${oeuvre.titre}`}
          aria-haspopup="dialog"
          aria-disabled={!enLigne || undefined}
          onClick={() => enLigne && setConfirmer(true)}
          className={`${CLASSE_BOUTON_CARTE} border-0 bg-action px-[18px] font-bold text-sur-action`}
        >
          {verbe}
        </button>
        <button
          type="button"
          aria-label={`Pas maintenant pour ${oeuvre.titre}`}
          aria-disabled={!enLigne || undefined}
          onClick={() => enLigne && pasMaintenant()}
          className={`${CLASSE_BOUTON_CARTE} border border-bordure bg-transparent px-[14px] font-semibold text-discret`}
        >
          Pas maintenant
        </button>
      </div>
      <Dialogue
        ouvert={confirmer}
        titre={`${verbe} ${oeuvre.titre} ?`}
        confirmer={`Oui, ${verbe.toLowerCase()}`}
        annuler="Pas tout de suite"
        onConfirmer={() => {
          setConfirmer(false)
          commencer()
          statut.mutate('en_cours', { onError: echec })
        }}
        onAnnuler={() => setConfirmer(false)}
      />
    </CarteIdee>
  )
}
