import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CLES } from '../bibliotheque/requetes'
import { Bouton } from '../composants/Bouton'
import { useEnLigne } from '../navigation/useEnLigne'
import { useSession } from '../session/Session'
import { chercherCouverturesManquantes, PAUSE_ENTRE_DEMANDES, type Avancement, type ResultatOeuvre } from './recherche'

const pluriel = (nombre: number, mot: string) => `${nombre} ${mot}${nombre > 1 ? 's' : ''}`

/** « Momo : couverture trouvée », « Vinland Saga : 12 couvertures de tome trouvées sur 29 cherchées ». */
function phrase(r: ResultatOeuvre): string {
  if (!r.serie) {
    if (r.cherchees === 0) return 'pas d’ISBN connu, pas cherchée'
    return r.trouvees > 0 ? 'couverture trouvée' : 'pas de couverture trouvée'
  }
  const sansIsbn = r.sansIsbn > 0 ? `${pluriel(r.sansIsbn, 'tome')} sans ISBN` : null
  if (r.cherchees === 0) return sansIsbn ?? ''
  const trouvees = `${r.trouvees} couverture${r.trouvees > 1 ? 's' : ''} de tome trouvée${r.trouvees > 1 ? 's' : ''} sur ${r.cherchees} cherchée${r.cherchees > 1 ? 's' : ''}`
  return [trouvees, sansIsbn].filter(Boolean).join(' · ')
}

function conclusion(avancement: Avancement): string | null {
  if (avancement.arret === 'arrete') return 'Recherche arrêtée. Ce qui a été trouvé est rangé ; je la relance quand je veux.'
  if (avancement.arret === 'reseau')
    return 'Plus de connexion : la recherche s’est interrompue. Relancée au retour du réseau, elle reprendra où elle s’est arrêtée.'
  if (avancement.arret === 'indisponible')
    return 'La recherche automatique ne répond pas pour le moment. Je réessaie plus tard : ce qui a été trouvé est rangé.'
  if (!avancement.termine) return null
  return avancement.resultats.length === 0 ? 'Tout a déjà sa couverture.' : 'Recherche terminée.'
}

/**
 * Réglages : cherche, une par une, les couvertures qui manquent. Sans IA, une demande à la fois,
 * et la liste de ce qui a été trouvé ou non, œuvre par œuvre.
 */
export function CouverturesManquantes() {
  const { depot, assistant, couvertures } = useSession()
  const client = useQueryClient()
  const enLigne = useEnLigne()
  const [avancement, setAvancement] = useState<Avancement | null>(null)
  const [enCours, setEnCours] = useState(false)
  // Faux dès que je demande l'arrêt ou que je quitte l'écran : la recherche s'arrête avant la demande suivante.
  const continuer = useRef(false)
  useEffect(() => () => void (continuer.current = false), [])

  async function lancer() {
    if (!enLigne || enCours) return
    continuer.current = true
    setEnCours(true)
    setAvancement(null)
    try {
      await chercherCouverturesManquantes({
        depot,
        assistant,
        couvertures,
        attendre: () => new Promise((suite) => setTimeout(suite, PAUSE_ENTRE_DEMANDES)),
        continuer: () => continuer.current,
        surAvancement: setAvancement,
      })
    } finally {
      setEnCours(false)
      // Les couvertures rangées apparaissent partout : bibliothèque, accueil, fiches.
      await Promise.all([
        client.invalidateQueries({ queryKey: CLES.oeuvres }),
        client.invalidateQueries({ queryKey: CLES.enCours }),
        client.invalidateQueries({ queryKey: ['oeuvre'] }),
      ])
    }
  }

  const fin = avancement && !enCours ? conclusion(avancement) : null

  return (
    <section aria-labelledby="couvertures-manquantes" data-etat={enCours ? 'recherche' : 'repos'} className="flex max-w-xl flex-col items-start gap-4">
      <h2 id="couvertures-manquantes" className="m-0 font-titre text-2xl">
        Couvertures
      </h2>
      <p className="m-0 text-discret">
        Ichnos cherche une à une les couvertures qui manquent, d’après l’ISBN de mes éditions et de mes tomes. Sans couverture trouvée, celle
        d’Ichnos reste en place.
      </p>
      {enCours ? (
        <Bouton variante="secondaire" onClick={() => (continuer.current = false)}>
          Arrêter la recherche
        </Bouton>
      ) : (
        <Bouton variante="secondaire" occupe={!enLigne} onClick={lancer}>
          Chercher les couvertures manquantes
        </Bouton>
      )}
      {!enLigne && !enCours && <p className="m-0 text-sm text-discret">Hors connexion : la recherche attendra le retour du réseau.</p>}
      {enCours && (
        <p role="status" className="m-0 text-[0.9375rem] text-discret">
          {avancement?.enCours ? `Je cherche : ${avancement.enCours}…` : 'Je regarde ce qui manque…'}
        </p>
      )}
      {avancement && avancement.resultats.length > 0 && (
        <ul aria-label="Ce que la recherche a donné" className="m-0 flex w-full list-none flex-col gap-2 p-0">
          {avancement.resultats
            .filter((r) => phrase(r))
            .map((r) => (
              <li key={r.oeuvre} className="border-t border-bordure pt-2 text-[0.9375rem] leading-snug">
                <span className="font-bold">{r.titre}</span> : {phrase(r)}
              </li>
            ))}
        </ul>
      )}
      {fin && (
        <p role="status" className="m-0 text-[0.9375rem] font-semibold">
          {fin}
        </p>
      )}
    </section>
  )
}
