import { supabase } from '../supabase/client'
import { creerCouverturesSupabase, type Couvertures } from './stockage'

/** Le stockage réel des couvertures, ou null si le projet Supabase n'est pas configuré. */
export const couverturesParDefaut: Couvertures | null = supabase ? creerCouverturesSupabase(supabase) : null
