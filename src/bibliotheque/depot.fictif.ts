import type { Depot, Installation, Lecture, OeuvreListee } from './depot'

/** Fausse bibliothèque pour les tests : aucun réseau, tout est en mémoire. */
export function depotFictif(
  depart: { oeuvres?: OeuvreListee[]; catalogue?: OeuvreListee[]; lecture?: Lecture; installation?: Installation } = {},
) {
  let oeuvres = depart.oeuvres ?? []
  const appels = { listerOeuvres: 0, installerCatalogue: 0 }
  // Permet à un test de garder une installation « en cours » jusqu'à ce qu'il la libère.
  let liberer: (() => void) | null = null
  const attente = { active: false, liberer: () => liberer?.() }

  const depot: Depot = {
    async listerOeuvres() {
      appels.listerOeuvres += 1
      return depart.lecture ?? { ok: true, oeuvres }
    },
    async installerCatalogue() {
      appels.installerCatalogue += 1
      if (attente.active) await new Promise<void>((suite) => (liberer = suite))
      const resultat = depart.installation ?? { ok: true }
      if (resultat.ok) oeuvres = depart.catalogue ?? []
      return resultat
    },
  }

  return { depot, appels, attente }
}
