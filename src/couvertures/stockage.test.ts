import { creerCouverturesSupabase, type ClientStockage } from './stockage'

const MOI = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const image = (contenu = 'image-de-couverture', type = 'image/jpeg') => new Blob([contenu], { type })

/** Un faux cache du navigateur (Cache Storage), en mémoire. */
function fauxCaches() {
  const boites = new Map<string, Map<string, Response>>()
  const caches = {
    open: async (nom: string) => {
      if (!boites.has(nom)) boites.set(nom, new Map())
      const boite = boites.get(nom) as Map<string, Response>
      return {
        match: async (cle: string) => boite.get(cle)?.clone(),
        put: async (cle: string, reponse: Response) => void boite.set(cle, reponse),
        delete: async (cle: string) => boite.delete(cle),
      }
    },
    delete: async (nom: string) => boites.delete(nom),
  } as unknown as CacheStorage
  return { caches, boites }
}

type Options = {
  /** La réduction appliquée avant le rangement (par défaut : l'image est rendue telle quelle). */
  reduire?: (image: Blob) => Promise<Blob>
  session?: boolean
  envoi?: { error: unknown }
  signature?: 'ok' | 'panne'
  telechargement?: 'ok' | 'panne'
}

function monde(options: Options = {}, partage?: ReturnType<typeof fauxCaches>) {
  const envois: { chemin: string; type: string | undefined; ecraser: boolean | undefined }[] = []
  const corps: Blob[] = []
  const signatures: string[][] = []
  const telechargements: string[] = []
  const cache = partage ?? fauxCaches()
  let numero = 0

  const client = {
    auth: { getSession: async () => ({ data: { session: options.session === false ? null : { user: { id: MOI } } }, error: null }) },
    storage: {
      from: (seau: string) => ({
        upload: async (chemin: string, envoye: Blob, reglages: { contentType?: string; upsert?: boolean }) => {
          corps.push(envoye)
          envois.push({ chemin: `${seau}:${chemin}`, type: reglages.contentType, ecraser: reglages.upsert })
          return options.envoi ?? { data: { path: chemin }, error: null }
        },
        createSignedUrls: async (chemins: string[]) => {
          signatures.push(chemins)
          if (options.signature === 'panne') return { data: null, error: { message: 'Failed to fetch' } }
          return { data: chemins.map((path) => ({ path, signedUrl: `https://stockage.test/${path}?jeton=${++numero}`, error: null })), error: null }
        },
      }),
    },
  } as unknown as ClientStockage

  const couvertures = creerCouverturesSupabase(client, {
    caches: cache.caches,
    recuperer: async (adresse) => {
      telechargements.push(String(adresse))
      if (options.telechargement === 'panne') throw new TypeError('Failed to fetch')
      return new Response(image('octets-venus-du-stockage'), { status: 200, headers: { 'content-type': 'image/jpeg' } })
    },
    creerAdresse: (blob) => `blob:essai/${blob.size}-${++numero}`,
    libererAdresse: () => {},
    reduire: options.reduire ?? (async (blob) => blob),
  })
  return { couvertures, envois, corps, signatures, telechargements, cache }
}

describe('déposer une couverture', () => {
  it('la range dans mon dossier, sous un nom tiré de son contenu', async () => {
    const { couvertures, envois } = monde()
    const depose = await couvertures.deposer(image())
    if (!depose.ok) throw new Error('dépôt attendu')
    expect(depose.chemin).toMatch(new RegExp(`^${MOI}/[0-9a-f]{32}\\.jpg$`))
    expect(envois).toEqual([{ chemin: `couvertures:${depose.chemin}`, type: 'image/jpeg', ecraser: false }])
  })

  it('donne le même nom à la même image, et un autre à une image différente', async () => {
    const { couvertures } = monde()
    const [a, b, c] = await Promise.all([couvertures.deposer(image('une')), couvertures.deposer(image('une')), couvertures.deposer(image('autre', 'image/png'))])
    if (!a.ok || !b.ok || !c.ok) throw new Error('dépôts attendus')
    expect(a.chemin).toBe(b.chemin)
    expect(c.chemin).not.toBe(a.chemin)
    expect(c.chemin).toMatch(/\.png$/)
  })

  it('range l’image réduite, pas l’image d’origine : 1200 px au plus, en JPEG', async () => {
    const reduite = image('image-reduite', 'image/jpeg')
    const vues: Blob[] = []
    const { couvertures, envois, corps } = monde({
      reduire: async (origine) => {
        vues.push(origine)
        return reduite
      },
    })
    const origine = image('grande-image-d-origine-en-png', 'image/png')
    const depose = await couvertures.deposer(origine)
    if (!depose.ok) throw new Error('dépôt attendu')
    expect(vues).toEqual([origine])
    // Le nom, l'extension et le contenu envoyé sont ceux de l'image réduite.
    expect(depose.chemin).toMatch(/\.jpg$/)
    expect(corps).toEqual([reduite])
    expect(envois[0].type).toBe('image/jpeg')
    const directe = await monde().couvertures.deposer(reduite)
    expect(directe.ok && directe.chemin).toBe(depose.chemin)
  })

  it('range l’image telle quelle si la réduction échoue', async () => {
    const { couvertures, corps } = monde({
      reduire: async () => {
        throw new Error('toile indisponible')
      },
    })
    const origine = image()
    expect((await couvertures.deposer(origine)).ok).toBe(true)
    expect(corps).toEqual([origine])
  })

  it('tient pour réussie une image déjà rangée', async () => {
    const { couvertures } = monde({ envoi: { error: { statusCode: '409', message: 'The resource already exists' } } })
    expect((await couvertures.deposer(image())).ok).toBe(true)
  })

  it('refuse ce qui n’est pas une image jpg, png ou webp, sans rien envoyer', async () => {
    const { couvertures, envois } = monde()
    expect(await couvertures.deposer(image('<svg/>', 'image/svg+xml'))).toEqual({ ok: false, echec: 'inconnu' })
    expect(await couvertures.deposer(image('texte', 'text/html'))).toEqual({ ok: false, echec: 'inconnu' })
    expect(envois).toHaveLength(0)
  })

  it('ne dépose rien sans compte connecté', async () => {
    const { couvertures, envois } = monde({ session: false })
    expect(await couvertures.deposer(image())).toEqual({ ok: false, echec: 'inconnu' })
    expect(envois).toHaveLength(0)
  })

  it('distingue l’absence de réseau d’un autre refus', async () => {
    const coupe = monde({ envoi: { error: { message: 'Failed to fetch' } } })
    expect(await coupe.couvertures.deposer(image())).toEqual({ ok: false, echec: 'reseau' })
    const refuse = monde({ envoi: { error: { statusCode: '403', message: 'new row violates row-level security policy' } } })
    expect(await refuse.couvertures.deposer(image())).toEqual({ ok: false, echec: 'inconnu' })
  })
})

describe('afficher une couverture', () => {
  const CHEMIN = `${MOI}/0123456789abcdef0123456789abcdef.jpg`

  it('demande une adresse signée, télécharge l’image et la garde sur l’appareil', async () => {
    const { couvertures, signatures, telechargements, cache } = monde()
    const adresse = await couvertures.adresse(CHEMIN)
    expect(adresse).toMatch(/^blob:essai\//)
    expect(signatures).toEqual([[CHEMIN]])
    expect(telechargements).toHaveLength(1)
    expect(telechargements[0]).toContain('jeton=')
    expect([...(cache.boites.get('ichnos-couvertures')?.keys() ?? [])]).toEqual([`/__couvertures/${CHEMIN}`])
  })

  it('ne redemande rien pour une couverture déjà affichée', async () => {
    const { couvertures, signatures, telechargements } = monde()
    const premiere = await couvertures.adresse(CHEMIN)
    expect(await couvertures.adresse(CHEMIN)).toBe(premiere)
    expect(signatures).toHaveLength(1)
    expect(telechargements).toHaveLength(1)
  })

  it('après une réouverture de l’appli, la retrouve sur l’appareil sans réseau', async () => {
    const premier = monde()
    await premier.couvertures.adresse(CHEMIN)
    // Une nouvelle ouverture, hors connexion : même cache du navigateur, plus aucun service.
    const second = monde({ signature: 'panne', telechargement: 'panne' }, premier.cache)
    expect(await second.couvertures.adresse(CHEMIN)).toMatch(/^blob:essai\//)
    expect(second.signatures).toHaveLength(0)
    expect(second.telechargements).toHaveLength(0)
  })

  it('regroupe en une seule demande les couvertures d’une même page', async () => {
    const { couvertures, signatures } = monde()
    const chemins = ['a', 'b', 'c'].map((lettre) => `${MOI}/${lettre.repeat(32)}.jpg`)
    const adresses = await Promise.all(chemins.map((chemin) => couvertures.adresse(chemin)))
    expect(adresses.every((adresse) => adresse?.startsWith('blob:essai/'))).toBe(true)
    expect(signatures).toEqual([chemins])
  })

  it('rend null hors connexion pour une couverture jamais vue, et réessaie la fois suivante', async () => {
    const cache = fauxCaches()
    const coupe = monde({ signature: 'panne' }, cache)
    expect(await coupe.couvertures.adresse(CHEMIN)).toBeNull()
    expect(await coupe.couvertures.adresse(CHEMIN)).toBeNull()
    expect(coupe.signatures).toHaveLength(2)

    const telechargementCoupe = monde({ telechargement: 'panne' }, cache)
    expect(await telechargementCoupe.couvertures.adresse(CHEMIN)).toBeNull()
  })
})

describe('oublier', () => {
  const CHEMIN = `${MOI}/0123456789abcdef0123456789abcdef.jpg`

  it('à la déconnexion, efface les couvertures gardées sur l’appareil', async () => {
    const { couvertures, cache } = monde()
    await couvertures.adresse(CHEMIN)
    await couvertures.oublier()
    expect(cache.boites.has('ichnos-couvertures')).toBe(false)
  })
})
