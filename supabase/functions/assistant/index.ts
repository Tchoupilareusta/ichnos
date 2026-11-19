// Fonction serveur « assistant » (Supabase Edge Function) — point d'entrée.
// Elle porte tout ce qui a besoin d'une clé secrète : la recherche de métadonnées et de
// couvertures (Google Books) et la fiche proposée par l'IA (API Claude). L'étape 7b
// (« Découvrir ailleurs ») y ajoutera son action.
//
// Les clés vivent dans les secrets du projet Supabase (Edge Functions → Secrets) :
//   ANTHROPIC_API_KEY      clé de l'API Claude ;
//   GOOGLE_BOOKS_API_KEY   clé Google restreinte à « Books API ».
// Sans l'une ou l'autre, la fonction répond calmement que ce service n'est pas configuré.
//
// Ce fichier ne fait que brancher les vrais services ; toute la logique, et tous les
// contrôles de sécurité, sont dans gestionnaire.ts, testé par gestionnaire.test.ts.

import Anthropic from '@anthropic-ai/sdk'
import { creerGestionnaire, type DemandeIA, type ReponseIA } from './gestionnaire.ts'

const cleAnthropic = Deno.env.get('ANTHROPIC_API_KEY')
const claude = cleAnthropic ? new Anthropic({ apiKey: cleAnthropic, maxRetries: 1, timeout: 60_000 }) : null

/** Un seul appel, sans outil : l'IA lit la demande et rend du JSON conforme au schéma. */
async function demanderFiche(client: Anthropic, demande: DemandeIA): Promise<ReponseIA> {
  const message = await client.messages.create({
    model: 'claude-sonnet-5-5',
    max_tokens: 8000,
    system: demande.systeme,
    messages: [{ role: 'user', content: demande.message }],
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: demande.schema } },
  })
  if (message.stop_reason === 'refusal') return { type: 'refus' }
  if (message.stop_reason === 'max_tokens') return { type: 'incomplet' }
  const texte = message.content.map((bloc) => (bloc.type === 'text' ? bloc.text : '')).join('')
  return { type: 'texte', texte }
}

Deno.serve(
  creerGestionnaire({
    urlSupabase: Deno.env.get('SUPABASE_URL') ?? '',
    cleGoogle: Deno.env.get('GOOGLE_BOOKS_API_KEY') || undefined,
    recuperer: (adresse, options) => fetch(adresse, options),
    demanderFiche: claude ? (demande) => demanderFiche(claude, demande) : null,
    // Une ligne par appel : action, résultat, durée, état des sources. Jamais de contenu.
    journal: (ligne) => console.log(JSON.stringify(ligne)),
  }),
)
