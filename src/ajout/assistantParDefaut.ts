import { supabase } from '../supabase/client'
import { creerAssistantSupabase, type Assistant } from './assistant'

/** L'assistant réel (la fonction serveur), ou null si le projet Supabase n'est pas configuré. */
export const assistantParDefaut: Assistant | null = supabase ? creerAssistantSupabase(supabase) : null
