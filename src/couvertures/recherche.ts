// « Chercher les couvertures manquantes » (Réglages) : pour chaque œuvre ou tome sans couverture,
// une demande par ISBN à l'assistant, une à la fois, avec une pause entre deux demandes pour
// respecter les quotas des catalogues. Jamais d'IA ici. (docs/reference.md §8)
// « Remplacer les couvertures de petite taille » suit le même rythme, pour les couvertures
// déjà rangées de moins de 450 px de large.

import type { Assistant } from '../ajout/assistant'
import type { Depot } from '../bibliotheque/depot'
import { estPetite, tailleRangee } from './reduction'
import type { Couvertures } from './stockage'

/** Ce qui a été trouvé pour une œuvre (pour une série : parmi ses tomes). */
export type ResultatOeuvre = {
  oeuvre: string
  titre: string
  serie: boolean
  /** Couvertures cherchées (une pour un livre, une par tome pour une série). */
  cherchees: number
  trouvees: number
  /** Parmi les trouvées, celles de moins de 450 px de large : rangées quand même, mais signalées. */
  petites: number
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
      resultat = { oeuvre: manque.oeuvre, titre: manque.titre, serie: manque.tome !== null, cherchees: 0, trouvees: 0, petites: 0, sansIsbn: 0 }
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
      if (deposee.ok && (await depot.definirCouverture(manque.oeuvre, manque.cible, deposee.chemin)).ok) {
        resultat.trouvees += 1
        if (estPetite(reponse.valeur)) resultat.petites += 1
      }
    }
    await attendre()
  }
  return dire({ termine: true })
}

// ---------------------------------------------------------------------------
// Remplacer les couvertures de petite taille
// ---------------------------------------------------------------------------

/** Ce qui a été fait pour une petite couverture (largeurs en pixels). */
export type Remplacement = { oeuvre: string; titre: string; tome: number | null } & (
  | { issue: 'remplacee'; avant: number; apres: number }
  /** La même édition n'a pas d'image plus large : la couverture reste. */
  | { issue: 'pas_plus_grande'; avant: number }
  /** Couverture sans ISBN (rangée sur l'œuvre, ou tome sans ISBN) : on ne saurait pas quelle édition chercher. */
  | { issue: 'sans_isbn'; avant: number }
)

export type AvancementRemplacement = {
  enCours: string | null
  lignes: Remplacement[]
  termine: boolean
  arret: null | 'arrete' | 'reseau' | 'indisponible'
}

/**
 * Mesure chaque couverture rangée, sur l'appareil. Pour celles de petite taille (moins de 450 px
 * de large, et pas déjà réduites à 1200 px) dont l'ISBN est connu, redemande la couverture de
 * cette même édition, et ne la remplace que si l'image trouvée, une fois rangée, est plus large.
 * Rien d'autre ne change dans la base.
 */
export async function remplacerPetitesCouvertures(outils: {
  depot: Depot
  assistant: Assistant
  couvertures: Couvertures
  /** La taille d'une image : une adresse affichable, ou une image pas encore rangée. Null si elle ne se lit pas. */
  mesurer: (source: string | Blob) => Promise<{ largeur: number; hauteur: number } | null>
  attendre: () => Promise<void>
  continuer: () => boolean
  surAvancement: (avancement: AvancementRemplacement) => void
}): Promise<AvancementRemplacement> {
  const { depot, assistant, couvertures, mesurer, attendre, continuer, surAvancement } = outils
  const lignes: Remplacement[] = []
  const dire = (suite: Partial<AvancementRemplacement>): AvancementRemplacement => {
    const avancement: AvancementRemplacement = { enCours: null, lignes: lignes.map((l) => ({ ...l })), termine: false, arret: null, ...suite }
    surAvancement(avancement)
    return avancement
  }

  const lecture = await depot.listerCouvertures()
  if (!lecture.ok) return dire({ arret: lecture.echec === 'reseau' ? 'reseau' : 'indisponible' })

  // Une même image peut être rangée à deux endroits : elle n'est mesurée qu'une fois.
  const tailles = new Map<string, { largeur: number; hauteur: number } | null>()
  for (const rangee of lecture.couvertures) {
    if (!continuer()) return dire({ arret: 'arrete' })
    if (!tailles.has(rangee.chemin)) {
      const adresse = await couvertures.adresse(rangee.chemin)
      tailles.set(rangee.chemin, adresse ? await mesurer(adresse) : null)
    }
    const taille = tailles.get(rangee.chemin) ?? null
    // Illisible (hors connexion, image disparue) : on n'y touche pas. Assez grande, ou déjà réduite
    // à 1200 px : rien à faire.
    if (taille === null || !estPetite(taille)) continue
    const avant = taille.largeur

    const commun = { oeuvre: rangee.oeuvre, titre: rangee.titre, tome: rangee.tome }
    if (!rangee.isbn) {
      lignes.push({ ...commun, issue: 'sans_isbn', avant })
      continue
    }

    dire({ enCours: rangee.tome === null ? rangee.titre : `${rangee.titre}, tome ${rangee.tome}` })
    const reponse = await assistant.couverture({ isbn: rangee.isbn })
    if (!reponse.ok) return dire({ arret: reponse.echec === 'reseau' ? 'reseau' : 'indisponible' })

    const trouvee = reponse.valeur
    // La taille qu'aura l'image trouvée une fois rangée (elle est réduite à 1200 px au plus).
    const brute = !trouvee
      ? null
      : trouvee.largeur !== null && trouvee.hauteur !== null
        ? { largeur: trouvee.largeur, hauteur: trouvee.hauteur }
        : await mesurer(trouvee.image)
    const apres = brute ? tailleRangee(brute).largeur : null
    let remplacee = false
    if (trouvee && apres !== null && apres > avant) {
      const deposee = await couvertures.deposer(trouvee.image)
      remplacee = deposee.ok && (await depot.definirCouverture(rangee.oeuvre, rangee.cible, deposee.chemin)).ok
    }
    lignes.push(remplacee ? { ...commun, issue: 'remplacee', avant, apres: apres as number } : { ...commun, issue: 'pas_plus_grande', avant })
    await attendre()
  }
  return dire({ termine: true })
}

// ---------------------------------------------------------------------------
// Retirer les fausses couvertures
// ---------------------------------------------------------------------------

/** Ce qui a été fait pour une fausse couverture rangée (« image not available », page blanche…). */
export type Retrait = {
  oeuvre: string
  titre: string
  tome: number | null
  /** `remplacee` : une vraie couverture de la même édition l'a remplacée ; `retiree` : la couverture d'Ichnos reprend sa place. */
  issue: 'remplacee' | 'retiree'
}

export type AvancementRetrait = {
  enCours: string | null
  lignes: Retrait[]
  termine: boolean
  arret: null | 'arrete' | 'reseau' | 'indisponible'
}

/**
 * Regarde chaque couverture rangée, sur l'appareil, avec le même contrôle que les recherches
 * (estFausseCouverture : image de remplacement d'un catalogue, page blanche, toile unie). Pour
 * chaque fausse couverture dont l'ISBN est connu, redemande la couverture de cette édition (le
 * même contrôle écarte une nouvelle fausse) ; sans vraie couverture trouvée, la fausse est retirée
 * et la couverture d'Ichnos (fond de couleur et titre) reprend sa place. Rien d'autre ne change.
 */
export async function retirerFaussesCouvertures(outils: {
  depot: Depot
  assistant: Assistant
  couvertures: Couvertures
  /** Lit l'image rangée à cette adresse ; null si elle ne se lit pas. */
  lire: (adresse: string) => Promise<Blob | null>
  /** Vrai si l'image n'est pas une couverture. */
  estFausse: (image: Blob) => Promise<boolean>
  attendre: () => Promise<void>
  continuer: () => boolean
  surAvancement: (avancement: AvancementRetrait) => void
}): Promise<AvancementRetrait> {
  const { depot, assistant, couvertures, lire, estFausse, attendre, continuer, surAvancement } = outils
  const lignes: Retrait[] = []
  const dire = (suite: Partial<AvancementRetrait>): AvancementRetrait => {
    const avancement: AvancementRetrait = { enCours: null, lignes: lignes.map((l) => ({ ...l })), termine: false, arret: null, ...suite }
    surAvancement(avancement)
    return avancement
  }

  const lecture = await depot.listerCouvertures()
  if (!lecture.ok) return dire({ arret: lecture.echec === 'reseau' ? 'reseau' : 'indisponible' })

  // Une même image peut être rangée à plusieurs endroits : elle n'est regardée qu'une fois.
  const verdicts = new Map<string, boolean>()
  for (const rangee of lecture.couvertures) {
    if (!continuer()) return dire({ arret: 'arrete' })
    if (!verdicts.has(rangee.chemin)) {
      const adresse = await couvertures.adresse(rangee.chemin)
      const image = adresse ? await lire(adresse) : null
      // Illisible (hors connexion, image disparue) : on n'y touche pas.
      verdicts.set(rangee.chemin, image ? await estFausse(image) : false)
    }
    if (!verdicts.get(rangee.chemin)) continue

    const commun = { oeuvre: rangee.oeuvre, titre: rangee.titre, tome: rangee.tome }
    dire({ enCours: rangee.tome === null ? rangee.titre : `${rangee.titre}, tome ${rangee.tome}` })
    let nouvelle: string | null = null
    if (rangee.isbn) {
      const reponse = await assistant.couverture({ isbn: rangee.isbn })
      if (!reponse.ok) return dire({ arret: reponse.echec === 'reseau' ? 'reseau' : 'indisponible' })
      if (reponse.valeur) {
        const deposee = await couvertures.deposer(reponse.valeur.image)
        if (deposee.ok) nouvelle = deposee.chemin
      }
    }
    const ecrite = await depot.definirCouverture(rangee.oeuvre, rangee.cible, nouvelle)
    if (!ecrite.ok) return dire({ arret: ecrite.echec === 'reseau' ? 'reseau' : 'indisponible' })
    lignes.push({ ...commun, issue: nouvelle ? 'remplacee' : 'retiree' })
    if (rangee.isbn) await attendre()
  }
  return dire({ termine: true })
}
