import { useEffect, useImperativeHandle, useRef, useState, type FormEvent, type Ref } from 'react'
import type { EchecAssistant, ImageTrouvee, PropositionCouverture } from '../ajout/assistant'
import type { OeuvreDetaillee } from '../bibliotheque/depot'
import { isbnValide } from '../bibliotheque/modele'
import { useRangerCouverture } from '../bibliotheque/requetes'
import { Bouton } from '../composants/Bouton'
import { ChampTexte } from '../composants/Champs'
import { ActionsFeuille, Feuille } from '../composants/Feuille'
import { IconeChevronBas, IconeCoche } from '../composants/Icones'
import { useSession } from '../session/Session'
import type { CibleCouverture } from './choix'
import { ECHECS_RANGEMENT } from './ChoisirImage'
import { Couverture } from './Couverture'
import { estPetite } from './reduction'

/** Combien d'images sont demandées en même temps, au plus. */
const IMAGES_A_LA_FOIS = 3

const ECHECS: Record<EchecAssistant, string> = {
  reseau: 'Pas de connexion à internet : la recherche attendra le retour du réseau.',
  limite: 'La recherche automatique ne répond pas pour le moment. Je réessaie plus tard, ou je choisis une image moi-même.',
  non_configure: 'La recherche automatique ne répond pas pour le moment. Je réessaie plus tard, ou je choisis une image moi-même.',
  ia: 'La recherche automatique ne répond pas pour le moment. Je réessaie plus tard, ou je choisis une image moi-même.',
  indisponible: 'La recherche automatique ne répond pas pour le moment. Je réessaie plus tard, ou je choisis une image moi-même.',
}

/** Une proposition et son image : en attente, arrivée, ou absente (elle disparaît alors de la liste). */
type Proposee = { cle: string; proposition: PropositionCouverture; etat: 'attente' | 'absente' } | { cle: string; proposition: PropositionCouverture; etat: 'prete'; trouvee: ImageTrouvee; adresse: string }

/** « Gallimard · Folio · 2013 », et pour VoiceOver « Couverture : Gallimard, Folio, 2013, de petite taille ». */
function decrire(proposee: Extract<Proposee, { etat: 'prete' }>) {
  const { editeur, collection, annee } = proposee.proposition
  const petite = estPetite(proposee.trouvee)
  const reperes = [editeur, collection, annee === null ? null : String(annee)].filter((repere): repere is string => !!repere)
  return {
    legende: [...reperes, ...(petite ? ['petite taille'] : [])].join(' · ') || 'Édition sans précision',
    nom: `Couverture : ${[...(reperes.length > 0 ? reperes : ['édition sans précision']), ...(petite ? ['de petite taille'] : [])].join(', ')}`,
  }
}

/** De quoi chercher : le titre et le premier auteur, et ce qu'on sait de mon édition, pour le tri. */
export type RechercheCouvertures = { titre: string; auteur: string; langue: 'fr' | 'en'; isbn: string | null; editeur: string | null }

/** La recherche d'une œuvre de ma bibliothèque : son titre, son premier auteur, mon édition. */
export function rechercheDeLOeuvre(oeuvre: OeuvreDetaillee): RechercheCouvertures {
  const edition = oeuvre.editions.find((e) => e.id === oeuvre.monEdition) ?? null
  return {
    titre: oeuvre.titreFr,
    auteur: oeuvre.auteurs.find((a) => a.role === 'auteur')?.nom ?? '',
    // La langue de mon édition : anglais si je lis en anglais, français sinon.
    langue: edition?.language === 'en' ? 'en' : 'fr',
    isbn: edition?.isbn ?? null,
    editeur: edition?.publisher ?? null,
  }
}

/**
 * « Chercher d'autres couvertures » : des éditions de la même œuvre qui ont une image, chez Google
 * Books et Open Library. Je touche celle qui me plaît, puis « Garder cette couverture ». Rien
 * n'est gardé sans mon choix ; aucune IA. Dans « Modifier », pour une œuvre de ma bibliothèque ;
 * à l'ajout et à l'achat, quand aucune couverture n'est trouvée, avec le titre et l'auteur connus.
 */
export function AutresCouvertures({
  recherche: depart,
  idOeuvre = '',
  cible,
  enLigne,
  surRangee,
  ref,
  sansBouton = false,
  surImage,
}: {
  recherche: RechercheCouvertures
  /** L'œuvre et l'endroit où ranger la couverture gardée : là où elle s'affiche. Inutiles avec `surImage`. */
  idOeuvre?: string
  cible?: CibleCouverture
  enLigne: boolean
  /** La couverture gardée est rangée. */
  surRangee?: () => void
  /** Pour l'ouvrir depuis un menu (« Changer la couverture »). */
  ref?: Ref<{ ouvrir: () => void }>
  /** Le bouton est remplacé par le menu de l'appelant. */
  sansBouton?: boolean
  /** Donné : l'image gardée est rendue à l'appelant, qui la rangera au bon moment. Rien n'est rangé ici. */
  surImage?: (image: Blob) => void
}) {
  const { assistant } = useSession()
  const rangement = useRangerCouverture(idOeuvre)
  const [ouvert, setOuvert] = useState(false)
  const [titre, setTitre] = useState('')
  const [auteur, setAuteur] = useState('')
  const [erreurTitre, setErreurTitre] = useState<string | null>(null)
  const [recherche, setRecherche] = useState<'repos' | 'en_cours' | 'faite'>('repos')
  const [proposees, setProposees] = useState<Proposee[]>([])
  const [choisie, setChoisie] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  /** Les champs de la recherche sont repliés tant qu'elle donne quelque chose : les images passent d'abord. */
  const [correction, setCorrection] = useState(false)
  /** Change à chaque recherche et à la fermeture : une réponse arrivée trop tard est ignorée. */
  const tour = useRef(0)
  const adresses = useRef<string[]>([])

  const oublierImages = () => {
    for (const adresse of adresses.current) URL.revokeObjectURL(adresse)
    adresses.current = []
  }
  useEffect(
    () => () => {
      tour.current += 1
      oublierImages()
    },
    [],
  )

  async function chercher(recherchee: { titre: string; auteur: string }) {
    const leTitre = recherchee.titre.trim()
    if (!leTitre) return setErreurTitre('Il me faut au moins le titre.')
    const ceTour = ++tour.current
    const actuel = () => tour.current === ceTour
    oublierImages()
    setErreurTitre(null)
    setMessage(null)
    setChoisie(null)
    setProposees([])
    setRecherche('en_cours')

    const isbn = depart.isbn && /^97[89]\d{10}$/.test(depart.isbn) && isbnValide(depart.isbn) ? depart.isbn : null
    const editeur = depart.editeur?.trim().slice(0, 120) || null
    const reponse = await assistant.autresCouvertures({
      titre: leTitre.slice(0, 200),
      ...(recherchee.auteur.trim() ? { auteur: recherchee.auteur.trim().slice(0, 120) } : {}),
      langue: depart.langue,
      ...(isbn ? { isbn } : {}),
      ...(editeur ? { editeur } : {}),
    })
    if (!actuel()) return
    setRecherche('faite')
    if (!reponse.ok) return setMessage(ECHECS[reponse.echec])

    const liste: Proposee[] = reponse.valeur.map((proposition, rang) => ({ cle: String(rang), proposition, etat: 'attente' }))
    setProposees(liste)
    // Les images, par leur référence : trois à la fois au plus, dans l'ordre des propositions.
    let suivante = 0
    const charger = async () => {
      while (suivante < liste.length && actuel()) {
        const rang = suivante++
        const image = await assistant.couverture({ ref: liste[rang].proposition.ref })
        if (!actuel()) return
        const trouvee = image.ok ? image.valeur : null
        let arrivee: Proposee = { ...liste[rang], etat: 'absente' }
        if (trouvee) {
          const adresse = URL.createObjectURL(trouvee.image)
          adresses.current.push(adresse)
          arrivee = { cle: liste[rang].cle, proposition: liste[rang].proposition, etat: 'prete', trouvee, adresse }
        }
        setProposees((avant) => avant.map((p) => (p.cle === arrivee.cle ? arrivee : p)))
      }
    }
    await Promise.all(Array.from({ length: IMAGES_A_LA_FOIS }, charger))
  }

  function ouvrir() {
    if (!enLigne) return
    // La recherche part préremplie : le titre et le premier auteur. Je peux la corriger et la relancer.
    setTitre(depart.titre)
    setAuteur(depart.auteur)
    setOuvert(true)
    void chercher({ titre: depart.titre, auteur: depart.auteur })
  }

  useImperativeHandle(ref, () => ({ ouvrir }))

  function fermer() {
    tour.current += 1
    oublierImages()
    setOuvert(false)
    setProposees([])
    setChoisie(null)
    setMessage(null)
    setRecherche('repos')
  }

  function garder() {
    const retenue = proposees.find((p) => p.cle === choisie)
    if (!retenue || retenue.etat !== 'prete' || rangement.isPending) return
    setMessage(null)
    if (surImage) {
      surImage(retenue.trouvee.image)
      return fermer()
    }
    if (!cible) return
    rangement.mutate(
      { image: retenue.trouvee.image, cible },
      {
        onSuccess: () => {
          surRangee?.()
          fermer()
        },
        onError: (echec) => setMessage(ECHECS_RANGEMENT[echec.echec] ?? ECHECS_RANGEMENT.inconnu),
      },
    )
  }

  const pretes = proposees.filter((p): p is Extract<Proposee, { etat: 'prete' }> => p.etat === 'prete')
  const enAttente = proposees.some((p) => p.etat === 'attente')
  const rienTrouve = recherche === 'faite' && !message && !enAttente && pretes.length === 0

  return (
    <>
      {!sansBouton && (
        <Bouton variante="secondaire" aria-haspopup="dialog" occupe={!enLigne} onClick={ouvrir}>
          Chercher d’autres couvertures
        </Bouton>
      )}
      <Feuille
        ouvert={ouvert}
        titre="Chercher d’autres couvertures"
        sousTitre={`${[titre.trim(), auteur.trim()].filter(Boolean).join(' · ')}${titre.trim() ? ', ' : ''}chez Google Books et Open Library.`}
        fermer={fermer}
      >
        <div data-etat={recherche} className="flex flex-col gap-5">
          {/* La recherche part toute seule, préremplie. Elle se déplie pour être corrigée, et s'ouvre d'elle-même quand elle ne donne rien. */}
          <details
            open={correction || rienTrouve || message !== null || erreurTitre !== null}
            onToggle={(evenement) => setCorrection(evenement.currentTarget.open)}
            className="group"
          >
            <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-[0.9375rem] font-semibold text-discret [&::-webkit-details-marker]:hidden">
              Corriger la recherche
              <span className="transition-transform duration-200 group-open:rotate-180">
                <IconeChevronBas taille={16} />
              </span>
            </summary>
            <form
              noValidate
              onSubmit={(evenement: FormEvent) => {
                evenement.preventDefault()
                void chercher({ titre, auteur })
              }}
              className="flex flex-col gap-4 pt-2"
            >
              <ChampTexte libelle="Titre" erreur={erreurTitre} autoComplete="off" enterKeyHint="search" value={titre} onChange={(e) => setTitre(e.target.value)} />
              <ChampTexte libelle="Auteur" aide="Facultatif : il départage les homonymes." autoComplete="off" enterKeyHint="search" value={auteur} onChange={(e) => setAuteur(e.target.value)} />
              <Bouton type="submit" variante="secondaire" occupe={recherche === 'en_cours'}>
                Chercher
              </Bouton>
            </form>
          </details>

          <p role="status" className="m-0 text-[0.9375rem] text-discret empty:hidden">
            {recherche === 'en_cours'
              ? 'Je cherche dans les catalogues…'
              : enAttente
                ? 'Les images arrivent…'
                : pretes.length > 0
                  ? `${pretes.length} couverture${pretes.length > 1 ? 's' : ''} proposée${pretes.length > 1 ? 's' : ''}.`
                  : ''}
          </p>
          {rienTrouve && (
            <p className="m-0 text-[1.0625rem] leading-relaxed">
              Aucune autre couverture trouvée pour cette recherche. Je peux la corriger, ou choisir une image moi-même.
            </p>
          )}

          {pretes.length > 0 && (
            <>
              <ul aria-label="Couvertures proposées" className="m-0 grid list-none grid-cols-2 gap-3 p-0 min-[30rem]:grid-cols-3">
                {pretes.map((proposee) => {
                  const { legende, nom } = decrire(proposee)
                  const retenue = choisie === proposee.cle
                  return (
                    <li key={proposee.cle} className="flex">
                      <button
                        type="button"
                        aria-pressed={retenue}
                        aria-label={nom}
                        onClick={() => setChoisie(proposee.cle)}
                        className="relative flex w-full cursor-pointer flex-col gap-2 rounded-carte border-2 border-transparent bg-transparent p-2 text-left text-encre aria-pressed:border-accent-texte aria-pressed:bg-accent-doux"
                      >
                        <Couverture titre={titre.trim() || depart.titre} graine="apercu" apercu={proposee.adresse} className="w-full" />
                        {retenue && (
                          <span aria-hidden="true" className="absolute top-3.5 right-3.5 flex size-7 items-center justify-center rounded-pilule bg-accent text-sur-accent shadow-douce">
                            <IconeCoche taille={16} />
                          </span>
                        )}
                        <span data-role="legende" className="text-sm leading-snug text-pretty">
                          {legende}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <ActionsFeuille>
                <Bouton occupe={choisie === null || rangement.isPending} onClick={garder}>
                  {rangement.isPending ? 'Je range l’image…' : 'Garder cette couverture'}
                </Bouton>
                <Bouton variante="secondaire" onClick={fermer}>
                  Aucune ne convient
                </Bouton>
              </ActionsFeuille>
            </>
          )}

          <p role="alert" className="m-0 rounded-carte bg-accent-doux px-5 py-4 text-[0.9375rem] font-semibold text-accent-texte empty:hidden">
            {message ?? ''}
          </p>
        </div>
      </Feuille>
    </>
  )
}
