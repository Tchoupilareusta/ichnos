import { useState } from 'react'
import { Page, TitrePage } from '../composants/Page'
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
    </Page>
  )
}
