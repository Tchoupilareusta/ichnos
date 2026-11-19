import { creerAssistantSupabase, type ClientFonctions } from './assistant'

type Reponse = { data?: unknown; error?: unknown }

function fauxClient(reponse: Reponse | (() => Reponse)) {
  const appels: { nom: string; corps: unknown }[] = []
  const client = {
    functions: {
      invoke: async (nom: string, options: { body: unknown }) => {
        appels.push({ nom, corps: options.body })
        const rendue = typeof reponse === 'function' ? reponse() : reponse
        return { data: rendue.data ?? null, error: rendue.error ?? null }
      },
    },
  } as unknown as ClientFonctions
  return { client, appels }
}

/** L'erreur que supabase-js rend quand la fonction répond par un refus (401, 429, 503…). */
const refus = (code: string, statut = 400) => ({
  name: 'FunctionsHttpError',
  context: new Response(JSON.stringify({ erreur: code }), { status: statut }),
})

const NOTICE_VIDE = {
  titre: null,
  titreOriginal: null,
  auteurs: null,
  traducteur: null,
  editeur: null,
  pages: null,
  langue: null,
  langueOriginale: null,
  annee: null,
  tome: null,
  manga: false,
}
const SOURCES = { bnf: 'ok', google_books: 'ok', open_library: 'ok' }

describe('assistant (fonction serveur)', () => {
  it('cherche par ISBN en appelant la fonction « assistant », et rend sa réponse', async () => {
    const reponse = { trouve: true, notice: { ...NOTICE_VIDE, titre: { valeur: 'Momo', source: 'bnf' } }, descriptions: [], couverture: null, sources: SOURCES }
    const { client, appels } = fauxClient({ data: reponse })
    expect(await creerAssistantSupabase(client).chercherIsbn('9782747024693')).toEqual({ ok: true, valeur: reponse })
    expect(appels).toEqual([{ nom: 'assistant', corps: { action: 'chercher_isbn', isbn: '9782747024693' } }])
  })

  it('cherche par titre, avec l’auteur seulement s’il est donné', async () => {
    const { client, appels } = fauxClient({ data: { resultats: [], sources: SOURCES } })
    const assistant = creerAssistantSupabase(client)
    await assistant.chercherTitre('Momo')
    await assistant.chercherTitre('Momo', '  Ende ')
    await assistant.chercherTitre('Momo', '   ')
    expect(appels.map((a) => a.corps)).toEqual([
      { action: 'chercher_titre', titre: 'Momo' },
      { action: 'chercher_titre', titre: 'Momo', auteur: 'Ende' },
      { action: 'chercher_titre', titre: 'Momo' },
    ])
  })

  it('rend une couverture sous forme d’image, avec son type et sa source', async () => {
    const { client, appels } = fauxClient({ data: { trouve: true, source: 'open_library', image: { type: 'image/jpeg', base64: btoa('contenu-image') } } })
    const reponse = await creerAssistantSupabase(client).couverture({ isbn: '9782747024693' })
    expect(appels[0].corps).toEqual({ action: 'couverture', isbn: '9782747024693' })
    if (!reponse.ok || !reponse.valeur) throw new Error('image attendue')
    expect(reponse.valeur.source).toBe('open_library')
    expect(reponse.valeur.image.type).toBe('image/jpeg')
    expect(reponse.valeur.image.size).toBe('contenu-image'.length)
    // Une fonction serveur plus ancienne ne donne pas la taille : elle est alors inconnue.
    expect(reponse.valeur.largeur).toBeNull()
    expect(reponse.valeur.hauteur).toBeNull()
  })

  it('fait suivre la taille de l’image, pour dire « de petite taille »', async () => {
    const image = { type: 'image/jpeg', base64: btoa('contenu-image') }
    const { client } = fauxClient({ data: { trouve: true, source: 'google_books', image, largeur: 300, hauteur: 450 } })
    const reponse = await creerAssistantSupabase(client).couverture({ isbn: '9782747024693' })
    expect(reponse).toMatchObject({ ok: true, valeur: { largeur: 300, hauteur: 450 } })
    // Une taille fantaisiste n'est pas crue.
    const bancale = fauxClient({ data: { trouve: true, source: 'google_books', image, largeur: 'grande', hauteur: -3 } })
    expect(await creerAssistantSupabase(bancale.client).couverture({ isbn: '9782747024693' })).toMatchObject({
      ok: true,
      valeur: { largeur: null, hauteur: null },
    })
  })

  it('rend « aucune couverture » sans en faire une erreur', async () => {
    const { client, appels } = fauxClient({ data: { trouve: false } })
    expect(await creerAssistantSupabase(client).couverture({ ref: { source: 'google_books', id: 'zyTCAlFPjgYC' } })).toEqual({ ok: true, valeur: null })
    expect(appels[0].corps).toEqual({ action: 'couverture', ref: { source: 'google_books', id: 'zyTCAlFPjgYC' } })
  })

  it('demande d’autres couvertures, et rend les propositions sans image', async () => {
    const propositions = [
      { ref: { source: 'google_books', id: 'zyTCAlFPjgYC' }, editeur: 'Gallimard', collection: 'Folio', annee: 2013, langue: 'fr', source: 'google_books' },
      { ref: { source: 'open_library', numero: 15166217 }, editeur: null, collection: null, annee: null, langue: null, source: 'open_library' },
    ]
    const { client, appels } = fauxClient({ data: { propositions, sources: SOURCES } })
    const demande = { titre: 'L’Étranger', auteur: 'Albert Camus', langue: 'fr' as const, isbn: '9782070360024', editeur: 'Gallimard' }
    expect(await creerAssistantSupabase(client).autresCouvertures(demande)).toEqual({ ok: true, valeur: propositions })
    expect(appels[0].corps).toEqual({ action: 'autres_couvertures', ...demande })
  })

  it('écarte une proposition mal formée, et ne croit pas une réponse sans liste', async () => {
    const bonne = { ref: { source: 'open_library', numero: 7 }, editeur: null, collection: null, annee: null, langue: null, source: 'open_library' }
    const melange = fauxClient({ data: { propositions: [bonne, { ref: 'https://exemple.test/x.jpg' }, null, { ref: { source: 'ailleurs', id: 'x' } }] } })
    expect(await creerAssistantSupabase(melange.client).autresCouvertures({ titre: 'Momo', langue: 'fr' })).toEqual({ ok: true, valeur: [bonne] })
    const bancale = fauxClient({ data: { propositions: 'aucune' } })
    expect(await creerAssistantSupabase(bancale.client).autresCouvertures({ titre: 'Momo', langue: 'fr' })).toEqual({ ok: false, echec: 'indisponible' })
  })

  it('demande une fiche en n’envoyant que l’œuvre', async () => {
    const fiche = { synopsis: null, genres: [], themes: [], atmospheres: [], themesNouveaux: [], tonalite: null, exigence: null, longueur: null }
    const { client, appels } = fauxClient({ data: fiche })
    const oeuvre = { titre: 'Momo', auteurs: ['Michael Ende'], descriptions: [] }
    expect(await creerAssistantSupabase(client).proposerFiche(oeuvre)).toEqual({ ok: true, valeur: fiche })
    expect(appels[0].corps).toEqual({ action: 'fiche', oeuvre })
  })

  it('traduit les refus de la fonction dans les mots de l’appli', async () => {
    const cas: [unknown, string][] = [
      [refus('limite', 429), 'limite'],
      [refus('non_configure', 503), 'non_configure'],
      [refus('ia', 502), 'ia'],
      [refus('panne', 503), 'indisponible'],
      [refus('connexion', 401), 'indisponible'],
      [refus('entree', 400), 'indisponible'],
      // La fonction n'est pas encore en ligne, ou la passerelle répond autre chose que du JSON.
      [{ name: 'FunctionsHttpError', context: new Response('Not Found', { status: 404 }) }, 'indisponible'],
      [{ name: 'FunctionsRelayError' }, 'indisponible'],
      [{ name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function' }, 'reseau'],
    ]
    for (const [error, attendu] of cas) {
      const { client } = fauxClient({ error })
      expect(await creerAssistantSupabase(client).chercherIsbn('9782747024693')).toEqual({ ok: false, echec: attendu })
    }
  })

  it('ne plante pas si l’appel lui-même échoue', async () => {
    const { client } = fauxClient(() => {
      throw new TypeError('Failed to fetch')
    })
    expect(await creerAssistantSupabase(client).chercherTitre('Momo')).toEqual({ ok: false, echec: 'reseau' })
  })

  it('tient une réponse inattendue pour une indisponibilité, pas pour un résultat', async () => {
    for (const data of [null, 'texte', { autre: 'chose' }, { trouve: 'oui' }]) {
      const { client } = fauxClient({ data })
      expect(await creerAssistantSupabase(client).chercherIsbn('9782747024693')).toEqual({ ok: false, echec: 'indisponible' })
    }
    const sansImage = fauxClient({ data: { trouve: true, source: 'bnf' } })
    expect(await creerAssistantSupabase(sansImage.client).couverture({ isbn: '9782747024693' })).toEqual({ ok: false, echec: 'indisponible' })
    const ficheBancale = fauxClient({ data: { synopsis: 12 } })
    expect(await creerAssistantSupabase(ficheBancale.client).proposerFiche({ titre: 'Momo', auteurs: [], descriptions: [] })).toEqual({
      ok: false,
      echec: 'indisponible',
    })
  })
})
