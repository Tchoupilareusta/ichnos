// Le lien entre l'appli et la fonction serveur « assistant » (supabase/functions/assistant).
// L'appli n'a aucune clé secrète : elle appelle la fonction avec la session du compte connecté,
// et c'est la fonction qui interroge les catalogues et l'IA.

import type { SupabaseClient } from '@supabase/supabase-js'
import { estFausseCouverture } from '../couvertures/uniformite'
import type {
  FicheProposee,
  OeuvrePourFiche,
  PropositionCouverture,
  RefCouverture,
  ReponseIsbn,
  ReponseTitre,
  Source,
} from '../../supabase/functions/assistant/contrat.ts'

export { LARGEUR_PETITE } from '../../supabase/functions/assistant/contrat.ts'

export type {
  Champ,
  Description,
  FicheProposee,
  Notice,
  OeuvrePourFiche,
  PropositionCouverture,
  RefCouverture,
  ReponseIsbn,
  ReponseTitre,
  Resultat,
  Source,
} from '../../supabase/functions/assistant/contrat.ts'

/**
 * Pourquoi l'assistant n'a pas répondu.
 *   reseau : pas de connexion ; limite : trop de fiches demandées à l'IA aujourd'hui ;
 *   non_configure : la clé du service n'est pas installée ; ia : l'IA n'a pas su répondre ;
 *   indisponible : tout le reste (fonction pas en ligne, panne).
 */
export type EchecAssistant = 'reseau' | 'limite' | 'non_configure' | 'ia' | 'indisponible'
export type Reponse<T> = { ok: true; valeur: T } | { ok: false; echec: EchecAssistant }

/** Largeur et hauteur en pixels ; null quand la fonction ne les donne pas. */
export type ImageTrouvee = { image: Blob; source: Source; largeur: number | null; hauteur: number | null }

/** Une taille en pixels crédible, sinon null. */
const pixels = (valeur: unknown): number | null =>
  typeof valeur === 'number' && Number.isInteger(valeur) && valeur > 0 && valeur < 100_000 ? valeur : null

/** Ce que « Chercher d'autres couvertures » envoie : le titre, et ce qu'on sait de mon édition, pour le tri. */
export type DemandeAutresCouvertures = { titre: string; auteur?: string; langue: 'fr' | 'en'; isbn?: string; editeur?: string }

/** Ce que l'appli attend de l'assistant (la fonction serveur en vrai, un faux dans les tests). */
export interface Assistant {
  chercherIsbn(isbn: string): Promise<Reponse<ReponseIsbn>>
  chercherTitre(titre: string, auteur?: string): Promise<Reponse<ReponseTitre>>
  /** L'image d'une couverture, ou null si aucune source n'en a de convenable. */
  couverture(demande: { isbn: string } | { ref: RefCouverture }): Promise<Reponse<ImageTrouvee | null>>
  /** D'autres éditions de l'œuvre qui ont une image : des références, jamais d'image. Sans IA. */
  autresCouvertures(demande: DemandeAutresCouvertures): Promise<Reponse<PropositionCouverture[]>>
  /** Synopsis et étiquettes proposés par l'IA, à partir de données bibliographiques publiques seulement. */
  proposerFiche(oeuvre: OeuvrePourFiche): Promise<Reponse<FicheProposee>>
}

const absent = async () => ({ ok: false as const, echec: 'indisponible' as const })

/** Sans projet Supabase configuré, l'assistant ne répond pas : l'ajout manuel reste entier. */
export const ASSISTANT_ABSENT: Assistant = {
  chercherIsbn: absent,
  chercherTitre: absent,
  couverture: absent,
  autresCouvertures: absent,
  proposerFiche: absent,
}

/** La seule partie du client Supabase dont l'assistant a besoin. */
export type ClientFonctions = Pick<SupabaseClient, 'functions'>

const estObjet = (valeur: unknown): valeur is Record<string, unknown> => typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)

/** Le refus de la fonction (« limite », « ia »…), lu dans sa réponse. */
async function echecDe(erreur: unknown): Promise<EchecAssistant> {
  const nom = estObjet(erreur) ? erreur.name : null
  if (nom === 'FunctionsFetchError') return 'reseau'
  if (nom !== 'FunctionsHttpError' || !estObjet(erreur) || !(erreur.context instanceof Response)) return 'indisponible'
  try {
    const corps: unknown = await erreur.context.json()
    const code = estObjet(corps) ? corps.erreur : null
    return code === 'limite' || code === 'non_configure' || code === 'ia' ? code : 'indisponible'
  } catch {
    return 'indisponible'
  }
}

function imageDepuisBase64(base64: string, type: string): Blob {
  const binaire = atob(base64)
  const octets = new Uint8Array(binaire.length)
  for (let rang = 0; rang < binaire.length; rang++) octets[rang] = binaire.charCodeAt(rang)
  return new Blob([octets], { type })
}

/** Une proposition bien formée : une référence vers Google Books ou Open Library, jamais une adresse. */
function propositionLue(valeur: unknown): PropositionCouverture | null {
  if (!estObjet(valeur) || !estObjet(valeur.ref)) return null
  const ref = valeur.ref
  const google = ref.source === 'google_books' && typeof ref.id === 'string'
  const openLibrary = ref.source === 'open_library' && (typeof ref.numero === 'number' || typeof ref.isbn === 'string')
  if (!google && !openLibrary) return null
  const texte = (champ: unknown) => (typeof champ === 'string' && champ.trim() ? champ.trim() : null)
  return {
    ref: ref as unknown as RefCouverture,
    editeur: texte(valeur.editeur),
    collection: texte(valeur.collection),
    annee: typeof valeur.annee === 'number' && Number.isInteger(valeur.annee) ? valeur.annee : null,
    langue: texte(valeur.langue),
    source: google ? 'google_books' : 'open_library',
  }
}

/**
 * `ecarter` : reconnaît sur l'appareil une image qui n'est pas une couverture (page blanche, toile
 * unie, image « image not available » : estFausseCouverture). Elle est alors traitée comme « pas de couverture », pour toutes les
 * recherches (ajout, achat, autres couvertures, couvertures manquantes ou de petite taille).
 */
export function creerAssistantSupabase(client: ClientFonctions, ecarter: (image: Blob) => Promise<boolean> = estFausseCouverture): Assistant {
  /** Un appel à la fonction. `lire` vérifie la forme de la réponse : null si elle est inattendue. */
  async function appeler<T>(corps: Record<string, unknown>, lire: (donnees: Record<string, unknown>) => T | undefined): Promise<Reponse<T>> {
    try {
      const { data, error } = await client.functions.invoke('assistant', { body: corps })
      if (error) return { ok: false, echec: await echecDe(error) }
      const valeur = estObjet(data) ? lire(data) : undefined
      return valeur === undefined ? { ok: false, echec: 'indisponible' } : { ok: true, valeur }
    } catch {
      // L'appel n'est pas parti : pas de connexion.
      return { ok: false, echec: 'reseau' }
    }
  }

  return {
    chercherIsbn: (isbn) =>
      appeler({ action: 'chercher_isbn', isbn }, (d) =>
        typeof d.trouve === 'boolean' && estObjet(d.notice) && Array.isArray(d.descriptions) ? (d as unknown as ReponseIsbn) : undefined,
      ),

    chercherTitre: (titre, auteur) =>
      appeler({ action: 'chercher_titre', titre, ...(auteur?.trim() ? { auteur: auteur.trim() } : {}) }, (d) =>
        Array.isArray(d.resultats) ? (d as unknown as ReponseTitre) : undefined,
      ),

    couverture: async (demande) => {
      const reponse = await appeler<ImageTrouvee | null>({ action: 'couverture', ...demande }, (d) => {
        if (d.trouve === false) return null
        const image = d.image
        if (d.trouve !== true || !estObjet(image) || typeof image.base64 !== 'string' || typeof image.type !== 'string') return undefined
        try {
          return {
            image: imageDepuisBase64(image.base64, image.type),
            source: d.source as Source,
            largeur: pixels(d.largeur),
            hauteur: pixels(d.hauteur),
          }
        } catch {
          return undefined
        }
      })
      // Une page blanche, une toile unie ou l’image « image not available » : « pas de couverture ».
      if (reponse.ok && reponse.valeur && (await ecarter(reponse.valeur.image))) return { ok: true, valeur: null }
      return reponse
    },

    autresCouvertures: (demande) =>
      appeler({ action: 'autres_couvertures', ...demande }, (d) =>
        Array.isArray(d.propositions) ? d.propositions.map(propositionLue).filter((p): p is PropositionCouverture => p !== null) : undefined,
      ),

    proposerFiche: (oeuvre) =>
      appeler({ action: 'fiche', oeuvre }, (d) =>
        (typeof d.synopsis === 'string' || d.synopsis === null) && Array.isArray(d.genres) && Array.isArray(d.themes) && Array.isArray(d.atmospheres)
          ? (d as unknown as FicheProposee)
          : undefined,
      ),
  }
}
