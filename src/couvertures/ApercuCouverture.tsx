import { useEffect, useMemo, useRef } from 'react'
import type { ImageTrouvee } from '../ajout/assistant'
import { libelleSource } from '../ajout/preremplir'
import { Bouton } from '../composants/Bouton'
import { AutresCouvertures, type RechercheCouvertures } from './AutresCouvertures'
import { ChoisirImage, ConseilPhoto, type OuvrirImage } from './ChoisirImage'
import { Couverture } from './Couverture'
import { estPetite } from './reduction'

/** Une image que j'apporte moi-même quand aucune couverture n'est trouvée : la photo de mon exemplaire, ou une autre édition. */
export type CouvertureChoisie = { image: Blob; origine: 'photo' | 'autre_edition' }

/**
 * Quand aucune couverture n'est trouvée pour mon ISBN, ce que je peux faire sur place :
 *   surChoix : l'image que j'apporte (ou null si je ne la garde pas) ; elle suit le geste en cours,
 *     rien n'est rangé ici ;
 *   autres : de quoi chercher d'autres couvertures ; null pour un tome, qui n'a que la photo.
 */
export type ChoixSansCouverture = {
  choisie: CouvertureChoisie | null
  surChoix: (choisie: CouvertureChoisie | null) => void
  autres: RechercheCouvertures | null
  enLigne: boolean
}

/**
 * La couverture trouvée par la recherche, avant validation : je la vois, et je peux ne pas la
 * garder. Rien n'est rangé tant que je n'ai pas validé. Une image de moins de 450 px de large
 * est dite « de petite taille ». Sans couverture trouvée, et si `sans` est donné : « Prendre une
 * photo de mon exemplaire », puis « Chercher d'autres couvertures », empilés.
 */
export function ApercuCouverture({
  titre,
  cherche,
  trouvee,
  adresse,
  garder,
  setGarder,
  sans,
}: {
  titre: string
  cherche: boolean
  trouvee: ImageTrouvee | null
  adresse: string | null
  garder: boolean
  setGarder: (garder: boolean) => void
  sans?: ChoixSansCouverture
}) {
  const photo = useRef<OuvrirImage>(null)
  const autres = useRef<{ ouvrir: () => void }>(null)
  const choisie = (!cherche && trouvee === null && sans?.choisie) || null
  const adresseChoisie = useMemo(() => (choisie ? URL.createObjectURL(choisie.image) : null), [choisie])
  useEffect(() => () => void (adresseChoisie && URL.revokeObjectURL(adresseChoisie)), [adresseChoisie])

  const visible = (trouvee !== null && garder) || choisie !== null
  const petite = trouvee !== null && estPetite(trouvee)
  // Les deux choix : seulement quand la recherche est finie, sans rien trouver, et que je n'ai encore rien apporté.
  const proposer = !cherche && trouvee === null && sans !== undefined && choisie === null
  return (
    <section aria-label="Couverture" data-etat={visible ? 'image' : 'typographique'} className="flex flex-wrap items-center gap-5">
      <Couverture titre={titre || 'Sans titre'} graine="apercu" apercu={choisie ? adresseChoisie : visible ? adresse : null} className="w-24 shrink-0" />
      <div className="flex min-w-0 flex-[1_1_12rem] flex-col items-start gap-2">
        {cherche ? (
          <p role="status" className="m-0 text-[0.9375rem] text-discret">
            Je cherche la couverture…
          </p>
        ) : choisie ? (
          <>
            <p role="status" className="m-0 text-[0.9375rem]">
              {choisie.origine === 'photo' ? 'La photo de mon exemplaire sera gardée.' : 'La couverture d’une autre édition sera gardée.'}
            </p>
            <Bouton variante="secondaire" onClick={() => sans?.surChoix(null)} className="min-h-11 px-5">
              Ne pas la garder
            </Bouton>
          </>
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

      {sans && proposer && (
        // Règle des panneaux : boutons empilés, pleine largeur. La photo d'abord : c'est la voie sûre.
        <div role="group" aria-label="Trouver une couverture" className="flex basis-full flex-col gap-3">
          <Bouton variante="secondaire" occupe={!sans.enLigne} onClick={() => photo.current?.ouvrir('photo')}>
            Prendre une photo de mon exemplaire
          </Bouton>
          {sans.autres && (
            <Bouton variante="secondaire" aria-haspopup="dialog" occupe={!sans.enLigne} onClick={() => autres.current?.ouvrir()}>
              Chercher d’autres couvertures
            </Bouton>
          )}
          {sans.enLigne ? (
            <ConseilPhoto />
          ) : (
            <p className="m-0 text-sm text-discret">Hors connexion : une image ne pourrait pas être rangée. J’attends le retour du réseau.</p>
          )}
          {/* Les deux panneaux ne rangent rien : l'image validée revient ici, et suit le geste en cours. */}
          <ChoisirImage ref={photo} sansBouton enLigne={sans.enLigne} surImage={(image) => sans.surChoix({ image, origine: 'photo' })} />
          {sans.autres && (
            <AutresCouvertures ref={autres} sansBouton recherche={sans.autres} enLigne={sans.enLigne} surImage={(image) => sans.surChoix({ image, origine: 'autre_edition' })} />
          )}
        </div>
      )}
    </section>
  )
}
