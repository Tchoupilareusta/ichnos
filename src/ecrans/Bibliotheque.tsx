import { useId, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { EchecInstallation, EchecLecture, OeuvreListee } from '../bibliotheque/depot'
import {
  FILTRES_VIDES,
  POSSESSIONS,
  STATUTS,
  correspond,
  filtresActifs,
  filtresDepuisParametres,
  libellePossession,
  libelleStatut,
  parametresDepuisFiltres,
  type Filtres,
  type Possession,
  type Statut,
} from '../bibliotheque/modele'
import { CLES, useOeuvres } from '../bibliotheque/requetes'
import { Bouton } from '../composants/Bouton'
import { ChampListe } from '../composants/Champs'
import { IconeFermer, IconeFiltres, IconeRecherche } from '../composants/Icones'
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
  const [panneauOuvert, setPanneauOuvert] = useState(false)
  const idPanneau = useId()

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

  const envies = filtres.statut === 'envie_de_lire'
  const pastilles = pastillesActives(filtres)

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-4">
        <div role="search">
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
              className="h-13 w-full max-w-xl rounded-pilule border border-bordure bg-surface pr-5 pl-13 text-base text-encre shadow-douce placeholder:text-discret"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            aria-pressed={envies}
            onClick={() => changer('statut', envies ? null : 'envie_de_lire')}
            className={`flex min-h-11 cursor-pointer items-center rounded-pilule px-4.5 text-[0.9375rem] transition-colors duration-200 ${
              envies ? 'border border-accent bg-accent font-bold text-sur-accent' : 'border border-bordure bg-surface font-semibold text-encre'
            }`}
          >
            Ma liste d’envies
          </button>
          <button
            type="button"
            aria-expanded={panneauOuvert}
            aria-controls={idPanneau}
            onClick={() => setPanneauOuvert(!panneauOuvert)}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-pilule border border-bordure bg-surface px-4.5 text-[0.9375rem] font-semibold text-encre"
          >
            <IconeFiltres taille={18} />
            {panneauOuvert ? 'Masquer les filtres' : 'Filtres'}
          </button>
        </div>

        <div id={idPanneau} hidden={!panneauOuvert}>
          <PanneauFiltres filtres={filtres} facettes={facettes} changer={changer} effacer={() => setFiltres(FILTRES_VIDES)} />
        </div>

        {pastilles.length > 0 && (
          <ul aria-label="Filtres actifs" className="m-0 flex list-none flex-wrap gap-2 p-0">
            {pastilles.map(({ cle, texte }) => (
              <li key={cle}>
                <button
                  type="button"
                  onClick={() => changer(cle, null)}
                  aria-label={`Retirer le filtre ${texte}`}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-pilule bg-accent-doux pr-3 pl-4 text-[0.9375rem] font-semibold text-accent-texte"
                >
                  {texte}
                  <IconeFermer taille={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {resultats.length > 0 ? (
        <Grille oeuvres={resultats} />
      ) : (
        <EtatVide
          action={
            <Bouton variante="secondaire" onClick={() => setFiltres(FILTRES_VIDES)}>
              Tout afficher
            </Bouton>
          }
        >
          {/* Annoncé par VoiceOver dès qu'une recherche ne trouve plus rien. */}
          <span role="status">
            {envies && !filtres.recherche && pastilles.length === 0
              ? 'Ma liste d’envies est vide pour l’instant. Sur une fiche, le statut « Envie de lire » y range une œuvre.'
              : 'Rien dans ma bibliothèque ne correspond à cette recherche.'}
          </span>
        </EtatVide>
      )}
    </div>
  )
}

type CleFacette = 'auteur' | 'genre' | 'theme' | 'atmosphere' | 'statut' | 'possession'

function pastillesActives(filtres: Filtres): { cle: CleFacette; texte: string }[] {
  const liste: { cle: CleFacette; texte: string }[] = []
  if (filtres.auteur) liste.push({ cle: 'auteur', texte: filtres.auteur })
  if (filtres.genre) liste.push({ cle: 'genre', texte: filtres.genre })
  if (filtres.theme) liste.push({ cle: 'theme', texte: filtres.theme })
  if (filtres.atmosphere) liste.push({ cle: 'atmosphere', texte: filtres.atmosphere })
  if (filtres.statut && filtres.statut !== 'envie_de_lire') liste.push({ cle: 'statut', texte: libelleStatut(filtres.statut) })
  if (filtres.possession) liste.push({ cle: 'possession', texte: libellePossession(filtres.possession) })
  return liste
}

function PanneauFiltres({
  filtres,
  facettes,
  changer,
  effacer,
}: {
  filtres: Filtres
  facettes: Record<'auteur' | 'genre' | 'theme' | 'atmosphere', string[]>
  changer: <K extends keyof Filtres>(cle: K, valeur: Filtres[K]) => void
  effacer: () => void
}) {
  const liste = (valeurs: string[], tous: string) => [{ valeur: '', libelle: tous }, ...valeurs.map((v) => ({ valeur: v, libelle: v }))]
  return (
    <div className="flex flex-col gap-5 rounded-panneau border border-bordure bg-surface p-5 shadow-douce tablette:p-6">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] gap-4">
        <ChampListe
          libelle="Auteur"
          value={filtres.auteur ?? ''}
          onChange={(e) => changer('auteur', e.target.value || null)}
          options={liste(facettes.auteur, 'Tous les auteurs')}
        />
        <ChampListe
          libelle="Genre"
          value={filtres.genre ?? ''}
          onChange={(e) => changer('genre', e.target.value || null)}
          options={liste(facettes.genre, 'Tous les genres')}
        />
        <ChampListe
          libelle="Thème"
          value={filtres.theme ?? ''}
          onChange={(e) => changer('theme', e.target.value || null)}
          options={liste(facettes.theme, 'Tous les thèmes')}
        />
        <ChampListe
          libelle="Atmosphère"
          value={filtres.atmosphere ?? ''}
          onChange={(e) => changer('atmosphere', e.target.value || null)}
          options={liste(facettes.atmosphere, 'Toutes les atmosphères')}
        />
        <ChampListe
          libelle="Statut de lecture"
          value={filtres.statut ?? ''}
          onChange={(e) => changer('statut', (e.target.value || null) as Statut | null)}
          options={[{ valeur: '', libelle: 'Tous les statuts' }, ...STATUTS.map((s) => ({ valeur: s.valeur, libelle: s.libelle }))]}
        />
        <ChampListe
          libelle="Possession"
          value={filtres.possession ?? ''}
          onChange={(e) => changer('possession', (e.target.value || null) as Possession | null)}
          aide="Une série où j’ai des tomes, ou des tomes à acheter, apparaît dans « Je l’ai » ou « À acheter »."
          options={[{ valeur: '', libelle: 'Toutes' }, ...POSSESSIONS.map((p) => ({ valeur: p.valeur, libelle: p.libelle }))]}
        />
      </div>
      {filtresActifs(filtres) && (
        <button
          type="button"
          onClick={effacer}
          className="flex min-h-11 cursor-pointer items-center self-start border-0 bg-transparent p-0 text-[0.9375rem] font-bold text-accent-texte underline decoration-1 underline-offset-4"
        >
          Effacer la recherche et les filtres
        </button>
      )}
    </div>
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
