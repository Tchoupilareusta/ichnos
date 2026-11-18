import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { LANGUES, nomLangue } from '../catalogue/langues'
import type { EchecEcriture, OeuvreDetaillee, Vocabulaire } from '../bibliotheque/depot'
import {
  ajusterTomes,
  etatDepuisOeuvre,
  etatVide,
  idChamp,
  ligneAuteur,
  ligneEdition,
  ligneMedia,
  valider,
  versEnvoi,
  type EtatFormulaire,
  type Erreurs,
} from '../bibliotheque/formulaire'
import { FORMES, GENRES_ETIQUETTES, LONGUEURS, ROLES, TYPES_MEDIA, type GenreEtiquette, type Role, type TypeMedia } from '../bibliotheque/modele'
import { useEnregistrerOeuvre, useOeuvre, useVocabulaire } from '../bibliotheque/requetes'
import { Bouton } from '../composants/Bouton'
import { CHAMP, ChampListe, ChampLong, ChampTexte, Pastilles } from '../composants/Champs'
import { Dialogue } from '../composants/Dialogue'
import { IconeAjouter, IconeChevronBas, IconeFermer } from '../composants/Icones'
import { BoutonPrincipal, EtatVide, Page, TitrePage } from '../composants/Page'
import { LIENS } from '../navigation/routes'
import { useEnLigne } from '../navigation/useEnLigne'
import { peutRevenir, remplacer, revenir, useRoute } from '../navigation/useRoute'

/** « Ajouter une œuvre » : le formulaire vide. */
export function Ajouter() {
  return <Formulaire initial={null} />
}

/** « Modifier » : le formulaire rempli avec la fiche. */
export function Modifier() {
  const { id } = useRoute()
  const requete = useOeuvre(id ?? '')
  if (requete.data) return <Formulaire key={requete.data.id} initial={requete.data} />
  return (
    <Page>
      <TitrePage>Modifier la fiche</TitrePage>
      {requete.isPending && (
        <p role="status" className="m-0 text-discret">
          Ouverture de la fiche…
        </p>
      )}
      {requete.isError && (
        <EtatVide action={<BoutonPrincipal href={LIENS.bibliotheque}>Revenir à ma bibliothèque</BoutonPrincipal>}>
          <span role="alert">
            {requete.error.echec === 'introuvable'
              ? 'Cette œuvre n’est pas, ou plus, dans ma bibliothèque.'
              : 'La fiche n’a pas pu s’ouvrir. Je réessaie au retour du réseau.'}
          </span>
        </EtatVide>
      )}
    </Page>
  )
}

const ECHECS: Record<EchecEcriture, string> = {
  reseau: 'Pas de connexion à internet : rien n’a été enregistré. Ma saisie reste là, je réessaie au retour du réseau.',
  invalide: 'La base a refusé une des valeurs : rien n’a été enregistré. Je vérifie les champs et je réessaie.',
  introuvable: 'Cette œuvre n’est plus dans ma bibliothèque : rien n’a été enregistré.',
  inconnu: 'L’enregistrement n’a pas abouti, et rien n’a été enregistré. Je réessaie dans un instant.',
}

const TONALITES = [
  { valeur: '1', libelle: 'Sombre' },
  { valeur: '2', libelle: 'Grave' },
  { valeur: '3', libelle: 'Nuancée' },
  { valeur: '4', libelle: 'Douce' },
  { valeur: '5', libelle: 'Lumineuse' },
]
const EXIGENCES = [
  { valeur: '1', libelle: 'Accessible' },
  { valeur: '2', libelle: 'Facile' },
  { valeur: '3', libelle: 'Moyenne' },
  { valeur: '4', libelle: 'Soutenue' },
  { valeur: '5', libelle: 'Exigeante' },
]
const INCONNU = { valeur: '', libelle: 'Je ne sais pas' }
const INDICATIONS: Record<GenreEtiquette, string> = { genre: 'Un genre…', theme: 'Un thème…', atmosphere: 'Une atmosphère…' }

const optionsLangues = (actuelle: string) => [
  { valeur: '', libelle: 'Inconnue' },
  ...LANGUES.map((l) => ({ valeur: l.code, libelle: l.nom.charAt(0).toUpperCase() + l.nom.slice(1) })),
  // Un code que la liste ne connaît pas encore reste choisi plutôt que d'être perdu.
  ...(actuelle && !nomLangue(actuelle) ? [{ valeur: actuelle, libelle: actuelle }] : []),
]

function Formulaire({ initial }: { initial: OeuvreDetaillee | null }) {
  const enLigne = useEnLigne()
  const vocabulaire = useVocabulaire().data ?? { etiquettes: [], auteurs: [] }
  const enregistrement = useEnregistrerOeuvre()
  const [depart] = useState(() => (initial ? etatDepuisOeuvre(initial) : etatVide()))
  const [etat, setEtat] = useState<EtatFormulaire>(depart)
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const [abandon, setAbandon] = useState(false)
  const [annonce, setAnnonce] = useState<string | null>(null)
  const resume = useRef<HTMLParagraphElement>(null)
  const idFormulaire = useId()

  const modifie = JSON.stringify(etat) !== JSON.stringify(depart)
  const titre = initial ? 'Modifier la fiche' : 'Ajouter une œuvre'
  const retour = initial ? LIENS.oeuvre(initial.id) : LIENS.bibliotheque

  useEffect(() => {
    document.title = `${titre} · Ichnos`
  }, [titre])

  const maj = (changement: Partial<EtatFormulaire>) => setEtat((avant) => ({ ...avant, ...changement }))

  function quitter() {
    if (modifie) setAbandon(true)
    else revenir(retour)
  }

  function enregistrer(evenement: FormEvent) {
    evenement.preventDefault()
    if (!enLigne || enregistrement.isPending) return
    const trouvees = valider(etat)
    setErreurs(trouvees)
    const premiere = Object.keys(trouvees)[0]
    if (premiere) {
      setAnnonce(
        Object.keys(trouvees).length === 1
          ? 'Un champ est à revoir avant d’enregistrer.'
          : 'Quelques champs sont à revoir avant d’enregistrer.',
      )
      document.getElementById(premiere)?.focus()
      return
    }
    setAnnonce(null)
    enregistrement.mutate(versEnvoi(etat, initial?.id), {
      onSuccess: (id) => {
        // Nouvelle œuvre : sa fiche s'ouvre à la place du formulaire, pour y choisir statut et possession.
        if (!initial || !peutRevenir()) remplacer(LIENS.oeuvre(id))
        else revenir(LIENS.oeuvre(id))
      },
      onError: () => resume.current?.focus(),
    })
  }

  const message = annonce ?? (enregistrement.error ? ECHECS[enregistrement.error.echec] : null)

  return (
    <Page
      entete={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={quitter}
            className="flex min-h-11 cursor-pointer items-center rounded-pilule border border-bordure bg-surface px-4 text-[0.9375rem] font-semibold text-encre"
          >
            Annuler
          </button>
          <Bouton type="submit" form={idFormulaire} occupe={enregistrement.isPending || !enLigne} className="min-h-11 px-5">
            Enregistrer
          </Bouton>
        </div>
      }
    >
      <form id={idFormulaire} noValidate onSubmit={enregistrer} className="flex max-w-3xl flex-col gap-12">
        <div className="flex flex-col gap-3">
          <TitrePage>{titre}</TitrePage>
          <p className="m-0 max-w-[60ch] text-discret">
            Ce que je ne sais pas, je le laisse vide : rien n’est jamais complété à ma place.
          </p>
          {!enLigne && (
            <p className="m-0 max-w-[60ch] rounded-carte bg-accent-doux px-5 py-4 text-[0.9375rem] font-semibold text-accent-texte">
              Hors connexion : je peux préparer la fiche, et l’enregistrer au retour du réseau.
            </p>
          )}
          <p
            ref={resume}
            tabIndex={-1}
            role="alert"
            className="m-0 max-w-[60ch] rounded-carte bg-accent-doux px-5 py-4 text-[0.9375rem] font-semibold text-accent-texte empty:hidden"
          >
            {message ?? ''}
          </p>
        </div>

        <Bloc titre="L’œuvre">
          <div className="grid grid-cols-1 gap-5 tablette:grid-cols-2">
            <ChampTexte
              id={idChamp.titreFr}
              libelle="Titre en français"
              value={etat.titreFr}
              onChange={(e) => maj({ titreFr: e.target.value })}
              erreur={erreurs[idChamp.titreFr]}
              required
              autoComplete="off"
              className="tablette:col-span-2"
            />
            <ChampTexte
              libelle="Titre original"
              aide="S’il diffère du titre français."
              value={etat.titreOriginal}
              onChange={(e) => maj({ titreOriginal: e.target.value })}
              autoComplete="off"
            />
            <ChampListe
              libelle="Langue d’origine"
              value={etat.langueOriginale}
              onChange={(e) => maj({ langueOriginale: e.target.value })}
              options={optionsLangues(etat.langueOriginale)}
            />
            <ChampListe
              libelle="Forme"
              value={etat.forme}
              onChange={(e) => maj({ forme: e.target.value as EtatFormulaire['forme'] })}
              options={FORMES.map((f) => ({ valeur: f.valeur, libelle: f.libelle }))}
            />
            <ChampTexte
              id={idChamp.annee}
              libelle="Première parution"
              aide="L’année, si je la connais."
              inputMode="numeric"
              value={etat.annee}
              onChange={(e) => maj({ annee: e.target.value })}
              erreur={erreurs[idChamp.annee]}
              autoComplete="off"
            />
          </div>
          <Bascule
            libelle="C’est une série en plusieurs tomes"
            aide="Un manga, par exemple : la possession se suit alors tome par tome."
            coche={etat.estSerie}
            onChange={(estSerie) => maj({ estSerie })}
          />
        </Bloc>

        <Bloc titre="Auteurs">
          <Auteurs etat={etat} maj={maj} connus={vocabulaire.auteurs} />
        </Bloc>

        <Bloc titre="En quelques mots">
          <ChampLong
            libelle="Résumé"
            aide="Écrit avec mes mots, sans rien dévoiler de la fin."
            value={etat.synopsis}
            onChange={(e) => maj({ synopsis: e.target.value })}
          />
        </Bloc>

        <Bloc titre="Étiquettes">
          {GENRES_ETIQUETTES.map((g) => (
            <Etiquettes key={g.valeur} genre={g.valeur} libelle={g.pluriel} etat={etat} maj={maj} vocabulaire={vocabulaire} />
          ))}
        </Bloc>

        <Bloc titre="Le caractère du livre">
          <Pastilles
            legende="Tonalité"
            options={[INCONNU, ...TONALITES]}
            valeur={etat.tonalite === null ? '' : String(etat.tonalite)}
            onChange={(v) => maj({ tonalite: v ? Number(v) : null })}
          />
          <Pastilles
            legende="Exigence"
            options={[INCONNU, ...EXIGENCES]}
            valeur={etat.exigence === null ? '' : String(etat.exigence)}
            onChange={(v) => maj({ exigence: v ? Number(v) : null })}
          />
          <Pastilles
            legende="Longueur"
            options={[INCONNU, ...LONGUEURS.map((l) => ({ valeur: l.valeur, libelle: l.libelle }))]}
            valeur={etat.longueur ?? ''}
            onChange={(v) => maj({ longueur: (v || null) as EtatFormulaire['longueur'] })}
          />
        </Bloc>

        <Bloc titre="Éditions" id="editions">
          <Editions etat={etat} maj={maj} erreurs={erreurs} />
        </Bloc>

        {etat.estSerie && (
          <Bloc titre="Tomes">
            <Tomes etat={etat} maj={maj} erreurs={erreurs} initial={initial} />
          </Bloc>
        )}

        <Bloc titre="À l’écran" aide="Une adaptation en anime, en film ou en série.">
          <Medias etat={etat} maj={maj} erreurs={erreurs} />
        </Bloc>

        <div className="flex flex-wrap gap-3 border-t border-bordure pt-8">
          <Bouton type="submit" occupe={enregistrement.isPending || !enLigne}>
            {enregistrement.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Bouton>
          <Bouton variante="secondaire" onClick={quitter}>
            Annuler
          </Bouton>
        </div>
      </form>

      <Dialogue
        ouvert={abandon}
        titre="Abandonner mes modifications ?"
        confirmer="Abandonner"
        annuler="Continuer la saisie"
        onAnnuler={() => setAbandon(false)}
        onConfirmer={() => {
          setAbandon(false)
          revenir(retour)
        }}
      >
        <p className="m-0">Ce que j’ai saisi ici ne sera pas enregistré.</p>
      </Dialogue>
    </Page>
  )
}

type PropsBloc = { etat: EtatFormulaire; maj: (changement: Partial<EtatFormulaire>) => void }

function Bloc({ titre, aide, id, children }: { titre: string; aide?: string; id?: string; children: ReactNode }) {
  const idTitre = useId()
  return (
    <section id={id} aria-labelledby={idTitre} className="flex scroll-mt-6 flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 id={idTitre} className="m-0 font-titre text-2xl">
          {titre}
        </h2>
        {aide && <p className="m-0 text-sm text-discret">{aide}</p>}
      </div>
      {children}
    </section>
  )
}

function Bascule({ libelle, aide, coche, onChange }: { libelle: string; aide?: string; coche: boolean; onChange: (coche: boolean) => void }) {
  const id = useId()
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={coche}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={aide ? `${id}-aide` : undefined}
        className="mt-0.5 size-6 shrink-0 cursor-pointer accent-[var(--accent)]"
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="cursor-pointer text-[0.9375rem] font-bold">
          {libelle}
        </label>
        {aide && (
          <span id={`${id}-aide`} className="text-sm text-discret">
            {aide}
          </span>
        )}
      </div>
    </div>
  )
}

/** Petit bouton rond « retirer », nommé pour VoiceOver. */
function BoutonRetirer({ nom, onClick }: { nom: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={nom}
      onClick={onClick}
      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pilule border border-bordure bg-surface text-discret hover:text-encre"
    >
      <IconeFermer taille={18} />
    </button>
  )
}

function BoutonAjouterLigne({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-pilule border border-dashed border-bordure bg-transparent px-4 text-[0.9375rem] font-bold text-accent-texte"
    >
      <IconeAjouter taille={18} />
      {children}
    </button>
  )
}

function Auteurs({ etat, maj, connus }: PropsBloc & { connus: string[] }) {
  const idListe = useId()
  const changer = (cle: string, changement: { nom?: string; role?: Role }) =>
    maj({ auteurs: etat.auteurs.map((a) => (a.cle === cle ? { ...a, ...changement } : a)) })
  return (
    <>
      <datalist id={idListe}>
        {connus.map((nom) => (
          <option key={nom} value={nom} />
        ))}
      </datalist>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {etat.auteurs.map((auteur, rang) => (
          <li key={auteur.cle} className="flex items-end gap-3">
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 min-[30rem]:grid-cols-[minmax(0,1fr)_11rem]">
              <ChampTexte
                libelle={`Nom${etat.auteurs.length > 1 ? ` (${rang + 1})` : ''}`}
                list={idListe}
                value={auteur.nom}
                onChange={(e) => changer(auteur.cle, { nom: e.target.value })}
                autoComplete="off"
              />
              <ChampListe
                libelle="Rôle"
                value={auteur.role}
                onChange={(e) => changer(auteur.cle, { role: e.target.value as Role })}
                options={ROLES.map((r) => ({ valeur: r.valeur, libelle: r.libelle }))}
              />
            </div>
            <BoutonRetirer
              nom={auteur.nom.trim() ? `Retirer ${auteur.nom.trim()}` : 'Retirer cette ligne'}
              onClick={() => maj({ auteurs: etat.auteurs.filter((a) => a.cle !== auteur.cle) })}
            />
          </li>
        ))}
      </ul>
      <BoutonAjouterLigne onClick={() => maj({ auteurs: [...etat.auteurs, ligneAuteur()] })}>Ajouter une personne</BoutonAjouterLigne>
    </>
  )
}

function Etiquettes({
  genre,
  libelle,
  etat,
  maj,
  vocabulaire,
}: PropsBloc & { genre: GenreEtiquette; libelle: string; vocabulaire: Vocabulaire }) {
  const [saisie, setSaisie] = useState('')
  const idListe = useId()
  const idChampSaisie = useId()
  const choisies = etat.etiquettes.filter((e) => e.genre === genre)
  const proposees = vocabulaire.etiquettes
    .filter((e) => e.genre === genre && !choisies.some((c) => c.nom === e.nom))
    .map((e) => e.nom)
    .sort((a, b) => a.localeCompare(b, 'fr'))

  function ajouter() {
    const nom = saisie.trim().replace(/\s+/g, ' ')
    if (!nom) return
    // Une étiquette déjà connue garde son écriture exacte (majuscules, accents).
    const connue = vocabulaire.etiquettes.find((e) => e.genre === genre && e.nom.toLocaleLowerCase('fr') === nom.toLocaleLowerCase('fr'))
    const retenu = connue?.nom ?? nom
    if (!choisies.some((c) => c.nom.toLocaleLowerCase('fr') === retenu.toLocaleLowerCase('fr')))
      maj({ etiquettes: [...etat.etiquettes, { genre, nom: retenu }] })
    setSaisie('')
  }

  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={idChampSaisie} className="text-[0.9375rem] font-bold">
        {libelle}
      </label>
      {choisies.length > 0 && (
        <ul aria-label={`${libelle} choisis`} className="m-0 flex list-none flex-wrap gap-2 p-0">
          {choisies.map((e) => (
            <li key={e.nom}>
              <button
                type="button"
                aria-label={`Retirer ${e.nom}`}
                onClick={() => maj({ etiquettes: etat.etiquettes.filter((x) => !(x.genre === genre && x.nom === e.nom)) })}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-pilule border-0 bg-accent-doux pr-3 pl-4 text-[0.9375rem] font-semibold text-accent-texte"
              >
                {e.nom}
                <IconeFermer taille={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <datalist id={idListe}>
        {proposees.map((nom) => (
          <option key={nom} value={nom} />
        ))}
      </datalist>
      <div className="flex gap-2">
        <input
          id={idChampSaisie}
          list={idListe}
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ajouter()
            }
          }}
          placeholder={INDICATIONS[genre]}
          autoComplete="off"
          enterKeyHint="done"
          className={`${CHAMP} min-w-0 flex-1`}
        />
        <Bouton variante="secondaire" onClick={ajouter} className="min-h-12 shrink-0 px-5">
          Ajouter
        </Bouton>
      </div>
    </div>
  )
}

function Editions({ etat, maj, erreurs }: PropsBloc & { erreurs: Erreurs }) {
  const changer = (cle: string, changement: Partial<EtatFormulaire['editions'][number]>) =>
    maj({ editions: etat.editions.map((e) => (e.cle === cle ? { ...e, ...changement } : e)) })
  return (
    <>
      {etat.editions.length === 0 && <p className="m-0 text-discret">Aucune édition notée pour l’instant.</p>}
      <ul className="m-0 flex list-none flex-col gap-5 p-0">
        {etat.editions.map((edition, rang) => (
          <li key={edition.cle} className="flex flex-col gap-5 rounded-panneau border border-bordure bg-surface p-5 shadow-douce">
            <div className="flex items-center justify-between gap-3">
              <h3 className="m-0 font-titre text-xl">{etat.editions.length > 1 ? `Édition ${rang + 1}` : 'Édition'}</h3>
              <BoutonRetirer
                nom={`Retirer l’édition ${edition.publisher.trim() || rang + 1}`}
                onClick={() =>
                  maj({
                    editions: etat.editions.filter((e) => e.cle !== edition.cle),
                    mienne: etat.mienne === edition.cle ? null : etat.mienne,
                  })
                }
              />
            </div>
            <div className="grid grid-cols-1 gap-5 tablette:grid-cols-2">
              <ChampTexte libelle="Éditeur" value={edition.publisher} onChange={(e) => changer(edition.cle, { publisher: e.target.value })} autoComplete="off" />
              <ChampTexte
                libelle="Collection ou format"
                aide="Folio, poche, broché…"
                value={edition.format}
                onChange={(e) => changer(edition.cle, { format: e.target.value })}
                autoComplete="off"
              />
              <ChampListe
                libelle="Langue de l’édition"
                value={edition.language}
                onChange={(e) => changer(edition.cle, { language: e.target.value })}
                options={optionsLangues(edition.language)}
              />
              <ChampTexte
                libelle="Traduction"
                value={edition.translator}
                onChange={(e) => changer(edition.cle, { translator: e.target.value })}
                autoComplete="off"
              />
              <ChampTexte
                id={idChamp.isbnEdition(edition.cle)}
                libelle="ISBN"
                aide="Au dos du livre, près du code-barres."
                inputMode="numeric"
                value={edition.isbn}
                onChange={(e) => changer(edition.cle, { isbn: e.target.value })}
                erreur={erreurs[idChamp.isbnEdition(edition.cle)]}
                autoComplete="off"
              />
              <ChampTexte
                id={idChamp.pagesEdition(edition.cle)}
                libelle="Nombre de pages"
                aide="Celui de mon exemplaire."
                inputMode="numeric"
                value={edition.pageCount}
                onChange={(e) => changer(edition.cle, { pageCount: e.target.value })}
                erreur={erreurs[idChamp.pagesEdition(edition.cle)]}
                autoComplete="off"
              />
            </div>
            <Bascule
              libelle="C’est mon édition"
              aide="Si elle est en anglais, le titre original passe en premier."
              coche={etat.mienne === edition.cle}
              onChange={(coche) => maj({ mienne: coche ? edition.cle : null })}
            />
          </li>
        ))}
      </ul>
      <BoutonAjouterLigne
        onClick={() => {
          const nouvelle = ligneEdition()
          // La première édition notée devient la mienne : je peux le défaire.
          maj({ editions: [...etat.editions, nouvelle], mienne: etat.editions.length === 0 ? nouvelle.cle : etat.mienne })
        }}
      >
        Ajouter une édition
      </BoutonAjouterLigne>
    </>
  )
}

function Tomes({ etat, maj, erreurs, initial }: PropsBloc & { erreurs: Erreurs; initial: OeuvreDetaillee | null }) {
  const [nombre, setNombre] = useState(String(etat.tomes.length))
  const nombreValide = /^\d+$/.test(nombre) && Number(nombre) <= 500
  const retires = initial ? initial.tomes.filter((t) => !etat.tomes.some((x) => x.numero === t.numero)) : []
  const retiresPossedes = retires.filter((t) => t.possession !== 'non_possede').length

  return (
    <>
      <ChampTexte
        id={idChamp.nombreTomes}
        libelle="Nombre de tomes"
        aide="Pour une série en cours, je l’augmente à chaque nouveau tome."
        inputMode="numeric"
        value={nombre}
        onChange={(e) => {
          setNombre(e.target.value)
          if (/^\d+$/.test(e.target.value) && Number(e.target.value) <= 500) maj({ tomes: ajusterTomes(etat.tomes, Number(e.target.value)) })
        }}
        erreur={nombreValide ? null : 'Un nombre de tomes en chiffres, jusqu’à 500.'}
        autoComplete="off"
        className="max-w-xs"
      />
      {retires.length > 0 && (
        <p role="status" className="m-0 max-w-[60ch] rounded-carte bg-accent-doux px-5 py-4 text-[0.9375rem] font-semibold text-accent-texte">
          {retires.length === 1 ? `Le tome ${retires[0].numero} sera retiré` : `Les tomes ${retires[0].numero} à ${retires[retires.length - 1].numero} seront retirés`}
          {retiresPossedes > 0 ? ', avec ce que j’avais noté sur leur possession.' : '.'}
        </p>
      )}
      {etat.tomes.length > 0 && (
        <details className="group rounded-panneau border border-bordure bg-surface shadow-douce">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 text-[0.9375rem] font-bold [&::-webkit-details-marker]:hidden">
            Titres et ISBN des tomes
            <span className="text-discret transition-transform duration-200 group-open:rotate-180">
              <IconeChevronBas taille={18} />
            </span>
          </summary>
          <ul className="m-0 flex list-none flex-col gap-4 border-t border-bordure p-5">
            {etat.tomes.map((tome) => (
              <li key={tome.numero} className="grid grid-cols-1 gap-3 min-[30rem]:grid-cols-2">
                <ChampTexte
                  libelle={`Tome ${tome.numero} : titre`}
                  value={tome.titre}
                  onChange={(e) => maj({ tomes: etat.tomes.map((t) => (t.numero === tome.numero ? { ...t, titre: e.target.value } : t)) })}
                  autoComplete="off"
                />
                <ChampTexte
                  id={idChamp.isbnTome(tome.numero)}
                  libelle={`Tome ${tome.numero} : ISBN`}
                  inputMode="numeric"
                  value={tome.isbn}
                  onChange={(e) => maj({ tomes: etat.tomes.map((t) => (t.numero === tome.numero ? { ...t, isbn: e.target.value } : t)) })}
                  erreur={erreurs[idChamp.isbnTome(tome.numero)]}
                  autoComplete="off"
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}

function Medias({ etat, maj, erreurs }: PropsBloc & { erreurs: Erreurs }) {
  const changer = (cle: string, changement: Partial<EtatFormulaire['medias'][number]>) =>
    maj({ medias: etat.medias.map((m) => (m.cle === cle ? { ...m, ...changement } : m)) })
  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-5 p-0">
        {etat.medias.map((media) => (
          <li key={media.cle} className="flex flex-col gap-5 rounded-panneau border border-bordure bg-surface p-5 shadow-douce">
            <div className="flex items-end gap-3">
              <ChampListe
                libelle="Type"
                value={media.type}
                onChange={(e) => changer(media.cle, { type: e.target.value as TypeMedia })}
                options={TYPES_MEDIA.map((t) => ({ valeur: t.valeur, libelle: t.libelle }))}
                className="min-w-0 flex-1"
              />
              <BoutonRetirer
                nom={`Retirer ${media.titre.trim() || 'cette adaptation'}`}
                onClick={() => maj({ medias: etat.medias.filter((m) => m.cle !== media.cle) })}
              />
            </div>
            <div className="grid grid-cols-1 gap-5 min-[30rem]:grid-cols-2">
              <ChampTexte
                libelle="Titre"
                aide="S’il diffère de celui du livre."
                value={media.titre}
                onChange={(e) => changer(media.cle, { titre: e.target.value })}
                autoComplete="off"
                className="min-[30rem]:col-span-2"
              />
              <ChampTexte
                id={idChamp.saisons(media.cle)}
                libelle="Saisons"
                inputMode="numeric"
                value={media.saisons}
                onChange={(e) => changer(media.cle, { saisons: e.target.value })}
                erreur={erreurs[idChamp.saisons(media.cle)]}
                autoComplete="off"
              />
              <ChampTexte
                id={idChamp.episodes(media.cle)}
                libelle="Épisodes en tout"
                inputMode="numeric"
                value={media.episodes}
                onChange={(e) => changer(media.cle, { episodes: e.target.value })}
                erreur={erreurs[idChamp.episodes(media.cle)]}
                autoComplete="off"
              />
            </div>
          </li>
        ))}
      </ul>
      <BoutonAjouterLigne onClick={() => maj({ medias: [...etat.medias, ligneMedia()] })}>Ajouter une adaptation</BoutonAjouterLigne>
    </>
  )
}
