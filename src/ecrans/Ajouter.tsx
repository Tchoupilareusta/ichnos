import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { EchecAssistant, Resultat } from '../ajout/assistant'
import { confierEdition, type Apport } from '../ajout/passage'
import { depuisNotice, depuisResultat, doublonsProches } from '../ajout/preremplir'
import type { OeuvreListee } from '../bibliotheque/depot'
import { isbnCompact, isbnValide } from '../bibliotheque/modele'
import { useOeuvres } from '../bibliotheque/requetes'
import { nomLangue } from '../catalogue/langues'
import { Bouton } from '../composants/Bouton'
import { ChampTexte } from '../composants/Champs'
import { Page, TitrePage } from '../composants/Page'
import { LIENS } from '../navigation/routes'
import { useEnLigne } from '../navigation/useEnLigne'
import { revenir, useRoute } from '../navigation/useRoute'
import { useSession } from '../session/Session'
import { Formulaire } from './Formulaire'

/** « Ajouter une œuvre » : la recherche automatique d'abord, le formulaire complet à portée. */
export function Ajouter() {
  const { parametres } = useRoute()
  if (parametres.get('mode') === 'manuel') return <Formulaire initial={null} />
  return <AjoutAutomatique />
}

type Etape =
  | { nom: 'choix' }
  | { nom: 'resultats'; resultats: Resultat[] }
  /** L'ISBN saisi est déjà dans ma bibliothèque. */
  | { nom: 'deja'; oeuvre: string; titre: string | null; tome: number | null }
  /** Une œuvre au titre très proche y est déjà : à moi de dire si c'est la même. */
  | { nom: 'proche'; oeuvres: OeuvreListee[]; apport: Apport; isbn: string | null }
  | { nom: 'formulaire'; apport: Apport }

const ECHECS: Record<EchecAssistant, string> = {
  reseau: 'Pas de connexion à internet : la recherche attendra le retour du réseau.',
  limite: 'La recherche automatique ne répond pas pour le moment. Je peux tout saisir moi-même : Ichnos n’a besoin de rien d’autre.',
  non_configure: 'La recherche automatique ne répond pas pour le moment. Je peux tout saisir moi-même : Ichnos n’a besoin de rien d’autre.',
  ia: 'La recherche automatique ne répond pas pour le moment. Je peux tout saisir moi-même : Ichnos n’a besoin de rien d’autre.',
  indisponible: 'La recherche automatique ne répond pas pour le moment. Je peux tout saisir moi-même : Ichnos n’a besoin de rien d’autre.',
}

const BOUTON_DISCRET =
  'flex min-h-11 cursor-pointer items-center rounded-pilule border border-bordure bg-surface px-4 text-[0.9375rem] font-semibold text-encre no-underline'
const LIEN_PLEIN =
  'flex min-h-12 items-center justify-center rounded-pilule border border-accent bg-accent px-6 text-[0.9375rem] font-bold text-sur-accent no-underline transition-transform duration-200 active:scale-[0.98]'
const LIEN_BORDE =
  'flex min-h-12 items-center justify-center rounded-pilule border border-bordure bg-surface px-6 text-[0.9375rem] font-semibold text-encre no-underline transition-transform duration-200 active:scale-[0.98]'
const MESSAGE = 'm-0 max-w-[60ch] rounded-carte bg-accent-doux px-5 py-4 text-[0.9375rem] font-semibold text-accent-texte'

function AjoutAutomatique() {
  const { depot, assistant } = useSession()
  const enLigne = useEnLigne()
  const oeuvres = useOeuvres().data
  const [etape, setEtape] = useState<Etape>({ nom: 'choix' })
  const [isbn, setIsbn] = useState('')
  const [titre, setTitre] = useState('')
  const [auteur, setAuteur] = useState('')
  const [erreurIsbn, setErreurIsbn] = useState<string | null>(null)
  const [erreurTitre, setErreurTitre] = useState<string | null>(null)
  /** La recherche en cours, et le message calme de celle qui n'a rien donné. */
  const [recherche, setRecherche] = useState<'isbn' | 'titre' | null>(null)
  const [message, setMessage] = useState<{ pour: 'isbn' | 'titre'; texte: string } | null>(null)
  const refIsbn = useRef<HTMLInputElement>(null)
  const refTitre = useRef<HTMLInputElement>(null)
  const refEntete = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    document.title = 'Ajouter une œuvre · Ichnos'
  }, [])

  // À chaque changement d'étape, VoiceOver et le clavier repartent du titre de l'écran.
  const premiere = useRef(true)
  useEffect(() => {
    if (premiere.current) {
      premiere.current = false
      return
    }
    // La recherche par titre se lance plus bas dans la page : le nouvel écran se lit depuis le haut.
    window.scrollTo(0, 0)
    refEntete.current?.focus({ preventScroll: true })
  }, [etape.nom])

  /** La fiche est prête : je préviens si une œuvre très proche est déjà là, sinon le formulaire s'ouvre. */
  function suite(apport: Apport, isbnTrouve: string | null) {
    const auteurs = apport.etat.auteurs.map((a) => a.nom).filter(Boolean)
    const proches = doublonsProches(apport.etat.titreFr, auteurs, oeuvres ?? [])
    setEtape(proches.length > 0 ? { nom: 'proche', oeuvres: proches, apport, isbn: isbnTrouve } : { nom: 'formulaire', apport })
  }

  async function chercherParIsbn(evenement: FormEvent) {
    evenement.preventDefault()
    if (!enLigne || recherche) return
    const compact = isbnCompact(isbn)
    if (!/^97[89]\d{10}$/.test(compact) || !isbnValide(compact)) {
      setErreurIsbn(
        /^\d{9}[\dX]$/.test(compact)
          ? 'Il me faut l’ISBN à 13 chiffres : il commence par 978 ou 979.'
          : 'Cet ISBN ne semble pas juste : 13 chiffres, à vérifier sur le livre.',
      )
      refIsbn.current?.focus()
      return
    }
    setErreurIsbn(null)
    setMessage(null)
    setRecherche('isbn')
    try {
      // D'abord ma bibliothèque : inutile d'interroger les catalogues pour un livre que j'ai déjà noté.
      const deja = await depot.trouverParIsbn(compact)
      if (deja.ok && deja.trouve) {
        const connue = oeuvres?.find((o) => o.id === deja.trouve?.id)
        return setEtape({ nom: 'deja', oeuvre: deja.trouve.id, titre: connue?.titre ?? null, tome: deja.trouve.tome })
      }
      const reponse = await assistant.chercherIsbn(compact)
      if (!reponse.ok) return setMessage({ pour: 'isbn', texte: ECHECS[reponse.echec] })
      if (!reponse.valeur.trouve) {
        return setMessage({ pour: 'isbn', texte: 'Aucun catalogue ne connaît cet ISBN. Je vérifie les chiffres, ou je cherche par le titre.' })
      }
      suite({ ...depuisNotice(reponse.valeur.notice, compact), couverture: reponse.valeur.couverture, descriptions: reponse.valeur.descriptions }, compact)
    } finally {
      setRecherche(null)
    }
  }

  async function chercherParTitre(evenement: FormEvent) {
    evenement.preventDefault()
    if (!enLigne || recherche) return
    const cherche = titre.trim()
    if (!cherche) {
      setErreurTitre('Il me faut au moins le titre.')
      refTitre.current?.focus()
      return
    }
    setErreurTitre(null)
    setMessage(null)
    setRecherche('titre')
    try {
      const reponse = await assistant.chercherTitre(cherche, auteur.trim() || undefined)
      if (!reponse.ok) return setMessage({ pour: 'titre', texte: ECHECS[reponse.echec] })
      if (reponse.valeur.resultats.length === 0) {
        return setMessage({ pour: 'titre', texte: 'Aucun catalogue ne connaît ce titre. Je vérifie l’orthographe, ou je saisis la fiche moi-même.' })
      }
      setEtape({ nom: 'resultats', resultats: reponse.valeur.resultats })
    } finally {
      setRecherche(null)
    }
  }

  const choisir = (resultat: Resultat) =>
    suite({ ...depuisResultat(resultat), couverture: resultat.couverture, descriptions: resultat.descriptions }, null)

  if (etape.nom === 'formulaire') return <Formulaire initial={null} apport={etape.apport} />

  const retourAuChoix = () => setEtape({ nom: 'choix' })
  const entete =
    etape.nom === 'choix' ? (
      <button type="button" onClick={() => revenir(LIENS.bibliotheque)} className={`${BOUTON_DISCRET} self-start`}>
        Annuler
      </button>
    ) : (
      <button type="button" onClick={retourAuChoix} className={`${BOUTON_DISCRET} self-start`}>
        Retour à la recherche
      </button>
    )

  if (etape.nom === 'resultats') {
    return (
      <Page entete={entete}>
        <div className="flex max-w-3xl flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1 ref={refEntete} tabIndex={-1} className="m-0 font-titre text-[2.125rem] leading-[1.1] outline-none tablette:text-[2.5rem]">
              Quelle œuvre ?
            </h1>
            <p className="m-0 max-w-[60ch] text-discret">Je choisis la bonne : sa fiche se remplit, et je relis tout avant d’enregistrer.</p>
          </div>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {etape.resultats.map((resultat, rang) => (
              <li key={rang}>
                <CarteResultat resultat={resultat} choisir={() => choisir(resultat)} />
              </li>
            ))}
          </ul>
          <Bouton variante="secondaire" onClick={retourAuChoix} className="self-start">
            Aucune ne convient
          </Bouton>
        </div>
      </Page>
    )
  }

  if (etape.nom === 'deja') {
    const nom = etape.titre
    return (
      <Page entete={entete}>
        <Avertissement refEntete={refEntete} titre="Déjà dans ma bibliothèque">
          <p className="m-0 max-w-[60ch] text-[1.0625rem] leading-relaxed">
            {!nom
              ? 'Cet ISBN est déjà dans ma bibliothèque.'
              : etape.tome
                ? `Cet ISBN est celui du tome ${etape.tome} de « ${nom} », déjà dans ma bibliothèque.`
                : `Cet ISBN est celui de « ${nom} », déjà dans ma bibliothèque.`}
          </p>
          <a href={LIENS.oeuvre(etape.oeuvre)} aria-label={nom ? `Ouvrir sa fiche : ${nom}` : undefined} className={`${LIEN_PLEIN} self-start`}>
            Ouvrir sa fiche
          </a>
        </Avertissement>
      </Page>
    )
  }

  if (etape.nom === 'proche') {
    const { apport, isbn: isbnTrouve } = etape
    const edition = apport.etat.editions[0]
    const ajouterEdition = (oeuvre: OeuvreListee) => {
      if (!isbnTrouve) return
      confierEdition({
        oeuvre: oeuvre.id,
        edition: { publisher: edition?.publisher ?? '', language: edition?.language ?? '', translator: edition?.translator ?? '', isbn: isbnTrouve, pageCount: edition?.pageCount ?? '' },
        tome: apport.tome,
      })
      window.location.hash = LIENS.modifier(oeuvre.id)
    }
    return (
      <Page entete={entete}>
        <Avertissement refEntete={refEntete} titre="Déjà dans ma bibliothèque ?">
          <ul className="m-0 flex list-none flex-col gap-6 p-0">
            {etape.oeuvres.map((oeuvre) => (
              <li key={oeuvre.id} className="flex flex-col gap-4">
                <p className="m-0 max-w-[60ch] text-[1.0625rem] leading-relaxed">
                  « {oeuvre.titre} »{oeuvre.auteurs.length > 0 ? `, de ${oeuvre.auteurs.join(', ')},` : ''} est déjà dans ma bibliothèque.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a href={LIENS.oeuvre(oeuvre.id)} aria-label={`Ouvrir sa fiche : ${oeuvre.titre}`} className={LIEN_PLEIN}>
                    Ouvrir sa fiche
                  </a>
                  {isbnTrouve && (
                    <Bouton
                      variante="secondaire"
                      aria-label={`${apport.tome ? 'Noter ce tome sur sa fiche' : 'Ajouter cette édition à sa fiche'} : ${oeuvre.titre}`}
                      onClick={() => ajouterEdition(oeuvre)}
                    >
                      {apport.tome ? 'Noter ce tome sur sa fiche' : 'Ajouter cette édition à sa fiche'}
                    </Bouton>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Bouton variante="secondaire" onClick={() => setEtape({ nom: 'formulaire', apport })} className="self-start">
            C’est une autre œuvre, continuer
          </Bouton>
        </Avertissement>
      </Page>
    )
  }

  return (
    <Page entete={entete}>
      <div className="flex max-w-4xl flex-col gap-10">
        <div className="flex flex-col gap-3">
          <TitrePage>Ajouter une œuvre</TitrePage>
          {!enLigne && <p className={MESSAGE}>Hors connexion : la recherche reprendra au retour du réseau. Le formulaire complet reste ouvert.</p>}
        </div>

        <section aria-labelledby="ajout-automatique" className="flex flex-col gap-7 rounded-panneau border border-bordure bg-surface p-6 shadow-douce tablette:p-8">
          <div className="flex flex-col gap-2">
            <h2 id="ajout-automatique" className="m-0 font-titre text-2xl">
              Remplir automatiquement
            </h2>
            <p className="m-0 max-w-[60ch] text-discret">
              Ichnos interroge la BnF, Google Books et Open Library. Je relis tout avant d’enregistrer.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 min-[64rem]:grid-cols-2 min-[64rem]:gap-12">
            <form noValidate onSubmit={chercherParIsbn} className="flex flex-col gap-4">
              <ChampTexte
                ref={refIsbn}
                libelle="ISBN à 13 chiffres"
                aide="Au dos de mon exemplaire, sous le code-barres. Tirets et espaces acceptés."
                erreur={erreurIsbn}
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="search"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
              />
              <Bouton type="submit" occupe={recherche !== null || !enLigne} className="self-start">
                {recherche === 'isbn' ? 'Je cherche…' : 'Chercher ce livre'}
              </Bouton>
              <Retour recherche={recherche === 'isbn'} message={message?.pour === 'isbn' ? message.texte : null} />
            </form>

            <form
              noValidate
              onSubmit={chercherParTitre}
              className="flex flex-col gap-4 border-t border-bordure pt-8 min-[64rem]:border-t-0 min-[64rem]:border-l min-[64rem]:pt-0 min-[64rem]:pl-12"
            >
              <ChampTexte
                ref={refTitre}
                libelle="Titre"
                aide="Sans édition précise en tête : la fiche commune à toutes les éditions, sans ISBN, éditeur ni pagination."
                erreur={erreurTitre}
                autoComplete="off"
                enterKeyHint="search"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
              />
              <ChampTexte
                libelle="Auteur"
                aide="Facultatif : il départage les homonymes."
                autoComplete="off"
                enterKeyHint="search"
                value={auteur}
                onChange={(e) => setAuteur(e.target.value)}
              />
              <Bouton type="submit" variante="secondaire" occupe={recherche !== null || !enLigne} className="self-start">
                {recherche === 'titre' ? 'Je cherche…' : 'Chercher cette œuvre'}
              </Bouton>
              <Retour recherche={recherche === 'titre'} message={message?.pour === 'titre' ? message.texte : null} />
            </form>
          </div>
        </section>

        <section aria-labelledby="ajout-manuel" className="flex flex-col items-start gap-3">
          <h2 id="ajout-manuel" className="m-0 font-titre text-2xl">
            Tout saisir moi-même
          </h2>
          <p className="m-0 max-w-[60ch] text-discret">Le formulaire complet, sans recherche : chaque champ est le mien.</p>
          <a href={LIENS.ajouterManuel} aria-label="Ouvrir le formulaire complet" className={`${LIEN_BORDE} mt-1`}>
            Ouvrir le formulaire
          </a>
        </section>
      </div>
    </Page>
  )
}

/** Sous un formulaire de recherche : ce qui se passe, ou ce qui n'a rien donné. L'état est porté par data-etat, pour l'étape 9. */
function Retour({ recherche, message }: { recherche: boolean; message: string | null }) {
  return (
    <div data-etat={recherche || message ? 'ouvert' : 'ferme'} className="flex flex-col">
      <p role="status" className="m-0 text-sm text-discret empty:hidden">
        {recherche ? 'Je cherche dans les catalogues…' : ''}
      </p>
      {message && !recherche && (
        <p role="alert" className={MESSAGE}>
          {message}
        </p>
      )}
    </div>
  )
}

function Avertissement({ titre, refEntete, children }: { titre: string; refEntete: React.RefObject<HTMLHeadingElement | null>; children: ReactNode }) {
  return (
    <div className="flex max-w-3xl flex-col gap-7">
      <h1 ref={refEntete} tabIndex={-1} className="m-0 font-titre text-[2.125rem] leading-[1.1] outline-none tablette:text-[2.5rem]">
        {titre}
      </h1>
      {children}
    </div>
  )
}

/** Un résultat de recherche : tout le bloc est un bouton, nommé pour VoiceOver (« Momo, de Michael Ende : choisir cette œuvre »). */
function CarteResultat({ resultat, choisir }: { resultat: Resultat; choisir: () => void }) {
  const titre = resultat.titre.valeur
  const auteurs = resultat.auteurs?.valeur.join(', ') ?? null
  const original = resultat.titreOriginal && resultat.titreOriginal.valeur.toLocaleLowerCase('fr') !== titre.toLocaleLowerCase('fr') ? resultat.titreOriginal.valeur : null
  const langue = nomLangue(resultat.langueOriginale?.valeur)
  const reperes = [
    original ? `Titre original : ${original}` : langue ? `Écrit en ${langue}` : null,
    resultat.annee ? String(resultat.annee.valeur) : null,
    resultat.serie ? 'Série en tomes' : null,
  ].filter(Boolean)
  return (
    <button
      type="button"
      onClick={choisir}
      aria-label={`${titre}${auteurs ? `, de ${auteurs}` : ''} : choisir cette œuvre`}
      className="flex min-h-16 w-full cursor-pointer flex-col items-start gap-1 rounded-carte border border-bordure bg-surface px-5 py-4 text-left text-encre transition-transform duration-200 active:scale-[0.99]"
    >
      <span className="font-titre text-xl leading-tight">{titre}</span>
      {auteurs && <span className="text-[0.9375rem]">{auteurs}</span>}
      {reperes.length > 0 && <span className="text-sm text-discret">{reperes.join(' · ')}</span>}
    </button>
  )
}
