import adresseCatalogue from '../../catalogue/catalogue-initial.json?url'
import { supabase } from '../supabase/client'
import type { Depot } from './depot'
import { creerDepotSupabase } from './depotSupabase'
import type { FichierCatalogue } from './envoiCatalogue'

// Le catalogue de départ n'est téléchargé qu'au moment de l'installer : il ne pèse rien le reste du temps.
async function chargerCatalogue(): Promise<FichierCatalogue> {
  const reponse = await fetch(adresseCatalogue)
  if (!reponse.ok) throw new Error('catalogue indisponible')
  return (await reponse.json()) as FichierCatalogue
}

/** La bibliothèque réelle, ou null si le projet Supabase n'est pas configuré. */
export const depotParDefaut: Depot | null = supabase ? creerDepotSupabase(supabase, chargerCatalogue) : null
