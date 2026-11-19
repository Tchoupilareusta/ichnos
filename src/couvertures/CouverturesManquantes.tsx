import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CLES } from '../bibliotheque/requetes'
import { Bouton } from '../composants/Bouton'
import { useEnLigne } from '../navigation/useEnLigne'
import { useSession } from '../session/Session'
import { largeurImage } from './mesure'
import {
  chercherCouverturesManquantes,
  PAUSE_ENTRE_DEMANDES,
  remplacerPetitesCouvertures,
  type Avancement,
  type AvancementRemplacement,
  type Remplacement,
  type ResultatOeuvre,
} from './recherche'

const pluriel = (nombre: number, mot: string) => `${nombre} ${mot}${nombre > 1 ? 's' : ''}`

/** « Momo : couverture trouvée », « Vinland Saga : 12 couvertures de tome trouvées sur 29 cherchées, dont 3 de petite taille ». */
function phrase(r: ResultatOeuvre): string {
  if (!r.serie) {
    if (r.cherchees === 0) return 'pas d’ISBN connu, pas cherchée'
    if (r.trouvees === 0) return 'pas de couverture trouvée'
    return r.petites > 0 ? 'couverture trouvée, mais de petite taille' : 'couverture trouvée'
  }
  const sansIsbn = r.sansIsbn > 0 ? `${pluriel(r.sansIsbn, 'tome')} sans ISBN` : null
  if (r.cherchees === 0) return sansIsbn ?? ''
  const trouvees = `${r.trouvees} couverture${r.trouvees > 1 ? 's' : ''} de tome trouvée${r.trouvees > 1 ? 's' : ''} sur ${r.cherchees} cherchée${r.cherchees > 1 ? 's' : ''}`
  const petites = r.petites > 0 ? `, dont ${r.petites} de petite taille` : ''
  return [`${trouvees}${petites}`, sansIsbn].filter(Boolean).join(' · ')
}

/** « remplacée (300 → 800 px) », « pas de plus grande image », « sans ISBN, laissée telle quelle ». */
function phraseRemplacement(ligne: Remplacement): string {
  if (ligne.issue === 'remplacee') return `remplacée (${ligne.avant} → ${ligne.apres}\u00a0px)`
  return ligne.issue === 'pas_plus_grande' ? 'pas de plus grande image' : 'sans ISBN, laissée telle quelle'
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

function conclusionRemplacement(avancement: AvancementRemplacement): string | null {
  if (avancement.arret === 'arrete') return 'Remplacement arrêté. Ce qui a été remplacé le reste ; je le relance quand je veux.'
  if (avancement.arret === 'reseau') return 'Plus de connexion : le remplacement s’est interrompu. Je le relance au retour du réseau.'
  if (avancement.arret === 'indisponible')
    return 'La recherche automatique ne répond pas pour le moment. Je réessaie plus tard : ce qui a été remplacé le reste.'
  if (!avancement.termine) return null
  return avancement.lignes.length === 0 ? 'Aucune couverture de petite taille.' : 'Remplacement terminé.'
}

/** Ce que la dernière action a donné : la recherche des couvertures manquantes, ou le remplacement des petites. */
type Bilan = { action: 'recherche'; avancement: Avancement } | { action: 'remplacement'; avancement: AvancementRemplacement }

/**
 * Réglages : cherche, une par une, les couvertures qui manquent, ou une image plus grande pour
 * celles de petite taille. Sans IA, une demande à la fois, et la liste de ce qui a été fait,
 * œuvre par œuvre.
 */
export function CouverturesManquantes() {
  const { depot, assistant, couvertures } = useSession()
  const client = useQueryClient()
  const enLigne = useEnLigne()
  const [bilan, setBilan] = useState<Bilan | null>(null)
  /** L'action en cours, s'il y en a une : jamais deux à la fois. */
  const [enCours, setEnCours] = useState<Bilan['action'] | null>(null)
  // Faux dès que je demande l'arrêt ou que je quitte l'écran : tout s'arrête avant la demande suivante.
  const continuer = useRef(false)
  useEffect(() => () => void (continuer.current = false), [])

  async function lancer(action: Bilan['action']) {
    if (!enLigne || enCours) return
    continuer.current = true
    setEnCours(action)
    setBilan(null)
    const commun = {
      depot,
      assistant,
      couvertures,
      attendre: () => new Promise<void>((suite) => setTimeout(suite, PAUSE_ENTRE_DEMANDES)),
      continuer: () => continuer.current,
    }
    try {
      if (action === 'recherche') {
        await chercherCouverturesManquantes({ ...commun, surAvancement: (avancement) => setBilan({ action, avancement }) })
      } else {
        await remplacerPetitesCouvertures({ ...commun, mesurer: largeurImage, surAvancement: (avancement) => setBilan({ action, avancement }) })
      }
    } finally {
      setEnCours(null)
      // Les couvertures rangées apparaissent partout : bibliothèque, accueil, fiches.
      await Promise.all([
        client.invalidateQueries({ queryKey: CLES.oeuvres }),
        client.invalidateQueries({ queryKey: CLES.enCours }),
        client.invalidateQueries({ queryKey: ['oeuvre'] }),
      ])
    }
  }

  const fin = !bilan || enCours ? null : bilan.action === 'recherche' ? conclusion(bilan.avancement) : conclusionRemplacement(bilan.avancement)
  const cherche = bilan?.avancement.enCours ?? null

  return (
    <section aria-labelledby="couvertures-manquantes" data-etat={enCours ? 'recherche' : 'repos'} className="flex max-w-xl flex-col items-start gap-4">
      <h2 id="couvertures-manquantes" className="m-0 font-titre text-2xl">
        Couvertures
      </h2>
      <p className="m-0 text-discret">
        Ichnos cherche une à une les couvertures qui manquent, d’après l’ISBN de mes éditions et de mes tomes. Sans couverture trouvée, celle
        d’Ichnos reste en place. Une couverture de petite taille peut être remplacée par une image plus grande de la même édition.
      </p>
      <div className="flex flex-wrap gap-3">
        {enCours === 'recherche' ? (
          <Bouton variante="secondaire" onClick={() => (continuer.current = false)}>
            Arrêter la recherche
          </Bouton>
        ) : (
          <Bouton variante="secondaire" occupe={!enLigne || enCours !== null} onClick={() => lancer('recherche')}>
            Chercher les couvertures manquantes
          </Bouton>
        )}
        {enCours === 'remplacement' ? (
          <Bouton variante="secondaire" onClick={() => (continuer.current = false)}>
            Arrêter
          </Bouton>
        ) : (
          <Bouton variante="secondaire" occupe={!enLigne || enCours !== null} onClick={() => lancer('remplacement')}>
            Remplacer les couvertures de petite taille
          </Bouton>
        )}
      </div>
      {!enLigne && !enCours && <p className="m-0 text-sm text-discret">Hors connexion : la recherche attendra le retour du réseau.</p>}
      {/* Le détail défile sans être annoncé : la zone d'annonce, plus bas, ne dit que le début et la fin. */}
      {enCours === 'recherche' && (
        <p className="m-0 text-[0.9375rem] text-discret">{cherche ? `Je cherche : ${cherche}…` : 'Je regarde ce qui manque…'}</p>
      )}
      {enCours === 'remplacement' && (
        <p className="m-0 text-[0.9375rem] text-discret">{cherche ? `Je cherche plus grand : ${cherche}…` : 'Je mesure mes couvertures…'}</p>
      )}
      {bilan?.action === 'recherche' && bilan.avancement.resultats.length > 0 && (
        <ul aria-label="Ce que la recherche a donné" className="m-0 flex w-full list-none flex-col gap-2 p-0">
          {bilan.avancement.resultats
            .filter((r) => phrase(r))
            .map((r) => (
              <li key={r.oeuvre} className="border-t border-bordure pt-2 text-[0.9375rem] leading-snug">
                <span className="font-bold">{r.titre}</span> : {phrase(r)}
              </li>
            ))}
        </ul>
      )}
      {bilan?.action === 'remplacement' && bilan.avancement.lignes.length > 0 && (
        <ul aria-label="Ce que le remplacement a donné" className="m-0 flex w-full list-none flex-col gap-2 p-0">
          {bilan.avancement.lignes.map((ligne) => (
            <li key={`${ligne.oeuvre}/${ligne.tome ?? ''}/${ligne.issue}`} className="border-t border-bordure pt-2 text-[0.9375rem] leading-snug">
              <span className="font-bold">{ligne.tome === null ? ligne.titre : `${ligne.titre}, tome ${ligne.tome}`}</span> :{' '}
              {phraseRemplacement(ligne)}
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="m-0 text-[0.9375rem] font-semibold empty:hidden">
        {enCours ? <span className="sr-only">{enCours === 'recherche' ? 'Recherche en cours…' : 'Remplacement en cours…'}</span> : (fin ?? '')}
      </p>
    </section>
  )
}
