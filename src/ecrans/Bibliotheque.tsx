import { useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { EchecInstallation, EchecLecture, OeuvreListee } from '../bibliotheque/depot'
import {
  FILTRES_VIDES,
  POSSESSIONS,
  STATUTS,
  correspond,
  filtresDepuisParametres,
  parametresDepuisFiltres,
  type Filtres,
} from '../bibliotheque/modele'
import { CLES, useOeuvres } from '../bibliotheque/requetes'
import { Bouton } from '../composants/Bouton'
import { ChampListe } from '../composants/Champs'
import { Feuille } from '../composants/Feuille'
import { IconeFermer, IconeFiltres, IconeRecherche } from '../composants/Icones'
import { IconePossession, IconeStatut } from '../composants/IconesLecture'
import { EtatVide, Page, TitrePage } from '../composants/Page'
import { Couverture } from '../couvertures/Couverture'
import { LIENS } from '../navigation/routes'
import { useRoute } from '../navigation/useRoute'
import { useSession } from '../session/Session'

const ERREUR_LECTURE: Record<EchecLecture, string> = {
  reseau: 'Pas de connexion à internet : ma bibliothèque s’affichera au retour du réseau.',
  inconnu: 'Ma bibliothèque n’a pas pu s’ouvrir. Je réessaie dans un instant.',
}

const ERREUR_INSTALLATION: Record<EchecInstallation, string> = {
  reseau: 'Pas de connexion à internet : l’installation attendra le retour du réseau.',
  deja: 'Ma bibliothèque contient déjà des œuvres : le catalogue n’a pas été installé une seconde fois.',
  inconnu: 'L’installation n’a pas abouti, et rien n’a été enregistré. Je réessaie dans un instant.',
}

export function Bibliotheque() {
  const { depot } = useSession()
  const client = useQueryClient()
  const requete = useOeuvres()
  const [installation, setInstallation] = useState<'repos' | 'en-cours' | 'faite'>('repos')
  const [erreur, setErreur] = useState<string | null>(null)

  async function installer() {
    if (installation === 'en-cours') return
    setInstallation('en-cours')
    setErreur(null)
    const resultat = await depot.installerCatalogue()
    if (resultat.ok) setInstallation('faite')
    else {
      setInstallation('repos')
      setErreur(ERREUR_INSTALLATION[resultat.echec])
    }
    // Réussie, ou déjà faite ailleurs (un autre appareil, un double appui) : on montre ce qui s'y trouve.
    if (resultat.ok || resultat.echec === 'deja') await client.invalidateQueries({ queryKey: CLES.oeuvres })
  }

  const oeuvres = requete.data
  const echec = requete.error?.echec === 'reseau' ? 'reseau' : 'inconnu'

  return (
    <Page>
      <TitrePage>Ma bibliothèque</TitrePage>

      {requete.isPending && (
        <p role="status" className="m-0 text-discret">
          Ouverture de ma bibliothèque…
        </p>
      )}

      {/* Les œuvres déjà chargées restent affichées si une relecture échoue (hors connexion). */}
      {requete.isError && !oeuvres && (
        <EtatVide
          action={
            <Bouton variante="secondaire" onClick={() => void requete.refetch()}>
              Réessayer
            </Bouton>
          }
        >
          <span role="alert">{ERREUR_LECTURE[echec]}</span>
        </EtatVide>
      )}

      {oeuvres && oeuvres.length === 0 && (
        <EtatVide
          action={
            <div className="flex flex-col items-start gap-4">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <Bouton occupe={installation === 'en-cours'} onClick={installer}>
                  Installer le catalogue de départ
                </Bouton>
                <a
                  href={LIENS.ajouter}
                  className="flex min-h-12 items-center text-[0.9375rem] font-semibold text-accent-texte underline decoration-1 underline-offset-4"
                >
                  Ajouter une œuvre
                </a>
              </div>
              <p role="status" className="m-0 text-sm text-discret empty:hidden">
                {installation === 'en-cours' ? 'Installation en cours…' : ''}
              </p>
            </div>
          }
        >
          Ma bibliothèque est encore vide. Je peux y installer le catalogue de départ, ou ajouter mes livres un à un.
        </EtatVide>
      )}

      {erreur && (
        <p role="alert" className="m-0 max-w-[65ch] rounded-carte bg-accent-doux px-5 py-4 text-[0.9375rem] font-semibold text-accent-texte">
          {erreur}
        </p>
      )}

      {oeuvres && oeuvres.length > 0 && (
        <>
          <p role="status" className="m-0 -mb-4 text-discret empty:hidden">
            {installation === 'faite' ? 'Le catalogue de départ est installé.' : ''}
          </p>
          <Collection oeuvres={oeuvres} />
        </>
      )}
    </Page>
  )
}

/** Recherche, filtres et grille. Les filtres vivent dans l'adresse : « Retour » depuis une fiche les retrouve. */
function Collection({ oeuvres }: { oeuvres: OeuvreListee[] }) {
  const route = useRoute()
  const [filtres, setFiltresBruts] = useState<Filtres>(() => filtresDepuisParametres(route.parametres))
  const [feuille, setFeuille] = useState(false)

  function setFiltres(suivants: Filtres) {
    setFiltresBruts(suivants)
    const requete = parametresDepuisFiltres(suivants).toString()
    // replaceState : ni nouvelle entrée d'historique à chaque lettre, ni rechargement de l'écran.
    window.history.replaceState(window.history.state, '', `${LIENS.bibliotheque}${requete ? `?${requete}` : ''}`)
  }
  const changer = <K extends keyof Filtres>(cle: K, valeur: Filtres[K]) => setFiltres({ ...filtres, [cle]: valeur })

  const facettes = useMemo(() => {
    const valeurs = (choisir: (o: OeuvreListee) => string[]) =>
      [...new Set(oeuvres.flatMap(choisir))].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
    return {
      auteur: valeurs((o) => o.auteurs),
      genre: valeurs((o) => o.genres),
      theme: valeurs((o) => o.themes),
      atmosphere: valeurs((o) => o.atmospheres),
    }
  }, [oeuvres])

  const resultats = useMemo(
    () =>
      oeuvres.filter((o) =>
        correspond(
          {
            titres: [o.titre, o.titreSecondaire ?? ''],
            auteurs: o.auteurs,
            genres: o.genres,
            themes: o.themes,
            atmospheres: o.atmospheres,
            statut: o.statut,
            possessions: o.possessionsFiltrables,
          },
          filtres,
        ),
      ),
    [oeuvres, filtres],
  )

  const facettesActives = pastillesFacettes(filtres)
  const seulementEnvies =
    filtres.statut === 'envie_de_lire' && !filtres.recherche.trim() && !filtres.possession && facettesActives.length === 0
  const seulementRecherche = !!filtres.recherche.trim() && !filtres.statut && !filtres.possession && facettesActives.length === 0
  const toutEffacer = () => setFiltres(FILTRES_VIDES)

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3.5">
        <div className="flex max-w-2xl items-center gap-2.5">
          <div role="search" className="min-w-0 flex-1">
            <label className="relative block">
              <span className="sr-only">Chercher un titre ou un auteur</span>
              <span className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-discret">
                <IconeRecherche taille={20} />
              </span>
              <input
                type="search"
                value={filtres.recherche}
                onChange={(e) => changer('recherche', e.target.value)}
                placeholder="Un titre, un auteur…"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="h-13 w-full rounded-pilule border border-bordure bg-surface pr-5 pl-13 text-base text-encre shadow-douce placeholder:text-discret"
              />
            </label>
          </div>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setFeuille(true)}
            className={`flex h-13 shrink-0 cursor-pointer items-center gap-2 rounded-pilule px-4.5 text-[0.9375rem] font-semibold shadow-douce ${
              facettesActives.length > 0 ? 'border border-transparent bg-accent-doux text-accent-texte' : 'border border-bordure bg-surface text-encre'
            }`}
          >
            <IconeFiltres taille={18} />
            Filtres
          </button>
        </div>

        {/* Les deux filtres de tous les jours, toujours à portée : un appui choisit, un second retire. */}
        <RangeePastilles libelle="Statut de lecture" defile>
          {STATUTS.map(({ valeur, libelle }) => {
            const choisi = filtres.statut === valeur
            return (
              <PastilleFiltre
                key={valeur}
                choisi={choisi}
                onClick={() => changer('statut', choisi ? null : valeur)}
                icone={<IconeStatut statut={valeur} taille={19} />}
                nom={valeur === 'envie_de_lire' ? 'Envie de lire, ma liste d’envies' : undefined}
              >
                {libelle}
              </PastilleFiltre>
            )
          })}
        </RangeePastilles>
        <RangeePastilles libelle="Possession" defile>
          {POSSESSIONS.map(({ valeur, libelle }) => {
            const choisi = filtres.possession === valeur
            return (
              <PastilleFiltre
                key={valeur}
                choisi={choisi}
                onClick={() => changer('possession', choisi ? null : valeur)}
                icone={<IconePossession possession={valeur} />}
              >
                {libelle}
              </PastilleFiltre>
            )
          })}
        </RangeePastilles>

        {facettesActives.length > 0 && (
          <ul aria-label="Autres filtres choisis" className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
            {facettesActives.map(({ cle, texte }) => (
              <li key={cle}>
                <button
                  type="button"
                  onClick={() => changer(cle, null)}
                  aria-label={`Retirer le filtre ${texte}`}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-pilule border-0 bg-accent-doux pr-3 pl-4 text-[0.9375rem] font-semibold text-accent-texte"
                >
                  {texte}
                  <IconeFermer taille={16} />
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={toutEffacer}
                aria-label="Tout effacer : la recherche et les filtres"
                className="flex min-h-11 cursor-pointer items-center border-0 bg-transparent px-2 text-[0.9375rem] font-bold text-accent-texte underline decoration-1 underline-offset-4"
              >
                Tout effacer
              </button>
            </li>
          </ul>
        )}
      </div>

      {resultats.length > 0 ? (
        <Grille oeuvres={resultats} />
      ) : (
        <EtatVide
          action={
            <Bouton variante="secondaire" onClick={toutEffacer}>
              Tout effacer
            </Bouton>
          }
        >
          {/* Annoncé par VoiceOver dès que plus rien ne correspond. */}
          <span role="status">
            {seulementEnvies
              ? 'Ma liste d’envies est vide pour l’instant. Sur une fiche, le statut « Envie de lire » y range une œuvre.'
              : seulementRecherche
                ? 'Rien dans ma bibliothèque ne correspond à cette recherche.'
                : 'Rien ne correspond à ces filtres.'}
          </span>
        </EtatVide>
      )}

      <Feuille ouvert={feuille} titre="Plus de filtres" fermer={() => setFeuille(false)} libelleFermer="Voir mes livres">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(14rem,100%),1fr))] gap-4">
          <ChampListe
            libelle="Genre"
            value={filtres.genre ?? ''}
            onChange={(e) => changer('genre', e.target.value || null)}
            options={liste(facettes.genre, 'Tous')}
          />
          <ChampListe
            libelle="Thème"
            value={filtres.theme ?? ''}
            onChange={(e) => changer('theme', e.target.value || null)}
            options={liste(facettes.theme, 'Tous')}
          />
          <ChampListe
            libelle="Atmosphère"
            value={filtres.atmosphere ?? ''}
            onChange={(e) => changer('atmosphere', e.target.value || null)}
            options={liste(facettes.atmosphere, 'Toutes')}
          />
          <ChampListe
            libelle="Auteur"
            value={filtres.auteur ?? ''}
            onChange={(e) => changer('auteur', e.target.value || null)}
            options={liste(facettes.auteur, 'Tous')}
          />
        </div>
      </Feuille>
    </div>
  )
}

const liste = (valeurs: string[], tous: string) => [{ valeur: '', libelle: tous }, ...valeurs.map((v) => ({ valeur: v, libelle: v }))]

type CleFacette = 'genre' | 'theme' | 'atmosphere' | 'auteur'

/** Les filtres de la feuille « Plus de filtres » qui sont choisis, dans l'ordre de la feuille. */
function pastillesFacettes(filtres: Filtres): { cle: CleFacette; texte: string }[] {
  return (['genre', 'theme', 'atmosphere', 'auteur'] as const)
    .filter((cle) => filtres[cle])
    .map((cle) => ({ cle, texte: filtres[cle] as string }))
}

/**
 * Une rangée de pastilles. Sur un iPhone étroit, elle défile à l’horizontale jusqu’au
 * bord de l'écran ; sur iPad, tout tient sur la largeur.
 */
function RangeePastilles({ libelle, defile = false, children }: { libelle: string; defile?: boolean; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={libelle}
      className={
        defile
          ? '-mx-6 -my-1 flex gap-2 overflow-x-auto px-6 py-1 [scrollbar-width:none] tablette:mx-0 tablette:flex-wrap tablette:overflow-visible tablette:px-0 [&::-webkit-scrollbar]:hidden'
          : 'flex flex-wrap gap-2'
      }
    >
      {children}
    </div>
  )
}

function PastilleFiltre({
  choisi,
  onClick,
  icone,
  nom,
  children,
}: {
  choisi: boolean
  onClick: () => void
  icone: ReactNode
  /** Nom lu par VoiceOver, quand il dit plus que le mot affiché (il commence toujours par lui). */
  nom?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={choisi}
      aria-label={nom}
      onClick={onClick}
      className={`flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-pilule pr-3.5 pl-3 text-[0.9375rem] whitespace-nowrap transition-colors duration-200 ${
        choisi ? 'border border-accent bg-accent font-bold text-sur-accent' : 'border border-bordure bg-surface font-semibold text-encre'
      }`}
    >
      {icone}
      {children}
    </button>
  )
}

function Grille({ oeuvres }: { oeuvres: OeuvreListee[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(8.75rem,40vw),1fr))] gap-x-5 gap-y-8 p-0 tablette:gap-x-6 tablette:gap-y-10">
      {oeuvres.map((oeuvre) => (
        <li key={oeuvre.id} className="min-w-0">
          <a href={LIENS.oeuvre(oeuvre.id)} className="group flex flex-col gap-3 text-encre no-underline">
            <Couverture
              titre={oeuvre.titre}
              graine={oeuvre.id}
              className="transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-active:scale-[0.98]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[0.9375rem] leading-[1.3] font-bold text-balance">{oeuvre.titre}</span>
              {oeuvre.auteurs.length > 0 && <span className="text-sm text-discret">{oeuvre.auteurs.join(', ')}</span>}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
