import { creerAuthSupabase, type ClientAuth } from './authSupabase'

type Reponses = {
  session?: { user: { email?: string } } | null
  erreurSession?: object | null
  erreurDemande?: object | null
  erreurVerification?: object | null
  erreurDeconnexion?: object | null
}

type Ecouteur = (evenement: string, session: { user: { email?: string } } | null) => void

/** Faux client Supabase : il note ce qu'on lui demande et répond ce qu'on lui a dit. */
function fauxClient(reponses: Reponses = {}) {
  const appels = { signInWithOtp: [] as unknown[], verifyOtp: [] as unknown[], signOut: [] as unknown[], arrets: 0 }
  const ecouteurs: Ecouteur[] = []
  const emettre: Ecouteur = (evenement, session) => ecouteurs.forEach((ecouteur) => ecouteur(evenement, session))
  const client = {
    auth: {
      getSession: async () => ({ data: { session: reponses.session ?? null }, error: reponses.erreurSession ?? null }),
      onAuthStateChange: (ecouteur: Ecouteur) => {
        ecouteurs.push(ecouteur)
        return { data: { subscription: { unsubscribe: () => void (appels.arrets += 1) } } }
      },
      signInWithOtp: async (demande: unknown) => {
        appels.signInWithOtp.push(demande)
        return { error: reponses.erreurDemande ?? null }
      },
      verifyOtp: async (demande: unknown) => {
        appels.verifyOtp.push(demande)
        return { error: reponses.erreurVerification ?? null }
      },
      signOut: async (options: unknown) => {
        appels.signOut.push(options)
        return { error: reponses.erreurDeconnexion ?? null }
      },
    },
  } as unknown as ClientAuth
  return { client, appels, emettre }
}

const sansMemoire = () => null
const ERREUR_RESEAU = { name: 'AuthRetryableFetchError', status: 0 }

describe('demander un code', () => {
  it('ne crée jamais de compte', async () => {
    const { client, appels } = fauxClient()
    const resultat = await creerAuthSupabase(client, sansMemoire).demanderCode('  moi@exemple.test ')
    expect(resultat).toEqual({ ok: true })
    expect(appels.signInWithOtp).toEqual([{ email: 'moi@exemple.test', options: { shouldCreateUser: false } }])
  })

  it('ne révèle pas qu’une adresse est inconnue', async () => {
    const { client } = fauxClient({ erreurDemande: { status: 422, code: 'otp_disabled' } })
    expect(await creerAuthSupabase(client, sansMemoire).demanderCode('inconnu@exemple.test')).toEqual({ ok: true })
  })

  it('signale des demandes trop rapprochées', async () => {
    const { client } = fauxClient({ erreurDemande: { status: 429, code: 'over_email_send_rate_limit' } })
    expect(await creerAuthSupabase(client, sansMemoire).demanderCode('moi@exemple.test')).toEqual({ ok: false, echec: 'trop' })
  })

  it('signale l’absence de réseau', async () => {
    const { client } = fauxClient({ erreurDemande: ERREUR_RESEAU })
    expect(await creerAuthSupabase(client, sansMemoire).demanderCode('moi@exemple.test')).toEqual({ ok: false, echec: 'reseau' })
  })

  it('signale une panne du service', async () => {
    const { client } = fauxClient({ erreurDemande: { status: 500, code: 'unexpected_failure' } })
    expect(await creerAuthSupabase(client, sansMemoire).demanderCode('moi@exemple.test')).toEqual({ ok: false, echec: 'inconnu' })
  })
})

describe('vérifier un code', () => {
  it('envoie l’adresse et le code reçus par e-mail', async () => {
    const { client, appels } = fauxClient()
    const resultat = await creerAuthSupabase(client, sansMemoire).verifierCode('moi@exemple.test', '123456')
    expect(resultat).toEqual({ ok: true })
    expect(appels.verifyOtp).toEqual([{ email: 'moi@exemple.test', token: '123456', type: 'email' }])
  })

  it('refuse un code faux ou expiré', async () => {
    const { client } = fauxClient({ erreurVerification: { status: 403, code: 'otp_expired' } })
    expect(await creerAuthSupabase(client, sansMemoire).verifierCode('moi@exemple.test', '000000')).toEqual({ ok: false, echec: 'code' })
  })

  it('signale l’absence de réseau', async () => {
    const { client } = fauxClient({ erreurVerification: ERREUR_RESEAU })
    expect(await creerAuthSupabase(client, sansMemoire).verifierCode('moi@exemple.test', '123456')).toEqual({ ok: false, echec: 'reseau' })
  })
})

describe('compte actuel', () => {
  it('rend le compte de la session en cours', async () => {
    const { client } = fauxClient({ session: { user: { email: 'moi@exemple.test' } } })
    expect(await creerAuthSupabase(client, sansMemoire).compteActuel()).toEqual({ email: 'moi@exemple.test' })
  })

  it('ne rend personne sans session', async () => {
    const { client } = fauxClient()
    expect(await creerAuthSupabase(client, sansMemoire).compteActuel()).toBeNull()
  })

  it('garde le compte mémorisé quand le réseau manque, pour la consultation hors connexion', async () => {
    const { client } = fauxClient({ erreurSession: ERREUR_RESEAU })
    const memoire = () => JSON.stringify({ user: { email: 'moi@exemple.test' } })
    expect(await creerAuthSupabase(client, memoire).compteActuel()).toEqual({ email: 'moi@exemple.test' })
  })

  it('ne se fie pas à la mémoire quand la session est refusée', async () => {
    const { client } = fauxClient({ erreurSession: { status: 400, code: 'refresh_token_not_found' } })
    const memoire = () => JSON.stringify({ user: { email: 'moi@exemple.test' } })
    expect(await creerAuthSupabase(client, memoire).compteActuel()).toBeNull()
  })

  it('ignore une mémoire illisible', async () => {
    const { client } = fauxClient({ erreurSession: ERREUR_RESEAU })
    expect(await creerAuthSupabase(client, () => 'pas du json').compteActuel()).toBeNull()
  })
})

describe('se déconnecter', () => {
  it('ne ferme que la session de cet appareil', async () => {
    const { client, appels } = fauxClient()
    expect(await creerAuthSupabase(client, sansMemoire).deconnecter()).toEqual({ ok: true })
    expect(appels.signOut).toEqual([{ scope: 'local' }])
  })

  it('signale l’absence de réseau', async () => {
    const { client } = fauxClient({ erreurDeconnexion: ERREUR_RESEAU })
    expect(await creerAuthSupabase(client, sansMemoire).deconnecter()).toEqual({ ok: false, echec: 'reseau' })
  })
})

describe('suivre les changements', () => {
  it('prévient à la connexion et à la déconnexion', () => {
    const { client, emettre } = fauxClient()
    const recus: unknown[] = []
    creerAuthSupabase(client, sansMemoire).surChangement((compte) => recus.push(compte))
    emettre('SIGNED_IN', { user: { email: 'moi@exemple.test' } })
    emettre('SIGNED_OUT', null)
    expect(recus).toEqual([{ email: 'moi@exemple.test' }, null])
  })

  it('laisse le démarrage à compteActuel, qui sait gérer l’absence de réseau', () => {
    const { client, emettre } = fauxClient()
    const recus: unknown[] = []
    creerAuthSupabase(client, sansMemoire).surChangement((compte) => recus.push(compte))
    emettre('INITIAL_SESSION', null)
    expect(recus).toEqual([])
  })

  it('arrête l’écoute sur demande', () => {
    const { client, appels } = fauxClient()
    creerAuthSupabase(client, sansMemoire).surChangement(() => {})()
    expect(appels.arrets).toBe(1)
  })
})
