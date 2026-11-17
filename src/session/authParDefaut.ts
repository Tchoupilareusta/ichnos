import { CLE_SESSION, supabase } from '../supabase/client'
import type { Auth } from './auth'
import { creerAuthSupabase } from './authSupabase'

function lireSessionMemorisee(): string | null {
  try {
    return localStorage.getItem(CLE_SESSION)
  } catch {
    return null
  }
}

/** Le service de connexion réel, ou null si le projet Supabase n'est pas configuré. */
export const authParDefaut: Auth | null = supabase ? creerAuthSupabase(supabase, lireSessionMemorisee) : null
