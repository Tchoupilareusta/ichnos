# ISBN à tirets, couvertures qui remplissent le cadre, photo de mon exemplaire, redressement

*Plan validé le 20 novembre 2026. Branche : `isbn-et-couvertures` (partie de `main` après la fusion de la refonte de « Modifier », PR n° 11).*
*À suivre dans une nouvelle session, sans l'historique de la conversation. Lire d'abord `CLAUDE.md` et `docs/reference.md` (§3, §4, §5, §8).*

**Réglage recommandé :** Fable 5.2, effort élevé (couvertures, traitement d'image). Opus 5.5, effort moyen, conviendrait aux points 1 et 3 seuls.

**Méthode demandée :** tests d'abord ; petits commits en français ; à la fin, tests, compilation, rendu à 393, 440 et 834 px en clair et en sombre, `/impeccable audit` sur la bibliothèque, la fiche et l'écran de redressement, avant / après en capture (grille et fiche pour le point 2, photos redressées pour le point 4), mise à jour de `docs/reference.md` (§5, §8 ; §3 et §4 pour le cadre 5:8), retrait de ce plan, puis **arrêt avant tout envoi sur GitHub**.

---

## 1. Contexte

Après ses essais sur iPhone, le propriétaire demande quatre améliorations :

1. afficher les ISBN avec leurs tirets, partout, et les placer pendant la saisie ;
2. des couvertures qui remplissent le cadre, sans les bandes colorées d'aujourd'hui ;
3. quand aucune couverture n'est trouvée pour un ISBN saisi (son Siddhartha, Livre de poche, 9782253008484 : aucune source n'en a), lui proposer de photographier son exemplaire ;
4. une photo de couverture redressée automatiquement, à la manière du scanner de documents de l'iPhone.

Aucune IA, aucun appel réseau nouveau, aucune nouvelle source de données, aucun changement de base.

## 2. Ce qui a été mesuré (20 novembre 2026)

### Bibliothèque pour les tirets

| Bibliothèque | Licence | Version | Poids | Constat |
|---|---|---|---|---|
| **`isbn3`** (retenue) | MIT | 2.0.13 (plages mises à jour le 1er novembre 2026) | 41 Ko minifié, **9,5 Ko compressé** (gzip), avec les plages | `ISBN.hyphenate('9782253008484')` → `978-2-253-00848-4` ; `9782070360024` → `978-2-07-036002-4` ; `9782081510852` → `978-2-08-151085-2` ; hors plages connues (`9790000000000`) → `null` |
| `isbnjs` | MIT | 0.2.2, dernière mise à jour en 2022 | — | écartée : plages anciennes |

Mesure faite avec `esbuild --bundle --minify` sur un fichier qui n'importe que `isbn3`.

### Formats des vraies couvertures (Open Library)

Mesures sur les images d'origine d'Open Library pour les ISBN du catalogue. **Ce ne sont pas forcément les fichiers rangés chez le propriétaire** : les siens peuvent venir de Google Books (clé absente du poste de développement, c'est voulu).

| Couverture | ISBN | Image | Largeur ÷ hauteur | Écart avec 2:3 (0,667) | Écart avec **5:8 (0,625)** |
|---|---|---|---|---|---|
| L'Étranger, Folio | 9782070360024 | 911 × 1500 | 0,607 | −9 % | **−3 %** |
| L'Étranger, autre scan Folio | 9782070360024 (couverture n° 15115103) | 625 × 1054, 573 × 1009 après rognage | 0,568 | −15 % | −9 % |
| Le Gai Savoir, GF Flammarion | 9782081510852 | 304 × 500 | 0,606 | −9 % | **−3 %** |
| Fahrenheit 451, Folio | 9782072892950 | 304 × 500, 303 × 485 après rognage | 0,625 | −6 % | **0 %** |
| L'Homme qui plantait des arbres, Gallimard | 9782070744619 | 300 × 475 | 0,630 | −5,5 % | **+1 %** |
| La Peste, Gallimard | — (échantillon) | 305 × 500 | 0,604 | −9 % | −3 % |
| La Jalousie, Minuit | — (échantillon) | 350 × 475 | 0,736 | +10 % | +18 % |
| Manga (tankōbon) | — | ≈ 0,70 | ≈ 0,70 | +5 % | +12 % |

Les poches français (Folio, GF, Livre de poche : 108 à 110 × 178 mm) sont plus étroits que 2:3. Avec un cadre 2:3, presque toute la bibliothèque serait « posée sur l'étagère » (point 2) ; avec un cadre 5:8, elle remplit le cadre.

### Marges unies

Prototype : une ligne (ou colonne) de bord est « unie » si au moins 98 % de ses points sont à 20 nuances près (sur 255, sur chaque canal) de la couleur du milieu de ce bord ; on avance tant que c'est le cas, sans dépasser 15 % de la dimension.

| Couverture | Bandes unies trouvées | Ce qu'elles sont | Décision attendue |
|---|---|---|---|
| Fahrenheit 451 | 9 px en haut, 6 px en bas | marge de scan | rogner |
| L'Étranger, Folio 911 × 1500 | 82 px en haut seulement (5,5 %) | le blanc du haut de la couverture Folio, qui fait partie du dessin | garder |
| L'Étranger, autre scan | 22 / 23 / 16 / 36 px sur les quatre côtés | marge de scan | rogner |
| Je me souviens (Perec), Hachette | 65 px en haut seulement (13,7 %) | probablement du dessin | garder |
| Le Gai Savoir, L'Homme qui plantait, La Jalousie | 1 px par côté | liseré | rogner (sans effet visible) |

D'où la règle retenue (point 2) : un côté n'est rogné que si sa bande fait moins de 4 % de la dimension, **ou** si le côté opposé a lui aussi une bande (cadre de scan).

### Bibliothèques de vision par ordinateur, écartées

| Bibliothèque | Licence | Poids | Pourquoi écartée |
|---|---|---|---|
| OpenCV.js (`@techstark/opencv-js` 5.0.0) | Apache 2.0 | 14,7 Mo décompressé, environ 10 Mo à charger (WebAssembly) | bien trop lourd pour une PWA, même chargé à la demande, et à garder hors connexion |
| `jscanify` 1.4.3 | MIT | 30 Mo décompressé | repose sur OpenCV.js (chargé à part) ; dépend aussi de `canvas` et `jsdom` |

## 3. Choix validés par le propriétaire

- **Point 1** : `isbn3`.
- **Point 2** : cadre **5:8** (au lieu de 2:3) et seuil de **6 %** ; les règles s'appliquent aussi aux couvertures déjà rangées (**règle générale**, y compris les photos rangées avant ce changement) ; une couverture que je recadre ou redresse moi-même porte une **marque invisible** dans son fichier et n'est jamais retouchée.
- **Point 4** : **code maison, environ 15 Ko**, sans dépendance, chargé seulement à l'ouverture du panneau de redressement.

## 4. Rappel de l'existant (à lire avant de coder)

- **ISBN** : `src/bibliotheque/modele.ts` (`isbnCompact`, `isbnValide` : 10 ou 13 caractères, chiffre de contrôle). Stocké sans tirets.
  - Saisie : `src/ecrans/Ajouter.tsx` (champ « ISBN à 13 chiffres », vers la ligne 278), `src/achat/JeLaiAchete.tsx` (étape `isbn`), `src/ecrans/Formulaire.tsx` (`ChampsEdition` pour mon édition et les autres éditions, `Tomes` pour l'ISBN de chaque tome, « Chercher cette édition » sous l'ISBN de mon édition).
  - Affichage : `src/ecrans/Fiche.tsx` (ligne « ISBN » des détails de l'édition, vers la ligne 472), `src/achat/JeLaiAchete.tsx` (« ISBN … » sous ce qui a été trouvé), `src/achat/ChercherEdition.tsx` (sous-titre du panneau). Chercher les autres avec `grep -rn isbn src --include=*.tsx`.
- **Affichage des couvertures** : `src/couvertures/Couverture.tsx` (cadre `aspect-[2/3]`, couverture typographique dessous, image `object-contain` par-dessus, `data-etat`), `src/couvertures/fond.ts` (couleur moyenne des bords pour les bandes : **à remplacer**), `src/couvertures/palette.ts` (couverture typographique). Les tailles des couvertures dans la grille, l'accueil et la fiche sont dans `Bibliotheque.tsx`, `Accueil.tsx`, `Fiche.tsx`.
- **Réception d'une image** : `src/ajout/assistant.ts` (`creerAssistantSupabase`, action `couverture`, filtre `ecarter` = `estPresqueUniforme` de `src/couvertures/uniformite.ts`).
- **Rangement** : `src/couvertures/reduction.ts` (`reduireImage` : 1200 px au plus, JPEG 0,85), `src/couvertures/stockage.ts` (`deposer`), `src/bibliotheque/requetes.ts` (`useRangerCouverture`).
- **Photo et recadrage actuels** : `src/couvertures/photo.ts` (`lireImage`, `recadrer`, `deplacerCoin`, `enJpeg`, cadre rectangulaire à quatre coins) et `src/couvertures/ChoisirImage.tsx` (panneau « Recadrer l'image », poignées de 44 px, « Image entière », `ref.ouvrir('photo' | 'phototheque')`, `surImage` pour rendre l'image sans la ranger).
- **Panneaux où aucune couverture n'est trouvée** : `src/couvertures/ApercuCouverture.tsx` (« Pas de couverture trouvée : celle d'Ichnos s'affichera. »), utilisé par `JeLaiAchete.tsx`, `ChercherEdition.tsx` et le formulaire d'« Ajouter ».
- **Autres couvertures** : `src/couvertures/AutresCouvertures.tsx` (`ref.ouvrir()`, `surImage`) : demande une œuvre existante (`OeuvreDetaillee`) ; à adapter pour « Ajouter » (titre et auteur saisis).
- **Modifier** : `src/couvertures/CouvertureModifiable.tsx` (menu « Changer la couverture », tout attend « Enregistrer »).
- **Aperçu local** : `apercu.html` et `src/apercu.tsx`, ignorés par Git. Les **étendre**, ne jamais les écraser. Serveur `ichnos-dev`, adresse `/ichnos/apercu.html#/…`. Pour les captures à largeur de téléphone : onglet neuf, pilotage par JavaScript (voir la mémoire du projet).

## 5. Les quatre points

### Point 1 : ISBN avec tirets

- Ajouter `isbn3` (dépendance de l'appli, version exacte 2.0.13).
- Une seule fonction, par exemple `isbnAffiche(isbn)` dans `src/bibliotheque/modele.ts` : ISBN compact → forme à tirets d'après `isbn3` ; si `isbn3` ne le connaît pas, **l'ISBN sans tirets**, jamais des tirets devinés. Accepte ISBN-13 et ISBN-10.
- L'utiliser partout où un ISBN est affiché (fiche, détails de l'édition, panneaux, tomes, listes).
- **VoiceOver** : l'ISBN affiché est lu chiffre par chiffre, sans les tirets. Par exemple, le texte à tirets en `aria-hidden` et, à côté, un texte réservé aux lecteurs d'écran avec les chiffres séparés par des espaces. Vérifier dans l'arbre d'accessibilité.
- **Saisie** (Ajouter, Modifier : mon édition, autres éditions, tomes ; Je l'ai acheté ; le champ d'ISBN qui déclenche « Chercher cette édition ») : les tirets se placent au fil de la frappe, quand le début saisi permet de les placer ; sinon les chiffres restent tels quels. Clavier numérique (`inputMode="numeric"`) conservé. Coller un ISBN avec ou sans tirets ou espaces fonctionne. Le curseur reste à sa place logique (compter les chiffres avant le curseur, pas les caractères). Effacer un tiret efface le chiffre d'avant.
- En base et dans tout ce qui part vers la base ou la fonction serveur : sans tirets (`isbnCompact`), comme aujourd'hui.
- **Limite connue, annoncée au propriétaire** : dans un champ en cours de saisie, VoiceOver lit la valeur telle qu'elle est écrite (tirets compris) ; on ne la masque pas, pour ne pas abîmer le champ.
- Tests : forme à tirets d'ISBN français, anglais et d'un tome de manga ; ISBN hors plages ; ISBN-10 ; saisie au fil de la frappe (frappe chiffre par chiffre, collage avec espaces, effacement autour d'un tiret, position du curseur) ; aucune valeur à tirets envoyée au dépôt.

### Point 2 : couvertures qui remplissent le cadre, sans bandes

- **Cadre 5:8** partout où une couverture s'affiche (`Couverture.tsx`) : grille, accueil, fiche, panneaux, aperçus. Vérifier que les cartes de la grille gardent leurs titres alignés, et l'accueil son carrousel.
- **Ordre des règles**, appliquées sur l'appareil quand l'image est chargée pour être affichée, mesurées **une seule fois par image** (résultat gardé par adresse, comme `couleurDesBords` aujourd'hui), sur une petite toile :
  1. **Rogner les marges unies**, avant toute autre règle. Un côté n'est rogné que si sa bande unie fait **moins de 4 %** de la dimension, **ou** si le côté opposé a lui aussi une bande unie (cadre de scan). Bande unie : au moins 98 % des points à 20 nuances près de la couleur du bord, sans dépasser 15 % de la dimension.
  2. **Si le format après rognage est à 6 % au plus de 5:8** : l'image **remplit le cadre**, avec un léger recadrage centré (3 % au plus de chaque côté).
  3. **Sinon** : l'image est montrée **à sa vraie forme, posée en bas de la case et centrée**, comme un livre sur une étagère (à la manière de l'app Livres d'Apple). **Aucune bande colorée** : le reste de la case est vide (fond de l'appli). Les titres sous les couvertures restent alignés d'une case à l'autre, puisque la case garde sa taille.
- L'image rangée n'est pas modifiée : ces règles ne changent que l'affichage, ce qui profite aussi aux couvertures déjà rangées, sans rien renvoyer.
- **Couverture recadrée ou redressée par moi** (point 4, et les photos à venir) : une **marque invisible** est écrite dans le JPEG au moment où il est produit (un segment de commentaire JPEG, `FF FE`, par exemple « Ichnos : recadrée à la main »). À l'affichage, une image qui porte la marque **n'est jamais rognée ni recadrée** : elle remplit le cadre si son format est déjà celui du cadre (à 1 % près), sinon elle est posée en bas de la case. Vérifier que la réduction (`reduireImage`) garde la marque, ou l'écrit après la réduction.
- **Photos rangées avant ce changement** (sans marque) : règle générale, comme les autres couvertures (choix du propriétaire).
- La couverture typographique (aucune image) reste au format du cadre. Le petit liseré et l'ombre de `Couverture.tsx` suivent la forme réelle de l'image en mode « étagère ».
- `fond.ts` (couleur des bandes) ne sert plus : le supprimer avec ses tests, ou le réduire à ce qui sert encore.
- Respecter `prefers-reduced-motion` et garder `data-etat` (« image », « typographique », et un état pour « étagère ») pour les animations de l'étape 9.
- Tests : rognage (bande d'un seul côté sous 4 %, bande d'un seul côté au-dessus de 4 % gardée, bandes opposées rognées même larges, limite de 15 %) ; décision remplir / étagère de part et d'autre de 6 % ; image marquée jamais retouchée ; lecture de la marque dans un JPEG.
- **Avant / après en capture**, avant de finaliser : grille de la bibliothèque et fiche, avec L'Étranger, Le Gai Savoir, Fahrenheit 451 et L'Homme qui plantait des arbres (dans l'aperçu local, avec les images d'Open Library ou des images de mêmes formats ; ne rien mettre dans le dépôt).

### Point 3 : pas de couverture trouvée, proposer la photo

- Dans « Je l'ai acheté », « Chercher cette édition » et « Ajouter » (par ISBN) : quand la recherche est finie et **qu'aucune couverture n'est trouvée**, le même panneau propose, empilés et pleine largeur (règle des panneaux, §3 de la référence) :
  1. **« Prendre une photo de mon exemplaire »** : appareil photo direct (`capture="environment"`), puis le redressement du point 4 ;
  2. **« Chercher d'autres couvertures »**, en second : seulement pour une œuvre, jamais pour un tome (« Je l'ai acheté » d'un tome n'a que la photo). Dans « Ajouter », il cherche avec le titre et l'auteur saisis (adapter `AutresCouvertures`, qui demande aujourd'hui une œuvre existante).
- La couverture obtenue suit le geste en cours : gardée avec « C'est mon exemplaire » (Je l'ai acheté), « Appliquer à mon édition » puis « Enregistrer » (Chercher cette édition), ou à la validation de la fiche (Ajouter). Je peux toujours ne pas la garder.
- Hors connexion : ces boutons sont grisés, avec une phrase calme (la photo peut être prise, mais rien ne peut être rangé).
- Pas de nouvelle source de données.
- Tests : les deux choix apparaissent seulement quand aucune couverture n'est trouvée ; pas d'« autres couvertures » pour un tome ; la photo gardée est rangée au bon endroit ; rien n'est rangé sans validation.

### Point 4 : redressement d'une photo de couverture

- **Remplace le recadrage rectangulaire à quatre coins** pour les photos (« Prendre une photo », « Choisir dans mes photos », panneau d'un tome, point 3).
- **Code maison**, environ 15 Ko, sans dépendance, dans un module chargé à la demande (`import()` dynamique) à l'ouverture du panneau. Ne pas l'importer ailleurs, pour qu'il reste hors du paquet principal (vérifier avec la compilation).
- **Détection des quatre coins** (vision par ordinateur classique, sans IA ni réseau) :
  1. réduire la photo à 512 px sur le grand côté ;
  2. apprendre la couleur du fond (table, nappe) sur les bords de l'image ;
  3. séparer le livre du fond (écart de couleur, seuil automatique), garder la plus grande zone d'un seul tenant ;
  4. prendre son contour (enveloppe convexe) et le simplifier en quadrilatère (retirer les sommets un à un en gardant la plus grande surface) ;
  5. si le résultat est douteux (moins de 15 % de l'image, non convexe, angle trop fermé), placer les quatre coins aux coins de l'image.
- **Coins réglables** : affichés sur la photo, déplaçables au doigt, avec une **loupe** au-dessus du doigt pour viser précisément (le doigt cache le coin). Chaque coin a un nom pour VoiceOver (« Coin en haut à gauche ») et se déplace aux flèches du clavier (ce qui règle aussi le point reporté à l'étape 9 dans la référence) ; « Image entière » remet les coins aux coins de l'image. Cibles de 44 px, `touch-action: none`, geste abandonné proprement (perte du pointeur), comme `ChoisirImage.tsx` aujourd'hui.
- **Redressement de la perspective** : homographie calculée à partir des quatre coins (système linéaire 8 × 8), image de sortie rééchantillonnée (interpolation bilinéaire) sur une toile, à la taille déduite de la longueur moyenne des côtés, la couverture droite et rectangulaire, sans la table autour. Puis les règles habituelles : **1200 px au plus**, JPEG, **marque invisible** (point 2), rangée dans mon espace privé, jamais dans le dépôt.
- Le panneau garde le texte et les boutons du recadrage actuel, adaptés : « Garder cette image » (principal), « Image entière » (secondaire), empilés.
- Tests : homographie (un carré connu envoyé sur un quadrilatère connu, et retour) ; détection sur des images **dessinées par le code** (un rectangle coloré mis en perspective sur un fond uni ou légèrement texturé, coins attendus connus, tolérance de quelques pixels) ; repli aux coins de l'image quand rien n'est trouvé ; coins déplacés au clavier ; image produite marquée et réduite. Jamais de vraie photo dans le dépôt.
- **Vérification sur de vraies photos** : le propriétaire dépose 3 ou 4 photos de livres posés de travers sur une table, prises sur son iPhone, dans un dossier **hors du dépôt** (par exemple `C:\Users\delph\Documents\photos-essai-ichnos`). Les passer dans le module (dans l'aperçu local, en simulant le choix d'une photo par `DataTransfer`), et montrer un avant / après en capture.

## 6. Limites de fiabilité (à dire au propriétaire)

- **Tirets** : un ISBN absent des plages d'`isbn3` est affiché sans tirets. Les plages évoluent : une mise à jour d'`isbn3` les rafraîchit (à vérifier à l'étape 10).
- **Rognage des marges** : une bande blanche d'un seul côté, au-delà de 4 %, est gardée, même si c'est en fait une marge de scan. Une marge de couleur dégradée ou bruitée (scan jauni) n'est pas reconnue comme unie.
- **Seuil de 6 %** : une couverture qui remplit le cadre perd au plus 3 % de chaque côté ; un texte collé au bord pourrait être effleuré.
- **Détection des coins** : fiable pour un livre posé sur une table unie qui contraste avec la couverture. Moins fiable si la couverture a la couleur de la table, avec un reflet fort, une nappe à motifs, un livre tenu à la main, ou un livre coupé par le bord de la photo. Dans tous les cas, les quatre coins réglables et le redressement restent ; si la détection est trop rarement juste sur les vraies photos, le dire au propriétaire plutôt que de l'enjoliver.
- **Courbure** : une couverture souple ou cornée n'est pas plane ; le redressement en perspective ne corrige pas une courbure.

## 7. À vérifier seulement sur l'iPhone du propriétaire

- « Prendre une photo de mon exemplaire » ouvre directement l'appareil photo, et la photo revient dans le panneau.
- Les photos prises sur l'iPhone : format HEIC, orientation, poids, temps de détection et de redressement (une photo de 12 à 48 mégapixels, réduite à la lecture).
- Le glisser des coins au doigt, la loupe sous le doigt, et le défilement de la page qui ne doit pas se déclencher pendant le geste.
- La qualité du redressement sur ses propres livres et sa propre table, et la netteté de la couverture produite sur la fiche.
- Ses couvertures réellement rangées (dont celles venues de Google Books) dans le cadre 5:8 : remplies ou posées sur l'étagère, sans bandes.
- La saisie à tirets avec le clavier numérique de l'iPhone, et le collage d'un ISBN.
- VoiceOver : un ISBN affiché lu chiffre par chiffre ; les coins nommés et déplaçables ; les boutons du point 3.
