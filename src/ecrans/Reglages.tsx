import { useState } from 'react'
import { Bouton } from '../composants/Bouton'
import { Page, TitrePage } from '../composants/Page'
import { CouverturesManquantes } from '../couvertures/CouverturesManquantes'
import { useSession } from '../session/Session'
import { appliquerTheme, lireChoixTheme, type ChoixTheme } from '../theme/theme'

const CHOIX: { valeur: ChoixTheme; libelle: string }[] = [
  { valeur: 'auto', libelle: 'Comme l’appareil' },
  { valeur: 'clair', libelle: 'Clair' },
  { valeur: 'sombre', libelle: 'Sombre' },
]

export function Reglages() {
  const [theme, setTheme] = useState<ChoixTheme>(lireChoixTheme)

  const choisir = (valeur: ChoixTheme) => {
    setTheme(valeur)
    appliquerTheme(valeur)
  }

  return (
    <Page>
      <TitrePage>Réglages</TitrePage>
      <fieldset className="m-0 flex max-w-xl flex-col gap-3 border-0 p-0">
        <legend className="mb-3 p-0 font-titre text-2xl">Thème</legend>
        <div className="flex flex-wrap gap-2.5">
          {CHOIX.map(({ valeur, libelle }) => (
            <label
              key={valeur}
              className={`flex min-h-12 cursor-pointer items-center rounded-pilule border px-5 text-[0.9375rem] transition-colors duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-accent-texte ${
                theme === valeur
                  ? 'border-accent bg-accent font-bold text-sur-accent'
                  : 'border-bordure bg-surface font-semibold text-encre'
              }`}
            >
              <input
                type="radio"
                name="theme"
                value={valeur}
                checked={theme === valeur}
                onChange={() => choisir(valeur)}
                className="sr-only"
              />
              {libelle}
            </label>
          ))}
        </div>
      </fieldset>
      <CouverturesManquantes />
      <MonCompte />
    </Page>
  )
}

function MonCompte() {
  const { auth, compte, couvertures } = useSession()
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function meDeconnecter() {
    setOccupe(true)
    setErreur(null)
    const resultat = await auth.deconnecter()
    // En cas de succès, l'appli repasse d'elle-même à l'écran de connexion,
    // et les couvertures gardées sur l'appareil sont effacées.
    if (resultat.ok) return void couvertures.oublier()
    setOccupe(false)
    setErreur(
      resultat.echec === 'reseau'
        ? 'Pas de connexion à internet : la déconnexion attendra le retour du réseau.'
        : 'La déconnexion n’a pas abouti. Réessayer dans un instant.',
    )
  }

  return (
    <section aria-labelledby="mon-compte" className="flex max-w-xl flex-col items-start gap-3">
      <h2 id="mon-compte" className="m-0 font-titre text-2xl">
        Mon compte
      </h2>
      <p className="m-0 mb-1 break-all text-discret">{compte.email}</p>
      <Bouton variante="secondaire" occupe={occupe} onClick={meDeconnecter}>
        Me déconnecter
      </Bouton>
      {erreur && (
        <p role="alert" className="m-0 rounded-carte bg-accent-doux px-5 py-3 text-[0.9375rem] leading-snug text-accent-texte">
          {erreur}
        </p>
      )}
    </section>
  )
}
