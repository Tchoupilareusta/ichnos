import { createClient } from '@supabase/supabase-js'
import { estCleSecrete } from './clePublique'

/** Nom sous lequel la session est gardée sur l'appareil. */
export const CLE_SESSION = 'ichnos-session'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const clePublique = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/**
 * Client Supabase de l'appli, ou null tant que l'adresse et la clé publique du projet
 * ne sont pas renseignées (fichier .env en local, variables GitHub pour le site publié).
 * Seule la clé publique a sa place ici : la sécurité repose sur la RLS de la base.
 */
export const supabase =
  url && clePublique && !estCleSecrete(clePublique)
    ? createClient(url, clePublique, {
        auth: {
          storageKey: CLE_SESSION,
          persistSession: true,
          autoRefreshToken: true,
          // Connexion par code saisi dans l'appli : aucun lien à lire dans l'adresse.
          detectSessionInUrl: false,
        },
      })
    : null
