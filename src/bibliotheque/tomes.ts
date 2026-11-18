import type { Tome } from './depot'
import { POSSESSIONS, type Possession } from './modele'

/** Titre de la confirmation avant de changer tous les tomes : « Marquer les 29 tomes comme « Je l’ai » ? » */
export function titreConfirmationTomes(tomes: Tome[], possession: Possession) {
  const libelle = POSSESSIONS.find((p) => p.valeur === possession)?.libelle ?? ''
  return tomes.length === 1 ? `Marquer le tome comme « ${libelle} » ?` : `Marquer les ${tomes.length} tomes comme « ${libelle} » ?`
}

/** Combien de tomes vont vraiment changer, et combien le sont déjà. */
export function texteConfirmationTomes(tomes: Tome[], possession: Possession) {
  const changent = tomes.filter((t) => t.possession !== possession).length
  const deja = tomes.length - changent
  if (changent === 0) return 'Tous les tomes le sont déjà : rien ne changera.'
  const partie = changent === 1 ? '1 tome va changer' : `${changent} tomes vont changer`
  if (deja === 0) return `${partie.charAt(0).toUpperCase()}${partie.slice(1)}.`
  return `${partie.charAt(0).toUpperCase()}${partie.slice(1)} ; ${deja === 1 ? 'l’autre l’est' : `les ${deja} autres le sont`} déjà.`
}
