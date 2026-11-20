import { useEffect, useMemo, useRef } from 'react'
import { couverturesDeLaFiche, type OeuvreDetaillee } from '../bibliotheque/depot'
import { IconeChevronBas, IconeFermer } from '../composants/Icones'
import { Menu } from '../composants/Menu'
import { AutresCouvertures, rechercheDeLOeuvre } from './AutresCouvertures'
import { ChoisirImage, type OuvrirImage } from './ChoisirImage'
import { couvertureAffichee, type CibleCouverture } from './choix'
import { Couverture } from './Couverture'

/**
 * Ce que je fais de la couverture dans « Modifier ». Rien n'est rangé ni retiré avant « Enregistrer » :
 * une nouvelle image reste sur l'appareil (jamais envoyée si j'annule), un retrait reste à l'écran.
 */
export type ChoixCouverture = { etat: 'inchangee' } | { etat: 'retiree' } | { etat: 'nouvelle'; image: Blob }

/** La couverture rangée qui s'affiche aujourd'hui, et tous les endroits de la fiche où elle est rangée. */
export function couvertureRangee(oeuvre: OeuvreDetaillee): { chemin: string | null; cibles: CibleCouverture[] } {
  const chemin = couvertureAffichee(couverturesDeLaFiche(oeuvre))
  if (!chemin) return { chemin: null, cibles: [] }
  return {
    chemin,
    cibles: [
      ...(oeuvre.couverture === chemin ? [{ type: 'oeuvre' as const }] : []),
      ...oeuvre.editions.filter((e) => e.couverture === chemin).map((e) => ({ type: 'edition' as const, edition: e.id })),
      ...oeuvre.tomes.filter((t) => t.couverture === chemin).map((t) => ({ type: 'tome' as const, numero: t.numero })),
    ],
  }
}

type Geste = 'photo' | 'phototheque' | 'autres'

/**
 * En haut de « Modifier » : la couverture en grand. Une bulle avec une croix la retire de l'écran ;
 * « Changer la couverture » ouvre un petit menu : photo, photothèque, autres éditions. Tout attend
 * « Enregistrer ». La couverture générée par Ichnos n'a pas de croix.
 */
export function CouvertureModifiable({
  oeuvre,
  titre,
  enLigne,
  choix,
  changer,
}: {
  oeuvre: OeuvreDetaillee
  /** Le titre en cours de saisie : la couverture générée le reprend. */
  titre: string
  enLigne: boolean
  choix: ChoixCouverture
  /** Un nouveau choix : l'écran l'affiche, propose « Annuler » quelques secondes, et le range à l'enregistrement. */
  changer: (choix: ChoixCouverture) => void
}) {
  const image = useRef<OuvrirImage>(null)
  const autres = useRef<{ ouvrir: () => void }>(null)
  const menu = useRef<HTMLDivElement>(null)
  const { chemin } = couvertureRangee(oeuvre)

  const nouvelle = choix.etat === 'nouvelle' ? choix.image : null
  const apercu = useMemo(() => (nouvelle ? URL.createObjectURL(nouvelle) : null), [nouvelle])
  useEffect(() => () => void (apercu && URL.revokeObjectURL(apercu)), [apercu])

  // Ce qui s'affiche : la nouvelle image, la couverture rangée, ou celle d'Ichnos.
  const affichee = choix.etat === 'nouvelle' ? 'nouvelle' : choix.etat === 'inchangee' && chemin ? 'rangee' : 'ichnos'

  function retirer() {
    changer(choix.etat === 'nouvelle' && chemin ? { etat: 'retiree' } : choix.etat === 'nouvelle' ? { etat: 'inchangee' } : { etat: 'retiree' })
    // La croix part avec l'image : le focus passe sur « Changer la couverture ».
    requestAnimationFrame(() => menu.current?.querySelector('button')?.focus())
  }

  function choisir(geste: Geste) {
    if (geste === 'autres') autres.current?.ouvrir()
    else image.current?.ouvrir(geste)
  }

  // Les deux panneaux ne rangent rien ici : `surImage` me rend l'image.
  const garder = (image: Blob) => changer({ etat: 'nouvelle', image })

  return (
    <section aria-label="Couverture" data-etat={affichee} className="flex flex-col items-center gap-4">
      <div className="relative w-[min(11.5rem,48vw)] tablette:w-full">
        <Couverture
          titre={titre.trim() || oeuvre.titreFr}
          graine={oeuvre.id}
          chemin={affichee === 'rangee' ? chemin : null}
          apercu={affichee === 'nouvelle' ? apercu : null}
          className="w-full"
        />
        {affichee !== 'ichnos' && (
          // La cible fait 44 px ; la bulle visible, 32 px, déborde du coin de la couverture.
          <button
            type="button"
            aria-label="Retirer la couverture"
            onClick={retirer}
            className="absolute -top-3.5 -right-3.5 flex size-11 cursor-pointer items-center justify-center rounded-pilule border-0 bg-transparent p-0"
          >
            <span className="flex size-8 items-center justify-center rounded-pilule border border-bordure bg-surface text-encre shadow-douce">
              <IconeFermer taille={16} />
            </span>
          </button>
        )}
      </div>

      <div ref={menu}>
        <Menu<Geste>
          actions
          nom="Changer la couverture"
          nomListe="Changer la couverture"
          desactive={!enLigne}
          classeBouton="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-pilule border border-bordure bg-surface px-5 text-[0.9375rem] font-semibold text-encre"
          contenuBouton={
            <>
              Changer la couverture
              <IconeChevronBas taille={16} />
            </>
          }
          options={[
            { valeur: 'photo', libelle: 'Prendre une photo' },
            { valeur: 'phototheque', libelle: 'Choisir dans mes photos' },
            { valeur: 'autres', libelle: 'Chercher d’autres couvertures' },
          ]}
          valeur={null}
          onChoisir={choisir}
        />
      </div>

      {oeuvre.estSerie && <p className="m-0 max-w-[40ch] text-center text-sm text-discret">Elle s’affiche tant qu’aucun tome n’a la sienne.</p>}
      {!enLigne && <p className="m-0 text-center text-sm text-discret">Je pourrai changer la couverture au retour du réseau.</p>}

      <ChoisirImage ref={image} sansBouton enLigne={enLigne} surImage={garder} />
      <AutresCouvertures ref={autres} sansBouton recherche={rechercheDeLOeuvre(oeuvre)} enLigne={enLigne} surImage={garder} />
    </section>
  )
}
