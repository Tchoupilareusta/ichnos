import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { EchecAssistant, ImageTrouvee, Notice } from '../ajout/assistant'
import { libelleSource } from '../ajout/preremplir'
import type { EchecAchat, OeuvreDetaillee } from '../bibliotheque/depot'
import { isbnCompact, isbnValide } from '../bibliotheque/modele'
import { CLES } from '../bibliotheque/requetes'
import { nomLangue } from '../catalogue/langues'
import { Bouton } from '../composants/Bouton'
import { ChampTexte } from '../composants/Champs'
import { ActionsFeuille, Feuille } from '../composants/Feuille'
import { ApercuCouverture } from '../couvertures/ApercuCouverture'
import { LIENS } from '../navigation/routes'
import { useEnLigne } from '../navigation/useEnLigne'
import { useSession } from '../session/Session'
import { preparerAchat, titreRessemble } from './achat'

/** Où j'en suis dans le panneau. Son nom est porté par data-etat, pour les animations de l'étape 9. */
type Etape =
  | { nom: 'isbn' }
  /** L'ISBN est lu : ce que les catalogues en disent (ou rien, s'ils ne le connaissent pas ou ne répondent pas). */
  | { nom: 'exemplaire'; isbn: string; notice: Notice | null; catalogues: 'connu' | 'inconnu' | 'muets' | 'hors_ligne' }
  /** L'ISBN est déjà porté ailleurs dans ma bibliothèque : rien n'est enregistré. */
  | { nom: 'ailleurs'; texte: string; fiche: { id: string; titre: string | null } | null }

type Image = { etat: 'aucune' } | { etat: 'recherche' } | { etat: 'trouvee'; trouvee: ImageTrouvee }

const ECHECS: Record<EchecAchat, string> = {
  reseau: 'Pas de connexion à internet : l’achat n’a pas été noté.',
  isbn_ailleurs: 'Cet ISBN est déjà noté ailleurs dans ma bibliothèque : rien n’a été enregistré.',
  invalide: 'Cet ISBN n’a pas été accepté : rien n’a été enregistré. Je vérifie les chiffres.',
  introuvable: 'Cette œuvre n’est plus dans ma bibliothèque : rien n’a été enregistré.',
  inconnu: 'L’achat n’a pas pu être noté. Je réessaie dans un instant.',
}

const SANS_CATALOGUE: Record<'inconnu' | 'muets' | 'hors_ligne', string> = {
  inconnu: 'Aucun catalogue ne connaît cet ISBN. Je vérifie les chiffres, ou je le note quand même : il sera seul sur la fiche.',
  muets: 'La recherche automatique ne répond pas pour le moment. Je peux noter l’ISBN seul, ou réessayer plus tard.',
  hors_ligne: 'Pas de connexion à internet : la recherche attendra le retour du réseau.',
}

/** Le titre du panneau dit où j'en suis : c'est lui que VoiceOver annonce quand l'étape change. */
function titreDe(etape: Etape): string {
  if (etape.nom === 'isbn') return 'Je l’ai acheté'
  if (etape.nom === 'ailleurs') return 'Déjà dans ma bibliothèque'
  if (etape.catalogues === 'connu') return 'Ce qui a été trouvé'
  return etape.catalogues === 'inconnu' ? 'ISBN inconnu des catalogues' : 'Recherche indisponible'
}

const MESSAGE = 'm-0 rounded-carte bg-accent-doux px-5 py-4 text-[0.9375rem] font-semibold text-accent-texte'

/**
 * « Je l'ai acheté » : l'ISBN de mon exemplaire, ce que les catalogues en disent, puis un seul
 * enregistrement (fonction noter_achat de la base). Pour un livre : l'édition devient la mienne.
 * Pour un tome de série (`tome`) : il reçoit son ISBN et sa couverture. Rien n'est enregistré
 * avant « C'est mon exemplaire ».
 */
export function JeLaiAchete({
  ouvert,
  oeuvre,
  titre,
  tome,
  fermer,
  surAchat,
}: {
  ouvert: boolean
  oeuvre: OeuvreDetaillee
  /** Le titre affiché de l'œuvre. */
  titre: string
  /** Le numéro du tome acheté, pour une série ; null pour un livre. */
  tome: number | null
  fermer: () => void
  /** L'achat est noté : la fiche l'annonce et referme le panneau. */
  surAchat: () => void
}) {
  const { depot, assistant, couvertures } = useSession()
  const client = useQueryClient()
  const enLigne = useEnLigne()
  const [etape, setEtape] = useState<Etape>({ nom: 'isbn' })
  const [saisie, setSaisie] = useState('')
  const [erreurIsbn, setErreurIsbn] = useState<string | null>(null)
  const [recherche, setRecherche] = useState(false)
  const [image, setImage] = useState<Image>({ etat: 'aucune' })
  const [garder, setGarder] = useState(true)
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const refIsbn = useRef<HTMLInputElement>(null)
  /** Change à chaque ouverture et à chaque nouvel ISBN : une réponse arrivée trop tard est ignorée. */
  const tour = useRef(0)

  // Chaque ouverture repart de zéro : un panneau refermé ne garde rien.
  useEffect(() => {
    if (!ouvert) return
    tour.current += 1
    setEtape({ nom: 'isbn' })
    setSaisie('')
    setErreurIsbn(null)
    setRecherche(false)
    setImage({ etat: 'aucune' })
    setGarder(true)
    setEnvoi(false)
    setMessage(null)
  }, [ouvert, tome])

  const trouvee = image.etat === 'trouvee' ? image.trouvee : null
  const adresse = useMemo(() => (trouvee ? URL.createObjectURL(trouvee.image) : null), [trouvee])
  useEffect(() => () => void (adresse && URL.revokeObjectURL(adresse)), [adresse])

  async function chercher(evenement: FormEvent) {
    evenement.preventDefault()
    if (!enLigne || recherche) return
    const isbn = isbnCompact(saisie)
    if (!/^97[89]\d{10}$/.test(isbn) || !isbnValide(isbn)) {
      setErreurIsbn(
        /^\d{9}[\dX]$/.test(isbn)
          ? 'Il me faut l’ISBN à 13 chiffres : il commence par 978 ou 979.'
          : 'Cet ISBN ne semble pas juste : 13 chiffres, à vérifier sur le livre.',
      )
      refIsbn.current?.focus()
      return
    }
    const ceTour = ++tour.current
    const actuel = () => tour.current === ceTour
    setErreurIsbn(null)
    setMessage(null)
    setRecherche(true)
    setImage({ etat: 'aucune' })
    setGarder(true)
    try {
      // D'abord ma bibliothèque : cet ISBN est-il déjà rangé ailleurs ?
      const deja = await depot.trouverParIsbn(isbn)
      if (!actuel()) return
      if (!deja.ok) {
        return setMessage(
          deja.echec === 'reseau'
            ? 'Pas de connexion à internet : la recherche attendra le retour du réseau.'
            : 'Ma bibliothèque n’a pas pu être consultée. Je réessaie dans un instant.',
        )
      }
      if (deja.trouve && deja.trouve.id !== oeuvre.id) {
        const lecture = await depot.lireOeuvre(deja.trouve.id)
        if (!actuel()) return
        const nom = lecture.ok ? lecture.oeuvre.titreFr : null
        const autre = !nom
          ? 'Cet ISBN est déjà dans ma bibliothèque, sur une autre œuvre.'
          : deja.trouve.tome
            ? `Cet ISBN est celui du tome ${deja.trouve.tome} de « ${nom} », déjà dans ma bibliothèque.`
            : `Cet ISBN est celui de « ${nom} », déjà dans ma bibliothèque.`
        return setEtape({ nom: 'ailleurs', texte: `${autre} Rien n’est enregistré.`, fiche: { id: deja.trouve.id, titre: nom } })
      }
      if (deja.trouve && tome !== null && deja.trouve.tome !== null && deja.trouve.tome !== tome) {
        return setEtape({ nom: 'ailleurs', texte: `Cet ISBN est déjà celui du tome ${deja.trouve.tome}. Rien n’est enregistré.`, fiche: null })
      }

      const reponse = await assistant.chercherIsbn(isbn)
      if (!actuel()) return
      if (!reponse.ok) {
        const sans: Record<EchecAssistant, 'muets' | 'hors_ligne'> = { reseau: 'hors_ligne', limite: 'muets', non_configure: 'muets', ia: 'muets', indisponible: 'muets' }
        return setEtape({ nom: 'exemplaire', isbn, notice: null, catalogues: sans[reponse.echec] })
      }
      if (!reponse.valeur.trouve) return setEtape({ nom: 'exemplaire', isbn, notice: null, catalogues: 'inconnu' })
      setEtape({ nom: 'exemplaire', isbn, notice: reponse.valeur.notice, catalogues: 'connu' })

      // La couverture de cette édition, par son ISBN : les deux sources, la plus large.
      if (reponse.valeur.couverture) {
        setImage({ etat: 'recherche' })
        const couverture = await assistant.couverture({ isbn })
        if (!actuel()) return
        setImage(couverture.ok && couverture.valeur ? { etat: 'trouvee', trouvee: couverture.valeur } : { etat: 'aucune' })
      }
    } finally {
      if (actuel()) setRecherche(false)
    }
  }

  async function valider() {
    if (etape.nom !== 'exemplaire' || !enLigne || envoi) return
    setEnvoi(true)
    setMessage(null)
    // La couverture gardée est rangée d'abord : la base ne reçoit que son chemin.
    let chemin: string | null = null
    if (trouvee && garder) {
      const deposee = await couvertures.deposer(trouvee.image)
      if (deposee.ok) chemin = deposee.chemin
    }
    const resultat = await depot.noterAchat(oeuvre.id, preparerAchat({ isbn: etape.isbn, notice: etape.notice, tome, couverture: chemin }))
    if (!resultat.ok) {
      setEnvoi(false)
      return setMessage(ECHECS[resultat.echec])
    }
    await Promise.all([
      client.invalidateQueries({ queryKey: CLES.oeuvre(oeuvre.id) }),
      client.invalidateQueries({ queryKey: CLES.oeuvres }),
      client.invalidateQueries({ queryKey: CLES.enCours }),
    ])
    setEnvoi(false)
    surAchat()
  }

  const changerIsbn = () => {
    tour.current += 1
    setEtape({ nom: 'isbn' })
    setRecherche(false)
    setMessage(null)
  }

  const notice = etape.nom === 'exemplaire' ? etape.notice : null
  const titreTrouve = notice?.titre?.valeur ?? null
  const tomeTrouve = notice?.tome?.valeur ?? null
  const autreLivre = titreTrouve !== null && !titreRessemble(titreTrouve, [oeuvre.titreFr, oeuvre.titreOriginal])
  const autreTome = tome !== null && tomeTrouve !== null && tomeTrouve !== tome
  const lignes = notice
    ? ([
        ['Éditeur', notice.editeur?.valeur, notice.editeur?.source],
        ['Traduction', notice.traducteur?.valeur, notice.traducteur?.source],
        ['Pages', notice.pages?.valeur, notice.pages?.source],
        ['Langue', notice.langue ? (nomLangue(notice.langue.valeur) ?? notice.langue.valeur) : null, notice.langue?.source],
      ].filter(([, valeur]) => valeur !== null && valeur !== undefined) as [string, string | number, Parameters<typeof libelleSource>[0]][])
    : []

  return (
    <Feuille ouvert={ouvert} titre={titreDe(etape)} sousTitre={tome === null ? titre : `${titre}, tome ${tome}`} fermer={fermer}>
      <div data-etat={etape.nom} className="flex flex-col gap-5">
        {etape.nom === 'isbn' && (
          <form noValidate onSubmit={chercher} className="flex flex-col gap-4">
            <ChampTexte
              ref={refIsbn}
              libelle="ISBN à 13 chiffres de mon exemplaire"
              aide="Au dos du livre, sous le code-barres. Tirets et espaces acceptés."
              erreur={erreurIsbn}
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="search"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
            />
            <Bouton type="submit" occupe={recherche || !enLigne}>
              {recherche ? 'Je cherche…' : 'Chercher ce livre'}
            </Bouton>
            <p role="status" className="m-0 text-sm text-discret empty:hidden">
              {recherche ? 'Je cherche dans ma bibliothèque et dans les catalogues…' : ''}
            </p>
            {!enLigne && <p className="m-0 text-sm text-discret">Hors connexion : la recherche attendra le retour du réseau.</p>}
          </form>
        )}

        {etape.nom === 'exemplaire' && (
          <>
            {etape.catalogues === 'connu' ? (
              <>
                {titreTrouve && (
                  <p className="m-0 font-titre text-xl leading-tight">
                    {titreTrouve}
                    {tomeTrouve !== null ? `, tome ${tomeTrouve}` : ''}
                  </p>
                )}
                {(autreLivre || autreTome) && (
                  <p className={MESSAGE}>
                    {autreLivre ? `Ce livre semble être « ${titreTrouve} ». Je vérifie l’ISBN.` : `Ce livre semble être le tome ${tomeTrouve}. Je vérifie l’ISBN.`}
                  </p>
                )}
                {lignes.length > 0 && (
                  <ul aria-label="Ce que disent les catalogues" className="m-0 flex list-none flex-col gap-1.5 p-0 text-[0.9375rem]">
                    {lignes.map(([nom, valeur, source]) => (
                      <li key={nom}>
                        <span className="text-discret">{nom} : </span>
                        {valeur}
                        <span className="text-discret">, d’après {libelleSource(source)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <ApercuCouverture
                  titre={titre}
                  cherche={image.etat === 'recherche'}
                  trouvee={trouvee}
                  adresse={adresse}
                  garder={garder}
                  setGarder={setGarder}
                />
              </>
            ) : (
              <p className="m-0 text-[1.0625rem] leading-relaxed">{SANS_CATALOGUE[etape.catalogues]}</p>
            )}
            <p className="m-0 text-sm text-discret tabular-nums">ISBN {etape.isbn}</p>
            <ActionsFeuille>
              <Bouton occupe={envoi || !enLigne || image.etat === 'recherche'} onClick={valider}>
                {envoi ? 'J’enregistre…' : etape.catalogues === 'connu' ? 'C’est mon exemplaire' : 'Noter cet ISBN quand même'}
              </Bouton>
              <Bouton variante="secondaire" onClick={changerIsbn}>
                Changer d’ISBN
              </Bouton>
            </ActionsFeuille>
          </>
        )}

        {etape.nom === 'ailleurs' && (
          <>
            <p className="m-0 text-[1.0625rem] leading-relaxed">{etape.texte}</p>
            <ActionsFeuille>
              {etape.fiche && (
                <a
                  href={LIENS.oeuvre(etape.fiche.id)}
                  aria-label={etape.fiche.titre ? `Ouvrir sa fiche : ${etape.fiche.titre}` : undefined}
                  className="flex min-h-12 items-center justify-center rounded-pilule border border-accent bg-accent px-6 text-[0.9375rem] font-bold text-sur-accent no-underline"
                >
                  Ouvrir sa fiche
                </a>
              )}
              <Bouton variante="secondaire" onClick={changerIsbn}>
                Changer d’ISBN
              </Bouton>
            </ActionsFeuille>
          </>
        )}

        <p role="alert" className={`${MESSAGE} empty:hidden`}>
          {message ?? ''}
        </p>
      </div>
    </Feuille>
  )
}
