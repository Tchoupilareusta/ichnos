# Étape 6, suite : corrections des couvertures

*Plan validé le 19 novembre 2026. Branche : `etape-6-couvertures` (partie de `main` après la fusion de la PR n° 9).*
*À suivre dans une nouvelle session, sans l'historique de la conversation. Lire d'abord `CLAUDE.md` et `docs/reference.md` (§5, §6, §8, §10.2).*

**Réglage recommandé :** Fable 5.2, effort élevé (base de données, sécurité, couvertures).

**Méthode demandée :** tests d'abord ; petits commits en français ; à la fin, tests, compilation, rendu à 393, 440 et 834 px en clair et en sombre, `/impeccable audit` sur les écrans modifiés, mise à jour de `docs/reference.md` (§5, §8, et §6.1 et §10.2 pour la nouvelle fonction), puis **arrêt avant tout envoi sur GitHub**.

---

## 1. Contexte

La fonction « assistant » est en ligne. « Chercher les couvertures manquantes » a tourné sur l'iPhone du propriétaire : environ la moitié des œuvres seules ont une couverture, très peu de tomes (Chainsaw Man 6 sur 22, Vinland Saga 9 sur 29, Vagabond et Elden Ring 0).

Les œuvres sans couverture sont surtout celles du catalogue de départ, pas encore achetées. Pour elles, une belle couverture d'une édition française courante suffit, même si ce n'est pas celle qui sera achetée. Les livres achetés auront leur ISBN, donc leur couverture exacte (demande 6). Le propriétaire achète surtout en Suisse romande (Payot, La Liseuse à Sion) : surtout des éditions d'éditeurs français.

## 2. Ce qui a été mesuré (19 novembre 2026)

### Tailles d'image selon l'adresse demandée

| Source et adresse | Exemple | Taille reçue |
|---|---|---|
| Open Library `/b/isbn/<isbn>-M.jpg` | L'Étranger, Momo | ~180 × 300 |
| Open Library `/b/isbn/<isbn>-L.jpg` (utilisée aujourd'hui) | L'Étranger 294 × 500, L'Homme qui plantait 300 × 475, Vinland t.1 348 × 500, Momo 336 × 500 | **plafonne à ~500 px de haut** |
| Open Library `/b/id/<cover_i>.jpg` (**sans taille : l'image d'origine**) | L'Étranger 396 × 642, Momo 625 × 999 | **jusqu'à ~1000 px** |
| Google `…/publisher/content/images/frontcover/<id>?fife=w480-h720` (essayée en premier aujourd'hui) | id `zyTCAlFPjgYC` | **128 × 184** (vignette ; rejetée par le seuil de 200 px, puis on passe à la suivante) |
| Google même adresse, `fife=w800-h1200` | même id | 128 × 184 |
| Google même adresse, `fife=w1200-h1800` | même id | **1163 × 1800** |
| Google `…/books/content?id=<id>&printsec=frontcover&img=1&zoom=0&source=gbs_api` | même id | 800 × 1237 |
| Google `…/books/content?vid=ISBN<isbn>&…&zoom=1/2/3/0` | plusieurs ISBN | souvent des **images grises génériques** (voir plus bas) : à ne pas utiliser |

La fiche affiche la couverture sur 12,25 rem (196 points) sur iPhone, 14 rem sur iPad, jusqu'à 16 rem sur grand écran. Sur un écran Retina d'iPhone (×3), il faut environ **600 px de large** pour une image nette. Les couvertures actuelles (Open Library « L », ~300 px) sont donc floues.

### Images grises génériques de Google

Pour un livre sans image, Google renvoie parfois une fausse couverture **qui passe nos contrôles actuels** (vraie image, assez lourde, assez large). Empreintes SHA-256 relevées :

| Image | Taille | Octets | SHA-256 |
|---|---|---|---|
| PNG gris « image not available » | 575 × 750 | 9 103 | `3efa8c43e5b4348f303a528c81adf435f0111ea752fe9f0f6241478b60987fa6` |
| JPEG silhouette de livre grise (même octets pour Vinland t.1 et Momo) | 575 × 829 | 246 264 | `5e7f0425abc77878f2a1efe98f12070d7e97b3047d2ce1cd050598230e34e205` |
| PNG bandeau gris | 575 × 92 | 1 101 | `2c38965f2e5664a903671e6dd2fe87fa38bc0c2be0c2c43065245ebe1650f0f8` (déjà rejeté par la taille minimale) |

### Cause du rognage (L'Étranger)

`src/couvertures/Couverture.tsx` pose l'image avec `object-cover` dans un cadre au format 2:3. L'image de L'Étranger (294 × 500, rapport 0,59) est plus étroite que le cadre (0,67) : elle est agrandie pour le remplir, et ses bords sont coupés.

## 3. Rappel de l'existant (à lire avant de coder)

- **Affichage** : `src/couvertures/Couverture.tsx` (couverture typographique toujours dessous, image par-dessus quand elle est chargée, `data-etat`). Règle d'affichage dans `src/couvertures/choix.ts`, `couvertureAffichee` : un livre montre la couverture de **mon édition, sinon celle de l'œuvre** ; une série montre le tome où j'en suis, sinon le tome 1, sinon le premier tome illustré, sinon l'œuvre. `cibleCouverture` dit où ranger une couverture trouvée.
- **Stockage** : `src/couvertures/stockage.ts` (`deposer`, `adresse`, `oublier`). Chemin `<user_id>/<32 caractères hexadécimaux tirés du contenu>.<jpg|png|webp>`, imposé par une contrainte de la base sur `works`, `editions` et `volumes` (migration `20261119200000_ajout_auto.sql`). Une image n'est jamais supprimée (une même image peut servir à deux œuvres ; nettoyage prévu à l'étape 10).
- **Dépôt** (`src/bibliotheque/depot.ts`, `depotSupabase.ts`, faux dans `depot.fictif.ts`) : `definirCouverture(id, cible, chemin)`, `trouverParIsbn(isbn)`, `listerSansCouverture()`.
- **Fonction serveur** `supabase/functions/assistant/` : `couverture.ts` (adresses, téléchargement sûr, `dimensions()` pour JPEG et PNG), `gestionnaire.ts` (actions `chercher_isbn`, `chercher_titre`, `couverture`, `fiche`), `contrat.ts` (types partagés avec l'appli), `entrees.ts` (relecture stricte des demandes), `sources/` (BnF, Google, Open Library), `notice.ts` (fusion des sources).
- **Réglages** : `src/couvertures/recherche.ts` (`chercherCouverturesManquantes`, pause de 1,5 s entre deux demandes) et `src/couvertures/CouverturesManquantes.tsx`.
- **Modifier** : `src/ecrans/Formulaire.tsx`, composant `CouvertureRangee` (visible seulement si une couverture existe, bouton « Retirer cette couverture », action immédiate hors du formulaire).
- **Fiche** : `src/ecrans/Fiche.tsx`, panneau d'un tome (`Feuille` dans `Tomes`, lecture et possession du tome).
- **Zone du haut** : `src/composants/Page.tsx` (`paddingTop: calc(env(safe-area-inset-top) + 1.5rem)`), `index.html` (`apple-mobile-web-app-status-bar-style` = `default`, `theme-color`).
- **Aperçu local** : `apercu.html` et `src/apercu.tsx`, ignorés par Git. Les **étendre**, ne jamais les écraser. Serveur `ichnos-dev`, adresse `/ichnos/apercu.html#/…`.
- **Tests de la base** : banc PGlite décrit dans la mémoire du projet (`environnement-windows-sans-docker`), avec `set search_path = public, extensions` pour pgTAP. La preuve qui fait foi est l'Action « Migrations » (base jetable), qui tourne aussi sur une branche poussée.

## 4. Défauts à corriger

### Défaut 1 : couvertures rognées

- `Couverture.tsx` : `object-contain` au lieu de `object-cover`, image centrée. Le cadre 2:3 arrondi ne change pas (grille régulière).
- Fond derrière l'image (**choix 1**) : **couleur moyenne des bords de l'image, adoucie vers le fond de l'appli**. Calcul une seule fois par image : dessiner l'image dans un petit canevas (l'adresse est un `blob:` de l'appli, donc lisible), moyenne d'une bande de quelques pixels sur les quatre bords, mélange avec `var(--fond)` (par exemple `color-mix(in srgb, <moyenne> 70%, var(--fond))`). Garder le résultat en mémoire par adresse. Sans canevas (tests jsdom) ou en cas d'erreur : `var(--surface)`.
- Une fois l'image chargée, ce fond couvre toute la couverture typographique (le texte typographique ne doit pas apparaître dans les bandes). Avant le chargement, la couverture typographique reste visible, comme aujourd'hui.
- Même composant partout : grille, accueil, fiche, panneau d'un tome, aperçus de l'ajout et de « Modifier ».

### Défaut 2 : résolution trop faible

Dans la fonction serveur (`couverture.ts`, `gestionnaire.ts`, `notice.ts`) :

- **Ordre des adresses, de la plus grande à la plus petite** :
  - Google (référence par identifiant de volume) : `fife=w1200-h1800`, puis `content?…&zoom=0`, puis `fife=w480-h720`.
  - Open Library par numéro de couverture : `/b/id/<n>.jpg` (image d'origine), puis `/b/id/<n>-L.jpg`.
  - Open Library par ISBN : préférer le numéro de couverture (`cover_i`), déjà renvoyé par la recherche `search.json?isbn=…` que fait `chercher_isbn`. D'après la documentation d'Open Library (à revérifier), les couvertures par ISBN sont limitées à environ 100 demandes par 5 minutes et par adresse, celles par numéro ne le sont pas. Garder `/b/isbn/<isbn>-L.jpg` en dernier recours.
- **Garder la plus grande** : si une adresse donne une image de moins de 450 px de large, essayer les suivantes et garder la plus large.
- **Rejeter les images grises de Google** : comparer l'empreinte SHA-256 des octets reçus (`crypto.subtle.digest`) à la liste du §2 ; une image reconnue est traitée comme « pas de couverture ». Test dédié avec les octets de ces images (les reproduire dans un échantillon ou les simuler : seule l'empreinte compte).
- **Donner la taille** : ajouter `largeur` et `hauteur` (null si inconnues, par exemple pour un WebP) à `ReponseCouverture` dans `contrat.ts`, et les faire suivre côté appli (`src/ajout/assistant.ts`).
- Ajouter `country=CH` à toutes les requêtes Google (éditions vues depuis la Suisse). `langRestrict` seulement pour « Chercher d'autres couvertures » (demande 5).

Seuil « de petite taille » (**choix 2**) : **moins de 450 px de large**.

Dans les Réglages :

- La liste de « Chercher les couvertures manquantes » dit « couverture trouvée, mais de petite taille » quand la largeur est sous 450 px ; pour une série, « dont N de petite taille ».
- Nouveau bouton **« Remplacer les couvertures de petite taille »** (**choix 3**) :
  - mesure faite **sur l'appareil**, sans rien changer à la base : charger chaque couverture rangée par `couvertures.adresse(chemin)` puis lire sa largeur (`createImageBitmap` ou `Image.naturalWidth`) ;
  - seulement pour les couvertures de moins de 450 px dont on connaît l'ISBN : l'ISBN de l'édition ou du tome qui porte la couverture ;
  - nouvelle demande par cet ISBN (même édition), et remplacement **seulement si l'image trouvée est plus large** ;
  - même rythme que la recherche existante (une demande à la fois, pause de 1,5 s, bouton « Arrêter ») ;
  - liste de ce qui a été fait, œuvre par œuvre : « remplacée (300 → 800 px) », « pas de plus grande image », « sans ISBN, laissée telle quelle » ;
  - nouvelle méthode du dépôt pour lister les couvertures rangées avec leur ISBN et leur cible (par exemple `listerCouvertures()`), dans le vrai dépôt et dans le faux ;
  - **limite connue**, à écrire dans `docs/reference.md` : une petite couverture que j'aurais choisie parmi d'autres éditions pourrait être remplacée par celle de mon édition. Je peux la rechoisir.

### Défaut 3 : texte sous l'heure et la batterie

- Un bandeau fixe en haut de **tous les écrans** (dans `App.tsx`, y compris l'écran de connexion) : hauteur `env(safe-area-inset-top)`, fond `var(--fond)` légèrement transparent avec un léger flou (`backdrop-filter`), `aria-hidden`, `pointer-events: none`. Il passe sous les panneaux et les fenêtres (les `<dialog>` natifs sont au-dessus de tout), au-dessus du contenu qui défile et de la barre latérale.
- Quand l'inset vaut 0, le bandeau a une hauteur nulle : rien ne change.
- Ne vérifiable que sur l'iPhone (l'aperçu n'a pas d'encoche).

## 5. Demandes

### Demande 4 : « Choisir une image »

- Où :
  - dans « Modifier », section « Couverture », **toujours visible** (même sans couverture), avec « Choisir une image », « Chercher d'autres couvertures » et « Retirer cette couverture » (ce dernier seulement s'il y a une couverture) ;
  - dans le panneau d'un tome de la fiche, « Choisir une image ».
- Un seul bouton, qui ouvre un `<input type="file" accept="image/*">` **sans `capture`** : l'iPhone propose alors photothèque, appareil photo ou fichiers.
- Lecture de l'image avec `createImageBitmap(fichier, { imageOrientation: 'from-image' })`, ou une `Image` en repli. Réduire dès la lecture si l'image dépasse environ 4096 px (limite de canevas de Safari). Refuser ce qui n'est pas une image, ou un fichier démesuré (au-delà de 30 Mo environ).
- Recadrage (**choix 4**) : **cadre libre à quatre coins, image entière par défaut**, dans un panneau (`Feuille`).
  - Poignées d'au moins 44 px, `touch-action: none` sur les poignées, événements de pointeur (doigt et souris).
  - Bouton « Image entière » pour revenir au départ. Le recadrage reste facultatif : on peut toujours garder l'image entière, ce qui garde le chemin accessible au clavier.
- Sortie : canevas, grand côté **1200 px au plus**, JPEG qualité 0,85 (environ 200 à 300 Ko), puis `couvertures.deposer` et `depot.definirCouverture`. Aucune dépendance ajoutée.
- Action immédiate (comme « Retirer »), hors du bouton « Enregistrer » du formulaire. Hors connexion : boutons grisés, phrase calme.

### Demande 5 : « Chercher d'autres couvertures » (œuvres seulement)

Pas pour un tome (**choix 6**).

- Panneau ouvert depuis « Modifier ». Recherche préremplie avec le titre et le premier auteur, modifiable.
- Nouvelle action de la fonction serveur, par exemple `autres_couvertures` :
  - entrée : titre, auteur facultatif, langue (`fr`, ou `en` si mon édition est en anglais), ISBN et éditeur de mon édition s'ils sont connus ;
  - relecture stricte dans `entrees.ts`, comme les autres actions ;
  - pas d'IA, donc pas de réservation d'appel.
- Sources :
  - **images** : Google Books (`intitle`, `inauthor`, `langRestrict=<langue>`, `country=CH`, `printType=books`, une vingtaine de résultats, seulement ceux qui ont une image) et Open Library (`search.json` par titre et auteur, puis `/works/<clé>/editions.json` : éditions avec `covers`, `isbn_13`, `publishers`, `publish_date`, `languages`, `physical_format`, `series`) ;
  - **BnF** (**choix 5**) : interrogée par titre et auteur **seulement pour la collection (zone 225), le format (215 $d, hauteur en cm) et l'année (210/214 $d)**, rapprochés par ISBN. **Aucune image ne vient de la BnF.** Étendre `NoticeBnf` (collection, année, hauteur) et ses tests.
- Réponse : au plus 8 propositions, sans doublon d'ISBN, chacune avec une référence d'image, l'éditeur, la collection, l'année, la langue et la source. **Aucune image dans cette réponse.**
- Tri, du plus probable au moins probable :
  1. même ISBN que mon édition ;
  2. même éditeur (comparé sans accents ni casse) ou même collection ;
  3. éditions dans la langue demandée, au format poche (hauteur ≤ 18 cm, ou collection de poche connue : Folio, Le Livre de Poche, Pocket, J'ai lu, 10/18, Points, GF, Babel…), les plus récentes d'abord ;
  4. le reste, les plus récentes d'abord.
- Côté appli : chaque image est demandée ensuite par l'action `couverture` existante (référence), trois à la fois au plus ; les propositions dont l'image n'arrive pas disparaissent.
  - Sous chaque image : « éditeur · collection · année », et « petite taille » si moins de 450 px.
  - Toucher une image la sélectionne (`aria-pressed`) ; « Garder cette couverture » la range ; « Aucune ne convient » ferme.
  - **Rien n'est gardé sans mon choix.**
- Tests de la fonction : tri, `langRestrict` et `country=CH` présents dans l'adresse Google, entrées refusées, aucune clé ni contenu personnel dans les journaux, textes des catalogues traités comme des données.

### Demande 6 : « Je l'ai acheté »

#### Écran

- Sur la fiche d'une œuvre qui n'est pas une série et que je n'ai pas encore (possession différente de « Je l'ai ») : une action « Je l'ai acheté » près de la possession.
- Pour une série : la même action dans le panneau d'un tome, si ce tome n'est pas à « Je l'ai ».
- Panneau en deux temps :
  1. **L'ISBN à 13 chiffres de mon exemplaire.** Même champ que l'ajout automatique (clavier numérique, tirets et espaces acceptés, compatible avec « Scanner du texte »), même validation.
  2. **Ce qui a été trouvé**, par `depot.trouverParIsbn` puis `assistant.chercherIsbn` : éditeur, traducteur, pages, langue, avec leur source, et l'aperçu de la couverture (avec « petite taille » s'il y a lieu ; je peux ne pas la garder).
     - Si le titre trouvé ne ressemble ni au titre français ni au titre original de l'œuvre (comparaison tolérante, comme `doublonsProches` dans `src/ajout/preremplir.ts`) : « Ce livre semble être « X ». Je vérifie l'ISBN. » Je peux quand même continuer.
     - Si l'ISBN est déjà celui d'une **autre** de mes œuvres : je le dis, avec un lien vers sa fiche, et je n'enregistre rien.
     - Si aucun catalogue ne connaît l'ISBN (**choix 7**) : « Aucun catalogue ne connaît cet ISBN », et le bouton **« Noter cet ISBN quand même »** (édition avec le seul ISBN).
- Validation (« C'est mon exemplaire ») :
  - si une couverture est gardée, `couvertures.deposer` d'abord ;
  - puis **un seul appel** à la fonction de base `noter_achat` ;
  - puis relecture de la fiche, de la bibliothèque et de l'accueil, et une annonce pour VoiceOver.
- Hors connexion : action grisée, phrase calme.
- Panneaux et messages construits pour l'étape 9 (élément distinct, état dans `data-etat`).
- Édition en anglais : rien de spécial à faire, le titre original passe en premier selon la règle existante (`titresAffiches`).

#### Fonction de la base `noter_achat` (nouvelle migration)

```text
public.noter_achat(oeuvre uuid, achat jsonb) returns uuid
achat = { "isbn", "publisher"?, "language"?, "format"?, "translator"?, "page_count"?, "tome"?, "couverture"? }
```

Règles :

- Sans compte connecté : erreur `28000`. L'œuvre doit être à moi (lecture verrouillée, `user_id = auth.uid()`), sinon `EO002`.
- ISBN obligatoire : sans espaces ni tirets, 13 chiffres commençant par 978 ou 979, chiffre de contrôle juste. Sinon `EO001`.
- ISBN déjà porté par une édition ou un tome d'une **autre** de mes œuvres : nouveau code **`EO003`**.
- **Sans tome** (œuvre qui n'est pas une série ; une série donne `EO001`) :
  - édition de cette œuvre qui porte déjà cet ISBN : **reprise**, et ses champs vides seulement sont complétés (`coalesce(existant, nouveau)`) : rien de ce que j'ai écrit n'est remplacé ;
  - sinon, nouvelle édition ;
  - elle devient « mon édition » (`library_entries.edition_id`), et la possession passe à `possede` ;
  - **couverture donnée** : rangée sur cette édition, qui devient la mienne et s'affiche donc ;
  - **pas de couverture** : l'actuelle reste affichée. Si l'œuvre n'a pas de couverture propre, elle reçoit celle de l'ancienne « mon édition » (`works.cover_path = coalesce(works.cover_path, ancienne_edition.cover_path)`).
- **Avec tome** (œuvre en série ; le tome doit exister, sinon `EO002`) :
  - l'ISBN du tome est remplacé par celui de mon exemplaire ;
  - la possession du tome passe à `possede` ;
  - la couverture du tome est remplacée si une couverture est donnée, sinon gardée.
- **Ne touche jamais** : synopsis, étiquettes, statut de lecture, progression, ressenti, dates, historique, lecture des tomes, médias, notes.
- Rend l'identifiant de l'édition (ou null pour un tome).
- Sécurité habituelle :
  - `security invoker`, `set search_path = ''` ;
  - `revoke all … from public, anon, authenticated, service_role` puis `grant execute … to authenticated` ;
  - les contraintes existantes s'appliquent (chemin de couverture dans mon dossier, ISBN bien formé).
- Ajouter `noter_achat` à la liste des fonctions permises dans `supabase/tests/01_securite_test.sql`, et dans §10.2 de la référence (sept fonctions).
- Côté appli : `depot.noterAchat(id, achat)` dans le vrai dépôt et dans le faux, avec un nouvel échec pour `EO003`.

Tests `supabase/tests/09_noter_achat_test.sql` :

- droits : appelable par `authenticated`, fermée à `anon`, `service_role` et `public`, pas de droits supérieurs ;
- achat d'une nouvelle édition : édition créée, devenue la mienne, possession `possede`, couverture rangée ;
- reprise d'une édition existante par ISBN : seuls les champs vides sont complétés ;
- sans couverture : la couverture affichée est gardée ;
- **rien d'autre ne change** : synopsis, étiquettes, statut, progression, ressenti, nombre d'événements identiques avant et après ;
- tome : ISBN, possession et couverture du tome ; lecture du tome inchangée ;
- ISBN invalide (`EO001`) ; ISBN d'une autre œuvre (`EO003`) ; série sans tome (`EO001`) ; tome inexistant (`EO002`) ;
- chemin de couverture d'un autre compte : refusé (`23514`) ;
- B tente d'acheter l'œuvre de A : `EO002`, rien ne change chez A ;
- visiteur non connecté : refusé (`42501`) ;
- **contre-épreuve** : RLS coupée un instant sur `works`, `editions`, `library_entries` et `volumes`, B obtient toujours `EO002` et rien ne change.

## 6. Décisions prises (validées le 19 novembre 2026)

| # | Choix | Décision |
|---|---|---|
| 1 | Fond autour d'une couverture entière | Couleur moyenne des bords de l'image, adoucie vers le fond de l'appli |
| 2 | Seuil « de petite taille » | Moins de 450 px de large |
| 3 | Remplacement des petites couvertures | Mesure sur l'appareil, remplacement seulement par la même édition (même ISBN) et seulement par une image plus large, avec la liste de ce qui a été remplacé |
| 4 | Recadrage | Libre, à quatre coins, image entière par défaut |
| 5 | « Autres couvertures » | BnF interrogée pour la collection, le format et l'année seulement ; aucune image de la BnF ; images de Google Books et d'Open Library seulement |
| 6 | « Autres couvertures » pour un tome | Non |
| 7 | ISBN inconnu des catalogues à l'achat | « Noter cet ISBN quand même » |

Décisions prises en route :

- **Où ranger une couverture choisie.**
  - Photo ou autre édition : là où elle s'affiche, c'est-à-dire sur mon édition si j'en ai une, sinon sur l'œuvre ; sur le tome pour un tome.
  - « Je l'ai acheté » : la couverture va sur l'édition achetée, qui devient la mienne et s'affiche donc.
  - Sans couverture trouvée à l'achat : l'actuelle reste affichée (règle de `noter_achat` ci-dessus).
- **Images grises de Google** : rejetées par leur empreinte (§2). Si Google en sert d'autres, en ajouter l'empreinte et un test.
- **Pas de source pour les tomes de manga en français.**
  - Aucune source gratuite, légale et fiable n'est connue.
  - Les sites d'éditeurs (Kurokawa, Kana, Tonkam, Kazé, Mana Books) n'ont pas d'accès public pour les programmes, et leurs conditions réservent les images.
  - Electre et ISBNdb sont payants.
  - Les autres sources sont des sites de fans, exclus par le propriétaire (MangaDex est exclu définitivement, §3 de la référence).
  - Pour les tomes, la voie sûre est la photo de mon exemplaire (demande 4) et l'ISBN de mon exemplaire (demande 6).

## 7. Ordre de travail proposé (un commit par lot)

1. Fonction serveur : adresses de la plus grande à la plus petite, garder la plus large, rejet des images grises, `largeur`/`hauteur` dans la réponse, `country=CH`. Tests.
2. Affichage : `object-contain` et fond tiré des bords, bandeau de la zone du haut. Tests et aperçu.
3. Réglages : « de petite taille » dans la liste, « Remplacer les couvertures de petite taille ». Tests.
4. Base : migration `noter_achat`, tests SQL avec contre-épreuve, liste de `01_securite_test.sql`.
5. Appli : « Je l'ai acheté » (fiche et panneau d'un tome). Tests d'écran.
6. « Choisir une image » (Modifier et panneau d'un tome), recadrage, réduction. Tests.
7. Fonction serveur : action `autres_couvertures` (Google avec `langRestrict` et `country=CH`, Open Library, BnF pour le tri). Puis l'appli : panneau « Chercher d'autres couvertures ». Tests.
8. Fin : tests, compilation, `deno check`, banc SQL, rendu aux trois largeurs en clair et en sombre, `/impeccable audit`, `docs/reference.md` (§5, §6.1, §8, §10.2), arrêt avant l'envoi.

## 8. Ce qui ne pourra être vérifié qu'après la fusion (ou sur l'iPhone)

- **Google Books avec la clé** : effet de `langRestrict` et de `country=CH`, tailles réelles obtenues par identifiant de volume, autres images grises éventuelles. La clé n'est pas sur le poste de développement, c'est voulu.
- **Bandeau de la zone du haut** : seulement sur l'iPhone (l'aperçu n'a pas d'encoche).
- **Photothèque et appareil photo**, format HEIC, orientation des photos et limites de canevas de Safari : sur l'iPhone.
- **Remplacement des petites couvertures** sur la vraie bibliothèque, et les limites de débit d'Open Library.
- La fonction `noter_achat` est, elle, vérifiée avant la fusion par l'Action « Migrations » (base jetable), dès que la branche est poussée.
