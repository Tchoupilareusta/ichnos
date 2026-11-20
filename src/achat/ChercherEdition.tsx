import { useEffect, useMemo, useRef, useState } from 'react'
import type { EchecAssistant, ImageTrouvee, Notice } from '../ajout/assistant'
import { libelleSource } from '../ajout/preremplir'
import type { LigneEdition } from '../bibliotheque/formulaire'
import { isbnCompact } from '../bibliotheque/modele'
import { nomLangue } from '../catalogue/langues'
import { Bouton } from '../composants/Bouton'
import { ActionsFeuille, Feuille } from '../composants/Feuille'
import { Isbn } from '../composants/Isbn'
import { ApercuCouverture, type CouvertureChoisie } from '../couvertures/ApercuCouverture'
import { LIENS } from '../navigation/routes'
import { useEnLigne } from '../navigation/useEnLigne'
import { useSession } from '../session/Session'
import { titreRessemble } from './achat'

/** Ce que les catalogues disent de mon édition, à reporter dans le formulaire si je le choisis. */
export type EditionTrouvee = {
  champs: Partial<Pick<LigneEdition, 'publisher' | 'translator' | 'pageCount' | 'language'>>
  /** La couverture de cette édition, si je la garde. */
  image: Blob | null
}

type Etat =
  | { nom: 'recherche' }
  | { nom: 'trouvee'; notice: Notice }
  | { nom: 'rien'; texte: string }
  | { nom: 'ailleurs'; texte: string; fiche: { id: string; titre: string | null } }

const SANS: Record<EchecAssistant | 'inconnu', string> = {
  inconnu: 'Aucun catalogue ne connaît cet ISBN. Je vérifie les chiffres, ou je remplis l’édition moi-même.',
  reseau: 'Pas de connexion à internet : la recherche attendra le retour du réseau.',
  limite: 'La recherche automatique ne répond pas pour le moment. Je réessaie plus tard.',
  non_configure: 'La recherche automatique ne répond pas pour le moment. Je réessaie plus tard.',
  ia: 'La recherche automatique ne répond pas pour le moment. Je réessaie plus tard.',
  indisponible: 'La recherche automatique ne répond pas pour le moment. Je réessaie plus tard.',
}

/**
 * « Chercher cette édition » (dans « Modifier ») : l'ISBN que je viens de saisir est cherché à la BnF,
 * chez Google Books et Open Library. Je vois ce qu'ils en disent (éditeur, traduction, pages, langue,
 * couverture) à côté de ce que j'ai noté, puis je choisis de l'appliquer ou non. Rien n'est remplacé
 * sans mon accord, et rien n'est enregistré avant « Enregistrer ».
 */
export function ChercherEdition({
  ouvert,
  isbn,
  idOeuvre,
  titres,
  auteur,
  actuelle,
  fermer,
  appliquer,
}: {
  ouvert: boolean
  isbn: string
  /** L'œuvre modifiée (null pendant un ajout) : un ISBN déjà rangé sur elle n'est pas « ailleurs ». */
  idOeuvre: string | null
  /** Ses titres français et original, pour signaler un livre qui semble être un autre. */
  titres: string[]
  /** Son premier auteur, pour chercher d'autres couvertures quand cette édition n'en a pas. */
  auteur: string
  actuelle: LigneEdition
  fermer: () => void
  appliquer: (trouvee: EditionTrouvee) => void
}) {
  const { depot, assistant } = useSession()
  const [etat, setEtat] = useState<Etat>({ nom: 'recherche' })
  const [image, setImage] = useState<{ cherche: boolean; trouvee: ImageTrouvee | null }>({ cherche: false, trouvee: null })
  const [garder, setGarder] = useState(true)
  /** Sans couverture trouvée : la photo de mon exemplaire, ou une autre édition, que j'apporte moi-même. */
  const [choisie, setChoisie] = useState<CouvertureChoisie | null>(null)
  const enLigne = useEnLigne()
  const tour = useRef(0)

  useEffect(() => {
    if (!ouvert) return
    const ceTour = ++tour.current
    const actuel = () => tour.current === ceTour
    const compact = isbnCompact(isbn)
    setEtat({ nom: 'recherche' })
    setImage({ cherche: false, trouvee: null })
    setGarder(true)
    setChoisie(null)
    void (async () => {
      // D'abord ma bibliothèque : cet ISBN est-il déjà celui d'une autre de mes œuvres ?
      const deja = await depot.trouverParIsbn(compact)
      if (!actuel()) return
      if (deja.ok && deja.trouve && deja.trouve.id !== idOeuvre) {
        const lecture = await depot.lireOeuvre(deja.trouve.id)
        if (!actuel()) return
        const nom = lecture.ok ? lecture.oeuvre.titreFr : null
        return setEtat({
          nom: 'ailleurs',
          texte: nom ? `Cet ISBN est celui de « ${nom} », déjà dans ma bibliothèque.` : 'Cet ISBN est déjà dans ma bibliothèque, sur une autre œuvre.',
          fiche: { id: deja.trouve.id, titre: nom },
        })
      }
      const reponse = await assistant.chercherIsbn(compact)
      if (!actuel()) return
      if (!reponse.ok) return setEtat({ nom: 'rien', texte: SANS[reponse.echec] })
      if (!reponse.valeur.trouve) return setEtat({ nom: 'rien', texte: SANS.inconnu })
      setEtat({ nom: 'trouvee', notice: reponse.valeur.notice })
      if (!reponse.valeur.couverture) return
      setImage({ cherche: true, trouvee: null })
      const couverture = await assistant.couverture({ isbn: compact })
      if (!actuel()) return
      setImage({ cherche: false, trouvee: couverture.ok ? couverture.valeur : null })
    })()
    return () => {
      tour.current += 1
    }
  }, [ouvert, isbn, idOeuvre, depot, assistant])

  const adresse = useMemo(() => (image.trouvee ? URL.createObjectURL(image.trouvee.image) : null), [image.trouvee])
  useEffect(() => () => void (adresse && URL.revokeObjectURL(adresse)), [adresse])

  const notice = etat.nom === 'trouvee' ? etat.notice : null
  const titreTrouve = notice?.titre?.valeur ?? null
  const autreLivre = titreTrouve !== null && !titreRessemble(titreTrouve, titres)
  // Chaque ligne : ce que disent les catalogues, et ce que j'avais noté s'il diffère.
  const lignes = notice
    ? [
        { nom: 'Éditeur', trouve: notice.editeur?.valeur ?? null, source: notice.editeur?.source, avant: actuelle.publisher.trim() },
        { nom: 'Traduction', trouve: notice.traducteur?.valeur ?? null, source: notice.traducteur?.source, avant: actuelle.translator.trim() },
        { nom: 'Pages', trouve: notice.pages ? String(notice.pages.valeur) : null, source: notice.pages?.source, avant: actuelle.pageCount.trim() },
        {
          nom: 'Langue',
          trouve: notice.langue ? (nomLangue(notice.langue.valeur) ?? notice.langue.valeur) : null,
          source: notice.langue?.source,
          avant: actuelle.language ? (nomLangue(actuelle.language) ?? actuelle.language) : '',
        },
      ].filter((ligne) => ligne.trouve !== null)
    : []
  const change = lignes.some((ligne) => ligne.trouve !== ligne.avant) || (image.trouvee !== null && garder) || choisie !== null

  function valider() {
    if (!notice) return
    const champs: EditionTrouvee['champs'] = {}
    if (notice.editeur) champs.publisher = notice.editeur.valeur
    if (notice.traducteur) champs.translator = notice.traducteur.valeur
    if (notice.pages) champs.pageCount = String(notice.pages.valeur)
    if (notice.langue) champs.language = notice.langue.valeur
    appliquer({ champs, image: choisie?.image ?? (image.trouvee && garder ? image.trouvee.image : null) })
  }

  return (
    <Feuille ouvert={ouvert} titre={etat.nom === 'trouvee' ? 'Ce qui a été trouvé' : 'Chercher cette édition'} sousTitre={<>ISBN <Isbn valeur={isbn} /></>} fermer={fermer}>
      <div data-etat={etat.nom} className="flex flex-col gap-5">
        {etat.nom === 'recherche' && (
          <p role="status" className="m-0 text-[0.9375rem] text-discret">
            Je cherche dans ma bibliothèque et dans les catalogues…
          </p>
        )}

        {etat.nom === 'trouvee' && (
          <>
            {titreTrouve && <p className="m-0 font-titre text-xl leading-tight">{titreTrouve}</p>}
            {autreLivre && (
              <p className="m-0 rounded-carte bg-accent-doux px-5 py-4 text-[0.9375rem] font-semibold text-accent-texte">
                Ce livre semble être « {titreTrouve} ». Je vérifie l’ISBN.
              </p>
            )}
            {lignes.length > 0 ? (
              <ul aria-label="Ce que disent les catalogues" className="m-0 flex list-none flex-col gap-2 p-0 text-[0.9375rem]">
                {lignes.map((ligne) => (
                  <li key={ligne.nom} className="flex flex-col">
                    <span>
                      <span className="text-discret">{ligne.nom} : </span>
                      {ligne.trouve}
                      {ligne.source && <span className="text-discret">, d’après {libelleSource(ligne.source)}</span>}
                    </span>
                    {ligne.avant && ligne.avant !== ligne.trouve && <span className="text-sm text-discret">J’avais noté : {ligne.avant}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-[0.9375rem] text-discret">Les catalogues ne disent rien de plus sur cette édition.</p>
            )}
            <ApercuCouverture
              titre={titres[0] ?? ''}
              cherche={image.cherche}
              trouvee={image.trouvee}
              adresse={adresse}
              garder={garder}
              setGarder={setGarder}
              sans={{
                choisie,
                surChoix: setChoisie,
                enLigne,
                autres: {
                  titre: titres[0] ?? '',
                  auteur,
                  langue: notice?.langue?.valeur === 'en' ? 'en' : 'fr',
                  isbn: isbnCompact(isbn),
                  editeur: notice?.editeur?.valeur ?? null,
                },
              }}
            />
            <ActionsFeuille>
              <Bouton occupe={image.cherche || !change} onClick={valider}>
                Appliquer à mon édition
              </Bouton>
              <Bouton variante="secondaire" onClick={fermer}>
                Ne rien changer
              </Bouton>
            </ActionsFeuille>
          </>
        )}

        {etat.nom === 'rien' && (
          <>
            <p className="m-0 text-[1.0625rem] leading-relaxed">{etat.texte}</p>
            <ActionsFeuille>
              <Bouton variante="secondaire" onClick={fermer}>
                Fermer
              </Bouton>
            </ActionsFeuille>
          </>
        )}

        {etat.nom === 'ailleurs' && (
          <>
            <p className="m-0 text-[1.0625rem] leading-relaxed">{etat.texte}</p>
            <ActionsFeuille>
              <a
                href={LIENS.oeuvre(etat.fiche.id)}
                aria-label={etat.fiche.titre ? `Ouvrir sa fiche : ${etat.fiche.titre}` : undefined}
                className="flex min-h-12 items-center justify-center rounded-pilule border border-accent bg-accent px-6 text-[0.9375rem] font-bold text-sur-accent no-underline"
              >
                Ouvrir sa fiche
              </a>
              <Bouton variante="secondaire" onClick={fermer}>
                Fermer
              </Bouton>
            </ActionsFeuille>
          </>
        )}
      </div>
    </Feuille>
  )
}
