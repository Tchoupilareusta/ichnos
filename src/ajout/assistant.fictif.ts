import type { Assistant, FicheProposee, ImageTrouvee, Notice, OeuvrePourFiche, RefCouverture, Reponse, ReponseIsbn, ReponseTitre, Resultat } from './assistant'

const INDISPONIBLE = { ok: false as const, echec: 'indisponible' as const }
const SOURCES = { bnf: 'ok', google_books: 'ok', open_library: 'ok' } as const

/** Une notice de test : seuls les champs utiles au test sont à donner. */
export function noticeFictive(champs: Partial<Notice> = {}): Notice {
  return {
    titre: null,
    titreOriginal: null,
    auteurs: null,
    traducteur: null,
    editeur: null,
    pages: null,
    langue: null,
    langueOriginale: null,
    annee: null,
    tome: null,
    manga: false,
    ...champs,
  }
}

export const reponseIsbnFictive = (champs: Partial<ReponseIsbn> & { notice: Notice }): Reponse<ReponseIsbn> => ({
  ok: true,
  valeur: { trouve: true, descriptions: [], couverture: null, sources: SOURCES, ...champs },
})

export function resultatFictif(champs: Omit<Partial<Resultat>, 'titre'> & { titre: string }): Resultat {
  const { titre, ...reste } = champs
  return {
    titre: { valeur: titre, source: 'bnf' },
    titreOriginal: null,
    auteurs: null,
    langueOriginale: null,
    annee: null,
    manga: false,
    serie: false,
    descriptions: [],
    couverture: null,
    ...reste,
  }
}

export const reponseTitreFictive = (resultats: Resultat[]): Reponse<ReponseTitre> => ({ ok: true, valeur: { resultats, sources: SOURCES } })

export const ficheFictive = (champs: Partial<FicheProposee> = {}): FicheProposee => ({
  synopsis: null,
  genres: [],
  themes: [],
  atmospheres: [],
  themesNouveaux: [],
  tonalite: null,
  exigence: null,
  longueur: null,
  ...champs,
})

type DemandeCouverture = { isbn: string } | { ref: RefCouverture }

/** Faux assistant pour les tests : aucun réseau, des réponses fixées d'avance. Sans réponse prévue, il est « indisponible ». */
export function assistantFictif(
  reponses: {
    isbn?: Reponse<ReponseIsbn> | ((isbn: string) => Reponse<ReponseIsbn>)
    titre?: Reponse<ReponseTitre>
    couverture?: Reponse<ImageTrouvee | null> | ((demande: DemandeCouverture) => Reponse<ImageTrouvee | null>)
    fiche?: Reponse<FicheProposee>
  } = {},
) {
  const appels = {
    chercherIsbn: [] as string[],
    chercherTitre: [] as { titre: string; auteur?: string }[],
    couverture: [] as DemandeCouverture[],
    proposerFiche: [] as OeuvrePourFiche[],
  }
  // Permet à un test de garder la proposition de l'IA « en cours » jusqu'à ce qu'il la libère.
  let liberer: (() => void) | null = null
  const attente = { active: false, liberer: () => liberer?.() }

  const assistant: Assistant = {
    async chercherIsbn(isbn) {
      appels.chercherIsbn.push(isbn)
      const reponse = reponses.isbn ?? INDISPONIBLE
      return typeof reponse === 'function' ? reponse(isbn) : reponse
    },
    async chercherTitre(titre, auteur) {
      appels.chercherTitre.push(auteur ? { titre, auteur } : { titre })
      return reponses.titre ?? INDISPONIBLE
    },
    async couverture(demande) {
      appels.couverture.push(demande)
      const reponse = reponses.couverture ?? INDISPONIBLE
      return typeof reponse === 'function' ? reponse(demande) : reponse
    },
    async proposerFiche(oeuvre) {
      appels.proposerFiche.push(oeuvre)
      if (attente.active) await new Promise<void>((suite) => (liberer = suite))
      return reponses.fiche ?? INDISPONIBLE
    },
  }
  return { assistant, appels, attente }
}

/** Une couverture trouvée, pour les tests : 600 px de large par défaut, donc pas « de petite taille ». */
export const imageFictive = (champs: Partial<ImageTrouvee> = {}) => ({
  ok: true as const,
  valeur: { image: new Blob(['image'], { type: 'image/jpeg' }), source: 'open_library' as const, largeur: 600, hauteur: 900, ...champs },
})
