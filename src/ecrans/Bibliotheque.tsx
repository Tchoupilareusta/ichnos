import { useEffect, useState } from 'react'
import type { EchecInstallation, EchecLecture, OeuvreListee } from '../bibliotheque/depot'
import { Bouton } from '../composants/Bouton'
import { EtatVide, Page, TitrePage } from '../composants/Page'
import { LIENS } from '../navigation/routes'
import { useSession } from '../session/Session'

type Etat = { statut: 'chargement' } | { statut: 'erreur'; echec: EchecLecture } | { statut: 'pret'; oeuvres: OeuvreListee[] }

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
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' })
  const [installation, setInstallation] = useState<'repos' | 'en-cours' | 'faite'>('repos')
  const [erreur, setErreur] = useState<string | null>(null)

  async function ouvrir() {
    const lecture = await depot.listerOeuvres()
    setEtat(lecture.ok ? { statut: 'pret', oeuvres: lecture.oeuvres } : { statut: 'erreur', echec: lecture.echec })
  }

  useEffect(() => {
    let actif = true
    depot.listerOeuvres().then((lecture) => {
      if (!actif) return
      setEtat(lecture.ok ? { statut: 'pret', oeuvres: lecture.oeuvres } : { statut: 'erreur', echec: lecture.echec })
    })
    return () => {
      actif = false
    }
  }, [depot])

  async function installer() {
    setInstallation('en-cours')
    setErreur(null)
    const resultat = await depot.installerCatalogue()
    if (resultat.ok) {
      setInstallation('faite')
      await ouvrir()
      return
    }
    setInstallation('repos')
    setErreur(ERREUR_INSTALLATION[resultat.echec])
    // Déjà installée ailleurs (un autre appareil, un double appui) : on montre ce qui s'y trouve.
    if (resultat.echec === 'deja') await ouvrir()
  }

  return (
    <Page>
      <TitrePage>Ma bibliothèque</TitrePage>

      {etat.statut === 'chargement' && (
        <p role="status" className="m-0 text-discret">
          Ouverture de ma bibliothèque…
        </p>
      )}

      {etat.statut === 'erreur' && (
        <EtatVide
          action={
            <Bouton
              variante="secondaire"
              onClick={() => {
                setEtat({ statut: 'chargement' })
                void ouvrir()
              }}
            >
              Réessayer
            </Bouton>
          }
        >
          <span role="alert">{ERREUR_LECTURE[etat.echec]}</span>
        </EtatVide>
      )}

      {etat.statut === 'pret' && etat.oeuvres.length === 0 && (
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

      {etat.statut === 'pret' && etat.oeuvres.length > 0 && (
        <>
          <p role="status" className="m-0 text-discret empty:hidden">
            {installation === 'faite' ? 'Le catalogue de départ est installé.' : ''}
          </p>
          <ListeOeuvres oeuvres={etat.oeuvres} />
        </>
      )}
    </Page>
  )
}

/** Liste provisoire, titre et auteur : la grille de couvertures arrive à l'étape suivante. */
function ListeOeuvres({ oeuvres }: { oeuvres: OeuvreListee[] }) {
  return (
    <ul className="m-0 grid max-w-5xl list-none grid-cols-1 gap-x-12 p-0 tablette:grid-cols-2">
      {oeuvres.map((oeuvre) => (
        <li key={oeuvre.id} className="flex flex-col gap-1 border-b border-bordure py-4">
          <span className="font-titre text-xl leading-snug text-balance">{oeuvre.titre}</span>
          {oeuvre.titreSecondaire && (
            <span className="font-titre text-[0.9375rem] italic text-discret">
              {oeuvre.titreSecondaire}
            </span>
          )}
          {oeuvre.auteurs.length > 0 && <span className="text-[0.9375rem] text-discret">{oeuvre.auteurs.join(', ')}</span>}
        </li>
      ))}
    </ul>
  )
}
