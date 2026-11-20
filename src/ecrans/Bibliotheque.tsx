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
  type Possession,
  type Statut,
} from '../bibliotheque/modele'
import { CLES, useOeuvres } from '../bibliotheque/requetes'
import { Bouton } from '../composants/Bouton'
import { ChampListe } from '../composants/Champs'
import { Feuille } from '../composants/Feuille'
import { IconeChevronBas, IconeFermer, IconeFiltres, IconeRecherche } from '../composants/Icones'
import { IconeLivre, IconePossession, IconePossessionGenerique, IconeStatut } from '../composants/IconesLecture'
import { Menu } from '../composants/Menu'
import { EtatVide, Page, TitrePage } from '../composants/Page'
import { Couverture } from '../couvertures/Couverture'
import { LIENS } from '../navigation/routes'
import { useRoute } from '../navigation/useRoute'
import { useSession } from '../session/Session'

const ERREUR_LECTURE: Record<EchecLecture, string> = {
  reseau: 'Pas de connexion à internet : ma bibliothèque s’affichera au retour du réseau.',
  inconnu: 'Ma bibliothèque n’a pas pu s’ouvrir. Réessayer dans un instant.',
}

const ERREUR_INSTALLATION: Record<EchecInstallation, string> = {
  reseau: 'Pas de connexion à internet : l’installation attendra le retour du réseau.',
  deja: 'Ma bibliothèque contient déjà des œuvres : le catalogue n’a pas été installé une seconde fois.',
  inconnu: 'L’installation n’a pas abouti, et rien n’a été enregistré. Réessayer dans un instant.',
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
          Ma bibliothèque est encore vide. Y installer le catalogue de départ, ou ajouter mes livres un à un.
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
        {/* Avec un texte très agrandi, « Filtres » passe sous la recherche plutôt que de la tronquer. */}
        <div className="flex max-w-2xl flex-wrap items-center gap-2.5">
          <div role="search" className="min-w-[min(100%,10rem)] flex-1">
            <label className="relative block">
              <span className="sr-only">Rechercher un titre ou un auteur</span>
              <span className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 text-discret">
                <IconeRecherche taille={20} />
              </span>
              <input
                type="search"
                value={filtres.recherche}
                onChange={(e) => changer('recherche', e.target.value)}
                placeholder="Rechercher"
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

        {/* Les deux filtres de tous les jours : deux bulles qui ouvrent un menu. Jamais coupées par le
            bord de l'écran ; si les deux bulles actives ne tiennent pas côte à côte, la seconde passe à la ligne. */}
        <div className="flex flex-wrap gap-2">
          <BulleFiltre
            nom="statut"
            libelle="Statut"
            icone={<IconeLivre taille={19} />}
            options={OPTIONS_STATUT}
            valeur={filtres.statut}
            choisir={(valeur) => changer('statut', valeur)}
          />
          <BulleFiltre
            nom="possession"
            libelle="Possession"
            icone={<IconePossessionGenerique />}
            options={OPTIONS_POSSESSION}
            valeur={filtres.possession}
            choisir={(valeur) => changer('possession', valeur)}
          />
        </div>

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

      <Feuille ouvert={feuille} titre="Filtres" fermer={() => setFeuille(false)} libelleFermer="Voir mes livres">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(14rem,100%),1fr))] gap-4">
          <ChampListe
            libelle="Statut de lecture"
            value={filtres.statut ?? ''}
            onChange={(e) => changer('statut', (e.target.value || null) as Statut | null)}
            options={[{ valeur: '', libelle: 'Tous' }, ...STATUTS]}
          />
          <ChampListe
            libelle="Possession"
            value={filtres.possession ?? ''}
            onChange={(e) => changer('possession', (e.target.value || null) as Possession | null)}
            options={[{ valeur: '', libelle: 'Toutes' }, ...POSSESSIONS]}
          />
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

const OPTIONS_STATUT = STATUTS.map((s) => ({ ...s, icone: <IconeStatut statut={s.valeur} taille={19} /> }))
const OPTIONS_POSSESSION = POSSESSIONS.map((p) => ({ ...p, icone: <IconePossession possession={p.valeur} /> }))

type CleFacette = 'genre' | 'theme' | 'atmosphere' | 'auteur'

/** Les autres filtres du panneau qui sont choisis (genre, thème, atmosphère, auteur), dans son ordre. */
function pastillesFacettes(filtres: Filtres): { cle: CleFacette; texte: string }[] {
  return (['genre', 'theme', 'atmosphere', 'auteur'] as const)
    .filter((cle) => filtres[cle])
    .map((cle) => ({ cle, texte: filtres[cle] as string }))
}

/**
 * Bulle de filtre : « Statut ▾ » ouvre un menu ; une fois un choix fait, la bulle l'affiche avec son
 * icône (« En cours ✕ »), prend le fond d'accent doux, et la croix retire le filtre.
 */
function BulleFiltre<T extends string>({
  nom,
  libelle,
  icone,
  options,
  valeur,
  choisir,
}: {
  /** « statut », « possession » : pour ce que VoiceOver lit. */
  nom: string
  libelle: string
  icone: ReactNode
  options: { valeur: T; libelle: string; icone: ReactNode }[]
  valeur: T | null
  choisir: (valeur: T | null) => void
}) {
  const choix = options.find((o) => o.valeur === valeur) ?? null
  return (
    <div
      className={`flex max-w-full items-center rounded-pilule border text-[0.9375rem] transition-colors duration-200 ${
        choix ? 'border-transparent bg-accent-doux font-bold text-accent-texte' : 'border-bordure bg-surface font-semibold text-encre'
      }`}
    >
      <Menu
        nom={choix ? `Filtre ${nom} : ${choix.libelle}. Changer` : `Filtrer par ${nom}, aucun filtre`}
        nomListe={`Filtrer par ${nom}`}
        contenuBouton={
          <>
            {choix ? choix.icone : icone}
            <span className="min-w-0">{choix ? choix.libelle : libelle}</span>
            {!choix && <IconeChevronBas taille={16} />}
          </>
        }
        classeBouton={`flex min-h-11 min-w-0 items-center gap-1.5 rounded-pilule border-0 bg-transparent pl-3.5 text-left text-inherit ${
          choix ? 'pr-1' : 'pr-3'
        }`}
        options={options}
        valeur={valeur}
        onChoisir={choisir}
      />
      {choix && (
        <button
          type="button"
          onClick={() => choisir(null)}
          aria-label={`Retirer le filtre ${choix.libelle}`}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pilule border-0 bg-transparent text-inherit"
        >
          <IconeFermer taille={16} />
        </button>
      )}
    </div>
  )
}

/**
 * Grille de couvertures : le nombre de colonnes suit la largeur de l'écran (2 sur iPhone, 4 sur iPad
 * en portrait, 6 en paysage), pas la taille du texte choisie dans les réglages de l'iPhone.
 */
function Grille({ oeuvres }: { oeuvres: OeuvreListee[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-7 p-0 min-[36rem]:grid-cols-3 tablette:grid-cols-4 tablette:gap-x-5 tablette:gap-y-9 min-[64rem]:grid-cols-5 min-[72rem]:grid-cols-6">
      {oeuvres.map((oeuvre) => (
        <li key={oeuvre.id} className="min-w-0">
          <a href={LIENS.oeuvre(oeuvre.id)} className="group flex flex-col gap-3 text-encre no-underline">
            <Couverture
              titre={oeuvre.titre}
              graine={oeuvre.id}
              chemin={oeuvre.couverture}
              className="transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-active:scale-[0.98]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[0.9375rem] leading-[1.3] font-bold text-balance [overflow-wrap:anywhere]">{oeuvre.titre}</span>
              {oeuvre.auteurs.length > 0 && <span className="text-sm text-discret">{oeuvre.auteurs.join(', ')}</span>}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
