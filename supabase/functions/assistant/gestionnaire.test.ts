// @vitest-environment node
// La fonction entière, de la requête à la réponse, avec de faux services autour d'elle :
// connexion Supabase, base, BnF, Google Books, Open Library et IA.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CLES_FICHE, LIMITE_IA_PAR_JOUR, ORIGINES_AUTORISEES } from './contrat.ts'
import { jpeg, png, reponseImage, reponseJson } from './essais.ts'
import { creerGestionnaire, type DemandeIA, type ReponseIA } from './gestionnaire.ts'

const echantillon = (nom: string) => readFileSync(new URL(`./echantillons/${nom}`, import.meta.url), 'utf8')

const SITE = 'https://tchoupilareusta.github.io'
const SUPABASE = 'https://projet-essai.supabase.co'
const JETON = 'jeton-de-session-valide-0123456789.abcdefghij.klmnopqrst'
const CLE_PUBLIQUE = 'sb_publishable_cle-publique-essai-0123456789'
// Deux clés reconnaissables : elles ne doivent apparaître dans aucune réponse ni aucun journal.
const CLE_GOOGLE = 'CLE-GOOGLE-SENTINELLE-7f3a'
const CLE_ANTHROPIC = 'CLE-ANTHROPIC-SENTINELLE-9b2c'
const ISBN = '9782747024693'

const SYNOPSIS =
  'Dans les ruines d’un amphithéâtre vit Momo, une petite fille qui sait écouter comme personne. Quand des hommes gris persuadent les habitants d’économiser leur temps, la ville change de visage.'
const FICHE_IA = JSON.stringify({
  oeuvre_connue: true,
  synopsis: SYNOPSIS,
  genres: ['Conte philosophique'],
  themes: ['Rapport au temps'],
  atmospheres: ['Lumineuse'],
  themes_nouveaux: ['Écoute'],
  tonalite: 4,
  exigence: 2,
  longueur: 'moyen',
})

const VOLUME_GOOGLE = {
  items: [
    {
      id: 'zyTCAlFPjgYC',
      volumeInfo: {
        title: 'Momo',
        authors: ['Michael Ende'],
        description: 'Momo affronte les hommes gris.',
        industryIdentifiers: [{ type: 'ISBN_13', identifier: ISBN }],
        pageCount: 430,
        imageLinks: { thumbnail: 'http://books.google.com/x' },
        language: 'fr',
      },
    },
  ],
}

type Options = {
  /** Réponses particulières : la première règle dont le motif est dans l'adresse l'emporte. */
  routes?: [string, (adresse: string, options?: RequestInit) => Response | Promise<Response>][]
  cleGoogle?: string | null
  ia?: ((demande: DemandeIA) => Promise<ReponseIA>) | null
  /** Nombre d'appels à l'IA encore permis par la fausse base. */
  appelsRestants?: number
}

function monde(options: Options = {}) {
  const appels: { adresse: string; options?: RequestInit }[] = []
  const journal: Record<string, unknown>[] = []
  const demandesIA: DemandeIA[] = []
  let restants = options.appelsRestants ?? 30

  const parDefaut: Options['routes'] = [
    [
      '/auth/v1/user',
      (_adresse, init) => {
        const entetes = new Headers(init?.headers)
        return entetes.get('authorization') === `Bearer ${JETON}` && entetes.get('apikey') === CLE_PUBLIQUE
          ? reponseJson({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@exemple.test' })
          : reponseJson({ msg: 'invalid JWT' }, 401)
      },
    ],
    [
      '/rest/v1/tags',
      () =>
        reponseJson([
          { kind: 'genre', name: 'Conte philosophique' },
          { kind: 'theme', name: 'Rapport au temps' },
          { kind: 'theme', name: 'Amitié' },
          { kind: 'atmosphere', name: 'Lumineuse' },
        ]),
    ],
    ['/rest/v1/rpc/reserver_appel_ia', () => reponseJson(restants-- > 0)],
    ['catalogue.bnf.fr', (adresse) => new Response(echantillon(adresse.includes('bib.title') ? 'bnf-titre-momo.xml' : 'bnf-momo.xml'))],
    ['googleapis.com/books', () => reponseJson(VOLUME_GOOGLE)],
    ['openlibrary.org/isbn/', () => new Response(echantillon('ol-edition-momo.json'))],
    ['openlibrary.org/search.json', () => new Response(echantillon('ol-recherche-momo.json'))],
    ['books.google.com/books/', () => reponseImage(jpeg(480, 720))],
    ['covers.openlibrary.org', () => reponseImage(jpeg(600, 900))],
  ]

  const recuperer = async (adresse: string, init?: RequestInit) => {
    appels.push({ adresse, options: init })
    const route = [...(options.routes ?? []), ...parDefaut].find(([motif]) => adresse.includes(motif))
    if (!route) throw new Error(`adresse imprévue dans le test : ${adresse}`)
    return route[1](adresse, init)
  }

  const ia =
    options.ia === undefined
      ? async (demande: DemandeIA): Promise<ReponseIA> => {
          demandesIA.push(demande)
          return { type: 'texte', texte: FICHE_IA }
        }
      : options.ia

  const gestionnaire = creerGestionnaire({
    urlSupabase: SUPABASE,
    cleGoogle: options.cleGoogle === undefined ? CLE_GOOGLE : (options.cleGoogle ?? undefined),
    recuperer,
    demanderFiche: ia,
    journal: (ligne) => journal.push(ligne),
  })

  const vers = (motif: string) => appels.filter((appel) => appel.adresse.includes(motif))
  return { gestionnaire, appels, journal, demandesIA, vers }
}

type Envoi = { origine?: string | null; jeton?: string | null; cle?: string | null; methode?: string; brut?: string }

function requete(corps: unknown, envoi: Envoi = {}) {
  const entetes = new Headers({ 'content-type': 'application/json' })
  const origine = envoi.origine === undefined ? SITE : envoi.origine
  const jeton = envoi.jeton === undefined ? JETON : envoi.jeton
  const cle = envoi.cle === undefined ? CLE_PUBLIQUE : envoi.cle
  if (origine) entetes.set('origin', origine)
  if (jeton) entetes.set('authorization', `Bearer ${jeton}`)
  if (cle) entetes.set('apikey', cle)
  const methode = envoi.methode ?? 'POST'
  return new Request(`${SUPABASE}/functions/v1/assistant`, {
    method: methode,
    headers: entetes,
    body: methode === 'POST' ? (envoi.brut ?? JSON.stringify(corps)) : undefined,
  })
}

const PAR_ISBN = { action: 'chercher_isbn', isbn: ISBN }
const POUR_FICHE = {
  action: 'fiche',
  oeuvre: { titre: 'Momo', auteurs: ['Michael Ende'], descriptions: [{ texte: 'Une orpheline et des voleurs de temps.', source: 'bnf' }] },
}

// ---------------------------------------------------------------------------

describe('origine de l’appel', () => {
  it('refuse une origine inconnue, sans rien appeler', async () => {
    const { gestionnaire, appels } = monde()
    for (const origine of ['https://exemple.test', 'https://tchoupilareusta.github.io.exemple.test', 'http://localhost:9999', 'null']) {
      const reponse = await gestionnaire(requete(PAR_ISBN, { origine }))
      expect(reponse.status, origine).toBe(403)
      expect(await reponse.json()).toEqual({ erreur: 'origine' })
      expect(reponse.headers.get('access-control-allow-origin')).toBeNull()
    }
    expect(appels).toHaveLength(0)
  })

  it('refuse un appel sans origine (hors navigateur)', async () => {
    const { gestionnaire, appels } = monde()
    const reponse = await gestionnaire(requete(PAR_ISBN, { origine: null }))
    expect(reponse.status).toBe(403)
    expect(appels).toHaveLength(0)
  })

  it('accepte le site publié et l’aperçu local, et seulement eux', async () => {
    expect([...ORIGINES_AUTORISEES]).toEqual(['https://tchoupilareusta.github.io', 'http://localhost:5173', 'http://localhost:4173'])
    for (const origine of ORIGINES_AUTORISEES) {
      const { gestionnaire } = monde()
      const reponse = await gestionnaire(requete(PAR_ISBN, { origine }))
      expect(reponse.status, origine).toBe(200)
      expect(reponse.headers.get('access-control-allow-origin')).toBe(origine)
      expect(reponse.headers.get('vary')).toMatch(/origin/i)
    }
  })

  it('répond à la question préalable du navigateur pour une origine permise, pas pour une autre', async () => {
    const { gestionnaire, appels } = monde()
    const permise = await gestionnaire(requete(null, { methode: 'OPTIONS', jeton: null, cle: null }))
    expect(permise.status).toBe(204)
    expect(permise.headers.get('access-control-allow-origin')).toBe(SITE)
    expect(permise.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')
    expect(permise.headers.get('access-control-allow-headers')).toMatch(/authorization/)
    const refusee = await gestionnaire(requete(null, { methode: 'OPTIONS', origine: 'https://exemple.test', jeton: null, cle: null }))
    expect(refusee.status).toBe(403)
    expect(appels).toHaveLength(0)
  })

  it('n’accepte que POST', async () => {
    const { gestionnaire, appels } = monde()
    const reponse = await gestionnaire(requete(null, { methode: 'GET' }))
    expect(reponse.status).toBe(405)
    expect(await reponse.json()).toEqual({ erreur: 'methode' })
    expect(appels).toHaveLength(0)
  })
})

describe('connexion', () => {
  it('refuse un visiteur non connecté, sans interroger aucune source', async () => {
    const { gestionnaire, appels } = monde()
    for (const envoi of [{ jeton: null }, { cle: null }, { jeton: null, cle: null }]) {
      const reponse = await gestionnaire(requete(PAR_ISBN, envoi))
      expect(reponse.status).toBe(401)
      expect(await reponse.json()).toEqual({ erreur: 'connexion' })
    }
    expect(appels).toHaveLength(0)
  })

  it('refuse un jeton que Supabase ne reconnaît pas : seule la vérification du jeton a lieu', async () => {
    const { gestionnaire, appels, vers } = monde()
    const reponse = await gestionnaire(requete(PAR_ISBN, { jeton: 'jeton-invente-0123456789-abcdefghijklmnop' }))
    expect(reponse.status).toBe(401)
    expect(await reponse.json()).toEqual({ erreur: 'connexion' })
    expect(appels).toHaveLength(1)
    expect(vers('/auth/v1/user')).toHaveLength(1)
  })

  it('refuse la clé publique présentée à la place d’un jeton de session', async () => {
    const { gestionnaire } = monde()
    const reponse = await gestionnaire(requete(PAR_ISBN, { jeton: CLE_PUBLIQUE }))
    expect(reponse.status).toBe(401)
  })

  it('refuse un jeton ou une clé mal formés avant tout appel', async () => {
    const { gestionnaire, appels } = monde()
    expect((await gestionnaire(requete(PAR_ISBN, { jeton: 'court' }))).status).toBe(401)
    expect((await gestionnaire(requete(PAR_ISBN, { cle: 'clé avec espaces et "guillemets" bien trop étrange' }))).status).toBe(401)
    expect(appels).toHaveLength(0)
  })

  it('refuse aussi quand le service de connexion ne répond pas : dans le doute, rien ne passe', async () => {
    const { gestionnaire, appels } = monde({
      routes: [
        [
          '/auth/v1/user',
          () => {
            throw new Error('panne')
          },
        ],
      ],
    })
    const reponse = await gestionnaire(requete(PAR_ISBN))
    expect(reponse.status).toBe(503)
    expect(await reponse.json()).toEqual({ erreur: 'panne' })
    expect(appels).toHaveLength(1)
  })

  it('vérifie le jeton auprès du projet Supabase, et nulle part ailleurs', async () => {
    const { gestionnaire, vers } = monde()
    await gestionnaire(requete(PAR_ISBN))
    expect(vers('/auth/v1/user')[0].adresse).toBe(`${SUPABASE}/auth/v1/user`)
  })
})

describe('entrées', () => {
  it('refuse une demande mal formée, sans interroger aucune source', async () => {
    const { gestionnaire, vers } = monde()
    const refusees: [unknown, Envoi?][] = [
      [{ action: 'chercher_isbn', isbn: '9782747024694' }],
      [{ action: 'chercher_isbn', isbn: '2747024695' }],
      [{ action: 'chercher_titre', titre: 'a'.repeat(201) }],
      [{ action: 'inconnue' }],
      [{ action: 'chercher_isbn', isbn: ISBN, notes: 'ma note personnelle' }],
      [null, { brut: 'pas du JSON' }],
      [null, { brut: '' }],
      [null, { brut: JSON.stringify({ action: 'chercher_titre', titre: 'Momo', auteur: 'x'.repeat(30_000) }) }],
    ]
    for (const [corps, envoi] of refusees) {
      const reponse = await gestionnaire(requete(corps, envoi))
      expect(reponse.status, JSON.stringify(corps ?? envoi).slice(0, 60)).toBe(400)
      expect(await reponse.json()).toEqual({ erreur: 'entree' })
    }
    expect(vers('catalogue.bnf.fr')).toHaveLength(0)
    expect(vers('googleapis.com')).toHaveLength(0)
    expect(vers('openlibrary.org')).toHaveLength(0)
  })
})

describe('recherche par ISBN', () => {
  it('rend la notice, champ par champ, avec la source de chacun', async () => {
    const { gestionnaire } = monde()
    const reponse = await gestionnaire(requete(PAR_ISBN))
    expect(reponse.status).toBe(200)
    const corps = await reponse.json()
    expect(corps.trouve).toBe(true)
    expect(corps.notice.titre).toEqual({ valeur: 'Momo', source: 'bnf' })
    expect(corps.notice.traducteur).toEqual({ valeur: 'Corinna Gepner', source: 'bnf' })
    expect(corps.notice.pages).toEqual({ valeur: 430, source: 'bnf' })
    expect(corps.notice.annee).toEqual({ valeur: 1973, source: 'open_library' })
    expect(corps.couverture).toEqual({ source: 'google_books', id: 'zyTCAlFPjgYC' })
    expect(corps.sources).toEqual({ bnf: 'ok', google_books: 'ok', open_library: 'ok' })
    expect(corps.descriptions.map((d: { source: string }) => d.source)).toEqual(['bnf', 'google_books'])
  })

  it('n’est jamais gardée en cache par le navigateur', async () => {
    const { gestionnaire } = monde()
    const reponse = await gestionnaire(requete(PAR_ISBN))
    expect(reponse.headers.get('cache-control')).toBe('no-store')
    expect(reponse.headers.get('content-type')).toMatch(/application\/json/)
  })

  it('envoie la clé Google dans un en-tête, jamais dans l’adresse', async () => {
    const { gestionnaire, vers } = monde()
    await gestionnaire(requete(PAR_ISBN))
    const [appel] = vers('googleapis.com')
    expect(appel.adresse).not.toContain(CLE_GOOGLE)
    expect(appel.adresse).not.toContain('key=')
    expect(new Headers(appel.options?.headers).get('x-goog-api-key')).toBe(CLE_GOOGLE)
  })

  it('n’envoie ni mon jeton ni ma clé publique aux catalogues extérieurs', async () => {
    const { gestionnaire, appels } = monde()
    await gestionnaire(requete(PAR_ISBN))
    for (const appel of appels.filter((a) => !a.adresse.startsWith(SUPABASE))) {
      const entetes = new Headers(appel.options?.headers)
      expect(entetes.get('authorization'), appel.adresse).toBeNull()
      expect(entetes.get('apikey'), appel.adresse).toBeNull()
      expect(JSON.stringify([...entetes]) + appel.adresse).not.toContain(JETON)
    }
  })

  it('répond avec ce qui marche quand une source est en panne, et le dit', async () => {
    const { gestionnaire } = monde({
      routes: [
        ['catalogue.bnf.fr', () => new Response('erreur', { status: 500 })],
        [
          'openlibrary.org',
          () => {
            throw new Error('délai dépassé')
          },
        ],
      ],
    })
    const corps = await (await gestionnaire(requete(PAR_ISBN))).json()
    expect(corps.trouve).toBe(true)
    expect(corps.notice.titre).toEqual({ valeur: 'Momo', source: 'google_books' })
    expect(corps.sources).toEqual({ bnf: 'panne', google_books: 'ok', open_library: 'panne' })
  })

  it('se passe de Google Books si sa clé n’est pas configurée', async () => {
    const { gestionnaire, vers } = monde({ cleGoogle: null })
    const corps = await (await gestionnaire(requete(PAR_ISBN))).json()
    expect(corps.sources.google_books).toBe('non_configure')
    expect(corps.notice.titre).toEqual({ valeur: 'Momo', source: 'bnf' })
    expect(vers('googleapis.com')).toHaveLength(0)
  })

  it('dit « pas trouvé », sans rien inventer, quand aucune source ne connaît l’ISBN', async () => {
    const { gestionnaire } = monde({
      routes: [
        ['catalogue.bnf.fr', () => new Response('<srw:numberOfRecords>0</srw:numberOfRecords>')],
        ['googleapis.com', () => reponseJson({ totalItems: 0 })],
        ['openlibrary.org/isbn/', () => reponseJson({ error: 'notfound' }, 404)],
        ['openlibrary.org/search.json', () => reponseJson({ docs: [] })],
      ],
    })
    const corps = await (await gestionnaire(requete(PAR_ISBN))).json()
    expect(corps.trouve).toBe(false)
    expect(Object.values(corps.notice).filter((valeur) => valeur !== null && valeur !== false)).toEqual([])
    expect(corps.sources).toEqual({ bnf: 'rien', google_books: 'rien', open_library: 'rien' })
  })
})

describe('recherche par titre', () => {
  it('rend une liste d’œuvres à choisir, sans ISBN ni éditeur ni pagination', async () => {
    const { gestionnaire, vers } = monde({ routes: [['googleapis.com', () => reponseJson({ totalItems: 0 })]] })
    const reponse = await gestionnaire(requete({ action: 'chercher_titre', titre: 'Momo', auteur: 'Ende' }))
    expect(reponse.status).toBe(200)
    const corps = await reponse.json()
    expect(corps.resultats).toHaveLength(1)
    expect(corps.resultats[0].titre).toEqual({ valeur: 'Momo', source: 'bnf' })
    expect(corps.resultats[0].annee).toEqual({ valeur: 1973, source: 'open_library' })
    expect(JSON.stringify(corps.resultats)).not.toMatch(/isbn|editeur|pages/i)
    expect(decodeURIComponent(vers('catalogue.bnf.fr')[0].adresse)).toContain('bib.author all "Ende"')
    // L'année est déjà connue : pas de seconde question à Open Library.
    expect(vers('openlibrary.org/search.json')).toHaveLength(1)
  })

  it('pour une œuvre traduite, demande l’année à Open Library sous son titre original', async () => {
    const zone = (etiquette: string, ind1: string, sous: string) =>
      `<mxc:datafield tag="${etiquette}" ind1="${ind1}" ind2=" ">${sous}</mxc:datafield>`
    const sous = (code: string, valeur: string) => `<mxc:subfield code="${code}">${valeur}</mxc:subfield>`
    const notice =
      '<srw:record>' +
      zone('101', '1', sous('a', 'fre') + sous('c', 'eng')) +
      zone('200', '1', sous('a', 'Le meilleur des mondes')) +
      zone('454', ' ', sous('t', 'Brave new world')) +
      zone('700', ' ', sous('a', 'Huxley') + sous('b', 'Aldous') + sous('4', '070')) +
      '</srw:record>'
    const { gestionnaire, vers } = monde({
      routes: [
        ['catalogue.bnf.fr', () => new Response(notice)],
        ['googleapis.com', () => reponseJson({ totalItems: 0 })],
        [
          'openlibrary.org/search.json',
          (adresse) =>
            reponseJson({
              docs: adresse.includes('title=Brave')
                ? [{ title: 'Brave New World', author_name: ['Aldous Huxley'], first_publish_year: 1932, cover_i: 5 }]
                : [{ title: 'Le meilleur des mondes', author_name: ['Aldous Huxley'], first_publish_year: 1976 }],
            }),
        ],
      ],
    })
    const corps = await (await gestionnaire(requete({ action: 'chercher_titre', titre: 'Le meilleur des mondes' }))).json()
    expect(corps.resultats[0].titreOriginal).toEqual({ valeur: 'Brave new world', source: 'bnf' })
    expect(corps.resultats[0].annee).toEqual({ valeur: 1932, source: 'open_library' })
    expect(corps.resultats[0].couverture).toEqual({ source: 'open_library', numero: 5 })
    const questions = vers('openlibrary.org/search.json').map((appel) => new URL(appel.adresse).searchParams)
    expect(questions).toHaveLength(2)
    expect(questions[1].get('title')).toBe('Brave new world')
    expect(questions[1].get('author')).toBe('Aldous Huxley')
  })
})

describe('couverture', () => {
  it('rend l’image d’une référence, codée, avec son type et sa source', async () => {
    const { gestionnaire } = monde()
    const reponse = await gestionnaire(requete({ action: 'couverture', ref: { source: 'google_books', id: 'zyTCAlFPjgYC' } }))
    const corps = await reponse.json()
    expect(corps.trouve).toBe(true)
    expect(corps.source).toBe('google_books')
    expect(corps.image.type).toBe('image/jpeg')
    expect(atob(corps.image.base64).length).toBe(6000)
    // La taille de l'image voyage avec elle : l'appli dit « de petite taille » sous 450 px de large.
    expect(corps.largeur).toBe(480)
    expect(corps.hauteur).toBe(720)
  })

  it('par ISBN, prend chez Open Library l’image d’origine de cette édition, par son numéro de couverture', async () => {
    const { gestionnaire, vers } = monde({ cleGoogle: null })
    const corps = await (await gestionnaire(requete({ action: 'couverture', isbn: ISBN }))).json()
    expect(corps).toMatchObject({ trouve: true, source: 'open_library' })
    // Le numéro vient de la fiche de l'édition (8751329), jamais de la recherche, qui donne
    // la couverture de l'œuvre en général (8574580, une édition allemande).
    expect(vers('covers.openlibrary.org').map((appel) => appel.adresse)).toEqual(['https://covers.openlibrary.org/b/id/8751329.jpg?default=false'])
    expect(vers('openlibrary.org/search.json')).toHaveLength(0)
  })

  it('par ISBN, garde l’adresse par ISBN d’Open Library en dernier recours, quand la fiche de l’édition ne répond pas', async () => {
    const { gestionnaire, vers } = monde({ cleGoogle: null, routes: [['openlibrary.org/isbn/', () => new Response('panne', { status: 503 })]] })
    const corps = await (await gestionnaire(requete({ action: 'couverture', isbn: ISBN }))).json()
    expect(corps.trouve).toBe(true)
    expect(vers('covers.openlibrary.org').map((appel) => appel.adresse)).toEqual([`https://covers.openlibrary.org/b/isbn/${ISBN}-L.jpg?default=false`])
  })

  it('par ISBN, garde la plus large des deux sources quand Google Books n’a qu’une petite image', async () => {
    const { gestionnaire } = monde({
      routes: [
        ['books.google.com/books/', () => reponseImage(jpeg(300, 450))],
        ['covers.openlibrary.org', () => reponseImage(jpeg(625, 999))],
      ],
    })
    const corps = await (await gestionnaire(requete({ action: 'couverture', isbn: ISBN }))).json()
    expect(corps).toMatchObject({ trouve: true, source: 'open_library', largeur: 625, hauteur: 999 })
  })

  it('interroge Google Books depuis la Suisse (country=CH), sans y mettre la clé', async () => {
    const { gestionnaire, vers } = monde()
    await gestionnaire(requete({ action: 'couverture', isbn: ISBN }))
    await gestionnaire(requete(PAR_ISBN))
    await gestionnaire(requete({ action: 'chercher_titre', titre: 'Momo', auteur: 'Ende' }))
    const adresses = vers('googleapis.com/books').map((appel) => new URL(appel.adresse))
    expect(adresses).toHaveLength(3)
    for (const adresse of adresses) {
      expect(adresse.searchParams.get('country')).toBe('CH')
      expect(adresse.searchParams.has('langRestrict')).toBe(false)
      expect(adresse.href).not.toContain(CLE_GOOGLE)
    }
  })

  it('par ISBN, cherche chez Google Books puis chez Open Library', async () => {
    const { gestionnaire, vers } = monde({ routes: [['books.google.com/books/', () => reponseImage(png(128, 170, 1269), 'image/png')]] })
    const corps = await (await gestionnaire(requete({ action: 'couverture', isbn: ISBN }))).json()
    expect(corps.trouve).toBe(true)
    expect(corps.source).toBe('open_library')
    expect(vers('googleapis.com')).toHaveLength(1)
    expect(vers('covers.openlibrary.org')).toHaveLength(1)
  })

  it('dit simplement « pas trouvée » quand aucune source n’a d’image convenable', async () => {
    const { gestionnaire } = monde({
      routes: [
        ['googleapis.com', () => reponseJson({ totalItems: 0 })],
        ['covers.openlibrary.org', () => new Response('non', { status: 404 })],
      ],
    })
    const reponse = await gestionnaire(requete({ action: 'couverture', isbn: ISBN }))
    expect(reponse.status).toBe(200)
    expect(await reponse.json()).toEqual({ trouve: false })
  })

  it('ne fait aucun appel à l’IA et ne consomme rien de la limite', async () => {
    const { gestionnaire, vers, demandesIA } = monde()
    await gestionnaire(requete({ action: 'couverture', isbn: ISBN }))
    await gestionnaire(requete(PAR_ISBN))
    expect(vers('reserver_appel_ia')).toHaveLength(0)
    expect(demandesIA).toHaveLength(0)
  })
})

describe('fiche par IA', () => {
  it('rend la proposition : synopsis et étiquettes de mon vocabulaire, thème nouveau à part', async () => {
    const { gestionnaire } = monde()
    const reponse = await gestionnaire(requete(POUR_FICHE))
    expect(reponse.status).toBe(200)
    expect(await reponse.json()).toEqual({
      synopsis: SYNOPSIS,
      genres: ['Conte philosophique'],
      themes: ['Rapport au temps'],
      atmospheres: ['Lumineuse'],
      themesNouveaux: ['Écoute'],
      tonalite: 4,
      exigence: 2,
      longueur: 'moyen',
    })
  })

  it('ne rend aucune donnée bibliographique, même si l’IA en écrit', async () => {
    const { gestionnaire } = monde({
      ia: async () => ({
        type: 'texte',
        texte: JSON.stringify({ ...JSON.parse(FICHE_IA), annee: 1973, editeur: 'Bayard', traducteur: 'X', isbn: ISBN, pages: 430, tomes: 3 }),
      }),
    })
    const corps = await (await gestionnaire(requete(POUR_FICHE))).json()
    expect(Object.keys(corps).sort()).toEqual([...CLES_FICHE].sort())
  })

  it('lit mon vocabulaire dans la base avec mon propre jeton, et le donne à l’IA', async () => {
    const { gestionnaire, vers, demandesIA } = monde()
    await gestionnaire(requete(POUR_FICHE))
    const [lecture] = vers('/rest/v1/tags')
    expect(new Headers(lecture.options?.headers).get('authorization')).toBe(`Bearer ${JETON}`)
    expect(new Headers(lecture.options?.headers).get('apikey')).toBe(CLE_PUBLIQUE)
    expect(demandesIA[0].message).toContain('Rapport au temps')
  })

  it('n’envoie à l’IA que l’œuvre, le vocabulaire et les descriptions : ni jeton, ni clé, ni compte', async () => {
    const { gestionnaire, demandesIA } = monde()
    await gestionnaire(requete(POUR_FICHE))
    const envoye = JSON.stringify(demandesIA[0])
    for (const interdit of [JETON, CLE_PUBLIQUE, CLE_GOOGLE, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@exemple.test']) {
      expect(envoye).not.toContain(interdit)
    }
    expect(Object.keys(demandesIA[0]).sort()).toEqual(['message', 'schema', 'systeme'])
  })

  it('réserve l’appel dans la base, avec la limite de 30 par jour, avant d’appeler l’IA', async () => {
    const ordre: string[] = []
    const { gestionnaire, vers } = monde({
      routes: [
        [
          '/rest/v1/rpc/reserver_appel_ia',
          () => {
            ordre.push('reservation')
            return reponseJson(true)
          },
        ],
      ],
      ia: async () => {
        ordre.push('ia')
        return { type: 'texte', texte: FICHE_IA }
      },
    })
    await gestionnaire(requete(POUR_FICHE))
    expect(ordre).toEqual(['reservation', 'ia'])
    expect(LIMITE_IA_PAR_JOUR).toBe(30)
    const [reservation] = vers('reserver_appel_ia')
    expect(JSON.parse(String(reservation.options?.body))).toEqual({ action_demandee: 'fiche', limite: 30 })
    expect(new Headers(reservation.options?.headers).get('authorization')).toBe(`Bearer ${JETON}`)
  })

  it('respecte la limite : au-delà, l’IA n’est plus appelée', async () => {
    const { gestionnaire, demandesIA } = monde({ appelsRestants: 2 })
    expect((await gestionnaire(requete(POUR_FICHE))).status).toBe(200)
    expect((await gestionnaire(requete(POUR_FICHE))).status).toBe(200)
    const refusee = await gestionnaire(requete(POUR_FICHE))
    expect(refusee.status).toBe(429)
    expect(await refusee.json()).toEqual({ erreur: 'limite' })
    expect((await gestionnaire(requete(POUR_FICHE))).status).toBe(429)
    expect(demandesIA).toHaveLength(2)
  })

  it('n’appelle pas l’IA si la réservation ne peut pas être vérifiée', async () => {
    for (const reponse of [() => new Response('erreur', { status: 500 }), () => reponseJson('oui'), () => reponseJson(null)]) {
      const { gestionnaire, demandesIA } = monde({ routes: [['/rest/v1/rpc/reserver_appel_ia', reponse]] })
      const refusee = await gestionnaire(requete(POUR_FICHE))
      expect(refusee.status).toBe(503)
      expect(await refusee.json()).toEqual({ erreur: 'panne' })
      expect(demandesIA).toHaveLength(0)
    }
  })

  it('sans clé Anthropic configurée, le dit calmement et ne consomme rien', async () => {
    const { gestionnaire, vers } = monde({ ia: null })
    const reponse = await gestionnaire(requete(POUR_FICHE))
    expect(reponse.status).toBe(503)
    expect(await reponse.json()).toEqual({ erreur: 'non_configure' })
    expect(vers('reserver_appel_ia')).toHaveLength(0)
  })

  it('rend « ia » quand l’IA échoue, refuse, s’interrompt ou répond n’importe quoi', async () => {
    const cas: (() => Promise<ReponseIA>)[] = [
      async () => {
        throw new Error('529 overloaded')
      },
      async () => ({ type: 'refus' }),
      async () => ({ type: 'incomplet' }),
      async () => ({ type: 'texte', texte: 'Désolé, voici la fiche : …' }),
    ]
    for (const ia of cas) {
      const { gestionnaire } = monde({ ia })
      const reponse = await gestionnaire(requete(POUR_FICHE))
      expect(reponse.status).toBe(502)
      expect(await reponse.json()).toEqual({ erreur: 'ia' })
    }
  })

  it('fonctionne avec un vocabulaire vide, et s’arrête si le vocabulaire ne peut pas être lu', async () => {
    const vide = monde({ routes: [['/rest/v1/tags', () => reponseJson([])]] })
    const corps = await (await vide.gestionnaire(requete(POUR_FICHE))).json()
    expect(corps.genres).toEqual([])
    expect(corps.synopsis).toBe(SYNOPSIS)

    const panne = monde({ routes: [['/rest/v1/tags', () => new Response('erreur', { status: 500 })]] })
    const reponse = await panne.gestionnaire(requete(POUR_FICHE))
    expect(reponse.status).toBe(503)
    expect(panne.demandesIA).toHaveLength(0)
    expect(panne.vers('reserver_appel_ia')).toHaveLength(0)
  })
})

describe('aucune clé, aucun contenu personnel dans les réponses ni dans les journaux', () => {
  const SECRETS = [CLE_GOOGLE, CLE_ANTHROPIC, JETON]
  // Un service extérieur qui renvoie la clé reçue dans son message d'erreur : le pire cas.
  const bavard = (adresse: string, init?: RequestInit) =>
    new Response(`erreur pour ${adresse} avec ${JSON.stringify([...new Headers(init?.headers)])}`, { status: 500 })
  const explosif = (adresse: string, init?: RequestInit): Response => {
    throw new Error(`échec ${adresse} ${JSON.stringify([...new Headers(init?.headers)])} ${CLE_GOOGLE}`)
  }

  const scenarios: [string, Options, unknown, Envoi?][] = [
    ['recherche réussie', {}, PAR_ISBN],
    ['recherche par titre', {}, { action: 'chercher_titre', titre: 'Momo', auteur: 'Ende' }],
    ['couverture', {}, { action: 'couverture', isbn: ISBN }],
    ['fiche réussie', {}, POUR_FICHE],
    ['sources bavardes', { routes: [['googleapis.com', bavard], ['catalogue.bnf.fr', bavard], ['openlibrary.org', bavard]] }, PAR_ISBN],
    ['sources qui lèvent une erreur', { routes: [['googleapis.com', explosif], ['catalogue.bnf.fr', explosif], ['openlibrary.org', explosif]] }, PAR_ISBN],
    ['connexion qui lève une erreur', { routes: [['/auth/v1/user', explosif]] }, PAR_ISBN],
    ['base bavarde', { routes: [['/rest/v1/', bavard]] }, POUR_FICHE],
    [
      'IA qui lève une erreur contenant sa clé',
      {
        ia: async () => {
          throw new Error(`401 invalid x-api-key ${CLE_ANTHROPIC}`)
        },
      },
      POUR_FICHE,
    ],
    ['IA qui recopie une clé dans sa réponse', { ia: async () => ({ type: 'texte', texte: `{"synopsis": "${CLE_ANTHROPIC}"` }) }, POUR_FICHE],
    ['demande invalide', {}, { action: 'chercher_isbn', isbn: 'faux' }],
    ['jeton refusé', {}, PAR_ISBN, { jeton: 'jeton-invente-0123456789-abcdefghijklmnop' }],
    ['origine refusée', {}, PAR_ISBN, { origine: 'https://exemple.test' }],
  ]

  it.each(scenarios)('%s', async (_nom, options, corps, envoi) => {
    const { gestionnaire, journal } = monde(options)
    const reponse = await gestionnaire(requete(corps, envoi))
    const visible = (await reponse.text()) + JSON.stringify([...reponse.headers])
    for (const secret of SECRETS) expect(visible).not.toContain(secret)

    const journaux = JSON.stringify(journal)
    for (const secret of SECRETS) expect(journaux).not.toContain(secret)
    // Ni ce que je cherche, ni qui je suis : le journal ne dit que l'action, le résultat et la durée.
    for (const personnel of [ISBN, 'Momo', 'Ende', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@exemple.test', 'googleapis', 'http']) {
      expect(journaux).not.toContain(personnel)
    }
    expect(journal).toHaveLength(1)
  })

  it('ne détaille jamais une erreur imprévue : un code, rien de plus', async () => {
    // Une réponse impossible (un nombre à la place d'un texte) fait échouer la lecture de la notice.
    const impossible = { status: 200, headers: new Headers(), text: async () => 12345 } as unknown as Response
    const { gestionnaire, journal } = monde({ routes: [['catalogue.bnf.fr', () => impossible]] })
    const reponse = await gestionnaire(requete(PAR_ISBN))
    expect(reponse.status).toBe(503)
    expect(await reponse.json()).toEqual({ erreur: 'panne' })
    expect(JSON.stringify(journal)).not.toMatch(/TypeError|function|split/)
  })

  it('écrit une ligne de journal par appel : l’action, le résultat, la durée, l’état des sources', async () => {
    const { gestionnaire, journal } = monde()
    await gestionnaire(requete(PAR_ISBN))
    expect(journal).toHaveLength(1)
    expect(Object.keys(journal[0]).sort()).toEqual(['action', 'ms', 'sources', 'statut'])
    expect(journal[0]).toMatchObject({ action: 'chercher_isbn', statut: 200, sources: { bnf: 'ok', google_books: 'ok', open_library: 'ok' } })
    expect(typeof journal[0].ms).toBe('number')
  })

  it('ne recopie jamais dans le journal une action inventée par l’appelant', async () => {
    const { gestionnaire, journal } = monde()
    await gestionnaire(requete({ action: 'texte-libre-de-l-appelant' }))
    expect(JSON.stringify(journal)).not.toContain('texte-libre')
    expect(journal[0]).toMatchObject({ statut: 400 })
  })
})
