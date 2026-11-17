import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Bouton } from '../composants/Bouton'
import type { Auth, Echec } from '../session/auth'

const MESSAGES: Record<Echec, string> = {
  code: 'Ce code n’est pas le bon, ou il a expiré. Je peux en redemander un.',
  trop: 'Trop de demandes d’affilée. Je patiente une minute avant de réessayer.',
  reseau: 'Pas de connexion à internet. Je réessaie quand le réseau revient.',
  inconnu: 'La connexion n’a pas abouti. Je réessaie dans un instant.',
}

const ADRESSE_MANQUANTE = 'J’indique d’abord mon adresse e-mail.'

// Bordure en « discret » plutôt qu'en « bordure » : le contour d'un champ vide doit rester
// visible (contraste d'au moins 3:1 avec le fond, WCAG 1.4.11).
const CHAMP =
  'min-h-12 w-full rounded-pilule border border-discret bg-surface px-5 text-base text-encre caret-accent-texte placeholder:text-discret aria-invalid:border-accent-texte'

/** Cadre des écrans d'entrée (connexion, appli non configurée) : le nom, une phrase, puis le contenu. */
function CadreEntree({ children }: { children: ReactNode }) {
  return (
    <main
      id="contenu"
      tabIndex={-1}
      className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center gap-9 pr-[max(1.5rem,env(safe-area-inset-right))] pl-[max(1.5rem,env(safe-area-inset-left))] outline-none"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 2rem)',
        // Un peu plus d'air en bas : le bloc se pose légèrement au-dessus du centre, hors du clavier.
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 6rem)',
      }}
    >
      <header className="flex flex-col gap-3">
        <h1 className="m-0 font-titre text-[2.75rem] leading-none italic text-accent-texte">Ichnos</h1>
        <p className="m-0 text-discret">Ma bibliothèque personnelle de lecture.</p>
      </header>
      {children}
    </main>
  )
}

function Alerte({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="m-0 rounded-carte bg-accent-doux px-5 py-3 text-[0.9375rem] leading-snug text-accent-texte">
      {children}
    </p>
  )
}

/** Connexion par code à 6 chiffres reçu par e-mail. */
export function Connexion({ auth }: { auth: Auth }) {
  const [etape, setEtape] = useState<'adresse' | 'code'>('adresse')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [codeRefuse, setCodeRefuse] = useState(false)

  const champEmail = useRef<HTMLInputElement>(null)
  const champCode = useRef<HTMLInputElement>(null)
  const premierAffichage = useRef(true)

  // À chaque changement d'étape, le curseur va dans le champ à remplir.
  // Pas à l'ouverture : sur iPhone, cela ferait surgir le clavier sans qu'on l'ait demandé.
  useEffect(() => {
    if (premierAffichage.current) {
      premierAffichage.current = false
      return
    }
    ;(etape === 'code' ? champCode : champEmail).current?.focus()
  }, [etape])

  async function demanderCode(evenement: FormEvent) {
    evenement.preventDefault()
    if (occupe) return
    const adresse = email.trim()
    if (!adresse) {
      setErreur(ADRESSE_MANQUANTE)
      champEmail.current?.focus()
      return
    }
    setOccupe(true)
    setErreur(null)
    const resultat = await auth.demanderCode(adresse)
    setOccupe(false)
    if (!resultat.ok) {
      setErreur(MESSAGES[resultat.echec])
      return
    }
    setEmail(adresse)
    setCode('')
    setCodeRefuse(false)
    setEtape('code')
  }

  async function verifierCode(evenement: FormEvent) {
    evenement.preventDefault()
    if (occupe) return
    if (code.length !== 6) {
      setErreur('Le code compte 6 chiffres.')
      setCodeRefuse(true)
      champCode.current?.focus()
      return
    }
    setOccupe(true)
    setErreur(null)
    setCodeRefuse(false)
    const resultat = await auth.verifierCode(email, code)
    setOccupe(false)
    if (!resultat.ok) {
      setErreur(MESSAGES[resultat.echec])
      setCodeRefuse(resultat.echec === 'code')
      champCode.current?.focus()
    }
    // En cas de succès, l'appli reçoit la nouvelle session et remplace cet écran.
  }

  function revenirALAdresse() {
    setErreur(null)
    setCodeRefuse(false)
    setEtape('adresse')
  }

  if (etape === 'adresse') {
    return (
      <CadreEntree>
        <form noValidate onSubmit={demanderCode} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="connexion-email" className="px-1 text-[0.9375rem] font-semibold">
              Mon adresse e-mail
            </label>
            <input
              ref={champEmail}
              id="connexion-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(evenement) => setEmail(evenement.target.value)}
              aria-invalid={erreur === ADRESSE_MANQUANTE || undefined}
              aria-describedby={erreur ? 'connexion-erreur' : 'connexion-aide'}
              className={CHAMP}
            />
            <p id="connexion-aide" className="m-0 px-1 text-sm text-discret">
              J’y reçois un code à 6 chiffres, sans mot de passe.
            </p>
          </div>
          {erreur && <Alerte id="connexion-erreur">{erreur}</Alerte>}
          <Bouton type="submit" occupe={occupe}>
            {occupe ? 'Envoi du code…' : 'Recevoir mon code'}
          </Bouton>
        </form>
      </CadreEntree>
    )
  }

  return (
    <CadreEntree>
      <form noValidate onSubmit={verifierCode} className="flex flex-col gap-5">
        <p id="connexion-aide" className="m-0 leading-relaxed">
          Si <strong className="font-bold break-all">{email}</strong> est bien l’adresse de mon compte, un code à
          6&nbsp;chiffres vient d’y être envoyé.
        </p>
        <div className="flex flex-col gap-2">
          <label htmlFor="connexion-code" className="px-1 text-[0.9375rem] font-semibold">
            Code reçu par e-mail
          </label>
          <input
            ref={champCode}
            id="connexion-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(evenement) => {
              setCode(evenement.target.value.replace(/\D/g, '').slice(0, 6))
              setCodeRefuse(false)
            }}
            aria-invalid={codeRefuse || undefined}
            aria-describedby={erreur ? 'connexion-erreur' : 'connexion-aide'}
            className={`${CHAMP} h-14 text-center text-[1.5rem] font-semibold tracking-[0.3em] indent-[0.3em] tabular-nums`}
          />
        </div>
        {erreur && <Alerte id="connexion-erreur">{erreur}</Alerte>}
        <Bouton type="submit" occupe={occupe}>
          {occupe ? 'Vérification…' : 'Ouvrir ma bibliothèque'}
        </Bouton>
        <button
          type="button"
          onClick={revenirALAdresse}
          className="min-h-11 cursor-pointer self-center rounded-pilule px-4 text-[0.9375rem] font-semibold text-discret underline decoration-bordure underline-offset-4"
        >
          Changer d’adresse ou redemander un code
        </button>
      </form>
    </CadreEntree>
  )
}

/** Affiché tant que l'adresse et la clé publique du projet Supabase ne sont pas renseignées. */
export function NonConfigure() {
  return (
    <CadreEntree>
      <div className="flex flex-col gap-3">
        <p className="m-0 leading-relaxed">La connexion à ma bibliothèque n’est pas encore configurée.</p>
        <p className="m-0 text-sm leading-relaxed text-discret">
          Il manque l’adresse et la clé publique du projet Supabase : dans le fichier .env sur l’ordinateur, ou dans les
          variables du dépôt GitHub pour le site publié.
        </p>
      </div>
    </CadreEntree>
  )
}
