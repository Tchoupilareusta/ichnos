import { useEffect, useRef, useState, type ReactNode } from 'react'
import { JeLaiAchete } from '../achat/JeLaiAchete'
import { titresAffiches } from '../catalogue/titres'
import { mentionTraduction, nomLangue } from '../catalogue/langues'
import { couverturesDeLaFiche, type Edition, type Media, type OeuvreDetaillee } from '../bibliotheque/depot'
import {
  LONGUEURS,
  POSSESSIONS,
  STATUTS,
  libelleForme,
  libellePossession,
  libelleStatut,
  libelleTypeMedia,
  possessionAffichee,
  type Statut,
} from '../bibliotheque/modele'
import { EchecDepot, useModifierOeuvre, useOeuvre } from '../bibliotheque/requetes'
import {
  STATUTS_MEDIA,
  libelleStatutMedia,
  texteEpisodes,
  type StatutMedia,
} from '../bibliotheque/suivi'
import { Bouton } from '../composants/Bouton'
import { IconeAjouter, IconeChevronBas, IconeModifier, IconeMoins, IconeRetour } from '../composants/Icones'
import { IconePossession, IconeStatut } from '../composants/IconesLecture'
import { Isbn } from '../composants/Isbn'
import { Menu } from '../composants/Menu'
import { EtatVide, BoutonPrincipal, Page } from '../composants/Page'
import { LIEN_ACTION, Section } from '../composants/Section'
import { MonParcours } from '../suivi/Parcours'
import { ProgressionFiche } from '../suivi/ProgressionFiche'
import { MonRessenti, ProposerRessenti } from '../suivi/Ressenti'
import { couvertureAffichee } from '../couvertures/choix'
import { Couverture } from '../couvertures/Couverture'
import { LIENS } from '../navigation/routes'
import { useEnLigne } from '../navigation/useEnLigne'
import { revenir, useRoute } from '../navigation/useRoute'
import { ANCRE_TOMES, MesTomes } from '../tomes/MesTomes'

const PASTILLE = 'flex min-h-11 items-center gap-1.5 rounded-pilule pr-3.5 pl-3.5 text-[0.9375rem]'
const PASTILLE_DOUCE = `${PASTILLE} border-0 bg-accent-doux font-bold text-accent-texte`
const PASTILLE_CLAIRE = `${PASTILLE} border border-bordure bg-surface font-semibold text-encre`

const OPTIONS_STATUT = STATUTS.map((s) => ({ ...s, icone: <IconeStatut statut={s.valeur} taille={19} /> }))
const OPTIONS_POSSESSION = POSSESSIONS.map((p) => ({ ...p, icone: <IconePossession possession={p.valeur} /> }))

export function Fiche() {
  const { id } = useRoute()
  const requete = useOeuvre(id ?? '')
  const oeuvre = requete.data

  useEffect(() => {
    if (oeuvre) {
      const langue = oeuvre.editions.find((e) => e.id === oeuvre.monEdition)?.language
      document.title = `${titresDe(oeuvre, langue).principal} · Ichnos`
    } else document.title = 'Fiche · Ichnos'
  }, [oeuvre])

  return (
    <Page entete={<BarreFiche id={oeuvre ? id : null} />}>
      {requete.isPending && (
        <p role="status" className="m-0 text-discret">
          Ouverture de la fiche…
        </p>
      )}
      {requete.isError && !oeuvre && <ErreurFiche erreur={requete.error} reessayer={() => void requete.refetch()} />}
      {oeuvre && <ContenuFiche oeuvre={oeuvre} />}
    </Page>
  )
}

function BarreFiche({ id }: { id: string | null }) {
  return (
    <div className="flex items-center justify-between">
      <a
        href={LIENS.bibliotheque}
        onClick={(e) => {
          e.preventDefault()
          revenir(LIENS.bibliotheque)
        }}
        className="flex min-h-11 items-center gap-1 rounded-pilule border border-bordure bg-surface pr-4 pl-2.5 text-[0.9375rem] font-semibold text-encre no-underline"
      >
        <IconeRetour taille={20} />
        Retour
      </a>
      {id && (
        <a
          href={LIENS.modifier(id)}
          aria-label="Modifier les informations de l’œuvre"
          className="flex size-11 items-center justify-center rounded-pilule border border-bordure bg-surface text-encre"
        >
          <IconeModifier taille={20} />
        </a>
      )}
    </div>
  )
}

function ErreurFiche({ erreur, reessayer }: { erreur: EchecDepot; reessayer: () => void }) {
  if (erreur.echec === 'introuvable')
    return (
      <EtatVide action={<BoutonPrincipal href={LIENS.bibliotheque}>Revenir à ma bibliothèque</BoutonPrincipal>}>
        Cette œuvre n’est pas, ou plus, dans ma bibliothèque.
      </EtatVide>
    )
  return (
    <EtatVide
      action={
        <Bouton variante="secondaire" onClick={reessayer}>
          Réessayer
        </Bouton>
      }
    >
      <span role="alert">
        {erreur.echec === 'reseau'
          ? 'Pas de connexion à internet : cette fiche s’affichera au retour du réseau.'
          : 'Cette fiche n’a pas pu s’ouvrir. Réessayer dans un instant.'}
      </span>
    </EtatVide>
  )
}

function titresDe(oeuvre: OeuvreDetaillee, langueEdition: string | null | undefined) {
  return titresAffiches(
    { title_fr: oeuvre.titreFr, title_original: oeuvre.titreOriginal, original_language: oeuvre.langueOriginale },
    langueEdition,
  )
}

const minusculeInitiale = (texte: string) => texte.charAt(0).toLocaleLowerCase('fr') + texte.slice(1)

const MESSAGES_ECRITURE: Record<string, string> = {
  reseau: 'Pas de connexion à internet : ce changement n’a pas été enregistré.',
  introuvable: 'Cette œuvre n’est plus dans ma bibliothèque : rien n’a été changé.',
  invalide: 'Ce changement n’a pas été accepté : rien n’a été modifié.',
  inconnu: 'Ce changement n’a pas pu être enregistré. Réessayer dans un instant.',
}

function ContenuFiche({ oeuvre }: { oeuvre: OeuvreDetaillee }) {
  const enLigne = useEnLigne()
  const modifier = useModifierOeuvre(oeuvre.id)
  // Passer à « Terminé » propose mon ressenti, sans obligation.
  const [ressenti, setRessenti] = useState(false)
  // « Je l'ai acheté » : pour le livre, ou pour un tome de la série. L'annonce reste après la fermeture du panneau.
  const [achat, setAchat] = useState<{ ouvert: boolean; tome: number | null }>({ ouvert: false, tome: null })
  const [annonce, setAnnonce] = useState<string | null>(null)
  // Après l'achat d'un livre, le bouton « Je l'ai acheté » disparaît : le focus va sur la
  // confirmation plutôt que de retomber au début de la page. (Pour un tome, il revient sur le tome.)
  const refAnnonce = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (annonce && !achat.ouvert && achat.tome === null) refAnnonce.current?.focus({ preventScroll: true })
  }, [annonce, achat.ouvert, achat.tome])

  function changerStatut(statut: Statut) {
    modifier.statut.mutate(statut)
    if (statut === 'termine') setRessenti(true)
  }

  const edition = oeuvre.editions.find((e) => e.id === oeuvre.monEdition) ?? null
  const { principal, secondaire } = titresDe(oeuvre, edition?.language)
  const titreEnVo = secondaire !== null && principal === oeuvre.titreOriginal
  const auteurs = oeuvre.auteurs.filter((a) => a.role === 'auteur').map((a) => a.nom)
  const illustrateurs = oeuvre.auteurs.filter((a) => a.role === 'illustrateur').map((a) => a.nom)
  const themes = oeuvre.etiquettes.filter((e) => e.genre === 'theme').map((e) => e.nom)
  const avecTomes = oeuvre.estSerie && oeuvre.tomes.length > 0
  const possession = possessionAffichee(
    oeuvre.possession,
    oeuvre.estSerie,
    oeuvre.tomes.map((t) => t.possession),
  )

  const erreurs = [
    modifier.statut,
    modifier.possession,
    modifier.monEdition,
    modifier.progression,
    modifier.unite,
    modifier.total,
    modifier.dateFin,
    modifier.appreciation,
    modifier.media,
  ]
    .map((mutation) => mutation.error?.echec)
    .filter(Boolean)
  const derniereErreur = erreurs[0]

  const repere = [
    secondaire ? `${titreEnVo ? 'Titre français' : 'Titre original'} : ${secondaire}` : null,
    oeuvre.annee !== null ? String(oeuvre.annee) : null,
  ].filter(Boolean)

  function allerAuxTomes() {
    const section = document.getElementById(ANCRE_TOMES)
    if (!section) return
    const doux = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    section.scrollIntoView({ behavior: doux ? 'smooth' : 'auto', block: 'start' })
    section.focus({ preventScroll: true })
  }

  return (
    // iPhone et iPad en portrait : une colonne centrée, comme la maquette (à côté de la barre latérale,
    // deux colonnes laisseraient moins de 250 px au titre). Écran large (iPad en paysage) : la couverture
    // reste à gauche, l'en-tête et les sections passent dans la colonne de droite.
    <div className="flex flex-col gap-10 tablette:mx-auto tablette:w-full tablette:max-w-[42rem] min-[72rem]:mx-0 min-[72rem]:grid min-[72rem]:max-w-none min-[72rem]:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)] min-[72rem]:items-start min-[72rem]:gap-x-14">
      {/* Couverture : elle reste visible pendant la lecture de la fiche sur grand écran */}
      <div className="flex flex-col items-center min-[72rem]:sticky min-[72rem]:top-[calc(env(safe-area-inset-top)+1.5rem)] min-[72rem]:row-span-2 min-[72rem]:items-stretch">
        <Couverture
          titre={principal}
          auteur={auteurs.join(', ') || null}
          graine={oeuvre.id}
          chemin={couvertureAffichee(couverturesDeLaFiche(oeuvre))}
          className="w-[12.25rem] tablette:w-[14rem] min-[72rem]:w-full"
        />
      </div>

      {/* En-tête : titres, auteur, thèmes, statut et possession */}
      <div className="-mt-4 flex min-w-0 flex-col items-center gap-[1.375rem] text-center min-[72rem]:mt-0 min-[72rem]:items-start min-[72rem]:text-left">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-titre text-[2.25rem] leading-[1.05] tablette:text-[2.75rem]">{principal}</h1>
          {auteurs.length > 0 && <p className="m-0 text-[1.0625rem]">{auteurs.join(', ')}</p>}
          {illustrateurs.length > 0 && <p className="m-0 text-sm text-discret">Illustrations : {illustrateurs.join(', ')}</p>}
          {repere.length > 0 && <p className="m-0 text-sm text-discret">{repere.join(' · ')}</p>}
        </div>

        {themes.length > 0 && (
          <ul
            aria-label="Thèmes"
            className="m-0 flex max-w-[20rem] list-none flex-wrap justify-center gap-x-3.5 gap-y-1.5 p-0 font-titre text-[1.1875rem] leading-[1.35] italic tablette:max-w-[32rem] min-[72rem]:max-w-[65ch] min-[72rem]:justify-start"
          >
            {themes.map((theme) => (
              <li key={theme}>
                <span
                  className="rounded-[3px] px-[5px] [box-decoration-break:clone]"
                  style={{
                    background: 'linear-gradient(transparent 14%, var(--surlignage) 14%, var(--surlignage) 90%, transparent 90%)',
                  }}
                >
                  {theme}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col items-center gap-3 min-[72rem]:items-start">
          <div className="flex flex-wrap justify-center gap-2.5 min-[72rem]:justify-start">
            <Menu
              nom={`Statut de lecture : ${libelleStatut(oeuvre.statut)}. Changer`}
              contenuBouton={
                <>
                  <IconeStatut statut={oeuvre.statut} taille={19} />
                  {libelleStatut(oeuvre.statut)}
                  <IconeChevronBas taille={16} />
                </>
              }
              classeBouton={PASTILLE_DOUCE}
              options={OPTIONS_STATUT}
              valeur={oeuvre.statut}
              onChoisir={changerStatut}
              desactive={!enLigne}
            />
            {avecTomes ? (
              // Une série se règle tome par tome : la pastille résume, et mène à la grille des tomes.
              <button
                type="button"
                aria-label={`Possession : ${libellePossession(possession)}. Voir mes tomes`}
                onClick={allerAuxTomes}
                className={`${PASTILLE_CLAIRE} cursor-pointer`}
              >
                <IconePossession possession={possession} />
                {libellePossession(possession)}
              </button>
            ) : (
              <Menu
                nom={`Possession : ${libellePossession(possession)}. Changer`}
                contenuBouton={
                  <>
                    <IconePossession possession={possession} />
                    {libellePossession(possession)}
                    <IconeChevronBas taille={16} />
                  </>
                }
                classeBouton={PASTILLE_CLAIRE}
                options={OPTIONS_POSSESSION}
                valeur={possession === 'partielle' ? null : possession}
                onChoisir={(valeur) => modifier.possession.mutate(valeur)}
                desactive={!enLigne}
              />
            )}
          </div>
          {!oeuvre.estSerie && oeuvre.possession !== 'possede' && (
            <button
              type="button"
              aria-haspopup="dialog"
              aria-disabled={!enLigne || undefined}
              onClick={() => enLigne && setAchat({ ouvert: true, tome: null })}
              className={LIEN_ACTION}
            >
              Je l’ai acheté
            </button>
          )}
          {!enLigne && (
            <p className="m-0 max-w-[30ch] text-sm text-discret min-[72rem]:max-w-none">
              Le statut et la possession pourront changer au retour du réseau.
            </p>
          )}
          {/* Toujours présent : son contenu change quand un achat est noté (VoiceOver l'annonce). */}
          <p
            ref={refAnnonce}
            tabIndex={-1}
            role="status"
            data-etat={annonce ? 'ouvert' : 'ferme'}
            className="m-0 max-w-[34ch] text-sm text-discret outline-none empty:hidden min-[72rem]:max-w-none"
          >
            {annonce ?? ''}
          </p>
          <p role="alert" className="m-0 text-sm font-semibold text-accent-texte empty:hidden">
            {derniereErreur ? MESSAGES_ECRITURE[derniereErreur] : ''}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-10 min-[72rem]:col-start-2">
        {(oeuvre.statut === 'en_cours' || oeuvre.statut === 'en_pause') && (
          <ProgressionFiche
            oeuvre={oeuvre}
            titre={principal}
            enLigne={enLigne}
            modifier={modifier}
            terminer={() => changerStatut('termine')}
          />
        )}
        <Resume oeuvre={oeuvre} edition={edition} />
        {(oeuvre.statut === 'en_cours' || oeuvre.statut === 'termine' || oeuvre.statut === 'en_pause' || oeuvre.appreciation) && (
          <MonRessenti valeur={oeuvre.appreciation} choisir={(valeur) => modifier.appreciation.mutate(valeur)} enLigne={enLigne} />
        )}
        <MonParcours
          historique={oeuvre.historique}
          statut={oeuvre.statut}
          enLigne={enLigne}
          dater={(date, precision) => modifier.dateFin.mutate({ date, precision })}
        />
        {oeuvre.editions.length > 0 && (
          <MonEdition oeuvre={oeuvre} edition={edition} enLigne={enLigne} choisir={(valeur) => modifier.monEdition.mutate(valeur)} />
        )}
        {avecTomes && (
          <MesTomes
            oeuvre={oeuvre}
            titre={principal}
            enLigne={enLigne}
            modifier={modifier}
            acheter={(numero) => setAchat({ ouvert: true, tome: numero })}
          />
        )}
        {oeuvre.medias.length > 0 && (
          <Medias oeuvre={oeuvre} enLigne={enLigne} changer={(media, valeurs) => modifier.media.mutate({ media, ...valeurs })} />
        )}
      </div>

      <ProposerRessenti
        ouvert={ressenti}
        titre={principal}
        valeur={oeuvre.appreciation}
        fermer={() => setRessenti(false)}
        choisir={(valeur) => {
          if (valeur !== oeuvre.appreciation) modifier.appreciation.mutate(valeur)
          setRessenti(false)
        }}
      />

      {/* Placé après les tomes : leur panneau se referme avant que celui-ci s'ouvre. */}
      <JeLaiAchete
        ouvert={achat.ouvert}
        oeuvre={oeuvre}
        titre={principal}
        tome={achat.tome}
        fermer={() => setAchat((avant) => ({ ...avant, ouvert: false }))}
        surAchat={() => {
          setAnnonce(
            achat.tome === null
              ? `Achat de « ${principal} » noté, avec l’ISBN de mon exemplaire.`
              : `Achat du tome ${achat.tome} de « ${principal} » noté, avec l’ISBN de mon exemplaire.`,
          )
          setAchat((avant) => ({ ...avant, ouvert: false }))
        }}
      />

    </div>
  )
}

function Resume({ oeuvre, edition }: { oeuvre: OeuvreDetaillee; edition: Edition | null }) {
  const nom = (genre: string) => oeuvre.etiquettes.filter((e) => e.genre === genre).map((e) => minusculeInitiale(e.nom))
  // « Manga · aventure historique · lecture longue · traduit du japonais · épique, âpre, introspective »
  const details = [
    libelleForme(oeuvre.forme),
    ...nom('genre'),
    LONGUEURS.find((l) => l.valeur === oeuvre.longueur)?.detail,
    mentionTraduction(oeuvre.langueOriginale, edition?.language, edition?.translator),
    nom('atmosphere').join(', ') || null,
  ].filter(Boolean)

  return (
    <Section titre="En quelques mots">
      {oeuvre.synopsis ? (
        <p className="m-0 text-[1.0625rem] leading-relaxed whitespace-pre-line">{oeuvre.synopsis}</p>
      ) : (
        <p className="m-0 text-discret">Pas encore de résumé pour cette œuvre.</p>
      )}
      <p className="m-0 mt-1 text-[0.9375rem] text-pretty text-discret">{details.join(' · ')}</p>
    </Section>
  )
}

function descriptionEdition(edition: Edition) {
  return [edition.publisher, edition.format, nomLangue(edition.language)].filter(Boolean).join(' · ') || 'Édition sans précision'
}

function MonEdition({
  oeuvre,
  edition,
  enLigne,
  choisir,
}: {
  oeuvre: OeuvreDetaillee
  edition: Edition | null
  enLigne: boolean
  choisir: (edition: string | null) => void
}) {
  const plusieurs = oeuvre.editions.length > 1 || (oeuvre.editions.length === 1 && !edition)
  // Ce que je lis d'un coup d'œil, en une ligne ; le reste (traduction, ISBN) se déplie.
  const ligne = edition
    ? [
        edition.publisher,
        edition.format,
        nomLangue(edition.language) ?? edition.language,
        edition.pageCount !== null ? `${edition.pageCount} pages` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''
  const precisions = edition
    ? ([
        ['Traduction', edition.translator],
        // Avec ses tirets ; VoiceOver le lit chiffre par chiffre.
        ['ISBN', edition.isbn ? <Isbn valeur={edition.isbn} /> : null],
      ] as [string, ReactNode][]).filter(([, valeur]) => valeur)
    : []

  return (
    <Section
      titre="Mon édition"
      complement={
        plusieurs ? (
          <Menu
            nom={edition ? `Mon édition : ${descriptionEdition(edition)}. Changer` : 'Choisir mon édition'}
            contenuBouton={
              <>
                {edition ? 'Changer' : 'Choisir'}
                <IconeChevronBas taille={16} />
              </>
            }
            classeBouton={PASTILLE_CLAIRE}
            options={oeuvre.editions.map((e) => ({ valeur: e.id, libelle: descriptionEdition(e) }))}
            valeur={edition?.id ?? null}
            onChoisir={(valeur) => choisir(valeur)}
            desactive={!enLigne}
          />
        ) : undefined
      }
    >
      {edition ? (
        <>
          <p className="m-0 text-[1.0625rem] [overflow-wrap:anywhere]">{ligne || 'Rien de noté sur cette édition.'}</p>
          {precisions.length > 0 && (
            <details className="group -mt-1">
              <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-[0.9375rem] font-semibold text-discret [&::-webkit-details-marker]:hidden">
                Détails
                <span className="transition-transform duration-200 group-open:rotate-180">
                  <IconeChevronBas taille={16} />
                </span>
              </summary>
              <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-1.5 pb-1">
                {precisions.map(([terme, valeur]) => (
                  <div key={terme} className="contents">
                    <dt className="text-[0.9375rem] text-discret">{terme}</dt>
                    <dd className="m-0 text-[0.9375rem] tabular-nums [overflow-wrap:anywhere]">{valeur}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </>
      ) : (
        <p className="m-0 text-discret">Mon édition n’est pas encore choisie.</p>
      )}
    </Section>
  )
}

const BOUTON_EPISODE =
  'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pilule p-0 transition-transform duration-200 active:scale-95 aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:active:scale-100'

const OPTIONS_STATUT_MEDIA = STATUTS_MEDIA

function Medias({
  oeuvre,
  enLigne,
  changer,
}: {
  oeuvre: OeuvreDetaillee
  enLigne: boolean
  changer: (media: string, valeurs: { vus?: number | null; statut?: StatutMedia }) => void
}) {
  return (
    <Section titre="À l’écran">
      <ul className="m-0 flex list-none flex-col gap-6 p-0">
        {oeuvre.medias.map((media) => (
          <UnMedia key={media.id} media={media} titreOeuvre={oeuvre.titreFr} enLigne={enLigne} changer={(v) => changer(media.id, v)} />
        ))}
      </ul>
    </Section>
  )
}

/** Un média associé : « Anime · 2 saisons · 48 épisodes », puis l'épisode vu avec − et +, et son statut. */
function UnMedia({
  media,
  titreOeuvre,
  enLigne,
  changer,
}: {
  media: Media
  titreOeuvre: string
  enLigne: boolean
  changer: (valeurs: { vus?: number | null; statut?: StatutMedia }) => void
}) {
  // Le titre seulement s'il diffère de celui de l'œuvre.
  const titre = media.titre && media.titre !== titreOeuvre ? ` « ${media.titre} »` : ''
  const nom = `${libelleTypeMedia(media.type)}${titre}`
  const details = [
    nom,
    media.saisons !== null ? `${media.saisons} saison${media.saisons > 1 ? 's' : ''}` : null,
    media.episodes !== null ? `${media.episodes} épisode${media.episodes > 1 ? 's' : ''}` : null,
  ].filter(Boolean)
  const vus = media.episodesVus ?? 0
  const auBout = media.episodes !== null && vus >= media.episodes
  const episode = texteEpisodes(media.episodesVus, media.episodes)

  return (
    <li className="flex flex-col gap-3">
      <p className="m-0 text-[1.0625rem]">{details.join(' · ')}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Un épisode de moins"
            aria-disabled={!enLigne || vus === 0 || undefined}
            onClick={() => enLigne && vus > 0 && changer({ vus: vus - 1 })}
            className={`${BOUTON_EPISODE} border border-bordure bg-fond text-encre`}
          >
            <IconeMoins taille={16} />
          </button>
          <p className="m-0 min-w-[9.5rem] text-center text-[1.0625rem] tabular-nums" aria-live="polite">
            {episode ?? <span className="text-discret">Aucun épisode vu</span>}
          </p>
          <button
            type="button"
            aria-label="Un épisode de plus"
            aria-disabled={!enLigne || auBout || undefined}
            onClick={() => {
              if (!enLigne || auBout) return
              // Le premier épisode vu fait passer de « À voir » à « En cours ».
              changer(media.statut === 'a_voir' ? { vus: vus + 1, statut: 'en_cours' } : { vus: vus + 1 })
            }}
            className={`${BOUTON_EPISODE} border border-accent bg-accent text-sur-accent`}
          >
            <IconeAjouter taille={16} />
          </button>
        </div>
        <Menu
          nom={`${nom} : ${libelleStatutMedia(media.statut)}. Changer`}
          contenuBouton={
            <>
              {libelleStatutMedia(media.statut)}
              <IconeChevronBas taille={16} />
            </>
          }
          classeBouton={PASTILLE_CLAIRE}
          options={OPTIONS_STATUT_MEDIA}
          valeur={media.statut}
          onChoisir={(statut) => changer({ statut })}
          desactive={!enLigne}
        />
      </div>
      {auBout && media.statut !== 'termine' && (
        <div data-etat="visible" className="flex flex-wrap items-center gap-3 rounded-carte bg-accent-doux p-4">
          <p className="m-0 text-[1.0625rem]">Dernier épisode atteint. Passer à « Vu » ?</p>
          <Bouton occupe={!enLigne} onClick={() => changer({ statut: 'termine' })}>
            Oui, vu
          </Bouton>
        </div>
      )}
    </li>
  )
}
