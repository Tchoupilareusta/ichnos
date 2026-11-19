// Catalogue général de la BnF, par son API publique SRU (sans clé).
// Les notices sont au format UNIMARC en XML. On lit seulement les champs utiles :
//   010 $a ISBN · 101 langue ($c langue d'origine) · 200 titre ($h numéro de tome)
//   210 ou 214 $c éditeur, $d année · 215 $a pagination, $d hauteur · 225 $a collection
//   330 $a résumé · 454 $t titre original
//   461 $v numéro de tome · 700/701 auteurs · 702 $4 730 traducteur.
// Règle : ce que la notice ne dit pas clairement reste vide.

import { langueDepuisTroisLettres } from './langues.ts'

export type NoticeBnf = {
  isbn: string | null
  titre: string | null
  tome: number | null
  /** Les auteurs sous la forme du catalogue (« Fedor Mihajlovič Dostoevskij ») : stable d'une édition à l'autre. */
  auteurs: string[]
  /** Le nom de l'auteur tel qu'il est imprimé sur le livre (« Fiodor Dostoïevski »), si c'est bien un simple nom. */
  signature: string | null
  traducteur: string | null
  editeur: string | null
  pages: number | null
  langue: string | null
  langueOriginale: string | null
  titreOriginal: string | null
  description: string | null
  /** La collection (« Folio »), sans le mot « Collection ». */
  collection: string | null
  /** L'année de cette édition (« impr. 2013 », « DL 2022 »), pas celle de l'œuvre. */
  annee: number | null
  /** La hauteur du livre en centimètres : 18 ou moins, c'est un poche. */
  hauteur: number | null
}

const BASE = 'https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&recordSchema=unimarcXchange'

/** Un texte sûr à placer entre guillemets dans une requête : sans guillemet ni barre oblique inverse. */
const pourRequete = (texte: string) => texte.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim()

export const adresseBnfIsbn = (isbn: string) =>
  `${BASE}&maximumRecords=5&query=${encodeURIComponent(`bib.isbn any "${pourRequete(isbn)}"`)}`

export function adresseBnfTitre(titre: string, auteur?: string) {
  const parties = [`bib.title all "${pourRequete(titre)}"`]
  if (auteur) parties.push(`bib.author all "${pourRequete(auteur)}"`)
  // doctype « a » : les textes imprimés (ni films, ni enregistrements).
  parties.push('bib.doctype any "a"')
  return `${BASE}&maximumRecords=50&query=${encodeURIComponent(parties.join(' and '))}`
}

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decoder(texte: string): string {
  return texte
    .replace(/&#x([0-9a-f]+);/gi, (_, hexa: string) => String.fromCodePoint(parseInt(hexa, 16)))
    .replace(/&#(\d+);/g, (_, nombre: string) => String.fromCodePoint(Number(nombre)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, nom: string) => ENTITES[nom])
    .replace(/\s+/g, ' ')
    .trim()
}

type Zone = { etiquette: string; ind1: string; sous: { code: string; valeur: string }[] }

function lireZones(notice: string): Zone[] {
  const zones: Zone[] = []
  const motif = /<mxc:datafield tag="(\d{3})" ind1="(.)" ind2="."[^>]*>([\s\S]*?)<\/mxc:datafield>/g
  for (const zone of notice.matchAll(motif)) {
    const sous = [...zone[3].matchAll(/<mxc:subfield code="(.)">([\s\S]*?)<\/mxc:subfield>/g)].map((s) => ({
      code: s[1],
      valeur: decoder(s[2]),
    }))
    zones.push({ etiquette: zone[1], ind1: zone[2], sous })
  }
  return zones
}

const premier = (zones: Zone[], etiquette: string, code: string): string | null =>
  zones.find((z) => z.etiquette === etiquette)?.sous.find((s) => s.code === code)?.valeur || null

const entier = (texte: string | null): number | null => {
  const trouve = texte?.match(/\d+/)
  const nombre = trouve ? Number(trouve[0]) : NaN
  return Number.isInteger(nombre) && nombre > 0 && nombre < 10000 ? nombre : null
}

/** « impr. 2013 », « DL 2022 », « 1991 » : l'année, si elle est écrite en toutes lettres. */
const anneeEdition = (texte: string | null): number | null => {
  const trouve = texte?.match(/\b(1[4-9]\d\d|20\d\d)\b/)
  return trouve ? Number(trouve[1]) : null
}

/** « 18 cm » : la hauteur du livre. Un format ancien (« in-8 ») reste inconnu. */
const hauteurLivre = (texte: string | null): number | null => {
  const trouve = texte?.match(/\b(\d{1,2})\s*cm\b/)
  return trouve ? Number(trouve[1]) : null
}

/** « Ende » + « Michael » donne « Michael Ende ». */
function nom(zone: Zone): string | null {
  const famille = zone.sous.find((s) => s.code === 'a')?.valeur
  const prenom = zone.sous.find((s) => s.code === 'b')?.valeur
  return [prenom, famille].filter(Boolean).join(' ') || null
}

/**
 * La mention d'auteur imprimée (200 $f), seulement si c'est un simple nom : un à cinq mots,
 * le premier avec une majuscule, sans rôle (« adapté par… ») ni liste (« X et Y », « X,... »).
 */
function signature(mention: string | null): string | null {
  const propre = mention?.trim()
  if (!propre || !/^\p{Lu}[\p{L}.'’-]*(\s+[\p{L}.'’-]+){0,4}$/u.test(propre)) return null
  if (/(^|\s)(par|et|avec|sous|dir\.|publ\.|trad\.|collection|d'après|d’après)(\s|$)/i.test(propre)) return null
  return propre
}

/** La pagination seulement quand elle est sans ambiguïté : un seul nombre de pages. */
function pagination(texte: string | null): number | null {
  if (!texte) return null
  const nombres = [...texte.matchAll(/(\d+)\s*p\./g)]
  if (nombres.length !== 1 || /\d\s*,\s*\d+\s*p\./.test(texte)) return null
  return entier(nombres[0][1])
}

function lireNotice(notice: string): NoticeBnf {
  const zones = lireZones(notice)
  const fonction = (zone: Zone) => zone.sous.find((s) => s.code === '4')?.valeur ?? null

  const isbn = premier(zones, '010', 'a')?.replace(/[\s-]/g, '') ?? null
  const langues = zones.find((z) => z.etiquette === '101')
  const auteurs = zones
    .filter((z) => (z.etiquette === '700' || z.etiquette === '701') && (fonction(z) === '070' || fonction(z) === null))
    .map(nom)
    .filter((n): n is string => !!n)
  const traducteur = zones.filter((z) => z.etiquette.startsWith('70') && fonction(z) === '730').map(nom)[0] ?? null

  return {
    isbn: isbn && /^97[89]\d{10}$/.test(isbn) ? isbn : null,
    titre: premier(zones, '200', 'a'),
    tome: entier(premier(zones, '200', 'h')) ?? entier(premier(zones, '461', 'v')),
    auteurs: [...new Set(auteurs)],
    signature: signature(premier(zones, '200', 'f')),
    traducteur,
    editeur: premier(zones, '210', 'c') ?? premier(zones, '214', 'c'),
    pages: pagination(premier(zones, '215', 'a')),
    langue: langueDepuisTroisLettres(langues?.sous.find((s) => s.code === 'a')?.valeur),
    // $c : la langue d'origine d'une traduction. Absente, on ne la déduit de rien.
    langueOriginale: langueDepuisTroisLettres(langues?.sous.find((s) => s.code === 'c')?.valeur),
    // « Momo : ein Märchen-Roman » : on garde le titre, pas son complément.
    titreOriginal: premier(zones, '454', 't')?.split(' : ')[0].trim() || null,
    description: premier(zones, '330', 'a'),
    collection: premier(zones, '225', 'a')?.replace(/^collection\s+/i, '').trim() || null,
    annee: anneeEdition(premier(zones, '210', 'd') ?? premier(zones, '214', 'd')),
    hauteur: hauteurLivre(premier(zones, '215', 'd')),
  }
}

/** Toutes les notices d'une réponse SRU. Une réponse vide ou illisible donne une liste vide. */
export function lireNoticesBnf(xml: string): NoticeBnf[] {
  return xml
    .split('<srw:record>')
    .slice(1)
    .map(lireNotice)
    .filter((notice) => notice.titre !== null)
}
