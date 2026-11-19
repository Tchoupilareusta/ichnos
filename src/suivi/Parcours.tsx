import { useEffect, useState } from 'react'
import type { Statut } from '../bibliotheque/modele'
import { dateSaisie, derniereFin, lecturesFaites, texteParcours, type Evenement, type PrecisionDate } from '../bibliotheque/suivi'
import { Bouton } from '../composants/Bouton'
import { ChampListe, ChampTexte, Pastilles } from '../composants/Champs'
import { Feuille } from '../composants/Feuille'
import { LIEN_ACTION, Section } from '../composants/Section'

const PRECISIONS: { valeur: PrecisionDate; libelle: string }[] = [
  { valeur: 'jour', libelle: 'Le jour' },
  { valeur: 'mois', libelle: 'Le mois' },
  { valeur: 'annee', libelle: 'L’année' },
]

const NOMS_MOIS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, i, 1))),
)

/**
 * « Mon parcours » : quelques mots, jamais une statistique.
 * « Commencé le 3 mars · terminé le 20 avril », les relectures, et la date de fin que je peux saisir moi-même.
 */
export function MonParcours({
  historique,
  statut,
  enLigne,
  dater,
}: {
  historique: Evenement[]
  statut: Statut
  enLigne: boolean
  dater: (date: string | null, precision: PrecisionDate) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const lignes = texteParcours(lecturesFaites(historique))
  const fin = derniereFin(historique)
  const termine = statut === 'termine'
  if (lignes.length === 0 && !termine) return null

  return (
    <Section titre="Mon parcours">
      {lignes.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[1.0625rem]">
          {lignes.map((ligne, rang) => (
            <li key={rang}>{ligne}</li>
          ))}
        </ul>
      )}
      {termine && (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-disabled={!enLigne || undefined}
          onClick={() => enLigne && setOuvert(true)}
          className={`${LIEN_ACTION} self-start`}
        >
          {fin ? 'Modifier la date de fin' : 'Ajouter la date de fin'}
        </button>
      )}
      <DateDeFin
        ouvert={ouvert}
        fermer={() => setOuvert(false)}
        existe={fin !== null}
        precisionDepart={fin?.precision ?? 'annee'}
        enregistrer={(date, precision) => {
          setOuvert(false)
          dater(date, precision)
        }}
      />
    </Section>
  )
}

function DateDeFin({
  ouvert,
  fermer,
  existe,
  precisionDepart,
  enregistrer,
}: {
  ouvert: boolean
  fermer: () => void
  existe: boolean
  precisionDepart: PrecisionDate
  enregistrer: (date: string | null, precision: PrecisionDate) => void
}) {
  const [precision, setPrecision] = useState<PrecisionDate>(precisionDepart)
  const [jour, setJour] = useState('')
  const [mois, setMois] = useState('1')
  const [annee, setAnnee] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    if (!ouvert) return
    setPrecision(precisionDepart)
    setJour('')
    setMois('1')
    setAnnee('')
    setErreur(null)
  }, [ouvert, precisionDepart])

  const aujourdhui = new Date()
  const max = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`

  return (
    <Feuille ouvert={ouvert} titre="Quand l’ai-je terminé ?" fermer={fermer}>
      <form
        noValidate
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault()
          const date = dateSaisie(precision, { jour, mois, annee })
          if (!date) {
            setErreur(precision === 'jour' ? 'Une date passée, jour compris.' : 'Une année passée, sur quatre chiffres.')
            return
          }
          enregistrer(date, precision)
        }}
      >
        <Pastilles
          legende="Je me souviens de…"
          options={PRECISIONS}
          valeur={precision}
          onChange={(p) => {
            setPrecision(p)
            setErreur(null)
          }}
        />
        {precision === 'jour' ? (
          <ChampTexte libelle="Date de fin" type="date" max={max} value={jour} onChange={(e) => setJour(e.target.value)} erreur={erreur} />
        ) : (
          <div className={precision === 'mois' ? 'grid grid-cols-2 gap-4' : 'flex flex-col'}>
            {precision === 'mois' && (
              <ChampListe
                libelle="Mois"
                options={NOMS_MOIS.map((nom, i) => ({ valeur: String(i + 1), libelle: nom }))}
                value={mois}
                onChange={(e) => setMois(e.target.value)}
              />
            )}
            <ChampTexte
              libelle="Année"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={4}
              value={annee}
              onChange={(e) => setAnnee(e.target.value)}
              erreur={erreur}
            />
          </div>
        )}
        <Bouton type="submit">Enregistrer</Bouton>
        {existe && (
          <button type="button" onClick={() => enregistrer(null, precision)} className={`${LIEN_ACTION} self-center`}>
            Retirer la date de fin
          </button>
        )}
      </form>
    </Feuille>
  )
}
