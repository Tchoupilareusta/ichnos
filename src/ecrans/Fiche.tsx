import { useEffect, useId, useState, type ReactNode } from 'react'
import { titresAffiches } from '../catalogue/titres'
import { mentionTraduction, nomLangue } from '../catalogue/langues'
import type { Edition, OeuvreDetaillee, Tome } from '../bibliotheque/depot'
import {
  LONGUEURS,
  POSSESSIONS,
  STATUTS,
  libelleForme,
  libellePossession,
  libelleStatut,
  libelleTypeMedia,
  possessionAffichee,
  type Possession,
} from '../bibliotheque/modele'
import { EchecDepot, useModifierOeuvre, useOeuvre } from '../bibliotheque/requetes'
import { Bouton } from '../composants/Bouton'
import { ChampTexte, Pastilles } from '../composants/Champs'
import { Dialogue } from '../composants/Dialogue'
import { IconeChevronBas, IconeModifier, IconeRetour } from '../composants/Icones'
import { Menu } from '../composants/Menu'
import { EtatVide, BoutonPrincipal, Page } from '../composants/Page'
import { Couverture } from '../couvertures/Couverture'
import { LIENS } from '../navigation/routes'
import { useEnLigne } from '../navigation/useEnLigne'
import { revenir, useRoute } from '../navigation/useRoute'

const PASTILLE = 'flex min-h-11 items-center gap-1.5 rounded-pilule pr-4 pl-[1.125rem] text-[0.9375rem]'
const PASTILLE_DOUCE = `${PASTILLE} border-0 bg-accent-doux font-bold text-accent-texte`
const PASTILLE_CLAIRE = `${PASTILLE} border border-bordure bg-surface font-semibold text-encre`
const TITRE_SECTION = 'm-0 font-titre text-2xl'

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
          : 'Cette fiche n’a pas pu s’ouvrir. Je réessaie dans un instant.'}
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

/** « épique, âpre et introspective » */
function enumerer(mots: string[]): string {
  if (mots.length <= 1) return mots.join('')
  return `${mots.slice(0, -1).join(', ')} et ${mots[mots.length - 1]}`
}

const MESSAGES_ECRITURE: Record<string, string> = {
  reseau: 'Pas de connexion à internet : ce changement n’a pas été enregistré.',
  introuvable: 'Cette œuvre n’est plus dans ma bibliothèque : rien n’a été changé.',
  invalide: 'Ce changement n’a pas été accepté : rien n’a été modifié.',
  inconnu: 'Ce changement n’a pas pu être enregistré. Je réessaie dans un instant.',
}

function ContenuFiche({ oeuvre }: { oeuvre: OeuvreDetaillee }) {
  const enLigne = useEnLigne()
  const modifier = useModifierOeuvre(oeuvre.id)
  const [confirmation, setConfirmation] = useState<Possession | null>(null)
  const [suppression, setSuppression] = useState(false)

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

  const erreurs = [modifier.statut, modifier.possession, modifier.possessionTomes, modifier.monEdition, modifier.suppression]
    .map((mutation) => mutation.error?.echec)
    .filter(Boolean)
  const derniereErreur = erreurs[0]

  const repere = [
    secondaire ? `${titreEnVo ? 'Titre français' : 'Titre original'} : ${secondaire}` : null,
    oeuvre.annee !== null ? String(oeuvre.annee) : null,
  ].filter(Boolean)

  function choisirPossession(valeur: Possession) {
    if (avecTomes) setConfirmation(valeur)
    else modifier.possession.mutate(valeur)
  }

  return (
    <div className="flex flex-col gap-10 tablette:grid tablette:grid-cols-[minmax(12rem,17rem)_minmax(0,1fr)] tablette:items-start tablette:gap-x-12">
      {/* En-tête : couverture, titres, auteur, thèmes, statut et possession */}
      <div className="flex flex-col items-center gap-[1.375rem] text-center tablette:sticky tablette:top-[calc(env(safe-area-inset-top)+1.5rem)] tablette:row-span-2 tablette:items-stretch">
        <Couverture
          titre={principal}
          auteur={auteurs.join(', ') || null}
          graine={oeuvre.id}
          className="w-[12.25rem] shadow-forte tablette:w-full"
        />
      </div>

      <div className="flex flex-col gap-10 tablette:min-w-0">
        <div className="-mt-4 flex flex-col items-center gap-[1.375rem] text-center tablette:mt-0 tablette:items-start tablette:text-left">
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 font-titre text-[2.25rem] leading-[1.05] tablette:text-[2.75rem]">{principal}</h1>
            {auteurs.length > 0 && <p className="m-0 text-[1.0625rem]">{auteurs.join(', ')}</p>}
            {illustrateurs.length > 0 && <p className="m-0 text-sm text-discret">Illustrations : {illustrateurs.join(', ')}</p>}
            {repere.length > 0 && <p className="m-0 text-sm text-discret">{repere.join(' · ')}</p>}
          </div>

          {themes.length > 0 && (
            <ul
              aria-label="Thèmes"
              className="m-0 flex max-w-[20rem] list-none flex-wrap justify-center gap-x-3.5 gap-y-1.5 p-0 font-titre text-[1.1875rem] leading-[1.35] italic tablette:max-w-[65ch] tablette:justify-start"
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

          <div className="flex flex-col items-center gap-3 tablette:items-start">
            <div className="flex flex-wrap justify-center gap-2.5">
              <Menu
                nom={`Statut de lecture : ${libelleStatut(oeuvre.statut)}. Changer`}
                contenuBouton={
                  <>
                    {libelleStatut(oeuvre.statut)}
                    <IconeChevronBas taille={16} />
                  </>
                }
                classeBouton={PASTILLE_DOUCE}
                options={STATUTS}
                valeur={oeuvre.statut}
                onChoisir={(valeur) => modifier.statut.mutate(valeur)}
                desactive={!enLigne}
              />
              <Menu
                nom={`Possession : ${libellePossession(possession)}. Changer`}
                contenuBouton={
                  <>
                    {libellePossession(possession)}
                    <IconeChevronBas taille={16} />
                  </>
                }
                classeBouton={PASTILLE_CLAIRE}
                options={POSSESSIONS}
                valeur={possession === 'partielle' ? null : possession}
                onChoisir={choisirPossession}
                desactive={!enLigne}
              />
            </div>
            {!enLigne && (
              <p className="m-0 max-w-[30ch] text-sm text-discret tablette:max-w-none">
                Je pourrai changer le statut et la possession au retour du réseau.
              </p>
            )}
            <p role="alert" className="m-0 text-sm font-semibold text-accent-texte empty:hidden">
              {derniereErreur ? MESSAGES_ECRITURE[derniereErreur] : ''}
            </p>
          </div>
        </div>

        <Resume oeuvre={oeuvre} edition={edition} />
        <MonEdition oeuvre={oeuvre} edition={edition} enLigne={enLigne} choisir={(valeur) => modifier.monEdition.mutate(valeur)} />
        {avecTomes && (
          <Tomes
            titre={principal}
            tomes={oeuvre.tomes}
            enLigne={enLigne}
            changer={(tomes, valeur) => modifier.possessionTomes.mutate({ tomes, possession: valeur })}
          />
        )}
        {oeuvre.medias.length > 0 && <Medias oeuvre={oeuvre} />}

        <div className="border-t border-bordure pt-8">
          <button
            type="button"
            aria-disabled={!enLigne || undefined}
            onClick={() => enLigne && setSuppression(true)}
            className="flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 text-[0.9375rem] font-bold text-accent-texte underline decoration-1 underline-offset-4 aria-disabled:cursor-default aria-disabled:opacity-60"
          >
            Supprimer cette œuvre de ma bibliothèque
          </button>
        </div>
      </div>

      <Dialogue
        ouvert={confirmation !== null}
        titre={confirmation ? titreConfirmationTomes(oeuvre.tomes, confirmation) : ''}
        confirmer="Confirmer"
        onAnnuler={() => setConfirmation(null)}
        onConfirmer={() => {
          if (confirmation) modifier.possessionTomes.mutate({ tomes: 'tous', possession: confirmation })
          setConfirmation(null)
        }}
      >
        {confirmation && texteConfirmationTomes(oeuvre.tomes, confirmation)}
      </Dialogue>

      <Dialogue
        ouvert={suppression}
        titre={`Supprimer « ${principal} » ?`}
        confirmer="Supprimer"
        annuler="Garder"
        occupe={modifier.suppression.isPending}
        onAnnuler={() => setSuppression(false)}
        onConfirmer={() =>
          modifier.suppression.mutate(undefined, {
            onSuccess: () => revenir(LIENS.bibliotheque),
            onSettled: () => setSuppression(false),
          })
        }
      >
        <p className="m-0">
          L’œuvre quittera ma bibliothèque, avec ses éditions{oeuvre.estSerie ? ', ses tomes' : ''}, mes notes et mon historique de lecture.
          Ce geste ne se défait pas.
        </p>
      </Dialogue>
    </div>
  )
}

export function titreConfirmationTomes(tomes: Tome[], possession: Possession) {
  const libelle = POSSESSIONS.find((p) => p.valeur === possession)?.libelle ?? ''
  return tomes.length === 1 ? `Marquer le tome comme « ${libelle} » ?` : `Marquer les ${tomes.length} tomes comme « ${libelle} » ?`
}

export function texteConfirmationTomes(tomes: Tome[], possession: Possession) {
  const changent = tomes.filter((t) => t.possession !== possession).length
  const deja = tomes.length - changent
  if (changent === 0) return 'Tous les tomes le sont déjà : rien ne changera.'
  const partie = changent === 1 ? '1 tome va changer' : `${changent} tomes vont changer`
  if (deja === 0) return `${partie.charAt(0).toUpperCase()}${partie.slice(1)}.`
  return `${partie.charAt(0).toUpperCase()}${partie.slice(1)} ; ${deja === 1 ? 'l’autre l’est' : `les ${deja} autres le sont`} déjà.`
}

function Section({ titre, children, complement }: { titre: string; children: ReactNode; complement?: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex max-w-[65ch] flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={id} className={TITRE_SECTION}>
          {titre}
        </h2>
        {complement}
      </div>
      {children}
    </section>
  )
}

function Resume({ oeuvre, edition }: { oeuvre: OeuvreDetaillee; edition: Edition | null }) {
  const nom = (genre: string) => oeuvre.etiquettes.filter((e) => e.genre === genre).map((e) => minusculeInitiale(e.nom))
  const atmospheres = nom('atmosphere')
  const details = [
    [libelleForme(oeuvre.forme), ...nom('genre')].join(', '),
    LONGUEURS.find((l) => l.valeur === oeuvre.longueur)?.detail,
    mentionTraduction(oeuvre.langueOriginale, edition?.language, edition?.translator),
    atmospheres.length > 0 ? `atmosphère ${enumerer(atmospheres)}` : null,
  ].filter(Boolean)

  return (
    <Section titre="En quelques mots">
      {oeuvre.synopsis ? (
        <p className="m-0 text-[1.0625rem] leading-relaxed whitespace-pre-line">{oeuvre.synopsis}</p>
      ) : (
        <p className="m-0 text-discret">Je n’ai pas encore écrit de résumé pour cette œuvre.</p>
      )}
      <p className="m-0 mt-1 text-[0.9375rem] text-discret">{details.join(' · ')}</p>
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
  const lignes = edition
    ? ([
        ['Éditeur', edition.publisher],
        ['Collection ou format', edition.format],
        ['Langue', nomLangue(edition.language) ?? edition.language],
        ['Traduction', edition.translator],
        ['Pages', edition.pageCount !== null ? String(edition.pageCount) : null],
        ['ISBN', edition.isbn],
      ].filter(([, valeur]) => valeur) as [string, string][])
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
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2.5 rounded-panneau border border-bordure bg-surface p-5 shadow-douce">
          {lignes.map(([terme, valeur]) => (
            <div key={terme} className="contents">
              <dt className="text-[0.9375rem] text-discret">{terme}</dt>
              <dd className="m-0 text-[0.9375rem] font-semibold [overflow-wrap:anywhere]">{valeur}</dd>
            </div>
          ))}
          {lignes.length === 0 && <dd className="col-span-2 m-0 text-discret">Je n’ai rien noté sur cette édition.</dd>}
        </dl>
      ) : (
        <p className="m-0 text-discret">
          {oeuvre.editions.length === 0
            ? 'Aucune édition n’est notée pour cette œuvre.'
            : 'Je n’ai pas encore choisi l’édition que je lis.'}
        </p>
      )}
      <a
        href={LIENS.modifier(oeuvre.id)}
        className="flex min-h-11 items-center self-start text-[0.9375rem] font-bold text-accent-texte underline decoration-1 underline-offset-4"
      >
        {oeuvre.editions.length === 0 ? 'Ajouter une édition' : 'Ajouter ou corriger une édition'}
      </a>
    </Section>
  )
}

const STYLE_TOME: Record<Possession, string> = {
  possede: 'border border-accent bg-accent font-bold text-sur-accent',
  a_acheter: 'border-2 border-dashed border-accent-texte bg-surface font-bold text-accent-texte',
  non_possede: 'border border-bordure bg-transparent font-semibold text-discret',
}

function Tomes({
  titre,
  tomes,
  enLigne,
  changer,
}: {
  titre: string
  tomes: Tome[]
  enLigne: boolean
  changer: (tomes: { de: number; a: number }, possession: Possession) => void
}) {
  const [plage, setPlage] = useState(false)
  return (
    <Section titre="Mes tomes">
      <ul aria-label="Légende" className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-sm text-discret">
        {POSSESSIONS.map((p) => (
          <li key={p.valeur} className="flex items-center gap-2">
            <span aria-hidden="true" className={`inline-block size-4 rounded-full ${STYLE_TOME[p.valeur]}`} />
            {p.libelle}
          </li>
        ))}
      </ul>
      <ul aria-label={`Tomes de ${titre}`} className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2 p-0">
        {tomes.map((tome) => (
          <li key={tome.numero} className="flex">
            <Menu
              nom={`Tome ${tome.numero}${tome.titre ? `, ${tome.titre}` : ''} : ${libellePossession(tome.possession)}. Changer`}
              contenuBouton={tome.numero}
              classeBouton={`flex h-11 w-full min-w-11 items-center justify-center rounded-pilule text-[0.9375rem] tabular-nums ${STYLE_TOME[tome.possession]}`}
              options={POSSESSIONS}
              valeur={tome.possession}
              onChoisir={(valeur) => changer({ de: tome.numero, a: tome.numero }, valeur)}
              desactive={!enLigne}
            />
          </li>
        ))}
      </ul>
      {plage ? (
        <PlageDeTomes
          premier={tomes[0].numero}
          dernier={tomes[tomes.length - 1].numero}
          fermer={() => setPlage(false)}
          appliquer={(de, a, possession) => {
            changer({ de, a }, possession)
            setPlage(false)
          }}
          enLigne={enLigne}
        />
      ) : (
        <button
          type="button"
          aria-disabled={!enLigne || undefined}
          onClick={() => enLigne && setPlage(true)}
          className="flex min-h-11 cursor-pointer items-center self-start border-0 bg-transparent p-0 text-[0.9375rem] font-bold text-accent-texte underline decoration-1 underline-offset-4 aria-disabled:cursor-default aria-disabled:opacity-60"
        >
          Changer plusieurs tomes à la fois
        </button>
      )}
    </Section>
  )
}

function PlageDeTomes({
  premier,
  dernier,
  appliquer,
  fermer,
  enLigne,
}: {
  premier: number
  dernier: number
  appliquer: (de: number, a: number, possession: Possession) => void
  fermer: () => void
  enLigne: boolean
}) {
  const [de, setDe] = useState(String(premier))
  const [a, setA] = useState(String(dernier))
  const [possession, setPossession] = useState<Possession>('possede')
  const [erreur, setErreur] = useState<string | null>(null)

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const debut = Number(de)
        const fin = Number(a)
        if (!Number.isInteger(debut) || !Number.isInteger(fin) || debut < premier || fin > dernier || debut > fin) {
          setErreur(`Choisir des tomes entre ${premier} et ${dernier}, le premier avant le dernier.`)
          return
        }
        appliquer(debut, fin, possession)
      }}
      className="flex flex-col gap-5 rounded-panneau border border-bordure bg-surface p-5 shadow-douce"
    >
      <div className="grid grid-cols-2 gap-4">
        <ChampTexte
          libelle="Du tome"
          inputMode="numeric"
          value={de}
          onChange={(e) => setDe(e.target.value)}
          autoFocus
        />
        <ChampTexte libelle="Au tome" inputMode="numeric" value={a} onChange={(e) => setA(e.target.value)} />
      </div>
      {erreur && (
        <p role="alert" className="m-0 -mt-3 text-sm font-semibold text-accent-texte">
          {erreur}
        </p>
      )}
      <Pastilles legende="Ces tomes, je…" options={POSSESSIONS} valeur={possession} onChange={setPossession} />
      <div className="flex flex-wrap gap-3">
        <Bouton type="submit" occupe={!enLigne}>
          Appliquer
        </Bouton>
        <Bouton variante="secondaire" onClick={fermer}>
          Annuler
        </Bouton>
      </div>
    </form>
  )
}

function Medias({ oeuvre }: { oeuvre: OeuvreDetaillee }) {
  return (
    <Section titre="À l’écran">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {oeuvre.medias.map((media) => {
          const details = [
            media.saisons !== null ? `${media.saisons} saison${media.saisons > 1 ? 's' : ''}` : null,
            media.episodes !== null ? `${media.episodes} épisode${media.episodes > 1 ? 's' : ''}` : null,
          ].filter(Boolean)
          return (
            <li key={media.id} className="flex flex-col gap-0.5 rounded-panneau border border-bordure bg-surface px-5 py-4 shadow-douce">
              <span className="text-sm font-bold text-discret">{libelleTypeMedia(media.type)}</span>
              <span className="font-titre text-xl">{media.titre ?? oeuvre.titreFr}</span>
              {details.length > 0 && <span className="text-[0.9375rem] text-discret">{details.join(' · ')}</span>}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
