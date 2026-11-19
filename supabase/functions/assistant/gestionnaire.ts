// Le cœur de la fonction « assistant » : une requête entre, une réponse sort.
// Tout ce dont elle dépend (réseau, IA, journal) lui est fourni : les tests la font tourner
// avec de faux services, et index.ts lui donne les vrais.
//
// Dans l'ordre, pour chaque appel :
//   1. l'origine doit être le site publié ou l'aperçu local ;
//   2. le jeton de session est vérifié auprès de Supabase : sans compte connecté, rien ne passe ;
//   3. la demande est relue champ par champ ;
//   4. l'action est exécutée. Seule « fiche » appelle l'IA, après avoir réservé l'appel dans la base.
// Les réponses d'erreur ne portent qu'un code. Rien de ce qu'un service extérieur répond
// n'est recopié, ni dans une réponse ni dans le journal : une clé ne peut donc pas s'échapper.

import {
  LIMITE_IA_PAR_JOUR,
  ORIGINES_AUTORISEES,
  type CodeErreur,
  type Demande,
  type EtatSource,
  type EtatSources,
  type OeuvrePourFiche,
  type RefCouverture,
  type ReponseCouverture,
  type ReponseIsbn,
  type ReponseTitre,
} from './contrat.ts'
import { chercherCouverture, enBase64, type Recuperer } from './couverture.ts'
import { LONGUEUR_MAX_CORPS, lireDemande } from './entrees.ts'
import { construireDemande, SCHEMA_FICHE, validerFiche, type Vocabulaire } from './fiche.ts'
import { completerAvecOriginal, fusionnerNotice, grouperResultats } from './notice.ts'
import { adresseBnfIsbn, adresseBnfTitre, lireNoticesBnf } from './sources/bnf.ts'
import { adresseGoogleIsbn, adresseGoogleTitre, lireVolumesGoogle, type VolumeGoogle } from './sources/google.ts'
import {
  adresseOpenLibraryEdition,
  adresseOpenLibraryIsbn,
  adresseOpenLibraryTitre,
  lireEditionOpenLibrary,
  lireRechercheOpenLibrary,
} from './sources/openLibrary.ts'

/** Ce qu'on demande à l'IA : des consignes, un message, et le schéma de la réponse attendue. */
export type DemandeIA = { systeme: string; message: string; schema: Record<string, unknown> }
/** Ce qu'elle rend : un texte (du JSON), un refus, ou une réponse coupée avant la fin. */
export type ReponseIA = { type: 'texte'; texte: string } | { type: 'refus' } | { type: 'incomplet' }

export type Dependances = {
  /** Adresse du projet Supabase (https://….supabase.co). */
  urlSupabase: string
  /** Clé Google Books ; absente, on se passe de cette source. */
  cleGoogle: string | undefined
  recuperer: Recuperer
  /** L'appel à l'IA ; null si la clé Anthropic n'est pas configurée. */
  demanderFiche: ((demande: DemandeIA) => Promise<ReponseIA>) | null
  /** Une ligne par appel : l'action, le résultat, la durée. Jamais de contenu. */
  journal: (ligne: Record<string, unknown>) => void
}

const STATUTS: Record<CodeErreur, number> = {
  origine: 403,
  methode: 405,
  connexion: 401,
  entree: 400,
  limite: 429,
  non_configure: 503,
  ia: 502,
  panne: 503,
}

const DELAI_SOURCE = 8_000
const DELAI_SUPABASE = 6_000
/** Un nom neutre : les catalogues savent qu'un programme les interroge, pas lequel ni pour qui. */
const AGENT = 'bibliotheque-personnelle/1.0'

type Lecture = { etat: 'ok'; texte: string } | { etat: 'rien' } | { etat: 'panne' }

class Refus extends Error {
  readonly code: CodeErreur
  constructor(code: CodeErreur) {
    super(code)
    this.code = code
  }
}

const json = (texte: string): unknown => {
  try {
    return JSON.parse(texte)
  } catch {
    return null
  }
}

export function creerGestionnaire(deps: Dependances): (requete: Request) => Promise<Response> {
  const { urlSupabase, cleGoogle, recuperer, demanderFiche, journal } = deps

  /** Lit une adresse d'un catalogue. Ne lève jamais d'erreur et ne garde rien de la réponse en cas d'échec. */
  async function lire(adresse: string, entetes: Record<string, string> = {}): Promise<Lecture> {
    try {
      const reponse = await recuperer(adresse, {
        headers: { accept: 'application/json, application/xml;q=0.9', 'user-agent': AGENT, ...entetes },
        signal: AbortSignal.timeout(DELAI_SOURCE),
      })
      if (reponse.status === 404) return { etat: 'rien' }
      if (reponse.status !== 200) return { etat: 'panne' }
      return { etat: 'ok', texte: await reponse.text() }
    } catch {
      return { etat: 'panne' }
    }
  }

  const lireGoogle = (adresse: string): Promise<Lecture> =>
    cleGoogle ? lire(adresse, { 'x-goog-api-key': cleGoogle }) : Promise.resolve({ etat: 'panne' })

  const etat = (lecture: Lecture, trouve: boolean): EtatSource => (lecture.etat === 'panne' ? 'panne' : trouve ? 'ok' : 'rien')

  /** Un appel à Supabase (connexion ou base) au nom du compte : son jeton, la clé publique reçue. */
  function versSupabase(chemin: string, compte: Compte, options: { methode?: string; corps?: unknown } = {}) {
    return recuperer(`${urlSupabase}${chemin}`, {
      method: options.methode ?? 'GET',
      headers: {
        authorization: `Bearer ${compte.jeton}`,
        apikey: compte.cle,
        accept: 'application/json',
        ...(options.corps === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
      signal: AbortSignal.timeout(DELAI_SUPABASE),
    })
  }

  type Compte = { jeton: string; cle: string }

  /** Le jeton est-il celui d'un compte connecté ? Supabase seul le dit. */
  async function verifierCompte(compte: Compte): Promise<void> {
    let reponse: Response
    try {
      reponse = await versSupabase('/auth/v1/user', compte)
    } catch {
      throw new Refus('panne')
    }
    if (reponse.status >= 500) throw new Refus('panne')
    if (reponse.status !== 200) throw new Refus('connexion')
    const utilisateur = json(await reponse.text().catch(() => '')) as { id?: unknown } | null
    if (!utilisateur || typeof utilisateur.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(utilisateur.id)) throw new Refus('connexion')
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  async function chercherIsbn(isbn: string): Promise<{ corps: ReponseIsbn; sources: EtatSources }> {
    const [bnf, google, edition, recherche] = await Promise.all([
      lire(adresseBnfIsbn(isbn)),
      lireGoogle(adresseGoogleIsbn(isbn)),
      lire(adresseOpenLibraryEdition(isbn)),
      lire(adresseOpenLibraryIsbn(isbn)),
    ])
    const notices = bnf.etat === 'ok' ? lireNoticesBnf(bnf.texte) : []
    const volumes = google.etat === 'ok' ? lireVolumesGoogle(json(google.texte)).filter((v) => v.isbn13.includes(isbn)) : []
    const lue = edition.etat === 'ok' ? lireEditionOpenLibrary(json(edition.texte)) : null
    const oeuvres = recherche.etat === 'ok' ? lireRechercheOpenLibrary(json(recherche.texte)) : []

    const sources: EtatSources = {
      bnf: etat(bnf, notices.length > 0),
      google_books: cleGoogle ? etat(google, volumes.length > 0) : 'non_configure',
      open_library:
        lue || oeuvres.length > 0 ? 'ok' : edition.etat === 'panne' && recherche.etat === 'panne' ? 'panne' : etat(edition, false),
    }
    return { corps: { ...fusionnerNotice(isbn, { bnf: notices, google: volumes, edition: lue, oeuvres }), sources }, sources }
  }

  async function chercherTitre(titre: string, auteur?: string): Promise<{ corps: ReponseTitre; sources: EtatSources }> {
    const [bnf, google, recherche] = await Promise.all([
      lire(adresseBnfTitre(titre, auteur)),
      lireGoogle(adresseGoogleTitre(titre, auteur)),
      lire(adresseOpenLibraryTitre(titre, auteur)),
    ])
    const notices = bnf.etat === 'ok' ? lireNoticesBnf(bnf.texte) : []
    const volumes = google.etat === 'ok' ? lireVolumesGoogle(json(google.texte)) : []
    const oeuvres = recherche.etat === 'ok' ? lireRechercheOpenLibrary(json(recherche.texte)) : []
    const sources: EtatSources = {
      bnf: etat(bnf, notices.length > 0),
      google_books: cleGoogle ? etat(google, volumes.length > 0) : 'non_configure',
      open_library: etat(recherche, oeuvres.length > 0),
    }
    const groupes = grouperResultats(titre, { bnf: notices, google: volumes, oeuvres })
    // Une œuvre traduite : son année de première publication se trouve sous son titre original.
    // Une seconde question à Open Library, pour les deux premiers résultats seulement.
    const resultats = await Promise.all(
      groupes.map(async (resultat, rang) => {
        const original = resultat.titreOriginal?.valeur
        if (rang > 1 || resultat.annee !== null || !original || !resultat.auteurs) return resultat
        const lecture = await lire(adresseOpenLibraryTitre(original, resultat.auteurs.valeur[0]))
        return lecture.etat === 'ok' ? completerAvecOriginal(resultat, lireRechercheOpenLibrary(json(lecture.texte))) : resultat
      }),
    )
    return { corps: { resultats, sources }, sources }
  }

  async function couverture(demande: Extract<Demande, { action: 'couverture' }>): Promise<ReponseCouverture> {
    const refs: RefCouverture[] = []
    if ('ref' in demande) {
      refs.push(demande.ref)
    } else {
      // Par ISBN : Google Books d'abord (il faut retrouver son identifiant de volume), puis Open Library
      // (il faut le numéro de couverture de cette édition, pour avoir l'image d'origine).
      const [google, edition] = await Promise.all([lireGoogle(adresseGoogleIsbn(demande.isbn)), lire(adresseOpenLibraryEdition(demande.isbn))])
      const volumes: VolumeGoogle[] = google.etat === 'ok' ? lireVolumesGoogle(json(google.texte)) : []
      const volume = volumes.find((v) => v.isbn13.includes(demande.isbn) && v.aCouverture)
      if (volume) refs.push({ source: 'google_books', id: volume.id })
      const numero = edition.etat === 'ok' ? (lireEditionOpenLibrary(json(edition.texte))?.couverture ?? null) : null
      // Sans numéro connu, l'adresse par ISBN reste le dernier recours : même édition, image plus petite.
      refs.push(numero !== null ? { source: 'open_library', numero } : { source: 'open_library', isbn: demande.isbn })
    }
    const trouvee = await chercherCouverture(refs, recuperer)
    if (!trouvee) return { trouve: false }
    const { image } = trouvee
    return {
      trouve: true,
      source: trouvee.source,
      image: { type: image.type, base64: enBase64(image.octets) },
      largeur: image.largeur,
      hauteur: image.hauteur,
    }
  }

  /** Mon vocabulaire d'étiquettes, lu dans la base avec mon jeton (la RLS ne montre que le mien). */
  async function lireVocabulaire(compte: Compte): Promise<Vocabulaire> {
    let lignes: unknown
    try {
      const reponse = await versSupabase('/rest/v1/tags?select=kind,name&order=name&limit=600', compte)
      if (reponse.status !== 200) throw new Refus('panne')
      lignes = json(await reponse.text())
    } catch {
      throw new Refus('panne')
    }
    if (!Array.isArray(lignes)) throw new Refus('panne')
    const vocabulaire: Vocabulaire = { genres: [], themes: [], atmospheres: [] }
    const listes: Record<string, string[]> = { genre: vocabulaire.genres, theme: vocabulaire.themes, atmosphere: vocabulaire.atmospheres }
    for (const ligne of lignes as { kind?: unknown; name?: unknown }[]) {
      if (typeof ligne?.kind !== 'string' || typeof ligne?.name !== 'string') continue
      const nom = ligne.name.trim()
      if (nom && nom.length <= 80) listes[ligne.kind]?.push(nom)
    }
    return vocabulaire
  }

  /** Réserve un appel à l'IA dans la base. Dans le doute (panne, réponse inattendue), on n'appelle pas. */
  async function reserverAppel(compte: Compte): Promise<void> {
    let accorde: unknown
    try {
      const reponse = await versSupabase('/rest/v1/rpc/reserver_appel_ia', compte, {
        methode: 'POST',
        corps: { action_demandee: 'fiche', limite: LIMITE_IA_PAR_JOUR },
      })
      if (reponse.status !== 200) throw new Refus('panne')
      accorde = json(await reponse.text())
    } catch {
      throw new Refus('panne')
    }
    if (accorde === false) throw new Refus('limite')
    if (accorde !== true) throw new Refus('panne')
  }

  async function fiche(oeuvre: OeuvrePourFiche, compte: Compte) {
    if (!demanderFiche) throw new Refus('non_configure')
    const vocabulaire = await lireVocabulaire(compte)
    await reserverAppel(compte)

    let reponse: ReponseIA
    try {
      reponse = await demanderFiche({ ...construireDemande(oeuvre, vocabulaire), schema: SCHEMA_FICHE })
    } catch {
      throw new Refus('ia')
    }
    if (reponse.type !== 'texte') throw new Refus('ia')
    const proposee = validerFiche(reponse.texte, vocabulaire, oeuvre)
    if (!proposee) throw new Refus('ia')
    return proposee
  }

  // -------------------------------------------------------------------------
  // La requête
  // -------------------------------------------------------------------------

  return async function gestionnaire(requete: Request): Promise<Response> {
    const debut = Date.now()
    const origine = requete.headers.get('origin')
    const permise = origine !== null && (ORIGINES_AUTORISEES as readonly string[]).includes(origine)

    const entetes: Record<string, string> = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    if (permise) {
      entetes['access-control-allow-origin'] = origine
      entetes.vary = 'Origin'
    }

    let action: Demande['action'] | undefined
    let sources: EtatSources | undefined

    const repondre = (statut: number, corps: unknown) => {
      journal({ ...(action ? { action } : {}), statut, ms: Date.now() - debut, ...(sources ? { sources } : {}) })
      return new Response(JSON.stringify(corps), { status: statut, headers: entetes })
    }

    try {
      if (!permise) throw new Refus('origine')

      if (requete.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'access-control-allow-origin': origine,
            vary: 'Origin',
            'access-control-allow-methods': 'POST, OPTIONS',
            'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
            'access-control-max-age': '86400',
          },
        })
      }
      if (requete.method !== 'POST') throw new Refus('methode')

      const jeton = /^Bearer ([A-Za-z0-9._-]{20,4000})$/.exec(requete.headers.get('authorization') ?? '')?.[1]
      const cle = requete.headers.get('apikey') ?? ''
      if (!jeton || !/^[A-Za-z0-9._-]{20,400}$/.test(cle)) throw new Refus('connexion')
      const compte: Compte = { jeton, cle }
      await verifierCompte(compte)

      const brut = await requete.text().catch(() => '')
      const demande = brut.length <= LONGUEUR_MAX_CORPS ? lireDemande(json(brut)) : null
      if (!demande) throw new Refus('entree')
      action = demande.action

      switch (demande.action) {
        case 'chercher_isbn': {
          const resultat = await chercherIsbn(demande.isbn)
          sources = resultat.sources
          return repondre(200, resultat.corps)
        }
        case 'chercher_titre': {
          const resultat = await chercherTitre(demande.titre, demande.auteur)
          sources = resultat.sources
          return repondre(200, resultat.corps)
        }
        case 'couverture':
          return repondre(200, await couverture(demande))
        case 'fiche':
          return repondre(200, await fiche(demande.oeuvre, compte))
      }
    } catch (erreur) {
      // Une erreur imprévue n'est jamais détaillée : ni au navigateur, ni au journal.
      const code: CodeErreur = erreur instanceof Refus ? erreur.code : 'panne'
      return repondre(STATUTS[code], { erreur: code })
    }
  }
}
