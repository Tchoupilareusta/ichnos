import type { Couvertures, Depose } from './stockage'

const MOI = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

/** Faux stockage des couvertures pour les tests : tout est en mémoire. */
export function couverturesFictives(depart: { depot?: Depose } = {}) {
  const deposees: { chemin: string; image: Blob }[] = []
  const appels = { adresse: [] as string[], oublier: 0 }

  const couvertures: Couvertures = {
    async deposer(image) {
      if (depart.depot && !depart.depot.ok) return depart.depot
      const chemin = `${MOI}/${String(deposees.length + 1).padStart(32, '0')}.jpg`
      deposees.push({ chemin, image })
      return { ok: true, chemin }
    },
    async adresse(chemin) {
      appels.adresse.push(chemin)
      return `blob:fictive/${chemin}`
    },
    async oublier() {
      appels.oublier += 1
    },
  }
  return { couvertures, deposees, appels }
}
