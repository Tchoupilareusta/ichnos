// Les images de couverture : rangées dans un stockage privé de Supabase (bucket « couvertures »,
// un dossier par compte), servies par adresse signée, et gardées sur l'appareil pour la
// consultation hors connexion. Jamais dans le dépôt GitHub. (docs/reference.md §8)

import type { SupabaseClient } from '@supabase/supabase-js'

export type Depose = { ok: true; chemin: string } | { ok: false; echec: 'reseau' | 'inconnu' }

/** Ce que l'appli attend du stockage des couvertures (Supabase en vrai, un faux dans les tests). */
export interface Couvertures {
  /** Range une image dans mon dossier et rend son chemin. La même image a toujours le même chemin. */
  deposer(image: Blob): Promise<Depose>
  /** Une adresse affichable pour une couverture rangée, ou null (hors connexion et jamais vue, ou disparue). */
  adresse(chemin: string): Promise<string | null>
  /** Efface les couvertures gardées sur l'appareil (à la déconnexion). */
  oublier(): Promise<void>
}

export const COUVERTURES_ABSENTES: Couvertures = {
  deposer: async () => ({ ok: false, echec: 'inconnu' }),
  adresse: async () => null,
  oublier: async () => {},
}

/** La seule partie du client Supabase dont les couvertures ont besoin. */
export type ClientStockage = Pick<SupabaseClient, 'storage' | 'auth'>

const SEAU = 'couvertures'
const CACHE = 'ichnos-couvertures'
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
/** Durée de vie d'une adresse signée : le temps de télécharger l'image, pas plus. */
const VALIDITE = 300

const cleCache = (chemin: string) => `/__couvertures/${chemin}`

type Outils = {
  /** Le cache du navigateur ; absent (vieux navigateur, test), les images ne sont gardées que le temps de la session. */
  caches?: CacheStorage
  recuperer?: (adresse: string) => Promise<Response>
  creerAdresse?: (image: Blob) => string
  libererAdresse?: (adresse: string) => void
}

async function empreinte(image: Blob): Promise<string> {
  const condense = await crypto.subtle.digest('SHA-256', await image.arrayBuffer())
  return [...new Uint8Array(condense)]
    .slice(0, 16)
    .map((octet) => octet.toString(16).padStart(2, '0'))
    .join('')
}

export function creerCouverturesSupabase(client: ClientStockage, outils: Outils = {}): Couvertures {
  const lesCaches = outils.caches ?? (typeof caches === 'undefined' ? undefined : caches)
  const recuperer = outils.recuperer ?? ((adresse: string) => fetch(adresse))
  const creerAdresse = outils.creerAdresse ?? ((image: Blob) => URL.createObjectURL(image))
  const libererAdresse = outils.libererAdresse ?? ((adresse: string) => URL.revokeObjectURL(adresse))
  // Une image n'est jamais supprimée du stockage ici : nommée d'après son contenu, elle peut
  // servir à deux œuvres. Une image devenue inutile reste dans mon dossier privé, sans conséquence.

  /** Les adresses déjà préparées pendant cette session. */
  const connues = new Map<string, Promise<string | null>>()
  /** Les chemins en attente d'une adresse signée : ceux d'une même page partent en une seule demande. */
  let enAttente: { chemin: string; suite: (adresse: string | null) => void }[] = []

  const ouvrirCache = async () => {
    try {
      return lesCaches ? await lesCaches.open(CACHE) : null
    } catch {
      return null
    }
  }

  async function signerEtTelecharger() {
    const lot = enAttente
    enAttente = []
    const signees = new Map<string, string>()
    try {
      const { data, error } = await client.storage.from(SEAU).createSignedUrls(lot.map((d) => d.chemin), VALIDITE)
      if (!error) for (const ligne of data ?? []) if (ligne.path && ligne.signedUrl) signees.set(ligne.path, ligne.signedUrl)
    } catch {
      // Hors connexion : aucune adresse, chaque demande rendra null.
    }
    const cache = await ouvrirCache()
    await Promise.all(
      lot.map(async ({ chemin, suite }) => {
        const signee = signees.get(chemin)
        if (!signee) return suite(null)
        try {
          const reponse = await recuperer(signee)
          if (!reponse.ok) return suite(null)
          const image = await reponse.blob()
          // Gardée sous une clé stable (le chemin) : l'adresse signée, elle, change à chaque fois.
          await cache?.put(cleCache(chemin), new Response(image, { headers: { 'content-type': image.type } })).catch(() => {})
          suite(creerAdresse(image))
        } catch {
          suite(null)
        }
      }),
    )
  }

  async function preparer(chemin: string): Promise<string | null> {
    const cache = await ouvrirCache()
    const gardee = await cache?.match(cleCache(chemin)).catch(() => undefined)
    if (gardee) return creerAdresse(await gardee.blob())
    return new Promise((suite) => {
      enAttente.push({ chemin, suite })
      // Laisse le temps à toutes les couvertures de la page de s'inscrire dans le même lot.
      if (enAttente.length === 1) setTimeout(signerEtTelecharger, 0)
    })
  }

  return {
    async deposer(image) {
      const extension = EXTENSIONS[image.type]
      if (!extension) return { ok: false, echec: 'inconnu' }
      try {
        const { data } = await client.auth.getSession()
        const moi = data.session?.user.id
        if (!moi) return { ok: false, echec: 'inconnu' }
        const chemin = `${moi}/${await empreinte(image)}.${extension}`
        const { error } = await client.storage.from(SEAU).upload(chemin, image, {
          contentType: image.type,
          // Une image ne change jamais sous un même nom : le navigateur peut la garder longtemps.
          cacheControl: '31536000',
          upsert: false,
        })
        if (!error) return { ok: true, chemin }
        const refus = error as { statusCode?: string; message?: string }
        // Déjà rangée (même image, donc même nom) : c'est réussi.
        if (refus.statusCode === '409' || /already exists|duplicate/i.test(refus.message ?? '')) return { ok: true, chemin }
        return { ok: false, echec: /failed to fetch|load failed|networkerror/i.test(refus.message ?? '') ? 'reseau' : 'inconnu' }
      } catch {
        return { ok: false, echec: 'reseau' }
      }
    },

    adresse(chemin) {
      const connue = connues.get(chemin)
      if (connue) return connue
      const promesse = preparer(chemin).then((adresse) => {
        // Un échec n'est pas retenu : la prochaine demande réessaiera (retour du réseau).
        if (adresse === null) connues.delete(chemin)
        return adresse
      })
      connues.set(chemin, promesse)
      return promesse
    },

    async oublier() {
      for (const promesse of connues.values()) {
        const adresse = await promesse.catch(() => null)
        if (adresse) libererAdresse(adresse)
      }
      connues.clear()
      try {
        await lesCaches?.delete(CACHE)
      } catch {
        // Rien à effacer.
      }
    },
  }
}
