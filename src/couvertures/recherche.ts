// « Chercher les couvertures manquantes » (Réglages) : pour chaque œuvre ou tome sans couverture,
// une demande par ISBN à l'assistant, une à la fois, avec une pause entre deux demandes pour
// respecter les quotas des catalogues. Jamais d'IA ici. (docs/reference.md §8)

import type { Assistant } from '../ajout/assistant'
import type { Depot } from '../bibliotheque/depot'
import type { Couvertures } from './stockage'

/** Ce qui a été trouvé pour une œuvre (pour une série : parmi ses tomes). */
export type ResultatOeuvre = {
  oeuvre: string
  titre: string
  serie: boolean
  /** Couvertures cherchées (une pour un livre, une par tome pour une série). */
  cherchees: number
  trouvees: number
  /** Sans ISBN connu : pas cherchées, pour ne pas risquer une mauvaise couverture. */
  sansIsbn: number
}

export type Avancement = {
  /** Ce qui est cherché en ce moment (« Vinland Saga, tome 2 »), ou null. */
  enCours: string | null
  resultats: ResultatOeuvre[]
  /** Vrai quand tout a été passé en revue. */
  termine: boolean
  /** Pourquoi la recherche s'est arrêtée avant la fin : à ma demande, ou parce que le réseau ou l'assistant a lâché. */
  arret: null | 'arrete' | 'reseau' | 'indisponible'
}

/** Pause entre deux demandes : Open Library limite le nombre de couvertures par minute. */
export const PAUSE_ENTRE_DEMANDES = 1500

export async function chercherCouverturesManquantes(outils: {
  depot: Depot
  assistant: Assistant
  couvertures: Couvertures
  /** La pause entre deux demandes. */
  attendre: () => Promise<void>
  /** Faux dès que je demande l'arrêt (ou que je quitte l'écran). */
  continuer: () => boolean
  surAvancement: (avancement: Avancement) => void
}): Promise<Avancement> {
  const { depot, assistant, couvertures, attendre, continuer, surAvancement } = outils
  const resultats: ResultatOeuvre[] = []
  const dire = (suite: Partial<Avancement>): Avancement => {
    const avancement: Avancement = { enCours: null, resultats: resultats.map((r) => ({ ...r })), termine: false, arret: null, ...suite }
    surAvancement(avancement)
    return avancement
  }

  const lecture = await depot.listerSansCouverture()
  if (!lecture.ok) return dire({ arret: lecture.echec === 'reseau' ? 'reseau' : 'indisponible' })

  for (const manque of lecture.manques) {
    let resultat = resultats.find((r) => r.oeuvre === manque.oeuvre)
    if (!resultat) {
      resultat = { oeuvre: manque.oeuvre, titre: manque.titre, serie: manque.tome !== null, cherchees: 0, trouvees: 0, sansIsbn: 0 }
      resultats.push(resultat)
    }
    if (!manque.isbn) {
      resultat.sansIsbn += 1
      continue
    }
    if (!continuer()) return dire({ arret: 'arrete' })

    dire({ enCours: manque.tome === null ? manque.titre : `${manque.titre}, tome ${manque.tome}` })
    const reponse = await assistant.couverture({ isbn: manque.isbn })
    // Réseau coupé ou assistant muet : inutile d'insister, la recherche reprendra plus tard où elle s'est arrêtée.
    if (!reponse.ok) return dire({ arret: reponse.echec === 'reseau' ? 'reseau' : 'indisponible' })

    resultat.cherchees += 1
    if (reponse.valeur) {
      const deposee = await couvertures.deposer(reponse.valeur.image)
      if (deposee.ok && (await depot.definirCouverture(manque.oeuvre, manque.cible, deposee.chemin)).ok) resultat.trouvees += 1
    }
    await attendre()
  }
  return dire({ termine: true })
}
