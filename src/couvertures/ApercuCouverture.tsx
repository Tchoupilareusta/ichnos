import type { ImageTrouvee } from '../ajout/assistant'
import { libelleSource } from '../ajout/preremplir'
import { Bouton } from '../composants/Bouton'
import { Couverture } from './Couverture'
import { estPetite } from './reduction'

/**
 * La couverture trouvée par la recherche, avant validation : je la vois, et je peux ne pas la
 * garder. Rien n'est rangé tant que je n'ai pas validé. Une image de moins de 450 px de large
 * est dite « de petite taille ».
 */
export function ApercuCouverture({
  titre,
  cherche,
  trouvee,
  adresse,
  garder,
  setGarder,
}: {
  titre: string
  cherche: boolean
  trouvee: ImageTrouvee | null
  adresse: string | null
  garder: boolean
  setGarder: (garder: boolean) => void
}) {
  const visible = trouvee !== null && garder
  const petite = trouvee !== null && estPetite(trouvee)
  return (
    <section aria-label="Couverture" data-etat={visible ? 'image' : 'typographique'} className="flex flex-wrap items-center gap-5">
      <Couverture titre={titre || 'Sans titre'} graine="apercu" apercu={visible ? adresse : null} className="w-24 shrink-0" />
      <div className="flex min-w-0 flex-[1_1_12rem] flex-col items-start gap-2">
        {cherche ? (
          <p role="status" className="m-0 text-[0.9375rem] text-discret">
            Je cherche la couverture…
          </p>
        ) : trouvee === null ? (
          <p className="m-0 text-[0.9375rem] text-discret">Pas de couverture trouvée : celle d’Ichnos s’affichera.</p>
        ) : garder ? (
          <>
            <p className="m-0 text-[0.9375rem]">
              Couverture trouvée sur {libelleSource(trouvee.source)}
              {petite ? ', de petite taille' : ''}.
            </p>
            <Bouton variante="secondaire" onClick={() => setGarder(false)} className="min-h-11 px-5">
              Ne pas la garder
            </Bouton>
          </>
        ) : (
          <>
            <p className="m-0 text-[0.9375rem] text-discret">Cette couverture ne sera pas gardée : celle d’Ichnos s’affichera.</p>
            <Bouton variante="secondaire" onClick={() => setGarder(true)} className="min-h-11 px-5">
              La garder finalement
            </Bouton>
          </>
        )}
      </div>
    </section>
  )
}
