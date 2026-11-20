import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Bouton } from '../composants/Bouton'
import type { Auth, Echec } from '../session/auth'

const MESSAGES: Record<Echec, string> = {
  identifiants: 'L’adresse ou le mot de passe ne correspond pas.',
  trop: 'Trop d’essais d’affilée. Patienter une minute avant de réessayer.',
  reseau: 'Pas de connexion à internet. Réessayer au retour du réseau.',
  inconnu: 'La connexion n’a pas abouti. Réessayer dans un instant.',
}

type Refus = { message: string; champs: ('email' | 'motDePasse')[] }

// Bordure en « discret » plutôt qu'en « bordure » : le contour d'un champ vide doit rester
// visible (contraste d'au moins 3:1 avec le fond, WCAG 1.4.11).
const CHAMP =
  'min-h-12 w-full rounded-pilule border border-discret bg-surface px-5 text-base text-encre caret-accent-texte aria-invalid:border-accent-texte'

const LIBELLE = 'px-1 text-[0.9375rem] font-semibold'

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

/**
 * Connexion par e-mail et mot de passe.
 *
 * Un vrai formulaire, avec les noms et attributs `autocomplete` que les gestionnaires de mots
 * de passe reconnaissent (Bitwarden sur iPhone). Les champs ne sont pas pilotés par React :
 * leurs valeurs sont lues au moment de l'envoi, pour prendre aussi ce qu'un remplissage
 * automatique y a écrit sans prévenir la page.
 *
 * Volontairement absent : inscription et « mot de passe oublié ». Le compte se gère depuis Supabase.
 */
export function Connexion({ auth }: { auth: Auth }) {
  const [occupe, setOccupe] = useState(false)
  const [refus, setRefus] = useState<Refus | null>(null)
  const champEmail = useRef<HTMLInputElement>(null)
  const champMotDePasse = useRef<HTMLInputElement>(null)

  async function seConnecter(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault()
    if (occupe) return

    const email = (champEmail.current?.value ?? '').trim()
    const motDePasse = champMotDePasse.current?.value ?? ''
    if (!email) {
      setRefus({ message: 'Indiquer d’abord mon adresse e-mail.', champs: ['email'] })
      champEmail.current?.focus()
      return
    }
    if (!motDePasse) {
      setRefus({ message: 'Indiquer aussi mon mot de passe.', champs: ['motDePasse'] })
      champMotDePasse.current?.focus()
      return
    }

    setOccupe(true)
    setRefus(null)
    const resultat = await auth.seConnecter(email, motDePasse)
    setOccupe(false)
    // En cas de succès, l'appli reçoit la nouvelle session et remplace cet écran.
    if (resultat.ok) return

    if (resultat.echec === 'identifiants') {
      setRefus({ message: MESSAGES.identifiants, champs: ['email', 'motDePasse'] })
      if (champMotDePasse.current) {
        champMotDePasse.current.value = ''
        champMotDePasse.current.focus()
      }
      return
    }
    setRefus({ message: MESSAGES[resultat.echec], champs: [] })
  }

  const decrit = refus ? 'connexion-erreur' : undefined

  return (
    <CadreEntree>
      <form noValidate onSubmit={seConnecter} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="connexion-email" className={LIBELLE}>
            Mon adresse e-mail
          </label>
          <input
            ref={champEmail}
            id="connexion-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={refus?.champs.includes('email') || undefined}
            aria-describedby={decrit}
            className={CHAMP}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="connexion-mot-de-passe" className={LIBELLE}>
            Mon mot de passe
          </label>
          <input
            ref={champMotDePasse}
            id="connexion-mot-de-passe"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={refus?.champs.includes('motDePasse') || undefined}
            aria-describedby={decrit}
            className={CHAMP}
          />
        </div>
        {refus && (
          <p
            id="connexion-erreur"
            role="alert"
            className="m-0 rounded-carte bg-accent-doux px-5 py-3 text-[0.9375rem] leading-snug text-accent-texte"
          >
            {refus.message}
          </p>
        )}
        <Bouton type="submit" occupe={occupe} className="mt-1">
          {occupe ? 'Connexion…' : 'Ouvrir ma bibliothèque'}
        </Bouton>
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
