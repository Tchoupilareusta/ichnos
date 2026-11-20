import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { EchecAssistant, FicheProposee, ImageTrouvee } from '../ajout/assistant'
import { editionConfiee, oublierEdition, type Apport, type EditionAAjouter } from '../ajout/passage'
import { appliquerProposition, libelleSource, pourFiche, type ChampPropose, type CleProvenance, type Provenance } from '../ajout/preremplir'
import { LANGUES, nomLangue } from '../catalogue/langues'
import { ChercherEdition, type EditionTrouvee } from '../achat/ChercherEdition'
import type { EchecEcriture, OeuvreDetaillee, Vocabulaire } from '../bibliotheque/depot'
import type { CibleCouverture } from '../couvertures/choix'
import { ApercuCouverture, type CouvertureChoisie } from '../couvertures/ApercuCouverture'
import { CouvertureModifiable, couvertureRangee, type ChoixCouverture } from '../couvertures/CouvertureModifiable'
import { BarreSaisie, type Message } from '../composants/BarreSaisie'
import { useMasquerNavigation } from '../navigation/saisie'
import {
  ajusterTomes,
  etatDepuisOeuvre,
  etatVide,
  idChamp,
  ligneAuteur,
  ligneEdition,
  ligneMedia,
  valider,
  versEnvoi,
  type EtatFormulaire,
  type Erreurs,
} from '../bibliotheque/formulaire'
import { FORMES, GENRES_ETIQUETTES, isbnCompact, isbnValide, LONGUEURS, ROLES, TYPES_MEDIA, type GenreEtiquette, type Role, type TypeMedia } from '../bibliotheque/modele'
import { EchecDepot, useEnregistrerOeuvre, useModifierOeuvre, useOeuvre, useVocabulaire } from '../bibliotheque/requetes'
import { useSession } from '../session/Session'
import { Bouton } from '../composants/Bouton'
import { CHAMP, ChampListe, ChampLong, ChampTexte, Pastilles } from '../composants/Champs'
import { ChampIsbn } from '../composants/Isbn'
import { Dialogue } from '../composants/Dialogue'
import { IconeAjouter, IconeChevronBas, IconeFermer, IconeSupprimer } from '../composants/Icones'
import { BoutonPrincipal, EtatVide, Page, TitrePage } from '../composants/Page'
import { Repli } from '../composants/Repli'
import { LIENS } from '../navigation/routes'
import { useEnLigne } from '../navigation/useEnLigne'
import { peutRevenir, remplacer, revenir, useRoute } from '../navigation/useRoute'

/** « Modifier » : le formulaire rempli avec la fiche. */
export function Modifier() {
  const { id } = useRoute()
  const requete = useOeuvre(id ?? '')
  if (requete.data) return <Formulaire key={requete.data.id} initial={requete.data} />
  return (
    <Page>
      <TitrePage>Modifier la fiche</TitrePage>
      {requete.isPending && (
        <p role="status" className="m-0 text-discret">
          Ouverture de la fiche…
        </p>
      )}
      {requete.isError && (
        <EtatVide action={<BoutonPrincipal href={LIENS.bibliotheque}>Revenir à ma bibliothèque</BoutonPrincipal>}>
          <span role="alert">
            {requete.error.echec === 'introuvable'
              ? 'Cette œuvre n’est pas, ou plus, dans ma bibliothèque.'
              : 'La fiche n’a pas pu s’ouvrir. Réessayer au retour du réseau.'}
          </span>
        </EtatVide>
      )}
    </Page>
  )
}

const ECHECS: Record<EchecEcriture, string> = {
  reseau: 'Pas de connexion à internet : rien n’a été enregistré. Ma saisie reste là : réessayer au retour du réseau.',
  invalide: 'La base a refusé une des valeurs : rien n’a été enregistré. Vérifier les champs, puis réessayer.',
  introuvable: 'Cette œuvre n’est plus dans ma bibliothèque : rien n’a été enregistré.',
  inconnu: 'L’enregistrement n’a pas abouti, et rien n’a été enregistré. Réessayer dans un instant.',
}

const TONALITES = [
  { valeur: '1', libelle: 'Sombre' },
  { valeur: '2', libelle: 'Grave' },
  { valeur: '3', libelle: 'Nuancée' },
  { valeur: '4', libelle: 'Douce' },
  { valeur: '5', libelle: 'Lumineuse' },
]
// « Difficulté de lecture » (la valeur « exigence » en base) : du plus facile au plus exigeant.
// « Modérée » plutôt que « Moyenne », pour ne pas se confondre avec la longueur.
const EXIGENCES = [
  { valeur: '1', libelle: 'Très facile' },
  { valeur: '2', libelle: 'Facile' },
  { valeur: '3', libelle: 'Modérée' },
  { valeur: '4', libelle: 'Soutenue' },
  { valeur: '5', libelle: 'Exigeante' },
]
const INCONNU = { valeur: '', libelle: 'Je ne sais pas' }
const INDICATIONS: Record<GenreEtiquette, string> = { genre: 'Un genre…', theme: 'Un thème…', atmosphere: 'Une atmosphère…' }

const optionsLangues = (actuelle: string) => [
  { valeur: '', libelle: 'Inconnue' },
  ...LANGUES.map((l) => ({ valeur: l.code, libelle: l.nom.charAt(0).toUpperCase() + l.nom.slice(1) })),
  // Un code que la liste ne connaît pas encore reste choisi plutôt que d'être perdu.
  ...(actuelle && !nomLangue(actuelle) ? [{ valeur: actuelle, libelle: actuelle }] : []),
]

const SANS_PROPOSITION: Record<EchecAssistant, string> = {
  limite: 'L’IA a déjà préparé ses 30 fiches du jour : remplir celle-ci à la main, ou y revenir demain.',
  reseau: 'La proposition automatique n’est pas disponible pour le moment. La fiche se remplit très bien à la main.',
  non_configure: 'La proposition automatique n’est pas disponible pour le moment. La fiche se remplit très bien à la main.',
  ia: 'La proposition automatique n’est pas disponible pour le moment. La fiche se remplit très bien à la main.',
  indisponible: 'La proposition automatique n’est pas disponible pour le moment. La fiche se remplit très bien à la main.',
}

/** Le champ « Auteur » est toujours là, en haut : une ligne vide l'attend si l'œuvre n'en a pas (elle n'est pas envoyée). */
function avecAuteur(etat: EtatFormulaire): EtatFormulaire {
  return etat.auteurs.some((a) => a.role === 'auteur') ? etat : { ...etat, auteurs: [ligneAuteur(), ...etat.auteurs] }
}

const libelleDe = <T extends string>(liste: { valeur: T; libelle: string }[], valeur: T | null | undefined) => liste.find((x) => x.valeur === valeur)?.libelle ?? null
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`

/** Les résumés d'une ligne des sections repliées : ce qu'elles contiennent, sans les ouvrir. */
function resumeDescription(etat: EtatFormulaire): string {
  const noms = etat.etiquettes.map((e) => e.nom)
  const etiquettes = noms.length === 0 ? 'aucune étiquette' : `${noms.slice(0, 2).join(', ')}${noms.length > 2 ? ` +${noms.length - 2}` : ''}`
  const tonalite = libelleDe(TONALITES, etat.tonalite === null ? null : String(etat.tonalite))
  return [etat.synopsis.trim() ? 'Résumé' : 'Sans résumé', etiquettes, tonalite?.toLocaleLowerCase('fr')].filter(Boolean).join(' · ')
}
function resumeDetails(etat: EtatFormulaire): string {
  const autres = etat.auteurs.filter((a) => a.role !== 'auteur' && a.nom.trim())
  return (
    [
      etat.titreOriginal.trim() && etat.titreOriginal.trim() !== etat.titreFr.trim() ? etat.titreOriginal.trim() : null,
      etat.langueOriginale ? nomLangue(etat.langueOriginale) : null,
      etat.annee.trim() || null,
      libelleDe(FORMES, etat.forme)?.toLocaleLowerCase('fr'),
      etat.estSerie ? 'série' : null,
      autres.length ? pluriel(autres.length, 'autre personne', 'autres personnes') : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Titre original, langue, année, forme'
  )
}
function resumeMedias(etat: EtatFormulaire): string {
  const medias = etat.medias.map((m) => libelleDe(TYPES_MEDIA, m.type)?.toLocaleLowerCase('fr') ?? 'adaptation')
  return [etat.estSerie ? pluriel(etat.tomes.length, 'tome', 'tomes') : null, medias.length ? medias.join(', ') : 'aucune adaptation'].filter(Boolean).join(' · ')
}
function resumeEditions(autres: EtatFormulaire['editions']): string {
  if (autres.length === 0) return 'Aucune autre édition notée'
  const editeurs = [...new Set(autres.map((e) => e.publisher.trim()).filter(Boolean))]
  return [pluriel(autres.length, 'édition', 'éditions'), editeurs.join(', ')].filter(Boolean).join(' · ')
}

/** Une édition (ou l'ISBN d'un tome) trouvée par la recherche, ajoutée à la fiche d'une œuvre que j'ai déjà. */
function avecEditionConfiee(etat: EtatFormulaire, confiee: EditionAAjouter): EtatFormulaire {
  if (confiee.tome !== null) {
    const numero = confiee.tome
    const tomes = etat.tomes.length >= numero ? etat.tomes : ajusterTomes(etat.tomes, numero)
    return { ...etat, estSerie: true, tomes: tomes.map((t) => (t.numero === numero ? { ...t, isbn: confiee.edition.isbn } : t)) }
  }
  return { ...etat, editions: [...etat.editions, { ...ligneEdition(), ...confiee.edition }] }
}

/**
 * Le formulaire d'une œuvre. `initial` : la fiche à modifier. `apport` : ce que la recherche
 * automatique a trouvé pour une œuvre nouvelle (tout y reste modifiable, rien n'est enregistré avant validation).
 */
export function Formulaire({ initial, apport = null }: { initial: OeuvreDetaillee | null; apport?: Apport | null }) {
  const enLigne = useEnLigne()
  const { depot, assistant, couvertures } = useSession()
  const vocabulaire = useVocabulaire().data ?? { etiquettes: [], auteurs: [] }
  const enregistrement = useEnregistrerOeuvre()
  // La barre « Annuler / Enregistrer » prend la place de la navigation tant que le formulaire est là.
  useMasquerNavigation()
  const [depart] = useState(() => avecAuteur(initial ? etatDepuisOeuvre(initial) : etatVide()))
  const [etat, setEtat] = useState<EtatFormulaire>(() => {
    const confiee = initial ? editionConfiee(initial.id) : null
    return apport?.etat ?? (confiee ? avecEditionConfiee(depart, confiee) : depart)
  })
  // L'édition confiée par l'écran « Ajouter » est reprise une seule fois.
  useEffect(() => oublierEdition(), [])
  // Ouvert par la recherche automatique, le formulaire remplace l'écran précédent sans changer d'adresse :
  // VoiceOver et le clavier repartent du début du contenu, en haut de la page.
  const ouvertParLaRecherche = apport !== null
  useEffect(() => {
    if (!ouvertParLaRecherche) return
    window.scrollTo(0, 0)
    document.getElementById('contenu')?.focus({ preventScroll: true })
  }, [ouvertParLaRecherche])

  // D'où vient chaque champ rempli par la recherche. Dès que je corrige un champ, sa source ne vaut plus.
  const [provenance, setProvenance] = useState<Provenance>(apport?.provenance ?? {})
  const cleEditionTrouvee = apport?.etat.editions[0]?.cle ?? null
  const oublierSource = (cle: CleProvenance) => setProvenance((avant) => (cle in avant ? { ...avant, [cle]: undefined } : avant))
  const aideSource = (cle: CleProvenance, parDefaut?: string) => {
    const source = provenance[cle]
    if (!source) return parDefaut
    // Open Library date parfois une traduction : cette année-là se vérifie.
    if (cle === 'annee' && source === 'open_library') return 'D’après Open Library, à vérifier : c’est parfois l’année d’une traduction.'
    return `D’après ${libelleSource(source)}.`
  }

  // La couverture trouvée : un aperçu, rangé seulement à la validation et si je la garde.
  const refCouverture = apport?.couverture ?? null
  const apercu = useQuery<ImageTrouvee | null>({
    queryKey: ['apercu-couverture', JSON.stringify(refCouverture)],
    queryFn: async () => {
      const reponse = refCouverture ? await assistant.couverture({ ref: refCouverture }) : null
      return reponse?.ok ? reponse.valeur : null
    },
    enabled: refCouverture !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const imageTrouvee = apercu.data ?? null
  const adresseApercu = useMemo(() => (imageTrouvee ? URL.createObjectURL(imageTrouvee.image) : null), [imageTrouvee])
  useEffect(() => () => void (adresseApercu && URL.revokeObjectURL(adresseApercu)), [adresseApercu])
  const [garderCouverture, setGarderCouverture] = useState(true)
  /** Sans couverture trouvée pour mon ISBN : la photo de mon exemplaire, ou une autre édition, que j'apporte moi-même. */
  const [couvertureChoisie, setCouvertureChoisie] = useState<CouvertureChoisie | null>(null)

  // La proposition de l'IA : demandée une seule fois, à partir de ce que les catalogues ont trouvé.
  const pourIA = useMemo(() => (apport ? pourFiche(apport.etat, apport.descriptions) : null), [apport])
  const proposition = useQuery<FicheProposee, EchecDepot<EchecAssistant>>({
    queryKey: ['fiche-proposee', JSON.stringify(pourIA)],
    queryFn: async () => {
      const reponse = await assistant.proposerFiche(pourIA as NonNullable<typeof pourIA>)
      if (!reponse.ok) throw new EchecDepot(reponse.echec)
      return reponse.valeur
    },
    enabled: pourIA !== null,
    // Un appel payant : jamais relancé tout seul (ni au retour dans l'appli, ni après un échec).
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  })
  const [proposes, setProposes] = useState<ChampPropose[]>([])
  const [themesNouveaux, setThemesNouveaux] = useState<string[]>([])
  const etatCourant = useRef(etat)
  etatCourant.current = etat
  const versee = useRef(false)
  useEffect(() => {
    const fiche = proposition.data
    if (!fiche || versee.current) return
    versee.current = true
    // Seuls les champs encore vides sont remplis : ce que j'ai écrit entre-temps reste.
    const { etat: suite, remplis } = appliquerProposition(etatCourant.current, fiche)
    setEtat(suite)
    setProposes(remplis)
    setThemesNouveaux(fiche.themesNouveaux)
  }, [proposition.data])
  const messageIA = !pourIA
    ? null
    : proposition.isPending
      ? 'Une proposition de résumé et d’étiquettes se prépare…'
      : proposition.error
        ? SANS_PROPOSITION[proposition.error.echec]
        : proposition.data && !proposition.data.synopsis
          ? 'L’IA ne connaît pas assez cette œuvre pour en proposer un résumé : il reste à écrire.'
          : null
  const propose = (champ: ChampPropose) => proposes.includes(champ)
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const [abandon, setAbandon] = useState(false)
  const [annonce, setAnnonce] = useState<string | null>(null)
  const resume = useRef<HTMLParagraphElement>(null)
  const idFormulaire = useId()

  const modifie = JSON.stringify(etat) !== JSON.stringify(depart)
  const titre = initial ? 'Modifier la fiche' : 'Ajouter une œuvre'
  const retour = initial ? LIENS.oeuvre(initial.id) : LIENS.bibliotheque

  useEffect(() => {
    document.title = `${titre} · Ichnos`
  }, [titre])

  const maj = (changement: Partial<EtatFormulaire>) => setEtat((avant) => ({ ...avant, ...changement }))
  /** Je corrige un champ rempli par la recherche : sa source est oubliée. */
  const majSource = (cle: CleProvenance, changement: Partial<EtatFormulaire>) => {
    maj(changement)
    oublierSource(cle)
  }

  // La couverture, comme tout le reste, attend « Enregistrer » : une nouvelle image reste sur
  // l'appareil (rien n'est envoyé si j'annule), un retrait reste à l'écran.
  const [choixCouverture, setChoixCouverture] = useState<ChoixCouverture>({ etat: 'inchangee' })
  const [messageTemporaire, setMessageTemporaire] = useState<Message | null>(null)
  const effacerMessage = useCallback(() => setMessageTemporaire(null), [])
  function changerCouverture(nouveau: ChoixCouverture) {
    const avant = choixCouverture
    setChoixCouverture(nouveau)
    setMessageTemporaire({ cle: Date.now(), texte: nouveau.etat === 'nouvelle' ? 'Nouvelle couverture' : 'Couverture retirée', annuler: () => setChoixCouverture(avant),
      nomAnnuler: nouveau.etat === 'nouvelle' ? 'Annuler : reprendre la couverture d’avant' : 'Annuler : remettre la couverture',
    })
  }

  // « Chercher cette édition » : le panneau, et une phrase une fois l'édition reportée.
  const [chercheEdition, setChercheEdition] = useState(false)
  const [noteEdition, setNoteEdition] = useState<string | null>(null)
  const mienne = etat.editions.find((e) => e.cle === etat.mienne) ?? null

  function appliquerEdition(trouvee: EditionTrouvee) {
    setChercheEdition(false)
    if (!mienne) return
    maj({ editions: etat.editions.map((e) => (e.cle === mienne.cle ? { ...e, ...trouvee.champs } : e)) })
    if (trouvee.image) changerCouverture({ etat: 'nouvelle', image: trouvee.image })
    setNoteEdition(trouvee.image ? 'C’est reporté dans mon édition, avec sa couverture. « Enregistrer » pour le garder.' : 'C’est reporté dans mon édition. « Enregistrer » pour le garder.')
  }

  /**
   * Une fois la fiche enregistrée, la couverture. Celle trouvée à l'ajout va sur mon édition, le tome
   * ou l'œuvre. Dans « Modifier » : une image retirée l'est de partout où elle était rangée ; une
   * nouvelle image est rangée (réduite) seulement maintenant, là où elle s'affichera.
   */
  async function rangerCouverture(id: string) {
    const trouveeGardee = apport ? (couvertureChoisie?.image ?? (imageTrouvee && garderCouverture ? imageTrouvee.image : null)) : null
    if (apport && trouveeGardee) {
      const deposee = await couvertures.deposer(trouveeGardee)
      if (deposee.ok) {
        let cible: CibleCouverture = { type: 'oeuvre' }
        if (apport.tome !== null) {
          cible = { type: 'tome', numero: apport.tome }
        } else if (cleEditionTrouvee && etat.mienne === cleEditionTrouvee) {
          // L'identifiant de l'édition n'existe qu'une fois la fiche enregistrée.
          const lecture = await depot.lireOeuvre(id)
          if (lecture.ok && lecture.oeuvre.monEdition) cible = { type: 'edition', edition: lecture.oeuvre.monEdition }
        }
        await depot.definirCouverture(id, cible, deposee.chemin)
      }
    }
    couvertureRatee.current = false
    if (choixCouverture.etat === 'retiree' && initial) {
      for (const cible of couvertureRangee(initial).cibles) {
        if (!(await depot.definirCouverture(id, cible, null)).ok) couvertureRatee.current = true
      }
    }
    if (choixCouverture.etat === 'nouvelle') {
      const deposee = await couvertures.deposer(choixCouverture.image)
      if (!deposee.ok) return void (couvertureRatee.current = true)
      // Là où elle s'affichera : sur mon édition (telle qu'enregistrée à l'instant), sinon sur l'œuvre.
      // Pour une série, sur la série elle-même : ses tomes se règlent un par un, dans leur panneau.
      const lecture = await depot.lireOeuvre(id)
      const monEdition = lecture.ok && !lecture.oeuvre.estSerie ? lecture.oeuvre.monEdition : null
      const rangee = await depot.definirCouverture(id, monEdition ? { type: 'edition', edition: monEdition } : { type: 'oeuvre' }, deposee.chemin)
      if (!rangee.ok) couvertureRatee.current = true
    }
  }
  /** Dans « Modifier » : la fiche est enregistrée, mais pas la couverture. L'écran reste ouvert pour réessayer. */
  const couvertureRatee = useRef(false)

  function quitter() {
    if (modifie || choixCouverture.etat !== 'inchangee' || couvertureChoisie !== null) setAbandon(true)
    else revenir(retour)
  }

  function enregistrer(evenement: FormEvent) {
    evenement.preventDefault()
    if (!enLigne || enregistrement.isPending) return
    const trouvees = valider(etat)
    setErreurs(trouvees)
    const premiere = Object.keys(trouvees)[0]
    if (premiere) {
      setAnnonce(
        Object.keys(trouvees).length === 1
          ? 'Un champ est à revoir avant d’enregistrer.'
          : 'Quelques champs sont à revoir avant d’enregistrer.',
      )
      // Un champ à revoir dans une section repliée : elle s'ouvre d'abord.
      const champ = document.getElementById(premiere)
      const repli = champ?.closest('details')
      if (repli) repli.open = true
      champ?.focus()
      return
    }
    setAnnonce(null)
    enregistrement.mutate({ fiche: versEnvoi(etat, initial?.id), apres: rangerCouverture }, {
      onSuccess: (id) => {
        if (initial && couvertureRatee.current) {
          setAnnonce('La fiche est enregistrée, mais pas la couverture. « Enregistrer » à nouveau pour réessayer.')
          return resume.current?.focus()
        }
        // Nouvelle œuvre : sa fiche s'ouvre à la place du formulaire, pour y choisir statut et possession.
        if (!initial || !peutRevenir()) remplacer(LIENS.oeuvre(id))
        else revenir(LIENS.oeuvre(id))
      },
      onError: () => resume.current?.focus(),
    })
  }

  const message = annonce ?? (enregistrement.error ? ECHECS[enregistrement.error.echec] : null)

  // L'ordre suit ce que je change le plus souvent. En modification : la couverture, mon édition, puis
  // le titre et l'auteur. À l'ajout, le titre passe d'abord : c'est par lui qu'une œuvre commence.
  const autresEditions = etat.editions.filter((e) => e.cle !== etat.mienne)
  const blocEdition = (
    <Bloc titre="Mon édition" id="editions">
      <MonEdition
        etat={etat}
        maj={maj}
        erreurs={erreurs}
        trouvee={cleEditionTrouvee}
        aideSource={aideSource}
        oublierSource={oublierSource}
        isbnDepart={depart.editions.find((e) => e.cle === etat.mienne)?.isbn ?? ''}
        chercher={() => {
          setNoteEdition(null)
          setChercheEdition(true)
        }}
        note={noteEdition}
      />
    </Bloc>
  )
  const blocTitre = (
    <Bloc titre="Titre et auteur">
      <ChampTexte
        id={idChamp.titreFr}
        libelle="Titre"
        aide={aideSource('titreFr')}
        value={etat.titreFr}
        onChange={(e) => majSource('titreFr', { titreFr: e.target.value })}
        erreur={erreurs[idChamp.titreFr]}
        required
        autoComplete="off"
      />
      <AuteursPrincipaux etat={etat} maj={(changement) => majSource('auteurs', changement)} connus={vocabulaire.auteurs} aide={aideSource('auteurs')} />
    </Bloc>
  )

  // Sur iPad, la couverture reste à gauche pendant que je fais défiler les champs, à droite.
  const avecCouverture = initial !== null || apport !== null
  return (
    <Page>
      <form id={idFormulaire} noValidate onSubmit={enregistrer} className={`flex flex-col gap-10 ${avecCouverture ? 'max-w-2xl tablette:max-w-none' : 'max-w-2xl'}`}>
        <div className="flex flex-col gap-3">
          <TitrePage>{titre}</TitrePage>
          {apport && (
            <p className="m-0 max-w-[60ch] text-discret">Voici ce que les catalogues ont trouvé. À relire et corriger : rien n’est enregistré avant « Enregistrer ».</p>
          )}
          {!enLigne && (
            <p className="m-0 max-w-[60ch] rounded-carte bg-accent-doux px-5 py-4 text-[0.9375rem] font-semibold text-accent-texte">
              Hors connexion : la fiche peut être préparée, puis enregistrée au retour du réseau.
            </p>
          )}
          <p
            ref={resume}
            tabIndex={-1}
            role="alert"
            className="m-0 max-w-[60ch] rounded-carte bg-accent-doux px-5 py-4 text-[0.9375rem] font-semibold text-accent-texte empty:hidden"
          >
            {message ?? ''}
          </p>
        </div>

        <div className={`flex flex-col gap-10 ${avecCouverture ? 'tablette:grid tablette:grid-cols-[14.5rem_minmax(0,40rem)] tablette:items-start tablette:gap-x-14' : ''}`}>
          {initial ? (
            <div className="tablette:sticky tablette:top-[calc(env(safe-area-inset-top)+2rem)]">
              <CouvertureModifiable oeuvre={initial} titre={etat.titreFr} enLigne={enLigne} choix={choixCouverture} changer={changerCouverture} />
            </div>
          ) : (
            apport && (
              <ApercuCouverture
                titre={etat.titreFr}
                cherche={refCouverture !== null && apercu.isPending}
                trouvee={imageTrouvee}
                adresse={adresseApercu}
                garder={garderCouverture}
                setGarder={setGarderCouverture}
                // Avec mon exemplaire en main (ajout par ISBN) : sa photo, ou une autre édition pour une œuvre.
                sans={
                  apport.tome !== null || apport.etat.editions[0]?.isbn
                    ? {
                        choisie: couvertureChoisie,
                        surChoix: setCouvertureChoisie,
                        enLigne,
                        autres:
                          apport.tome === null
                            ? {
                                titre: etat.titreFr,
                                auteur: etat.auteurs.find((a) => a.role === 'auteur')?.nom ?? '',
                                langue: mienne?.language === 'en' ? 'en' : 'fr',
                                isbn: mienne?.isbn ? isbnCompact(mienne.isbn) : null,
                                editeur: mienne?.publisher || null,
                              }
                            : null,
                      }
                    : undefined
                }
              />
            )
          )}

          <div className="flex min-w-0 flex-col gap-10">
            {initial ? (
              <>
                {blocEdition}
                {blocTitre}
              </>
            ) : (
              <>
                {blocTitre}
                {blocEdition}
              </>
            )}

            <div className="flex flex-col">
              <Repli titre="Description et étiquettes" resume={resumeDescription(etat)} ouvertAuDepart={pourIA !== null}>
                {/* Élément toujours présent : son contenu change, son état est porté par data-etat (étape 9). */}
                <p role="status" data-etat={messageIA ? 'ouvert' : 'ferme'} className="m-0 max-w-[60ch] text-[0.9375rem] text-discret empty:hidden">
                  {messageIA ?? ''}
                </p>
                <ChampLong
                  libelle="Résumé"
                  aide={
                    propose('synopsis') && etat.synopsis === proposition.data?.synopsis
                      ? 'Proposé par l’IA d’après les catalogues : à relire et à corriger.'
                      : initial
                        ? undefined
                        : 'Écrit avec mes mots, sans rien dévoiler de la fin.'
                  }
                  value={etat.synopsis}
                  onChange={(e) => maj({ synopsis: e.target.value })}
                />
                {propose('etiquettes') && <p className="m-0 text-sm text-discret">Étiquettes proposées par l’IA dans mon vocabulaire : retirer ce qui ne convient pas.</p>}
                {GENRES_ETIQUETTES.map((g) => (
                  <Etiquettes key={g.valeur} genre={g.valeur} libelle={g.pluriel} etat={etat} maj={maj} vocabulaire={vocabulaire} />
                ))}
                {themesNouveaux.length > 0 && (
                  <ThemesNouveaux
                    themes={themesNouveaux}
                    ajouter={(nom) => {
                      if (!etat.etiquettes.some((e) => e.genre === 'theme' && e.nom === nom)) maj({ etiquettes: [...etat.etiquettes, { genre: 'theme', nom }] })
                      setThemesNouveaux((avant) => avant.filter((theme) => theme !== nom))
                    }}
                  />
                )}
                {(propose('tonalite') || propose('exigence') || propose('longueur')) && <p className="m-0 text-sm text-discret">Tonalité, difficulté et longueur proposées par l’IA : à ajuster.</p>}
                <Pastilles
                  legende="Tonalité"
                  options={[INCONNU, ...TONALITES]}
                  valeur={etat.tonalite === null ? '' : String(etat.tonalite)}
                  onChange={(v) => maj({ tonalite: v ? Number(v) : null })}
                />
                <Pastilles
                  legende="Difficulté de lecture"
                  options={[INCONNU, ...EXIGENCES]}
                  valeur={etat.exigence === null ? '' : String(etat.exigence)}
                  onChange={(v) => maj({ exigence: v ? Number(v) : null })}
                />
                <Pastilles
                  legende="Longueur"
                  options={[INCONNU, ...LONGUEURS.map((l) => ({ valeur: l.valeur, libelle: l.libelle }))]}
                  valeur={etat.longueur ?? ''}
                  onChange={(v) => maj({ longueur: (v || null) as EtatFormulaire['longueur'] })}
                />
              </Repli>

              <Repli titre="Détails de l’œuvre" resume={resumeDetails(etat)}>
                <div className="grid grid-cols-2 gap-4">
                  <ChampTexte
                    libelle="Titre original"
                    aide={aideSource('titreOriginal')}
                    value={etat.titreOriginal}
                    onChange={(e) => majSource('titreOriginal', { titreOriginal: e.target.value })}
                    autoComplete="off"
                    className="col-span-2"
                  />
                  <ChampListe
                    libelle="Langue d’origine"
                    aide={aideSource('langueOriginale')}
                    value={etat.langueOriginale}
                    onChange={(e) => majSource('langueOriginale', { langueOriginale: e.target.value })}
                    options={optionsLangues(etat.langueOriginale)}
                  />
                  <ChampTexte
                    id={idChamp.annee}
                    libelle="Parution"
                    aide={aideSource('annee')}
                    inputMode="numeric"
                    value={etat.annee}
                    onChange={(e) => majSource('annee', { annee: e.target.value })}
                    erreur={erreurs[idChamp.annee]}
                    autoComplete="off"
                  />
                  <ChampListe
                    libelle="Type d’œuvre"
                    value={etat.forme}
                    onChange={(e) => maj({ forme: e.target.value as EtatFormulaire['forme'] })}
                    options={FORMES.map((f) => ({ valeur: f.valeur, libelle: f.libelle }))}
                    className="col-span-2"
                  />
                </div>
                <Bascule libelle="C’est une série en plusieurs tomes" coche={etat.estSerie} onChange={(estSerie) => maj({ estSerie })} />
                <AutresPersonnes etat={etat} maj={(changement) => majSource('auteurs', changement)} connus={vocabulaire.auteurs} />
              </Repli>

              <Repli titre={etat.estSerie ? 'Tomes et médias' : 'À l’écran'} resume={resumeMedias(etat)}>
                {etat.estSerie && (
                  <>
                    {provenance.tomes && <p className="m-0 text-sm text-discret">{`Le tome ${apport?.tome} est celui de mon ISBN, d’après ${libelleSource(provenance.tomes)}.`}</p>}
                    <Tomes etat={etat} maj={maj} erreurs={erreurs} initial={initial} />
                  </>
                )}
                <Medias etat={etat} maj={maj} erreurs={erreurs} />
              </Repli>

              <Repli titre="Autres éditions" resume={resumeEditions(autresEditions)}>
                <AutresEditions etat={etat} maj={maj} erreurs={erreurs} />
              </Repli>
            </div>

            {/* Tout en bas, séparée du reste : la suppression, toujours après confirmation. */}
            {initial && <Suppression oeuvre={initial} enLigne={enLigne} />}
          </div>
        </div>
      </form>

      <BarreSaisie
        formulaire={idFormulaire}
        occupe={enregistrement.isPending || !enLigne}
        enregistrement={enregistrement.isPending}
        annuler={quitter}
        message={messageTemporaire}
        effacerMessage={effacerMessage}
      />

      {mienne && (
        <ChercherEdition
          ouvert={chercheEdition}
          isbn={mienne.isbn}
          idOeuvre={initial?.id ?? null}
          titres={[etat.titreFr, etat.titreOriginal].filter(Boolean)}
          auteur={etat.auteurs.find((a) => a.role === 'auteur')?.nom ?? ''}
          actuelle={mienne}
          fermer={() => setChercheEdition(false)}
          appliquer={appliquerEdition}
        />
      )}

      <Dialogue
        ouvert={abandon}
        titre="Abandonner mes modifications ?"
        confirmer="Abandonner"
        annuler="Continuer la saisie"
        onAnnuler={() => setAbandon(false)}
        onConfirmer={() => {
          setAbandon(false)
          revenir(retour)
        }}
      >
        <p className="m-0">{initial ? 'Aucun changement ne sera enregistré, couverture comprise.' : 'Rien de ce qui a été saisi ici ne sera enregistré.'}</p>
      </Dialogue>
    </Page>
  )
}

const ECHECS_SUPPRESSION: Record<string, string> = {
  reseau: 'Pas de connexion à internet : l’œuvre n’a pas été supprimée.',
  introuvable: 'Cette œuvre n’est déjà plus dans ma bibliothèque.',
  invalide: 'La suppression n’a pas été acceptée : rien n’a été retiré.',
  inconnu: 'La suppression n’a pas abouti, et rien n’a été retiré. Réessayer dans un instant.',
}

/**
 * Supprimer l'œuvre : rangé ici, au bas de « Modifier », plutôt qu'en fin de fiche.
 * La fiche se lit et se termine sur l'œuvre ; ce geste, rare et définitif, reste à l'écart.
 */
function Suppression({ oeuvre, enLigne }: { oeuvre: OeuvreDetaillee; enLigne: boolean }) {
  const { suppression } = useModifierOeuvre(oeuvre.id)
  const [ouvert, setOuvert] = useState(false)
  const nom = oeuvre.titreFr

  return (
    <section aria-label="Supprimer l’œuvre" className="mt-6 flex flex-col items-center gap-2 border-t border-bordure pt-10">
      {/* Fond rouge doux : l'accent doux de la palette, avec le texte accentué (contraste AA en clair et en sombre). */}
      {/* Court à l'écran pour tenir sur une ligne à 393 px ; VoiceOver entend le titre de l'œuvre. */}
      <button
        type="button"
        aria-label={`Supprimer ${nom} de ma bibliothèque`}
        aria-disabled={!enLigne || undefined}
        onClick={() => enLigne && setOuvert(true)}
        className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-pilule border-0 bg-accent-doux px-6 text-[0.9375rem] font-bold whitespace-nowrap text-accent-texte transition-transform duration-200 active:scale-[0.98] aria-disabled:cursor-default aria-disabled:opacity-60"
      >
        <IconeSupprimer taille={19} />
        Supprimer de ma bibliothèque
      </button>
      <p role="alert" className="m-0 text-sm font-semibold text-accent-texte empty:hidden">
        {suppression.error ? ECHECS_SUPPRESSION[suppression.error.echec] : ''}
      </p>
      <Dialogue
        ouvert={ouvert}
        titre={`Supprimer « ${nom} » ?`}
        confirmer="Supprimer"
        annuler="Garder"
        occupe={suppression.isPending}
        onAnnuler={() => setOuvert(false)}
        onConfirmer={() =>
          suppression.mutate(undefined, {
            // La fiche n'existe plus : la bibliothèque prend la place de cet écran.
            onSuccess: () => remplacer(LIENS.bibliotheque),
            onSettled: () => setOuvert(false),
          })
        }
      >
        <p className="m-0">
          L’œuvre quittera ma bibliothèque, avec ses éditions{oeuvre.estSerie ? ', ses tomes' : ''}, mes notes et mon historique de lecture.
          Ce geste ne se défait pas.
        </p>
      </Dialogue>
    </section>
  )
}

const LIEN =
  'flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 text-left text-[0.9375rem] font-bold text-accent-texte underline decoration-1 underline-offset-4 aria-disabled:cursor-default aria-disabled:opacity-60'

/** Les thèmes que l'IA propose en plus de mon vocabulaire : à part, marqués « Nouveau », ajoutés un par un si je le veux. */
function ThemesNouveaux({ themes, ajouter }: { themes: string[]; ajouter: (nom: string) => void }) {
  return (
    <div role="group" aria-label="Thèmes proposés, absents de mon vocabulaire" className="flex flex-col gap-2.5 border-t border-bordure pt-5">
      <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.9375rem]">
        <span className="rounded-pilule bg-surlignage px-2.5 py-0.5 text-sm font-bold">Nouveau</span>
        <span className="text-discret">L’IA propose aussi ces thèmes, absents de mon vocabulaire.</span>
      </p>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {themes.map((nom) => (
          <li key={nom}>
            <button
              type="button"
              aria-label={`Ajouter le thème nouveau ${nom}`}
              onClick={() => ajouter(nom)}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-pilule border border-dashed border-bordure bg-transparent px-4 text-[0.9375rem] font-bold text-accent-texte"
            >
              <IconeAjouter taille={18} />
              {nom}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

type PropsBloc = { etat: EtatFormulaire; maj: (changement: Partial<EtatFormulaire>) => void }

function Bloc({ titre, id, children }: { titre: string; id?: string; children: ReactNode }) {
  const idTitre = useId()
  return (
    <section id={id} aria-labelledby={idTitre} className="flex scroll-mt-6 flex-col gap-4">
      <h2 id={idTitre} className="m-0 font-titre text-[1.375rem] leading-tight">
        {titre}
      </h2>
      {children}
    </section>
  )
}

/** Case à cocher : toute la ligne (case et libellé) répond au toucher, sur au moins 44 px de haut. */
function Bascule({ libelle, aide, coche, onChange }: { libelle: string; aide?: string; coche: boolean; onChange: (coche: boolean) => void }) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 self-start">
      <input
        id={id}
        type="checkbox"
        checked={coche}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={aide ? `${id}-aide` : undefined}
        className="size-6 shrink-0 cursor-pointer accent-[var(--accent)]"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-[0.9375rem] font-bold">{libelle}</span>
        {aide && (
          <span id={`${id}-aide`} className="text-sm text-discret">
            {aide}
          </span>
        )}
      </span>
    </label>
  )
}

/** Petit bouton rond « retirer », nommé pour VoiceOver. */
function BoutonRetirer({ nom, onClick }: { nom: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={nom}
      onClick={onClick}
      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pilule border border-bordure bg-surface text-discret hover:text-encre"
    >
      <IconeFermer taille={18} />
    </button>
  )
}

/** Ajouter une ligne (personne, édition, adaptation) : un simple lien, pour ce que je fais rarement. */
function BoutonAjouterLigne({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${LIEN} gap-1.5 self-start no-underline`}>
      <IconeAjouter taille={18} />
      <span className="underline decoration-1 underline-offset-4">{children}</span>
    </button>
  )
}

/** En haut : le ou les auteurs, sans le choix du rôle. Les autres personnes sont dans « Détails de l'œuvre ». */
function AuteursPrincipaux({ etat, maj, connus, aide }: PropsBloc & { connus: string[]; aide?: string }) {
  const idListe = useId()
  const auteurs = etat.auteurs.filter((a) => a.role === 'auteur')
  return (
    <>
      <datalist id={idListe}>
        {connus.map((nom) => (
          <option key={nom} value={nom} />
        ))}
      </datalist>
      {auteurs.map((auteur, rang) => (
        <div key={auteur.cle} className="flex items-end gap-3">
          <ChampTexte
            libelle={auteurs.length > 1 ? `Auteur ${rang + 1}` : 'Auteur'}
            aide={rang === 0 ? aide : undefined}
            list={idListe}
            value={auteur.nom}
            onChange={(e) => maj({ auteurs: etat.auteurs.map((a) => (a.cle === auteur.cle ? { ...a, nom: e.target.value } : a)) })}
            autoComplete="off"
            className="min-w-0 flex-1"
          />
          {auteurs.length > 1 && (
            <BoutonRetirer
              nom={auteur.nom.trim() ? `Retirer ${auteur.nom.trim()}` : 'Retirer cet auteur'}
              onClick={() => maj({ auteurs: etat.auteurs.filter((a) => a.cle !== auteur.cle) })}
            />
          )}
        </div>
      ))}
    </>
  )
}

/** Dans « Détails de l'œuvre » : traduction, illustrations, ou un second auteur, avec leur rôle. */
function AutresPersonnes({ etat, maj, connus }: PropsBloc & { connus: string[] }) {
  const idListe = useId()
  const autres = etat.auteurs.filter((a) => a.role !== 'auteur')
  const changer = (cle: string, changement: { nom?: string; role?: Role }) =>
    maj({ auteurs: etat.auteurs.map((a) => (a.cle === cle ? { ...a, ...changement } : a)) })
  return (
    <div className="flex flex-col gap-3">
      <datalist id={idListe}>
        {connus.map((nom) => (
          <option key={nom} value={nom} />
        ))}
      </datalist>
      {autres.length > 0 && (
        <ul aria-label="Autres personnes" className="m-0 flex list-none flex-col gap-4 p-0">
          {autres.map((personne) => (
            <li key={personne.cle} className="flex items-end gap-3">
              <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_9.5rem] gap-3">
                <ChampTexte libelle="Nom" list={idListe} value={personne.nom} onChange={(e) => changer(personne.cle, { nom: e.target.value })} autoComplete="off" />
                <ChampListe
                  libelle="Rôle"
                  value={personne.role}
                  onChange={(e) => changer(personne.cle, { role: e.target.value as Role })}
                  options={ROLES.map((r) => ({ valeur: r.valeur, libelle: r.libelle }))}
                />
              </div>
              <BoutonRetirer
                nom={personne.nom.trim() ? `Retirer ${personne.nom.trim()}` : 'Retirer cette ligne'}
                onClick={() => maj({ auteurs: etat.auteurs.filter((a) => a.cle !== personne.cle) })}
              />
            </li>
          ))}
        </ul>
      )}
      <BoutonAjouterLigne onClick={() => maj({ auteurs: [...etat.auteurs, ligneAuteur('', 'traducteur')] })}>Ajouter une personne</BoutonAjouterLigne>
    </div>
  )
}

type ChangerEdition = (cle: string, changement: Partial<EtatFormulaire['editions'][number]>, source?: CleProvenance) => void

/** Les champs d'une édition, deux par deux dès l'iPhone : ils sont courts. */
function ChampsEdition({
  edition,
  changer,
  erreurs,
  aide,
  apresIsbn,
}: {
  edition: EtatFormulaire['editions'][number]
  changer: ChangerEdition
  erreurs: Erreurs
  aide: (source: CleProvenance) => string | undefined
  /** Sous l'ISBN : « Chercher cette édition », pour mon édition. */
  apresIsbn?: ReactNode
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 flex flex-col gap-2">
        <ChampIsbn
          id={idChamp.isbnEdition(edition.cle)}
          libelle="ISBN"
          value={edition.isbn}
          surChange={(isbn) => changer(edition.cle, { isbn })}
          erreur={erreurs[idChamp.isbnEdition(edition.cle)]}
          autoComplete="off"
          enterKeyHint="done"
        />
        {apresIsbn}
      </div>
      <ChampTexte
        libelle="Éditeur"
        aide={aide('editeur')}
        value={edition.publisher}
        onChange={(e) => changer(edition.cle, { publisher: e.target.value }, 'editeur')}
        autoComplete="off"
        className="col-span-2"
      />
      <ChampTexte
        id={idChamp.pagesEdition(edition.cle)}
        libelle="Pages"
        aide={aide('pages')}
        inputMode="numeric"
        value={edition.pageCount}
        onChange={(e) => changer(edition.cle, { pageCount: e.target.value }, 'pages')}
        erreur={erreurs[idChamp.pagesEdition(edition.cle)]}
        autoComplete="off"
      />
      <ChampListe
        libelle="Langue"
        aide={aide('langue')}
        value={edition.language}
        onChange={(e) => changer(edition.cle, { language: e.target.value }, 'langue')}
        options={optionsLangues(edition.language)}
      />
      <ChampTexte
        libelle="Collection"
        value={edition.format}
        onChange={(e) => changer(edition.cle, { format: e.target.value })}
        autoComplete="off"
      />
      <ChampTexte
        libelle="Traduction"
        aide={aide('traducteur')}
        value={edition.translator}
        onChange={(e) => changer(edition.cle, { translator: e.target.value }, 'traducteur')}
        autoComplete="off"
      />
    </div>
  )
}

/** Mon édition, celle de mon exemplaire : ce que je modifie le plus souvent après la couverture. */
function MonEdition({
  etat,
  maj,
  erreurs,
  trouvee,
  aideSource,
  oublierSource,
  isbnDepart,
  chercher,
  note,
}: PropsBloc & {
  erreurs: Erreurs
  /** Clé de l'édition remplie par la recherche : ses champs disent d'où ils viennent. */
  trouvee: string | null
  aideSource: (cle: CleProvenance, parDefaut?: string) => string | undefined
  oublierSource: (cle: CleProvenance) => void
  /** L'ISBN de mon édition à l'ouverture : « Chercher cette édition » n'est proposé que s'il change. */
  isbnDepart: string
  chercher: () => void
  note: string | null
}) {
  const mienne = etat.editions.find((e) => e.cle === etat.mienne) ?? null
  if (!mienne) {
    return (
      <>
        <p className="m-0 text-[0.9375rem] text-discret">
          {etat.editions.length > 0 ? 'Aucune de mes éditions notées n’est marquée comme la mienne.' : 'Mon édition n’est pas encore notée.'}
        </p>
        <BoutonAjouterLigne
          onClick={() => {
            const nouvelle = ligneEdition()
            maj({ editions: [...etat.editions, nouvelle], mienne: nouvelle.cle })
          }}
        >
          Noter mon édition
        </BoutonAjouterLigne>
      </>
    )
  }
  const changer: ChangerEdition = (cle, changement, source) => {
    maj({ editions: etat.editions.map((e) => (e.cle === cle ? { ...e, ...changement } : e)) })
    if (source && cle === trouvee) oublierSource(source)
  }
  const compact = isbnCompact(mienne.isbn)
  const proposer = /^97[89]\d{10}$/.test(compact) && isbnValide(compact) && compact !== isbnCompact(isbnDepart)
  return (
    <>
      <ChampsEdition
        edition={mienne}
        changer={changer}
        erreurs={erreurs}
        aide={(source) => (mienne.cle === trouvee ? aideSource(source) : undefined)}
        apresIsbn={
          proposer && (
            <Bouton variante="secondaire" aria-haspopup="dialog" onClick={chercher} className="min-h-11 self-start px-5">
              Chercher cette édition
            </Bouton>
          )
        }
      />
      <p role="status" className="m-0 text-sm text-discret empty:hidden">
        {note ?? ''}
      </p>
    </>
  )
}

/** Les éditions que j'ai notées en plus de la mienne : l'une d'elles peut devenir la mienne. */
function AutresEditions({ etat, maj, erreurs }: PropsBloc & { erreurs: Erreurs }) {
  const autres = etat.editions.filter((e) => e.cle !== etat.mienne)
  const changer: ChangerEdition = (cle, changement) => maj({ editions: etat.editions.map((e) => (e.cle === cle ? { ...e, ...changement } : e)) })
  return (
    <>
      {autres.length > 0 && (
        <ul className="m-0 flex list-none flex-col p-0">
          {autres.map((edition, rang) => (
            <li key={edition.cle} className="flex flex-col gap-4 border-b border-bordure pb-6 not-first:pt-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="m-0 text-[0.9375rem] font-bold">{edition.publisher.trim() || `Édition ${rang + 1}`}</h3>
                <BoutonRetirer
                  nom={`Retirer l’édition ${edition.publisher.trim() || rang + 1}`}
                  onClick={() => maj({ editions: etat.editions.filter((e) => e.cle !== edition.cle) })}
                />
              </div>
              <ChampsEdition edition={edition} changer={changer} erreurs={erreurs} aide={() => undefined} />
              <Bascule libelle="C’est mon édition" coche={false} onChange={(coche) => coche && maj({ mienne: edition.cle })} />
            </li>
          ))}
        </ul>
      )}
      <BoutonAjouterLigne onClick={() => maj({ editions: [...etat.editions, ligneEdition()], mienne: etat.mienne })}>Ajouter une édition</BoutonAjouterLigne>
    </>
  )
}

function Etiquettes({
  genre,
  libelle,
  etat,
  maj,
  vocabulaire,
}: PropsBloc & { genre: GenreEtiquette; libelle: string; vocabulaire: Vocabulaire }) {
  const [saisie, setSaisie] = useState('')
  const idListe = useId()
  const idChampSaisie = useId()
  const choisies = etat.etiquettes.filter((e) => e.genre === genre)
  const proposees = vocabulaire.etiquettes
    .filter((e) => e.genre === genre && !choisies.some((c) => c.nom === e.nom))
    .map((e) => e.nom)
    .sort((a, b) => a.localeCompare(b, 'fr'))

  function ajouter() {
    const nom = saisie.trim().replace(/\s+/g, ' ')
    if (!nom) return
    // Une étiquette déjà connue garde son écriture exacte (majuscules, accents).
    const connue = vocabulaire.etiquettes.find((e) => e.genre === genre && e.nom.toLocaleLowerCase('fr') === nom.toLocaleLowerCase('fr'))
    const retenu = connue?.nom ?? nom
    if (!choisies.some((c) => c.nom.toLocaleLowerCase('fr') === retenu.toLocaleLowerCase('fr')))
      maj({ etiquettes: [...etat.etiquettes, { genre, nom: retenu }] })
    setSaisie('')
  }

  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={idChampSaisie} className="text-[0.9375rem] font-bold">
        {libelle}
      </label>
      {choisies.length > 0 && (
        <ul aria-label={`${libelle} choisis`} className="m-0 flex list-none flex-wrap gap-2 p-0">
          {choisies.map((e) => (
            <li key={e.nom}>
              <button
                type="button"
                aria-label={`Retirer ${e.nom}`}
                onClick={() => maj({ etiquettes: etat.etiquettes.filter((x) => !(x.genre === genre && x.nom === e.nom)) })}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-pilule border-0 bg-accent-doux pr-3 pl-4 text-[0.9375rem] font-semibold text-accent-texte"
              >
                {e.nom}
                <IconeFermer taille={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <datalist id={idListe}>
        {proposees.map((nom) => (
          <option key={nom} value={nom} />
        ))}
      </datalist>
      <div className="flex gap-2">
        <input
          id={idChampSaisie}
          list={idListe}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ajouter()
            }
          }}
          placeholder={INDICATIONS[genre]}
          autoComplete="off"
          enterKeyHint="done"
          className={`${CHAMP} min-w-0 flex-1`}
        />
        <Bouton variante="secondaire" onClick={ajouter} className="min-h-12 shrink-0 px-5">
          Ajouter
        </Bouton>
      </div>
    </div>
  )
}

function Tomes({ etat, maj, erreurs, initial }: PropsBloc & { erreurs: Erreurs; initial: OeuvreDetaillee | null }) {
  const [nombre, setNombre] = useState(String(etat.tomes.length))
  const nombreValide = /^\d+$/.test(nombre) && Number(nombre) <= 500
  const retires = initial ? initial.tomes.filter((t) => !etat.tomes.some((x) => x.numero === t.numero)) : []
  const retiresPossedes = retires.filter((t) => t.possession !== 'non_possede').length

  return (
    <>
      <ChampTexte
        id={idChamp.nombreTomes}
        libelle="Nombre de tomes"
        aide="Pour une série en cours, l’augmenter à chaque nouveau tome."
        inputMode="numeric"
        value={nombre}
        onChange={(e) => {
          setNombre(e.target.value)
          if (/^\d+$/.test(e.target.value) && Number(e.target.value) <= 500) maj({ tomes: ajusterTomes(etat.tomes, Number(e.target.value)) })
        }}
        erreur={nombreValide ? null : 'Un nombre de tomes en chiffres, jusqu’à 500.'}
        autoComplete="off"
        className="max-w-xs"
      />
      {retires.length > 0 && (
        <p role="status" className="m-0 max-w-[60ch] rounded-carte bg-accent-doux px-5 py-4 text-[0.9375rem] font-semibold text-accent-texte">
          {retires.length === 1 ? `Le tome ${retires[0].numero} sera retiré` : `Les tomes ${retires[0].numero} à ${retires[retires.length - 1].numero} seront retirés`}
          {retiresPossedes > 0 ? ', avec la possession notée pour eux.' : '.'}
        </p>
      )}
      {etat.tomes.length > 0 && (
        <details className="group rounded-panneau border border-bordure bg-surface shadow-douce">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 text-[0.9375rem] font-bold [&::-webkit-details-marker]:hidden">
            Titres et ISBN des tomes
            <span className="text-discret transition-transform duration-200 group-open:rotate-180">
              <IconeChevronBas taille={18} />
            </span>
          </summary>
          <ul className="m-0 flex list-none flex-col gap-4 border-t border-bordure p-5">
            {etat.tomes.map((tome) => (
              <li key={tome.numero} className="grid grid-cols-1 gap-3 min-[30rem]:grid-cols-2">
                <ChampTexte
                  libelle={`Tome ${tome.numero} : titre`}
                  value={tome.titre}
                  onChange={(e) => maj({ tomes: etat.tomes.map((t) => (t.numero === tome.numero ? { ...t, titre: e.target.value } : t)) })}
                  autoComplete="off"
                />
                <ChampIsbn
                  id={idChamp.isbnTome(tome.numero)}
                  libelle={`Tome ${tome.numero} : ISBN`}
                  value={tome.isbn}
                  surChange={(isbn) => maj({ tomes: etat.tomes.map((t) => (t.numero === tome.numero ? { ...t, isbn } : t)) })}
                  erreur={erreurs[idChamp.isbnTome(tome.numero)]}
                  autoComplete="off"
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}

function Medias({ etat, maj, erreurs }: PropsBloc & { erreurs: Erreurs }) {
  const changer = (cle: string, changement: Partial<EtatFormulaire['medias'][number]>) =>
    maj({ medias: etat.medias.map((m) => (m.cle === cle ? { ...m, ...changement } : m)) })
  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-5 p-0">
        {etat.medias.map((media) => (
          <li key={media.cle} className="flex flex-col gap-5 rounded-panneau border border-bordure bg-surface p-5 shadow-douce">
            <div className="flex items-end gap-3">
              <ChampListe
                libelle="Type"
                value={media.type}
                onChange={(e) => changer(media.cle, { type: e.target.value as TypeMedia })}
                options={TYPES_MEDIA.map((t) => ({ valeur: t.valeur, libelle: t.libelle }))}
                className="min-w-0 flex-1"
              />
              <BoutonRetirer
                nom={`Retirer ${media.titre.trim() || 'cette adaptation'}`}
                onClick={() => maj({ medias: etat.medias.filter((m) => m.cle !== media.cle) })}
              />
            </div>
            <div className="grid grid-cols-1 gap-5 min-[30rem]:grid-cols-2">
              <ChampTexte
                libelle="Titre"
                aide="S’il diffère de celui du livre."
                value={media.titre}
                onChange={(e) => changer(media.cle, { titre: e.target.value })}
                autoComplete="off"
                className="min-[30rem]:col-span-2"
              />
              <ChampTexte
                id={idChamp.saisons(media.cle)}
                libelle="Saisons"
                inputMode="numeric"
                value={media.saisons}
                onChange={(e) => changer(media.cle, { saisons: e.target.value })}
                erreur={erreurs[idChamp.saisons(media.cle)]}
                autoComplete="off"
              />
              <ChampTexte
                id={idChamp.episodes(media.cle)}
                libelle="Épisodes en tout"
                inputMode="numeric"
                value={media.episodes}
                onChange={(e) => changer(media.cle, { episodes: e.target.value })}
                erreur={erreurs[idChamp.episodes(media.cle)]}
                autoComplete="off"
              />
            </div>
          </li>
        ))}
      </ul>
      <BoutonAjouterLigne onClick={() => maj({ medias: [...etat.medias, ligneMedia()] })}>Ajouter une adaptation</BoutonAjouterLigne>
    </>
  )
}
