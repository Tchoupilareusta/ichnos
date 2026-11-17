// Page de relecture du catalogue de départ : une fiche par œuvre, fabriquée à partir de
// catalogue/catalogue-initial.json. Outil de préparation (étape 3), hors de l'application.
// Les règles d'affichage (ordre des titres, « traduit de l’anglais ») sont celles de l'application.
import { nomLangue, traduitDe } from '../../src/catalogue/langues.ts'
import { titresAffiches } from '../../src/catalogue/titres.ts'

const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const FORMES = { roman: 'Roman', roman_court: 'Roman court', nouvelle: 'Nouvelle', conte: 'Conte', poesie: 'Poésie', essai: 'Essai', philosophie: 'Philosophie', manga: 'Manga', autre: 'Autre' }
const TONS = ['', 'très sombre', 'sombre', 'entre-deux', 'plutôt lumineux', 'lumineux']
const EXIGENCES = ['', 'très accessible', 'accessible', 'demande de l’attention', 'exigeant', 'très exigeant']
const LONGUEURS = { court: 'Court', moyen: 'Moyen', long: 'Long' }

const isbnLisible = (isbn) => `${isbn.slice(0, 3)}-${isbn.slice(3, 4)}-${isbn.slice(4, 12)}-${isbn.slice(12)}`
const vide = '<em>laissé vide</em>'

/** Ligne d'origine d'une œuvre : titre secondaire, langue, année. Exportée pour être testée. */
export function origine(oeuvre) {
  const edition = oeuvre.editions[0]
  const { secondaire } = titresAffiches(oeuvre, edition.language)
  const langue = oeuvre.original_language
  let provenance = null
  if (langue && langue !== edition.language) provenance = traduitDe(langue)
  else if (langue && langue !== 'fr') provenance = `édition en ${nomLangue(langue) ?? langue}, la langue d’origine`
  return [
    secondaire,
    provenance,
    oeuvre.first_published_year ? `première parution en ${oeuvre.first_published_year}` : 'année de première parution laissée vide',
  ].filter(Boolean)
}

function echelle(valeur, mots) {
  const points = [1, 2, 3, 4, 5].map((n) => `<i class="${n <= valeur ? 'plein' : ''}"></i>`).join('')
  return `<span class="echelle" role="img" aria-label="${valeur} sur 5, ${e(mots[valeur])}">${points}</span> <span class="mot">${valeur} · ${e(mots[valeur])}</span>`
}

function fiche(o, interets) {
  const ed = o.editions[0]
  const { principal } = titresAffiches(o, ed.language)
  const theme = (nom) => `<span class="theme">${e(nom)}${interets.has(nom) ? '<span class="coeur" title="Centre d’intérêt"> ★</span>' : ''}</span>`
  const tomes = o.volumes.length
    ? `<details><summary>${o.volumes.length} tomes · ${o.volumes.filter((v) => v.isbn).length} ISBN vérifiés</summary><ol class="tomes">${o.volumes
        .map((v) => `<li><span>t. ${v.number}</span> ${v.isbn ? e(isbnLisible(v.isbn)) : '<em>vide</em>'}${v.title ? ` <small>${e(v.title)}</small>` : ''}</li>`)
        .join('')}</ol></details>`
    : ''
  const medias = o.media.map((m) => `<p class="ligne"><b>Média associé</b> ${e(m.kind)} · ${m.seasons} saison${m.seasons > 1 ? 's' : ''} · ${m.episodes_total} épisodes</p>`).join('')
  const liste = (titre, lignes) => (lignes?.length ? `<section><h3>${titre}</h3><ul>${lignes.map((l) => `<li>${e(l)}</li>`).join('')}</ul></section>` : '')
  return `
<article class="fiche" id="${e(o.key)}">
  <header>
    <p class="surtitre">${e(FORMES[o.form])}${o.is_series ? ' · série' : ''}</p>
    <h2>${e(principal)}</h2>
    <p class="auteur">${o.authors.map((a) => e(a.name)).join(', ')}</p>
    <p class="origine">${origine(o).map(e).join(' · ')}</p>
    <p class="themes">${o.themes.map(theme).join(' ')}</p>
  </header>
  ${o.relecture.a_trancher ? `<p class="trancher"><b>À trancher</b> ${e(o.relecture.a_trancher)}</p>` : ''}
  <p class="synopsis">${e(o.synopsis)}</p>
  <dl class="reperes">
    <div><dt>Genre</dt><dd>${o.genres.map(e).join(' · ')}</dd></div>
    <div><dt>Atmosphère</dt><dd>${o.atmospheres.map(e).join(' · ')}</dd></div>
    <div><dt>Tonalité</dt><dd>${echelle(o.tone, TONS)}</dd></div>
    <div><dt>Exigence</dt><dd>${echelle(o.density, EXIGENCES)}</dd></div>
    <div><dt>Longueur</dt><dd>${e(LONGUEURS[o.length])}</dd></div>
  </dl>
  <section class="edition">
    <h3>Édition proposée</h3>
    <p>${e(o.relecture.edition_proposee)}</p>
    <p class="ligne"><b>Éditeur</b> ${ed.publisher ? e(ed.publisher) : vide}${ed.translator ? ` · <b>Traduction</b> ${e(ed.translator)}` : ''} · <b>Format</b> ${ed.format ? e(ed.format) : vide} · <b>Langue</b> ${e(nomLangue(ed.language) ?? ed.language)}</p>
    <p class="ligne"><b>ISBN</b> ${ed.isbn ? `<span class="isbn">${e(isbnLisible(ed.isbn))}</span>` : vide} · <b>Pages</b> ${ed.page_count ?? vide}</p>
    ${tomes}${medias}
  </section>
  ${liste('Mes remarques', o.relecture.remarques)}
  ${liste('Autres éditions possibles', o.relecture.autres_editions)}
  <section><h3>Sources</h3><ul class="sources">${o.relecture.sources
    .map((s) => `<li><a href="${e(s.url)}" target="_blank" rel="noopener">${e(s.label)}</a></li>`)
    .join('')}</ul></section>
</article>`
}

const STYLE = `
/* Une colonne de lecture, fiches l'une sous l'autre, jetons d'Ichnos (docs/reference.md §4). */
:root {
  --fond: #F5EFE6; --surface: #FBF8F3; --encre: #2A2420; --encre-2: #6E625A;
  --accent: #550000; --lien: #550000; --accent-doux: #EEDDD8; --bord: #DDD0C0; --surligne: #EBD3CD;
  --titre: 'Lora', Georgia, 'Times New Roman', serif;
  --texte: 'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --fond: #151413; --surface: #262422; --encre: #EEEAE4; --encre-2: #A6A099;
  --accent: #C46A6A; --lien: #EEEAE4; --accent-doux: #3A1E1D; --bord: #3A3734; --surligne: #4A2524; color-scheme: dark } }
:root[data-theme="dark"] {
  --fond: #151413; --surface: #262422; --encre: #EEEAE4; --encre-2: #A6A099;
  --accent: #C46A6A; --lien: #EEEAE4; --accent-doux: #3A1E1D; --bord: #3A3734; --surligne: #4A2524; color-scheme: dark }
* { box-sizing: border-box }
body { background: var(--fond); color: var(--encre); font: 1rem/1.6 var(--texte);
  padding-block: 2.5rem 4rem; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)) }
main { max-width: 44rem; margin-inline: auto; display: flex; flex-direction: column; gap: 2rem }
h1, h2, h3 { font-family: var(--titre); font-weight: 600; margin: 0; text-wrap: balance }
h1 { font-size: 2rem; line-height: 1.2 }
h2 { font-size: 1.625rem; line-height: 1.25 }
h3 { font-size: 1.0625rem }
p, ul, ol, dl { margin: 0 }
a { color: var(--lien); text-underline-offset: 0.2em }
a:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px }
.surtitre { font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--encre-2) }
.entete { display: flex; flex-direction: column; gap: 0.75rem }
.entete p { max-width: 38rem }
.sommaire { columns: 2 15rem; column-gap: 2rem; padding: 0; list-style: none }
.sommaire li { break-inside: avoid }
.sommaire a { display: flex; align-items: center; min-height: 2.75rem }
.bloc, .fiche { background: var(--surface); border: 1px solid var(--bord); border-radius: 24px; padding: 1.5rem;
  display: flex; flex-direction: column; gap: 1.25rem; min-width: 0 }
.bloc > ul, .groupe > ul, .fiche section > ul { padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.35rem }
ul.mots { display: flex; flex-flow: row wrap; gap: 0.3rem 1rem; padding: 0; list-style: none }
.groupe { display: flex; flex-direction: column; gap: 0.5rem }
.fiche header { display: flex; flex-direction: column; gap: 0.3rem }
.auteur { font-size: 1.0625rem; font-weight: 600 }
.origine { color: var(--encre-2); font-size: 0.9375rem }
.themes { margin-top: 0.5rem; line-height: 2 }
.theme { font-family: var(--titre); font-style: italic; font-size: 1.0625rem; background: var(--surligne); padding: 0.2em 0.35em;
  margin-right: 0.2rem; box-decoration-break: clone; -webkit-box-decoration-break: clone }
.coeur { font-style: normal; font-size: 0.8em; color: var(--accent) }
.trancher { background: var(--accent-doux); border-radius: 16px; padding: 0.9rem 1.1rem }
.synopsis { font-size: 1.0625rem; max-width: 65ch }
.reperes { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.9rem 1.5rem }
.reperes dt, .ligne b, .trancher b { font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--encre-2) }
.reperes dd { margin: 0 }
.ligne b, .trancher b { margin-right: 0.25rem }
.echelle { display: inline-flex; gap: 4px; vertical-align: middle; margin-right: 0.35rem }
.echelle i { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid var(--accent) }
.echelle i.plein { background: var(--accent) }
.fiche section { display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid var(--bord); padding-top: 1.1rem }
.isbn, .tomes { font-variant-numeric: tabular-nums }
summary { cursor: pointer; min-height: 2.75rem; display: flex; align-items: center; font-weight: 600 }
.tomes { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.2rem 1rem; font-size: 0.9375rem }
.tomes span { display: inline-block; width: 2.6rem; color: var(--encre-2) }
.tomes small { color: var(--encre-2) }
.sources { font-size: 0.9375rem }
em { color: var(--encre-2) }
`

/** La page entière, en HTML (sans doctype : la plateforme de publication l'ajoute). */
export function pageRelecture(catalogue) {
  const interets = new Set(catalogue.tags.theme.filter((t) => t.is_interest).map((t) => t.name))
  const parCle = Object.fromEntries(catalogue.works.map((o) => [o.key, o]))
  const titre = (o) => titresAffiches(o, o.editions[0].language).principal
  const lienFiche = (o) => `<a href="#${e(o.key)}">${e(titre(o))}</a>`
  const mots = (liste) => `<ul class="mots">${liste.map((m) => `<li>${e(m)}</li>`).join('')}</ul>`
  const general = catalogue.relecture_generale
  const aTrancher = catalogue.works.filter((o) => o.relecture.a_trancher)
  const tomes = catalogue.works.reduce((total, o) => total + o.volumes.length, 0)

  return `<title>Ichnos, relecture du catalogue</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;1,500&family=Nunito:wght@400;600;700&display=swap">
<style>${STYLE}</style>
<main>
  <header class="entete">
    <p class="surtitre">Ichnos · catalogue de départ</p>
    <h1>Relecture du catalogue</h1>
    <p>${catalogue.works.length} œuvres, dont ${catalogue.works.filter((o) => o.is_series).length} séries (${tomes} tomes). Rien n’est encore importé dans la bibliothèque : l’import attend votre « catalogue validé ».</p>
  </header>

  <section class="bloc">
    <h2>Ce qui demande votre avis</h2>
    <ul>${general.points.map((p) => `<li>${e(p)}</li>`).join('')}</ul>
    <div class="groupe"><h3>Thèmes que je propose d’ajouter</h3>
      <p>Ils ne sont pas dans le vocabulaire et ne sont posés sur aucune fiche tant que vous ne les avez pas acceptés.</p>
      <ul>${general.themes_proposes.map((t) => `<li><b>${e(t.name)}</b> : ${e(t.raison)} Pour ${t.pour.map((k) => lienFiche(parCle[k])).join(', ')}.</li>`).join('')}</ul></div>
    <div class="groupe"><h3>Fiches avec un choix à faire</h3>
      <ul>${aTrancher.map((o) => `<li>${lienFiche(o)} : ${e(o.relecture.a_trancher)}</li>`).join('')}</ul></div>
  </section>

  <section class="bloc">
    <h2>Comment corriger</h2>
    <ul>
      <li>Dites-le en langage courant dans la conversation, par exemple « Momo : tonalité 5, retirer Onirique », ou laissez un commentaire sur cette page.</li>
      <li>Tout se corrige : synopsis, étiquettes, tonalité, exigence, longueur, édition retenue.</li>
      <li>Un champ marqué « laissé vide » n’a pas pu être vérifié dans une source fiable. Il reste vide plutôt qu’inventé.</li>
    </ul>
  </section>

  <section class="bloc">
    <h2>Les ${catalogue.works.length} œuvres</h2>
    <ul class="sommaire">${catalogue.works.map((o) => `<li>${lienFiche(o)}</li>`).join('')}</ul>
  </section>

  <section class="bloc">
    <h2>Repères</h2>
    <div class="groupe"><h3>Tonalité</h3><p>De 1, très sombre (1984), à 5, lumineux (Un psaume pour les recyclés sauvages).</p></div>
    <div class="groupe"><h3>Exigence</h3><p>De 1, très accessible (Le Petit Prince), à 5, très exigeant (Le Gai Savoir).</p></div>
    <div class="groupe"><h3>Longueur</h3><p>Court : moins de 150 pages environ. Moyen : entre les deux. Long : plus de 400 pages, et les séries.</p></div>
  </section>

  <section class="bloc">
    <h2>Vocabulaire d’étiquettes</h2>
    <div class="groupe"><h3>Genres</h3>${mots(catalogue.tags.genre)}</div>
    <div class="groupe"><h3>Atmosphères</h3>${mots(catalogue.tags.atmosphere)}</div>
    <div class="groupe"><h3>Thèmes marqués centres d’intérêt <span class="coeur">★</span></h3>
      <p>Ils orientent les recommandations. Dans l’application, rien ne les distingue des autres thèmes.</p>
      ${mots(catalogue.tags.theme.filter((t) => t.is_interest).map((t) => t.name))}</div>
    <div class="groupe"><h3>Autres thèmes</h3>${mots(catalogue.tags.theme.filter((t) => !t.is_interest).map((t) => t.name))}</div>
  </section>

  ${catalogue.works.map((o) => fiche(o, interets)).join('\n')}
</main>
`
}
