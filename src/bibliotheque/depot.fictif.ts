import { titresAffiches } from '../catalogue/titres'
import type {
  Depot,
  Ecriture,
  Enregistrement,
  FicheEnvoi,
  Installation,
  Lecture,
  OeuvreDetaillee,
  OeuvreListee,
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
    auteurs: fiche.authors.map((a) => ({ nom: a.name, role: a.role })),
    etiquettes: fiche.tags.map((t) => ({ genre: t.kind, nom: t.name, coeur: false })),
    editions,
    tomes: fiche.volumes.map((v) => ({
      numero: v.number,
      titre: v.title,
      isbn: v.isbn,
      possession: avant?.tomes.find((t) => t.numero === v.number)?.possession ?? 'non_possede',
    })),
    medias: fiche.media.map((m, rang) => ({
      id: m.id ?? `${id}-media-${rang}`,
      type: m.kind,
      titre: m.title,
      saisons: m.seasons,
      episodes: m.episodes_total,
      episodesVus: avant?.medias.find((x) => x.id === m.id)?.episodesVus ?? null,
    })),
    statut: avant?.statut ?? 'a_decouvrir',
    possession: avant?.possession ?? 'non_possede',
    monEdition: mienne >= 0 ? editions[mienne].id : null,
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
      return modifier(id, 'statut', statut, (o) => ({ ...o, statut }))
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
    async supprimerOeuvre(id) {
      const resultat = modifier(id, 'suppression', undefined, (o) => o)
      if (resultat.ok) oeuvres = oeuvres.filter((o) => o.id !== id)
      return resultat
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
