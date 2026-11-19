import { titresAffiches } from '../catalogue/titres'
import {
  historiqueAvecFin,
  progressionSerie,
  type Evenement,
  type TypeEvenement,
} from './suivi'
import { cibleCouverture, couvertureAffichee } from '../couvertures/choix'
import {
  couverturesDeLaFiche,
  type CouvertureRangee,
  type Depot,
  type EnCours,
  type Ecriture,
  type Enregistrement,
  type FicheEnvoi,
  type Installation,
  type Lecture,
  type ManqueCouverture,
  type OeuvreDetaillee,
  type OeuvreListee,
} from './depot'
import { comparerTitres, possessionAffichee, possessionsFiltrables } from './modele'

/** Une œuvre de test : seuls les champs utiles au test sont à donner. */
export function oeuvreFictive(champs: Partial<OeuvreDetaillee> & { id: string; titreFr: string }): OeuvreDetaillee {
  return {
    titreOriginal: null,
    langueOriginale: null,
    annee: null,
    forme: 'roman',
    synopsis: null,
    tonalite: null,
    exigence: null,
    longueur: null,
    estSerie: false,
    auteurs: [],
    etiquettes: [],
    editions: [],
    tomes: [],
    medias: [],
    statut: 'a_decouvrir',
    possession: 'non_possede',
    monEdition: null,
    unite: null,
    position: null,
    total: null,
    appreciation: null,
    historique: [],
    ...champs,
  }
}

export function versListee(oeuvre: OeuvreDetaillee): OeuvreListee {
  const langue = oeuvre.editions.find((e) => e.id === oeuvre.monEdition)?.language
  const { principal, secondaire } = titresAffiches(
    { title_fr: oeuvre.titreFr, title_original: oeuvre.titreOriginal, original_language: oeuvre.langueOriginale },
    langue,
  )
  const tomes = oeuvre.tomes.map((t) => t.possession)
  const noms = (genre: string) => oeuvre.etiquettes.filter((e) => e.genre === genre).map((e) => e.nom)
  return {
    id: oeuvre.id,
    titre: principal,
    titreSecondaire: secondaire,
    auteurs: oeuvre.auteurs.filter((a) => a.role === 'auteur').map((a) => a.nom),
    genres: noms('genre'),
    themes: noms('theme'),
    atmospheres: noms('atmosphere'),
    statut: oeuvre.statut,
    possession: possessionAffichee(oeuvre.possession, oeuvre.estSerie, tomes),
    possessionsFiltrables: possessionsFiltrables(oeuvre.possession, oeuvre.estSerie, tomes),
    couverture: couvertureAffichee(couverturesDeLaFiche(oeuvre)),
  }
}

/** Ce que ferait la fonction enregistrer_oeuvre, sans ses contrôles : assez pour tester les écrans. */
function appliquerFiche(fiche: FicheEnvoi, avant: OeuvreDetaillee | undefined, id: string): OeuvreDetaillee {
  const editions = fiche.editions.map((e, rang) => ({
    id: e.id ?? `${id}-edition-${rang}-${Date.now()}`,
    isbn: e.isbn,
    publisher: e.publisher,
    language: e.language,
    format: e.format,
    translator: e.translator,
    pageCount: e.page_count,
    // Comme dans la base : une édition gardée conserve sa couverture.
    couverture: avant?.editions.find((x) => x.id === e.id)?.couverture ?? null,
  }))
  const mienne = fiche.editions.findIndex((e) => e.mienne)
  return {
    id,
    titreFr: fiche.title_fr,
    titreOriginal: fiche.title_original,
    langueOriginale: fiche.original_language,
    annee: fiche.first_published_year,
    forme: fiche.form,
    synopsis: fiche.synopsis,
    tonalite: fiche.tone,
    exigence: fiche.density,
    longueur: fiche.length,
    estSerie: fiche.is_series,
    couverture: avant?.couverture ?? null,
    auteurs: fiche.authors.map((a) => ({ nom: a.name, role: a.role })),
    etiquettes: fiche.tags.map((t) => ({ genre: t.kind, nom: t.name, coeur: false })),
    editions,
    tomes: fiche.volumes.map((v) => ({
      numero: v.number,
      titre: v.title,
      isbn: v.isbn,
      possession: avant?.tomes.find((t) => t.numero === v.number)?.possession ?? 'non_possede',
      lecture: avant?.tomes.find((t) => t.numero === v.number)?.lecture ?? 'a_lire',
      couverture: avant?.tomes.find((t) => t.numero === v.number)?.couverture ?? null,
    })),
    medias: fiche.media.map((m, rang) => ({
      id: m.id ?? `${id}-media-${rang}`,
      type: m.kind,
      titre: m.title,
      saisons: m.seasons,
      episodes: m.episodes_total,
      episodesVus: avant?.medias.find((x) => x.id === m.id)?.episodesVus ?? null,
      statut: avant?.medias.find((x) => x.id === m.id)?.statut ?? 'a_voir',
    })),
    statut: avant?.statut ?? 'a_decouvrir',
    possession: avant?.possession ?? 'non_possede',
    monEdition: mienne >= 0 ? editions[mienne].id : null,
    unite: avant?.unite ?? null,
    position: avant?.position ?? null,
    total: avant?.total ?? null,
    appreciation: avant?.appreciation ?? null,
    historique: avant?.historique ?? [],
  }
}

/** Ce que feraient changer_statut et noter_progression (supabase/migrations), en plus simple. */
const AUJOURDHUI = () => new Date().toISOString()
const noter = (o: OeuvreDetaillee, type: TypeEvenement, valeur: number | null = null): Evenement[] => [
  ...o.historique,
  { type, valeur, date: AUJOURDHUI(), precision: 'jour' },
]
function lectureOuverte(o: OeuvreDetaillee) {
  const bornes = o.historique.filter((e) => e.type === 'commence' || e.type === 'termine')
  return bornes[bornes.length - 1]?.type === 'commence'
}
const positionDe = (o: OeuvreDetaillee) =>
  o.estSerie ? progressionSerie(o.tomes.map((t) => ({ numero: t.numero, lecture: t.lecture }))).position : o.position

export function appliquerStatut(o: OeuvreDetaillee, statut: OeuvreDetaillee['statut']): OeuvreDetaillee {
  if (o.statut === statut) return o
  const ouverte = lectureOuverte(o)
  const position = positionDe(o)
  if (statut === 'en_cours') {
    const dejaLu = o.historique.some((e) => e.type === 'termine')
    if (o.statut === 'termine' || (!ouverte && dejaLu))
      return {
        ...o,
        statut,
        position: null,
        historique: noter(o, 'commence'),
        tomes: o.tomes.map((t) => ({ ...t, lecture: 'a_lire' })),
      }
    return { ...o, statut, historique: noter(o, ouverte ? 'repris' : 'commence', ouverte ? position : null) }
  }
  if (statut === 'termine' && ouverte) return { ...o, statut, historique: noter(o, 'termine', position) }
  if (statut === 'en_pause' && ouverte) return { ...o, statut, historique: noter(o, 'mis_en_pause', position) }
  return { ...o, statut }
}

export function appliquerProgression(o: OeuvreDetaillee, valeur: number | null): OeuvreDetaillee {
  if (o.estSerie) {
    if (valeur === null) return o
    return {
      ...o,
      tomes: o.tomes.map((t) => ({
        ...t,
        lecture: t.numero < valeur ? 'lu' : t.numero === valeur ? 'en_cours' : t.lecture === 'en_cours' ? 'a_lire' : t.lecture,
      })),
      historique: noter(o, 'progression', valeur),
    }
  }
  return { ...o, position: valeur, historique: valeur === null ? o.historique : noter(o, 'progression', valeur) }
}

function versEnCours(o: OeuvreDetaillee): EnCours {
  return {
    id: o.id,
    titre: versListee(o).titre,
    auteurs: o.auteurs.filter((a) => a.role === 'auteur').map((a) => a.nom),
    estSerie: o.estSerie,
    unite: o.unite,
    position: o.position,
    total: o.total,
    pagesEdition: o.editions.find((e) => e.id === o.monEdition)?.pageCount ?? null,
    tomes: o.tomes.map((t) => ({ numero: t.numero, lecture: t.lecture })),
    appreciation: o.appreciation,
    couverture: couvertureAffichee(couverturesDeLaFiche(o)),
  }
}

/** Fausse bibliothèque pour les tests : aucun réseau, tout est en mémoire. */
export function depotFictif(
  depart: {
    oeuvres?: OeuvreDetaillee[]
    catalogue?: OeuvreDetaillee[]
    lecture?: Lecture
    installation?: Installation
    /** Réponse imposée à toutes les écritures (sauf l'installation). */
    ecriture?: Ecriture
  } = {},
) {
  let oeuvres = depart.oeuvres ?? []
  let compteur = 0
  const appels = {
    listerOeuvres: 0,
    installerCatalogue: 0,
    enregistrerOeuvre: [] as FicheEnvoi[],
    ecritures: [] as { action: string; id: string; valeur?: unknown }[],
  }
  // Permet à un test de garder une installation « en cours » jusqu'à ce qu'il la libère.
  let liberer: (() => void) | null = null
  const attente = { active: false, liberer: () => liberer?.() }

  function modifier(id: string, action: string, valeur: unknown, changer: (o: OeuvreDetaillee) => OeuvreDetaillee): Ecriture {
    appels.ecritures.push({ action, id, valeur })
    if (depart.ecriture && !depart.ecriture.ok) return depart.ecriture
    const existe = oeuvres.some((o) => o.id === id)
    if (!existe) return { ok: false, echec: 'introuvable' }
    oeuvres = oeuvres.map((o) => (o.id === id ? changer(o) : o))
    return { ok: true }
  }

  const depot: Depot = {
    async listerOeuvres() {
      appels.listerOeuvres += 1
      return depart.lecture ?? { ok: true, oeuvres: oeuvres.map(versListee).sort((a, b) => comparerTitres(a.titre, b.titre)) }
    },
    async listerEnCours() {
      if (depart.lecture && !depart.lecture.ok) return depart.lecture
      // Le plus récemment touché d'abord : l'ordre des écritures fait foi ici.
      const recents = [...appels.ecritures].reverse().map((e) => e.id)
      const rang = (id: string) => (recents.includes(id) ? recents.indexOf(id) : recents.length)
      const lectures = oeuvres
        .filter((o) => o.statut === 'en_cours')
        .sort((a, b) => rang(a.id) - rang(b.id))
        .map(versEnCours)
      return { ok: true, lectures }
    },
    async lireOeuvre(id) {
      if (depart.lecture && !depart.lecture.ok) return depart.lecture
      const oeuvre = oeuvres.find((o) => o.id === id)
      return oeuvre ? { ok: true, oeuvre } : { ok: false, echec: 'introuvable' }
    },
    async lireVocabulaire() {
      const etiquettes = new Map(oeuvres.flatMap((o) => o.etiquettes).map((e) => [`${e.genre}:${e.nom}`, e]))
      const auteurs = new Set(oeuvres.flatMap((o) => o.auteurs.map((a) => a.nom)))
      return { ok: true, vocabulaire: { etiquettes: [...etiquettes.values()], auteurs: [...auteurs].sort() } }
    },
    async enregistrerOeuvre(fiche): Promise<Enregistrement> {
      appels.enregistrerOeuvre.push(fiche)
      if (depart.ecriture && !depart.ecriture.ok) return depart.ecriture
      const avant = fiche.id ? oeuvres.find((o) => o.id === fiche.id) : undefined
      if (fiche.id && !avant) return { ok: false, echec: 'introuvable' }
      const id = fiche.id ?? `nouvelle-${++compteur}`
      const apres = appliquerFiche(fiche, avant, id)
      oeuvres = avant ? oeuvres.map((o) => (o.id === id ? apres : o)) : [...oeuvres, apres]
      return { ok: true, id }
    },
    async changerStatut(id, statut) {
      return modifier(id, 'statut', statut, (o) => appliquerStatut(o, statut))
    },
    async noterProgression(id, valeur) {
      return modifier(id, 'progression', valeur, (o) => appliquerProgression(o, valeur))
    },
    async changerUnite(id, unite, total) {
      return modifier(id, 'unite', { unite, total }, (o) => ({ ...o, unite, total, position: null }))
    },
    async changerTotal(id, total) {
      return modifier(id, 'total', total, (o) => ({ ...o, total }))
    },
    async daterFin(id, date, precision) {
      return modifier(id, 'dateFin', { date, precision }, (o) => ({ ...o, historique: historiqueAvecFin(o.historique, date, precision) }))
    },
    async changerAppreciation(id, appreciation) {
      return modifier(id, 'appreciation', appreciation, (o) => ({ ...o, appreciation }))
    },
    async changerLectureTomes(id, choix, lecture) {
      return modifier(id, 'lectureTomes', { choix, lecture }, (o) => ({
        ...o,
        tomes: o.tomes.map((t) => (choix === 'tous' || (t.numero >= choix.de && t.numero <= choix.a) ? { ...t, lecture } : t)),
      }))
    },
    async changerMedia(id, media, valeurs) {
      return modifier(id, 'media', { media, ...valeurs }, (o) => ({
        ...o,
        medias: o.medias.map((m) =>
          m.id === media
            ? { ...m, episodesVus: valeurs.vus !== undefined ? valeurs.vus : m.episodesVus, statut: valeurs.statut ?? m.statut }
            : m,
        ),
      }))
    },
    async changerPossession(id, possession) {
      return modifier(id, 'possession', possession, (o) => ({ ...o, possession }))
    },
    async changerPossessionTomes(id, choix, possession) {
      return modifier(id, 'possessionTomes', { choix, possession }, (o) => ({
        ...o,
        tomes: o.tomes.map((t) => (choix === 'tous' || (t.numero >= choix.de && t.numero <= choix.a) ? { ...t, possession } : t)),
      }))
    },
    async changerMonEdition(id, edition) {
      return modifier(id, 'monEdition', edition, (o) => ({ ...o, monEdition: edition }))
    },
    // Ce que ferait la fonction noter_achat de la base, sans ses contrôles de forme.
    async noterAchat(id, achat) {
      appels.ecritures.push({ action: 'achat', id, valeur: achat })
      if (depart.ecriture && !depart.ecriture.ok) return depart.ecriture
      const oeuvre = oeuvres.find((o) => o.id === id)
      if (!oeuvre) return { ok: false, echec: 'introuvable' }
      const numero = achat.tome ?? null
      if (oeuvre.estSerie !== (numero !== null)) return { ok: false, echec: 'invalide' }
      const ailleurs = oeuvres.some(
        (o) =>
          (o.id !== id && (o.editions.some((e) => e.isbn === achat.isbn) || o.tomes.some((t) => t.isbn === achat.isbn))) ||
          (o.id === id && o.tomes.some((t) => t.isbn === achat.isbn && t.numero !== numero)),
      )
      if (ailleurs) return { ok: false, echec: 'isbn_ailleurs' }
      const remplacerOeuvre = (apres: OeuvreDetaillee) => void (oeuvres = oeuvres.map((o) => (o.id === id ? apres : o)))

      if (numero !== null) {
        if (!oeuvre.tomes.some((t) => t.numero === numero)) return { ok: false, echec: 'introuvable' }
        remplacerOeuvre({
          ...oeuvre,
          tomes: oeuvre.tomes.map((t) =>
            t.numero === numero ? { ...t, isbn: achat.isbn, possession: 'possede', couverture: achat.couverture ?? t.couverture ?? null } : t,
          ),
        })
        return { ok: true, edition: null }
      }

      const ancienne = oeuvre.editions.find((e) => e.id === oeuvre.monEdition)
      const reprise = oeuvre.editions.find((e) => e.isbn === achat.isbn)
      const achetee = reprise
        ? {
            ...reprise,
            publisher: reprise.publisher ?? achat.publisher ?? null,
            language: reprise.language ?? achat.language ?? null,
            format: reprise.format ?? achat.format ?? null,
            translator: reprise.translator ?? achat.translator ?? null,
            pageCount: reprise.pageCount ?? achat.page_count ?? null,
            couverture: achat.couverture ?? reprise.couverture ?? null,
          }
        : {
            id: `${id}-achat-${++compteur}`,
            isbn: achat.isbn,
            publisher: achat.publisher ?? null,
            language: achat.language ?? null,
            format: achat.format ?? null,
            translator: achat.translator ?? null,
            pageCount: achat.page_count ?? null,
            couverture: achat.couverture ?? null,
          }
      remplacerOeuvre({
        ...oeuvre,
        editions: reprise ? oeuvre.editions.map((e) => (e.id === reprise.id ? achetee : e)) : [...oeuvre.editions, achetee],
        monEdition: achetee.id,
        possession: 'possede',
        // Sans couverture sur l'édition achetée, celle qui s'affichait reste affichée.
        couverture: !achetee.couverture && ancienne?.couverture ? ancienne.couverture : oeuvre.couverture,
      })
      return { ok: true, edition: achetee.id }
    },
    async supprimerOeuvre(id) {
      const resultat = modifier(id, 'suppression', undefined, (o) => o)
      if (resultat.ok) oeuvres = oeuvres.filter((o) => o.id !== id)
      return resultat
    },
    async definirCouverture(id, cible, chemin) {
      return modifier(id, 'couverture', { cible, chemin }, (o) =>
        cible.type === 'oeuvre'
          ? { ...o, couverture: chemin }
          : cible.type === 'edition'
            ? { ...o, editions: o.editions.map((e) => (e.id === cible.edition ? { ...e, couverture: chemin } : e)) }
            : { ...o, tomes: o.tomes.map((t) => (t.numero === cible.numero ? { ...t, couverture: chemin } : t)) },
      )
    },
    async trouverParIsbn(isbn) {
      if (depart.lecture && !depart.lecture.ok) return depart.lecture
      for (const o of oeuvres) {
        if (o.editions.some((e) => e.isbn === isbn)) return { ok: true, trouve: { id: o.id, tome: null } }
        const tome = o.tomes.find((t) => t.isbn === isbn)
        if (tome) return { ok: true, trouve: { id: o.id, tome: tome.numero } }
      }
      return { ok: true, trouve: null }
    },
    async listerSansCouverture() {
      if (depart.lecture && !depart.lecture.ok) return depart.lecture
      const manques: ManqueCouverture[] = []
      for (const o of [...oeuvres].sort((a, b) => comparerTitres(a.titreFr, b.titreFr))) {
        if (o.estSerie) {
          for (const t of o.tomes.filter((x) => !x.couverture)) {
            manques.push({ oeuvre: o.id, titre: o.titreFr, tome: t.numero, isbn: t.isbn, cible: { type: 'tome', numero: t.numero } })
          }
          continue
        }
        const mienne = o.editions.find((e) => e.id === o.monEdition)
        if (o.couverture || mienne?.couverture) continue
        const avecIsbn = mienne?.isbn ? mienne : o.editions.find((e) => e.isbn)
        manques.push({
          oeuvre: o.id,
          titre: o.titreFr,
          tome: null,
          isbn: avecIsbn?.isbn ?? null,
          cible: cibleCouverture({ edition: avecIsbn?.id ?? null, monEdition: o.monEdition }),
        })
      }
      return { ok: true, manques }
    },
    async listerCouvertures() {
      if (depart.lecture && !depart.lecture.ok) return depart.lecture
      const couvertures: CouvertureRangee[] = []
      for (const o of [...oeuvres].sort((a, b) => comparerTitres(a.titreFr, b.titreFr))) {
        const commun = { oeuvre: o.id, titre: o.titreFr }
        if (o.couverture) couvertures.push({ ...commun, tome: null, chemin: o.couverture, isbn: null, cible: { type: 'oeuvre' } })
        for (const e of o.editions) {
          if (e.couverture) couvertures.push({ ...commun, tome: null, chemin: e.couverture, isbn: e.isbn, cible: { type: 'edition', edition: e.id } })
        }
        for (const t of [...o.tomes].sort((a, b) => a.numero - b.numero)) {
          if (t.couverture) couvertures.push({ ...commun, tome: t.numero, chemin: t.couverture, isbn: t.isbn, cible: { type: 'tome', numero: t.numero } })
        }
      }
      return { ok: true, couvertures }
    },
    async installerCatalogue() {
      appels.installerCatalogue += 1
      if (attente.active) await new Promise<void>((suite) => (liberer = suite))
      const resultat = depart.installation ?? { ok: true }
      if (resultat.ok) oeuvres = depart.catalogue ?? []
      return resultat
    },
  }

  return { depot, appels, attente, oeuvres: () => oeuvres }
}
