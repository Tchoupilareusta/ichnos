// Vérification de tout ce que la fonction reçoit. Règle : une demande est lue champ par champ,
// et tout champ inconnu la fait refuser. Rien de personnel ne peut donc voyager par erreur,
// et aucune adresse ne peut être glissée à la place d'une référence.

import type { Demande, Description, OeuvrePourFiche, RefCouverture, Source } from './contrat.ts'

const SOURCES: Source[] = ['bnf', 'google_books', 'open_library']

export const LONGUEUR_MAX_CORPS = 24_000
const TITRE_MAX = 200
const NOM_MAX = 120
const DESCRIPTION_MAX = 4000
const AUTEURS_MAX = 6
const DESCRIPTIONS_MAX = 3

/** L'ISBN à 13 chiffres sous forme compacte, ou null s'il est mal formé ou si son chiffre de contrôle est faux. */
export function isbn13(saisie: unknown): string | null {
  if (typeof saisie !== 'string' || saisie.length > 30) return null
  const compact = saisie.replace(/[\s-]/g, '')
  if (!/^97[89]\d{10}$/.test(compact)) return null
  const somme = [...compact].reduce((total, chiffre, rang) => total + Number(chiffre) * (rang % 2 === 0 ? 1 : 3), 0)
  return somme % 10 === 0 ? compact : null
}

const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)

/** Vrai si l'objet n'a que des clés permises. */
const seulement = (objet: Record<string, unknown>, cles: string[]) => Object.keys(objet).every((cle) => cles.includes(cle))

// Tabulation et saut de ligne sont permis dans un texte long ; aucun autre caractère de contrôle.
// deno-lint-ignore no-control-regex
const CONTROLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

/** Un texte non vide, sans caractère de contrôle, d'une longueur raisonnable ; sinon null. */
function texte(valeur: unknown, max: number): string | null {
  if (typeof valeur !== 'string' || valeur.length > max * 2) return null
  const propre = valeur.trim()
  if (!propre || propre.length > max || CONTROLE.test(propre)) return null
  return propre
}

function refCouverture(valeur: unknown): RefCouverture | null {
  if (!estObjet(valeur)) return null
  if (valeur.source === 'google_books' && seulement(valeur, ['source', 'id'])) {
    // Un identifiant de volume Google Books : lettres, chiffres, tiret et souligné, rien d'autre.
    return typeof valeur.id === 'string' && /^[A-Za-z0-9_-]{6,24}$/.test(valeur.id) ? { source: 'google_books', id: valeur.id } : null
  }
  if (valeur.source === 'open_library' && seulement(valeur, ['source', 'isbn'])) {
    const isbn = isbn13(valeur.isbn)
    return isbn ? { source: 'open_library', isbn } : null
  }
  if (valeur.source === 'open_library' && seulement(valeur, ['source', 'numero'])) {
    const numero = valeur.numero
    return typeof numero === 'number' && Number.isInteger(numero) && numero > 0 && numero < 1e12
      ? { source: 'open_library', numero }
      : null
  }
  return null
}

function description(valeur: unknown): Description | null {
  if (!estObjet(valeur) || !seulement(valeur, ['texte', 'source'])) return null
  const contenu = texte(valeur.texte, DESCRIPTION_MAX)
  if (!contenu || !SOURCES.includes(valeur.source as Source)) return null
  return { texte: contenu, source: valeur.source as Source }
}

function oeuvrePourFiche(valeur: unknown): OeuvrePourFiche | null {
  if (!estObjet(valeur)) return null
  if (!seulement(valeur, ['titre', 'titreOriginal', 'auteurs', 'annee', 'langueOriginale', 'descriptions'])) return null

  const titre = texte(valeur.titre, TITRE_MAX)
  if (!titre) return null
  const oeuvre: OeuvrePourFiche = { titre, auteurs: [], descriptions: [] }

  if (valeur.titreOriginal !== undefined) {
    const titreOriginal = texte(valeur.titreOriginal, TITRE_MAX)
    if (!titreOriginal) return null
    oeuvre.titreOriginal = titreOriginal
  }

  if (!Array.isArray(valeur.auteurs) || valeur.auteurs.length > AUTEURS_MAX) return null
  for (const auteur of valeur.auteurs) {
    const nom = texte(auteur, NOM_MAX)
    if (!nom) return null
    oeuvre.auteurs.push(nom)
  }

  if (valeur.annee !== undefined) {
    const annee = valeur.annee
    if (typeof annee !== 'number' || !Number.isInteger(annee) || annee < -3000 || annee > 2100) return null
    oeuvre.annee = annee
  }

  if (valeur.langueOriginale !== undefined) {
    if (typeof valeur.langueOriginale !== 'string' || !/^[a-z]{2,3}$/.test(valeur.langueOriginale)) return null
    oeuvre.langueOriginale = valeur.langueOriginale
  }

  if (!Array.isArray(valeur.descriptions) || valeur.descriptions.length > DESCRIPTIONS_MAX) return null
  for (const element of valeur.descriptions) {
    const lue = description(element)
    if (!lue) return null
    oeuvre.descriptions.push(lue)
  }
  return oeuvre
}

/** La demande, vérifiée et nettoyée, ou null si elle est mal formée. */
export function lireDemande(corps: unknown): Demande | null {
  if (!estObjet(corps)) return null

  switch (corps.action) {
    case 'chercher_isbn': {
      if (!seulement(corps, ['action', 'isbn'])) return null
      const isbn = isbn13(corps.isbn)
      return isbn ? { action: 'chercher_isbn', isbn } : null
    }
    case 'chercher_titre': {
      if (!seulement(corps, ['action', 'titre', 'auteur'])) return null
      const titre = texte(corps.titre, TITRE_MAX)
      if (!titre) return null
      if (corps.auteur === undefined) return { action: 'chercher_titre', titre }
      const auteur = texte(corps.auteur, NOM_MAX)
      return auteur ? { action: 'chercher_titre', titre, auteur } : null
    }
    case 'couverture': {
      if (seulement(corps, ['action', 'isbn']) && corps.isbn !== undefined) {
        const isbn = isbn13(corps.isbn)
        return isbn ? { action: 'couverture', isbn } : null
      }
      if (seulement(corps, ['action', 'ref']) && corps.ref !== undefined) {
        const ref = refCouverture(corps.ref)
        return ref ? { action: 'couverture', ref } : null
      }
      return null
    }
    case 'autres_couvertures': {
      if (!seulement(corps, ['action', 'titre', 'auteur', 'langue', 'isbn', 'editeur'])) return null
      const titre = texte(corps.titre, TITRE_MAX)
      // La langue entre dans une adresse : français ou anglais, rien d'autre.
      if (!titre || (corps.langue !== 'fr' && corps.langue !== 'en')) return null
      const demande: Extract<Demande, { action: 'autres_couvertures' }> = { action: 'autres_couvertures', titre, langue: corps.langue }
      if (corps.auteur !== undefined) {
        const auteur = texte(corps.auteur, NOM_MAX)
        if (!auteur) return null
        demande.auteur = auteur
      }
      if (corps.isbn !== undefined) {
        const isbn = isbn13(corps.isbn)
        if (!isbn) return null
        demande.isbn = isbn
      }
      if (corps.editeur !== undefined) {
        const editeur = texte(corps.editeur, NOM_MAX)
        if (!editeur) return null
        demande.editeur = editeur
      }
      return demande
    }
    case 'fiche': {
      if (!seulement(corps, ['action', 'oeuvre'])) return null
      const oeuvre = oeuvrePourFiche(corps.oeuvre)
      return oeuvre ? { action: 'fiche', oeuvre } : null
    }
    default:
      return null
  }
}
