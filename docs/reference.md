# Ichnos — Document de référence

*Version 1 — 17 novembre 2026*
*Mise à jour du 17 novembre 2026 : l'IA comme aide à la suggestion (§2, §7.6, §8.4, §10.2, §11).*
*Mise à jour du 18 novembre 2026 : décisions de l'étape 4, bibliothèque et fiches (§3, §6.2, §10.2, §11) ; points reportés aux étapes 9 et 10 (§11 ; depuis le 19 novembre 2026, les alertes `npm audit` relèvent de l'étape 11).*
*Mise à jour du 18 novembre 2026 : corrections après essai sur iPhone : cinq statuts, libellés de possession, ordre des filtres, allègement de la bibliothèque et de la fiche, icônes ; ajout d'une œuvre à l'étape 6 (§2, §3, §5, §6, §11).*
*Mise à jour du 19 novembre 2026 : bulles-menus Statut et Possession, grille à colonnes fixes, recherche (§3, §5).*
*Mise à jour du 19 novembre 2026 : animations des interactions, à faire à l'étape 9 (§4.3, §11).*
*Mise à jour du 19 novembre 2026 : suivi de lecture (étape 5) : relectures, date de fin approximative, progression des séries tirée des tomes, ressenti proposé quand je termine un livre, « Le mettre en pause » (§5, §6, §10.2, §11).*
*Mise à jour du 19 novembre 2026 : ajout automatique (étape 6) : ordre des sources, couvertures, deux manières d'ajouter, fiche proposée par l'IA, fonction serveur « assistant » et sa sécurité (§3, §5, §6.1, §8, §10.2, §10.4, §11).*
*Mise à jour du 19 novembre 2026 : nouvelle étape 10 « Nettoyage et optimisation » ; la revue de sécurité finale devient l'étape 11 et porte sur le code nettoyé (§11).*
*Mise à jour du 19 novembre 2026 : corrections de couvertures (étape 6, suite) : couverture montrée en entier, grandes images, « Je l'ai acheté », « Choisir une image », « Chercher d'autres couvertures », fonction `noter_achat` (§3, §5, §6.1, §8, §10.2, §11).*
*Mise à jour du 20 novembre 2026 : poids des couvertures : toute image est réduite au moment d'être rangée (§8.5, §11).*
*Mise à jour du 20 novembre 2026 : ISBN à tirets, cadre de couverture 5:8 sans bandes, photo de mon exemplaire quand aucune couverture n’est trouvée, redressement d’une photo et correction légère de sa lumière (§3, §4.3, §5, §8.5, §10.1, §11).*
*Mise à jour du 20 novembre 2026 : refonte de « Modifier » (couverture d'abord, sections repliées, barre « Annuler / Enregistrer », tout attend « Enregistrer », « Chercher cette édition »), boutons des panneaux empilés, fausses couvertures presque uniformes écartées (§3, §5, §8.1, §8.5, §11).*
*Mise à jour du 20 novembre 2026 (soir) : retouches des tomes après essai sur iPhone : gestes au doigt par les événements tactiles, cercles, haut de section allégé, légende sous la grille, menu compact qui attend le doigt levé, message sur une ligne (§6.2, §6.3, §11).*
*Mise à jour du 21 novembre 2026 : recommandations (étape 7) : algorithme, écran Découvrir, « Une idée pour la suite » sur l'accueil, « Pas maintenant » rangé par deux fonctions, « À relire un jour » compté comme un signe positif (§5, §6.1, §6.4, §7, §10.2, §11).*
*Mise à jour du 20 novembre 2026 : tomes d'une série, « sélectionner d'abord, puis appliquer » (barre d'actions, message « Annuler », fonction `regler_tomes`) ; voix de l'interface : consignes à l'infinitif, messages neutres ; idée pour plus tard : une version nette de ma photo (§3, §5, §6.2, §6.3, §8.5, §10.2, §11, §12).*

Ce document complète le cahier des charges initial. Il consigne les décisions prises, le modèle de données, la logique des recommandations et le plan de développement. En cas de doute, c'est lui qui fait foi.

---

## 1. Vision

Ichnos (« trace », en grec) est une bibliothèque personnelle, pensée d'abord pour l'iPhone, qui aide à choisir sa prochaine lecture et à suivre plusieurs lectures en parallèle.

Lire doit rester un plaisir. L'application ne mesure rien, ne pousse à rien et ne juge rien.

## 2. Principes non négociables

- Aucun objectif, compteur de performance, série de jours, badge, classement ni notification.
- Un livre en pause n'est jamais présenté comme un échec.
- Aucune fonction sociale, aucune publicité.
- L'IA (API Claude) ne fait que suggérer : rien n'est enregistré sans validation, et l'appli fonctionne entièrement sans elle.
- Interface entièrement en français.
- Données privées : rien de personnel dans le dépôt GitHub, aucune clé secrète dans le frontend.
- Les livres et leurs idées passent avant l'interface.
- Les métadonnées ne sont jamais inventées. Un ISBN, une pagination ou un éditeur inconnus restent vides.
- Aucun ordre de lecture imposé.

## 3. Décisions validées

| Sujet | Décision |
|---|---|
| Nom | Ichnos |
| Direction visuelle | Mise en page « galerie » (espace, grandes couvertures), formes très arrondies et fluides, palette chaude papier/encre, accent maroon `#550000`. Thèmes clair et sombre (sombre neutre, pas brun). |
| Navigation mobile | Barre du bas : Accueil · Bibliothèque · Découvrir, plus un bouton « Ajouter ». |
| Navigation iPad et ordinateur | Barre latérale, grille de couvertures plus large. |
| Notes et citations | Rangées dans la fiche de chaque œuvre. Pas d'onglet dédié. |
| Liste d'envies | Filtre de la bibliothèque, pas d'onglet dédié : c'est le choix « Envie de lire » du menu Statut (ce que j'ai envie de lire, pas ce que je veux acheter). « À acheter » reste un filtre de possession séparé, qui sert de liste de courses. |
| Libellés de possession | « Je l'ai », « À acheter », « Je ne l'ai pas » (remplace « Pas à moi » le 18 novembre 2026 ; seul le libellé change, pas la valeur en base). |
| Statuts de lecture | Cinq statuts, toujours dans cet ordre (menus, filtres, listes) : « En cours », « Envie de lire », « Terminé », « À découvrir », « En pause ». « En pause » veut dire « je ne lis pas ce livre en ce moment », sans jugement. (Le 18 novembre 2026, « Laissé de côté », c'est-à-dire abandonné, est fusionné dans « En pause » : la différence n'était pas claire.) |
| Ordre des filtres | Du plus utile au moins utile : statut, possession, genre, thème, atmosphère, auteur. Sous la recherche, deux bulles côte à côte, « Statut ▾ » et « Possession ▾ », ouvrent chacune un menu (choix avec icône et mot). Une fois un choix fait, la bulle l'affiche avec une croix pour le retirer (« En cours ✕ ») et prend le fond d'accent doux. Jamais de bulle coupée ni de défilement horizontal : si deux bulles actives ne tiennent pas côte à côte, la seconde passe à la ligne. Le panneau « Filtres » (feuille qui monte du bas, fenêtre centrée sur iPad) garde les six filtres dans cet ordre, en accord avec les bulles. Même présentation sur iPad. |
| Icônes | Toujours accompagnées d'un mot, jamais seules ; VoiceOver lit le mot. Statuts : un même livre dessiné pour Ichnos, dans cinq états (ouvert pour « En cours », cœur sur la couverture pour « Envie de lire », coche pour « Terminé », étincelle pour « À découvrir », livre ouvert posé à l'envers pour « En pause »). Possession : le code de la grille des tomes (cercle plein, pointillé, vide, à moitié plein). |
| Légèreté | Une phrase d'explication seulement là où elle sert (hors connexion, états vides, confirmations). Sur la fiche, ce que je range (ISBN, traducteur, suppression) passe après ce que je lis. Dans « Modifier », c'est l'inverse : ce que je change le plus souvent vient d'abord, le reste est replié (§5). |
| Boutons des panneaux | Dans tout panneau qui monte du bas et dans toute confirmation : boutons empilés, pleine largeur, l'action principale en haut, la secondaire en dessous (décidé le 20 novembre 2026). Un choix secondaire à côté d'une image (« Ne pas la garder ») est une bulle, pas un lien souligné. |
| Voix de l'interface | Précisée le 20 novembre 2026, pour toute l'appli. **La première personne reste pour ce qui m'appartient** : libellés, états, sections et réglages qui désignent mes livres ou mes choix (« Je l'ai », « Je ne l'ai pas », « J'en ai une partie », « Mon ressenti », « Mon envie du moment », « Mon édition », « Je l'ai acheté », « Où j'en suis » ; VoiceOver : « Tome 4, lu, je l'ai »). **Les consignes, aides et explications sont à l'infinitif**, sans « je », « vous » ni « tu » (« Toucher les tomes à changer, ou glisser le doigt dessus. », « Réessayer dans un instant. »). **Les messages d'état et d'erreur sont neutres** (« Aucun livre trouvé pour cet ISBN. », « Couverture retirée. », « Recherche dans les catalogues… »). **Les questions de confirmation sont à l'infinitif** (« Changer 12 tomes ? », « Marquer ce livre comme terminé ? »). Le contenu des fiches écrit par l'IA n'est pas concerné. **Pour trancher** (précisé le 20 novembre 2026) : la première personne reste quand le texte décrit ma situation ou mon choix (« J'en suis à la page », « Je compte en… », « Je me souviens de… », « Je ne sais pas », « J'avais noté : … ») ; les boutons d'action et les questions que l'appli me pose passent à l'infinitif ou à une forme neutre (« Tout saisir à la main », « Se déconnecter », « Date de fin » plutôt que « Quand l'ai-je terminé ? », « Oui, terminé » pour répondre à « Marquer ce livre comme terminé ? »). |
| Appréciation | Quelques mots plutôt que des étoiles (voir §6.4). Facultative. |
| Mangas | Possession et progression suivies tome par tome. La possession de la série se calcule à partir des tomes : « J'en ai une partie » quand je n'ai pas tous les tomes (§6.2). |
| Hors connexion, modifications | Les boutons de modification sont grisés, avec un message calme qui explique pourquoi. |
| Langue de lecture | Français ou anglais. Le catalogue n'ajoute pas d'édition anglaise d'office. Quand j'ajoute un livre par son ISBN, l'édition est celle de mon exemplaire. Pour une œuvre écrite en anglais, « Découvrir ailleurs » indique si la version originale vaut le coup (ex. 1984 et son vocabulaire inventé). Si mon édition est en anglais, le titre original s'affiche en premier. Les fiches (synopsis, étiquettes) restent toujours en français. |
| Anime | Média associé à l'œuvre (saisons, épisodes), jamais compté comme des livres. |
| Hors connexion | Consultation possible. Les modifications demandent une connexion. |
| Couvertures | Recherche automatique par ISBN (Google Books, puis Open Library), copie dans le stockage Supabase, couverture typographique générée en dernier recours. Elle s'affiche dans une case au format 5:8, celui des poches français : proche de ce format, elle remplit la case ; sinon elle est posée en bas, à sa vraie forme, sans bande colorée (§8.5 ; remplace, le 20 novembre 2026, « montrée en entier dans un cadre 2:3 »). Je peux aussi photographier mon exemplaire (la photo est redressée), ou choisir la couverture d'une autre édition. Une série montre le tome où j'en suis, sinon le tome 1 ; chaque tome montre la sienne dans son panneau ; la grille des tomes garde ses cercles (§8). |
| Couvertures de manga | Par l'ISBN du tome français, aux mêmes sources. MangaDex est exclu définitivement : c'est un site de traductions de fans, sans droits sur les images (décidé le 19 novembre 2026). Aucune autre source gratuite, légale et fiable n'est connue pour les tomes en français : la voie sûre est la photo de mon exemplaire et l'ISBN de mon exemplaire (§8.5). |
| Ajouter une œuvre | Deux manières : remplir automatiquement (ISBN à 13 chiffres de mon exemplaire, ou titre seul) ou tout saisir à la main. Pas de scan du code-barres : un champ à clavier numérique qui accepte chiffres, tirets et espaces (Safari sur iPhone n'a pas de lecteur de code-barres natif, et aucune bibliothèque n'est ajoutée pour cela). |
| ISBN | Rangé sans tirets, affiché avec ses tirets partout (978-2-253-00848-4), et les tirets se placent pendant la saisie. Leur place vient de la bibliothèque `isbn3` (licence MIT, 9,5 Ko compressé) ; un ISBN hors de ses plages reste sans tirets, jamais de tirets devinés (décidé le 20 novembre 2026, détail au §5). |
| Source de chaque champ | Affichée sous le champ pendant l'ajout (« D'après la BnF »), jamais enregistrée : une fois validée, la fiche est la mienne. |
| Citation du jour sur l'accueil | Retirée. |
| Avertissements de contenu | Aucun, pour aucune œuvre (choix du propriétaire, remplace la demande du cahier des charges). |
| Découverte d'œuvres extérieures | Mode « Découvrir ailleurs », séparé de « Mon envie du moment », appuyé sur l'API Claude (§7.6). (Remplace, le 17 novembre 2026, le report à une version ultérieure.) |
| Fiche automatique | À l'ajout d'un livre, l'API Claude propose synopsis et étiquettes, en suggestion modifiable (§8.4). |
| IA dans l'application | API Claude, modèle Sonnet 5.5. Elle suggère, ne décide jamais et n'enregistre rien (§2). |
| Connexion | E-mail et mot de passe, avec un formulaire que Bitwarden sait remplir sur iPhone. Session longue : elle reste ouverte sur l'appareil jusqu'à la déconnexion. Inscriptions publiques fermées. Pas de lien « mot de passe oublié » : la réinitialisation se fait depuis Supabase. (Remplace, le 17 novembre 2026, le code à 6 chiffres par e-mail : le service d'e-mail gratuit de Supabase ne permet pas d'envoyer un code à la place d'un lien.) |
| Veille de Supabase | Évitée par une GitHub Action planifiée. |
| Sauvegardes | Export JSON depuis l'application + copie automatique vers un dépôt GitHub privé. |
| Outils de développement | Claude Code en local sur Windows. Skills Superpowers et Impeccable installés au niveau utilisateur, pas dans le dépôt. |
| Modèles | Fable 5.2 (effort élevé) pour les pièces structurantes, Opus 5.5 (effort moyen) pour le reste. Voir §11. |

## 4. Identité visuelle

### 4.1 Intention

Entrer dans une belle bibliothèque calme, lumineuse et chaleureuse. Rien de cassant : coins généreusement arrondis, transitions douces, aucune couleur agressive.

### 4.2 Palette

| Rôle | Clair | Sombre |
|---|---|---|
| Fond | Papier `#F5EFE6` | Anthracite `#151413` |
| Surface (cartes) | `#FBF8F3` | `#262422` |
| Texte principal | Encre `#2A2420` | `#EEEAE4` |
| Texte secondaire | `#6E625A` | `#A6A099` |
| Accent (boutons, sélection, progression) | Maroon `#550000` | `#8D3131` |
| Texte accentué (liens, onglet actif) | `#550000` | Texte principal `#EEEAE4` |
| Texte sur accent | `#FBF8F3` | `#F5EFE9` |
| Accent doux (fonds de pastilles) | `#EEDDD8` | `#3A1E1D` |
| Contour d'un tome « Je ne l'ai pas » (ajouté le 20 novembre 2026 : 3,3:1 sur le fond, là où les bordures, décoratives, n'atteignent que 1,3:1) | `#8F8172` | `#6E6862` |
| Bordures | `#DDD0C0` | `#3A3734` |
| Barre de progression | `#550000` | `#C46A6A` (sur piste `#3A3734`) |
| Ombres | brun chaud très léger | noir, plus marqué |
| Surlignage des thèmes | `#EBD3CD` | `#4A2524` |

En thème sombre, `#8D3131` sert de couleur de fond (boutons, éléments sélectionnés) : en texte sur fond sombre, il ne serait pas assez lisible.

Tous les couples texte/fond doivent atteindre un contraste WCAG AA.

### 4.3 Formes et mouvement

- Rayons généreux : environ 24 px pour les cartes, boutons en forme de pilule, couvertures arrondies à 12–14 px.
- Couvertures dans une case au format 5:8 (largeur ÷ hauteur = 0,625), partout : grille, accueil, fiche, panneaux, aperçus. Une couverture d'un autre format y est posée en bas, comme un livre sur une étagère ; l'ombre et les coins arrondis suivent alors la forme de l'image, et le reste de la case laisse voir le fond de l'appli.
- Ombres très douces et chaudes, jamais grises et dures.
- Animations courtes et amorties (ressorts légers). Respect de `prefers-reduced-motion`.
- Interactions animées, discrètes et rapides (décidé le 19 novembre 2026, réalisé à l'étape 9) : ouverture du panneau des filtres, déroulement des menus Statut et Possession, changements de statut.
- Passer à « Je l'ai » déclenche une petite animation joyeuse : l'icône qui rebondit, une lueur douce. Jamais de confettis ni de message de félicitations.
- Quand l'iPhone demande de réduire les animations, des fondus courts remplacent les mouvements.
- D'ici l'étape 9, chaque nouveau composant (étapes 5 à 8) est construit pour pouvoir être animé sans être réécrit : un élément qui apparaît ou disparaît (panneau, menu, feuille, message) reste un élément distinct qu'on peut cibler, son état ouvert ou fermé est porté par un attribut (`data-etat`, `aria-expanded`, `open`), et les changements d'état passent par un seul endroit du code. Les couleurs et les durées viennent des jetons de design, pas de valeurs écrites en dur.

### 4.4 Typographie

- Titres : **Lora**.
- Interface et textes : **Nunito**.
- Polices hébergées avec l'application (fonctionnement hors ligne, aucune requête vers un service tiers).

### 4.5 Appareils cibles

| Appareil | Zone d'affichage (points CSS) |
|---|---|
| iPhone 16 | 393 × 852 |
| iPhone 18 Pro Max | 440 × 956 |
| iPad Pro 11 pouces | 834 × 1210 en portrait, 1210 × 834 en paysage |

- Sur iPhone : une colonne, barre de navigation en bas, actions principales à portée de pouce.
- Sur iPad : navigation latérale, grilles sur plusieurs colonnes, mise en page plus éditoriale.
- Respect des zones de sécurité (Dynamic Island, indicateur d'accueil) en mode application installée.

## 5. Écrans

| Écran | Contenu |
|---|---|
| Accueil | Lectures en cours, la plus récemment touchée d'abord (carrousel de couvertures cliquables, rangée sans défilement sur iPad quand elle tient, progression en texte seul : « p. 75 sur 230 », « Lettre 12 », « Tome 4 sur 29 » ; bouton « Où j'en suis » qui ouvre un panneau de mise à jour : page/tome/lettre, « J'ai terminé ce livre », « Le mettre en pause » — nouveau nom de « Le mettre de côté », ce statut étant fusionné dans « En pause » ; après « J'ai terminé », le même panneau propose mon ressenti). Un anime n'y figure jamais. Puis « Une idée pour la suite » (étape 7, §7.7) : une seule idée, sa phrase, « Une autre idée », et le lien « Selon mon humeur » vers Découvrir ; sans idée à proposer, la section n'apparaît pas et seul le lien reste. Puis les dernières lectures terminées (étape 8). Pas de barre de progression sur l'accueil. |
| Bibliothèque | Grille de couvertures (2 colonnes sur iPhone, 4 sur iPad en portrait, 6 en paysage, quelle que soit la taille du texte), recherche (« Rechercher » ; VoiceOver : « Rechercher un titre ou un auteur »), bulles-menus Statut et Possession, panneau « Filtres » avec les six filtres. |
| Fiche d'une œuvre | Couverture, titres français et original, auteur, thèmes juste sous le titre (Lora italique, surlignage doux sur toute la hauteur du mot, jamais en forme de bouton), statut et possession (pastilles avec icône ; pour une série, la possession résume et mène aux tomes), progression avec barre (seulement « En cours » ou « En pause » ; unité et total choisis ici), synopsis sans spoiler, genre, longueur et atmosphère en une ligne, « Mon ressenti » (avec « Retirer »), « Mon parcours » en quelques mots, mon édition en une ligne (traduction et ISBN dans « Détails »), tomes (sélectionner d'abord, puis appliquer, comme dans Photos : voir §6.2 ; le panneau d'un tome, par un appui long (ou la touche I au clavier), montre sa couverture, son état, son ISBN, « Je l'ai acheté » et « Choisir une image »), notes et citations, média associé (épisodes vus avec − et +, statut). La fiche se termine sur l'œuvre, jamais sur la suppression. |
| Découvrir | « Mon envie du moment » : une seule grande bulle qui ouvre le menu des six envies, portée par l'adresse (`#/decouvrir?envie=reconfortant`). Puis trois idées, chacune dans une carte qui mène à la fiche (couverture, titre, auteur, phrase), avec « Commencer » (« Reprendre » pour un livre en pause), confirmé par une question courte, et « Pas maintenant », plus discret, qui met l'idée de côté trois semaines (« Idée mise de côté · Annuler »). Puis « D'autres idées » et une ligne discrète qui explique « Pas maintenant ». États vides et hors connexion : §7.7. Un mode séparé, « Découvrir ailleurs », propose des œuvres absentes de la bibliothèque (§7.6, étape 7b). |
| Ajouter | Deux choix : « Remplir automatiquement », mis en avant (ISBN à 13 chiffres : l'édition exacte de mon exemplaire ; titre, et auteur si je veux : une liste d'œuvres où je choisis, puis la fiche commune à toutes les éditions, sans ISBN, éditeur ni pagination), et « Tout saisir à la main » (le formulaire complet). Si l'ISBN est déjà dans ma bibliothèque, ou si une œuvre au titre très proche y est, l'appli me prévient avant d'aller plus loin et propose d'ouvrir sa fiche ou d'y ajouter l'édition. Le formulaire prérempli montre la source de chaque champ, la couverture trouvée (que je peux ne pas garder) et la proposition de l'IA (§8.4). Rien n'est enregistré sans ma validation. Hors connexion, la recherche est grisée. |
| Modifier | Le formulaire de la fiche, dans l'ordre de ce que je change le plus souvent (refonte du 20 novembre 2026, détail plus bas). Visible : la couverture en grand, « Mon édition », « Titre et auteur ». Replié, avec un résumé d'une ligne : « Description et étiquettes », « Détails de l'œuvre », « Tomes et médias » (« À l'écran » pour un livre seul), « Autres éditions ». Tout en bas, séparée : la suppression, après confirmation. Une barre fixe « Annuler / Enregistrer » remplace la navigation. Tout attend « Enregistrer », couverture comprise. |
| Réglages | Thème, « Chercher les couvertures manquantes » (une demande à la fois, sans IA, avec la liste de ce qui a été trouvé ou non, œuvre par œuvre ; une couverture de moins de 450 px de large est dite « de petite taille »), « Remplacer les couvertures de petite taille » (§8.5), export des données, compte, gestion des genres, thèmes et atmosphères. |

Mise à jour de la progression : depuis l'accueil, le bouton « Où j'en suis » ouvre un panneau (saisie directe du nombre, − / +, Enregistrer) ; sur la fiche, − / + (enregistrés une seconde après le dernier appui) et saisie directe. Quand j'atteins le total, la fiche propose doucement « Marquer ce livre comme terminé ? » (« Marquer la série comme terminée ? » quand tous les tomes sont lus), sans jamais le faire à ma place.

ISBN à tirets (20 novembre 2026) :
- **Affichage.** Partout où un ISBN se lit (fiche, « Je l'ai acheté », « Chercher cette édition »), il porte ses tirets. VoiceOver le lit chiffre par chiffre, sans les tirets.
- **Saisie** (Ajouter, « Je l'ai acheté », Modifier : mon édition, autres éditions, tomes). Les tirets se placent au fil de la frappe, dès que le début saisi le permet (« 978-2-07 » n'attend pas la suite ; « 978-2-35 » attend de savoir si l'éditeur a cinq chiffres). Clavier numérique ; coller un ISBN avec ou sans tirets ou espaces fonctionne ; le curseur reste à sa place ; effacer un tiret efface le chiffre d'avant. ISBN à 10 caractères acceptés là où ils l'étaient.
- **En base**, et dans tout ce qui part vers la base ou la fonction serveur : toujours sans tirets.
- **Limites.** Un ISBN absent des plages d'`isbn3` reste sans tirets (les plages évoluent : mettre `isbn3` à jour à l'étape 10). Dans un champ en cours de saisie, VoiceOver lit la valeur telle qu'elle est écrite, tirets compris.

Pas de couverture trouvée (20 novembre 2026) : dans « Je l'ai acheté », « Chercher cette édition » et « Ajouter » par ISBN, quand la recherche est finie sans couverture, le même bloc propose, empilés et pleine largeur :
- **« Prendre une photo de mon exemplaire »** : l'appareil photo directement, puis le redressement (§8.5).
- **« Chercher d'autres couvertures »**, en second : pour une œuvre, jamais pour un tome. Il part du titre et de l'auteur connus (ceux que j'ai saisis, dans « Ajouter »).
- L'image suit le geste en cours : gardée avec « C'est mon exemplaire », « Appliquer à mon édition » puis « Enregistrer », ou à la validation de la fiche. « Ne pas la garder » revient aux deux boutons. Rien n'est rangé sans validation.
- Dans « Je l'ai acheté », la photo est proposée aussi quand aucun catalogue ne connaît l'ISBN, ou quand la recherche ne répond pas (« Chercher d'autres couvertures » n'est alors pas proposé).
- Par le titre seul, sans exemplaire en main, rien de tel n'est proposé.
- Hors connexion, les deux boutons sont grisés : « Hors connexion : une image ne pourrait pas être rangée. Attendre le retour du réseau. »

« Je l'ai acheté » (validé le 19 novembre 2026) : sur la fiche d'un livre que je n'ai pas encore, près de la possession ; pour une série, dans le panneau d'un tome que je n'ai pas. Le panneau se déroule en deux temps.
- D'abord l'ISBN à 13 chiffres de mon exemplaire : même champ et même vérification que l'ajout automatique.
- Puis ce que les catalogues en disent (éditeur, traduction, pages, langue, chacun avec sa source) et l'aperçu de la couverture, que je peux ne pas garder. Rien n'est enregistré avant « C'est mon exemplaire ».
- L'appli me prévient si le livre trouvé semble être un autre titre ou un autre tome ; je peux quand même continuer.
- Si l'ISBN est déjà celui d'une autre de mes œuvres, ou d'un autre tome de la même série, elle le dit (avec un lien vers la fiche) et n'enregistre rien.
- Si aucun catalogue ne connaît l'ISBN, ou si la recherche ne répond pas : « Noter cet ISBN quand même ».
- À la validation, un seul enregistrement (fonction `noter_achat`, §6.1), puis une phrase de confirmation. Mon statut de lecture, ma progression et mes notes ne bougent pas.

« Modifier » (refonte validée le 20 novembre 2026) :
- **Ordre.** La couverture, puis « Mon édition » (ISBN, éditeur, pages et langue, puis collection et traduction, deux par deux), puis « Titre et auteur » (le ou les auteurs seulement ; traduction, illustrations et second auteur sont dans « Détails de l'œuvre »). Le reste est replié, fermé à l'ouverture, avec un titre et un résumé d'une ligne (« Résumé · Roman philosophique, Spiritualité +7 · douce », « Allemand · 1922 · roman »). Un champ à revoir dans une section repliée l'ouvre. À l'ajout, le même formulaire met le titre avant l'édition, et « Description et étiquettes » s'ouvre quand l'IA propose quelque chose.
- **Couverture.** En grand, avec une bulle ronde à croix dans son coin (VoiceOver : « Retirer la couverture ») ; pas de croix sur la couverture d'Ichnos. Dessous, un seul bouton « Changer la couverture » ouvre un petit menu : « Prendre une photo » (l'appareil photo directement), « Choisir dans mes photos » (l'iPhone propose photothèque, appareil photo ou fichiers), « Chercher d'autres couvertures ». Sur iPad, la couverture reste à gauche pendant que les champs défilent à droite.
- **Tout attend « Enregistrer ».** Une nouvelle couverture (photo, autre édition, « Chercher cette édition ») s'affiche tout de suite, mais reste sur l'appareil : elle n'est réduite et envoyée qu'à l'enregistrement. Un retrait n'est fait qu'à l'enregistrement. « Annuler » annule tout ; s'il y a des changements, une confirmation le dit (« Rien de ce que j'ai changé ne sera enregistré, couverture comprise. »). Une image abandonnée n'est donc jamais envoyée dans le stockage. Si la fiche est enregistrée mais pas la couverture, l'écran reste ouvert et le dit, pour réessayer.
- **Message temporaire.** Juste après avoir retiré ou changé la couverture, « Couverture retirée · Annuler » (ou « Nouvelle couverture · Annuler ») apparaît en bas, au-dessus de la barre, environ 5 secondes, puis disparaît. Le temps s'arrête tant que le message a le focus.
- **Barre « Annuler / Enregistrer ».** Fixe, à portée de pouce, au-dessus de l'indicateur d'accueil, en forme de pilule comme la navigation, qu'elle remplace (barre du bas sur iPhone, barre latérale sur iPad) tant que le formulaire est affiché ; aucun bouton en haut, seulement le titre. Le bas est préféré au haut : c'est là que le pouce et la navigation se trouvent déjà, et sur iPhone le haut est sous la Dynamic Island.
- **« Chercher cette édition ».** Proposé sous l'ISBN de mon édition dès que j'en saisis un nouveau, valide. Comme « Je l'ai acheté » : ma bibliothèque d'abord (un ISBN déjà porté par une autre œuvre est signalé), puis la BnF, Google Books et Open Library. Le panneau « Ce qui a été trouvé » montre éditeur, traduction, pages, langue et couverture, avec « J'avais noté : … » quand c'est différent. « Appliquer à mon édition » reporte ce qui a été trouvé dans le formulaire ; « Ne rien changer » referme. Rien n'est enregistré avant « Enregistrer ».
- **Libellés.** « Type d'œuvre » (au lieu de « Forme ») ; « Difficulté de lecture » (au lieu d'« Exigence ») : très facile, facile, modérée, soutenue, exigeante. Seules les sources des champs et les propositions de l'IA gardent une phrase d'aide.
- **Suppression.** « Supprimer de ma bibliothèque », court pour tenir sur une ligne à 393 px (VoiceOver : « Supprimer Siddhartha de ma bibliothèque »). Une bulle à fond rouge doux (l'accent doux de la palette, texte accentué : contraste AA en clair et en sombre) avec une poubelle, tout en bas, séparée par un filet. Confirmation obligatoire.

Zone du haut de l'iPhone : un voile fixe, de la hauteur de la zone de l'heure et de la batterie, sur tous les écrans. Le contenu qui défile passe dessous sans se mêler à l'horloge. Sans encoche, il n'a aucune hauteur.

Maquettes de référence : canvas « Ichnos — Maquettes » (Accueil, Fiche, Découvrir, panneau « Où j'en suis »), revues avec Impeccable le 17 novembre 2026.

## 6. Modèle de données

Base PostgreSQL via Supabase. Toutes les tables portent un `user_id` et sont protégées par Row Level Security (`user_id = auth.uid()`). Le projet vise un seul utilisateur mais reste compatible avec plusieurs comptes.

### 6.1 Tables

**`works` — les œuvres**
- `id`, `user_id`
- `title_fr`, `title_original`, `original_language`, `first_published_year` (facultatif)
- `form` : roman, roman court, nouvelle, conte, poésie, essai, philosophie, manga, autre
- `synopsis` (rédaction originale, sans spoiler)
- `tone` : 1 (sombre) à 5 (lumineux)
- `density` : 1 (accessible) à 5 (exigeant)
- `length` : court, moyen, long
- `cover_path` : couverture par défaut de l'œuvre
- `is_series` : vrai pour les séries en volumes (Vinland Saga)
- `created_at`, `updated_at`

**`authors`** et **`work_authors`** — auteurs et rôle (auteur, traducteur, illustrateur).

**`tags`** et **`work_tags`** — vocabulaire modifiable.
- `tags.kind` : `genre`, `theme`, `atmosphere`
- `tags.is_interest` : marque les thèmes qui comptent personnellement (pardon de soi, paix intérieure, rapport au temps…). Ils influencent les recommandations sans jamais apparaître comme un programme.

**`editions`** — une œuvre peut en avoir plusieurs.
- `work_id`, `isbn` (vide si inconnu), `publisher`, `language`, `format`, `translator`, `page_count` (vide si inconnu), `cover_path`

**`volumes`** — tomes d'une série.
- `work_id`, `number`, `title` (facultatif), `isbn`, `cover_path`
- `ownership` : possédé, à acheter, non possédé
- `reading_status` : à lire, en cours, lu

**`library_entries`** — ma relation à une œuvre (une par œuvre).
- `work_id`, `edition_id` (facultatif)
- `reading_status` : en cours, envie de lire, terminé, à découvrir, en pause (« abandonné » fusionné dans « en pause » le 18 novembre 2026)
- `ownership` : possédé, à acheter, non possédé (pour une série, calculé à partir des tomes)
- `progress_unit` : page, chapitre, tome, lettre, section, pourcentage (vide tant que je n'ai rien choisi : l'appli propose « page »)
- `progress_current`, `progress_total` (facultatifs ; inutilisés pour une série, dont la progression vient des tomes, §6.3)
- `appreciation` (facultative, voir §6.4)
- `started_at`, `finished_at` (facultatifs)

**`reading_events`** — historique discret, jamais affiché sous forme de statistiques.
- `entry_id`, `kind` (commencé, progression, mis en pause, repris, terminé), `value`, `occurred_at`
- `date_precision` : jour, mois ou année. Seule une date de fin saisie à la main peut être approximative : « en 2019 » est enregistré au 1er janvier 2019 avec la précision « année », et ne s'affiche jamais autrement (ajouté le 19 novembre 2026).
- Permet aussi les relectures : chaque « commencé » ouvre une lecture.

**`media`** — médias associés.
- `work_id`, `kind` (anime, film…), `title`, `seasons`, `episodes_total`, `episodes_watched`, `status` (à l'écran : « À voir », « En cours », « Vu »)

**`notes`** — citations et réflexions.
- `work_id`, `kind` (citation, commentaire, réflexion), `body`, `location` (ex. « p. 75 », « lettre 12 »), `created_at`

**`recommendation_log`** — idées mises de côté par « Pas maintenant ».
- `mode`, `work_id`, `reason`, `response` (choisie, ignorée, aucune), `shown_at`
- Depuis l'étape 7 (21 novembre 2026), elle ne reçoit que des mises de côté : une ligne par œuvre au plus (une nouvelle mise de côté remplace l'ancienne), avec l'envie et la date donnée par la base. Ce n'est pas un historique : rien n'en est affiché, et ni les idées montrées ni celles que je choisis ne sont notées. `reason` et les réponses « choisie » et « aucune » restent inutilisées.

Idées mises de côté (fonctions `mettre_idee_de_cote` et `reprendre_idee`, ajoutées le 21 novembre 2026) :
- **`mettre_idee_de_cote(oeuvre, envie)`** retire l'éventuelle mise de côté précédente de cette œuvre et ajoute la nouvelle, datée par la base, en tout ou rien ; elle rend cette date. Elle ne vérifie pas que l'œuvre est « à découvrir » : mettre de côté une œuvre déjà lue est sans effet.
- **`reprendre_idee(oeuvre)`** retire la mise de côté : elle sert à « Annuler ».
- **Refus.** Envie qui n'est pas l'une des six (`EO001`) ; œuvre introuvable dans ma bibliothèque (`EO002`).
- Elles ne touchent à rien d'autre : ni statut, ni possession, ni progression, ni historique, ni notes. « Commencer » passe par `changer_statut` (§6.3).

**`ai_calls`** — journal des appels à l'IA (ajouté à l'étape 6).
- `action`, `occurred_at`. Une ligne par appel, sans aucun contenu (ni titre, ni ISBN, ni texte).
- Il ne sert qu'à plafonner les appels payants (§10.2) : ce n'est pas une statistique, et rien n'en est affiché.
- Une ligne ne s'ajoute qu'à l'heure présente ; personne ne modifie ni ne supprime une ligne, même avec ma session.

Chemins de couverture (`cover_path` des œuvres, éditions et tomes) : toujours `<mon identifiant>/<empreinte de l'image>.<jpg, png ou webp>`, dans mon dossier du stockage privé. La base refuse tout autre chemin.

« Je l'ai acheté » (fonction `noter_achat`, ajoutée le 19 novembre 2026), en tout ou rien :
- **Un livre.** L'édition de l'œuvre qui porte déjà cet ISBN est reprise, et seuls ses champs vides sont complétés : rien de ce que j'ai écrit n'est remplacé. Sinon, une édition est créée. Elle devient « mon édition » (`library_entries.edition_id`), et la possession passe à « possédé ».
- **Sa couverture.** Celle que je garde est rangée sur cette édition : c'est elle qui s'affiche. Sans couverture sur l'édition achetée, celle qui s'affichait reste affichée : la couverture de mon ancienne édition, s'il y en avait une, devient celle de l'œuvre.
- **Un tome.** Il reçoit l'ISBN de mon exemplaire et passe à « possédé » ; sa couverture n'est remplacée que si j'en garde une. Sa lecture ne change pas.
- **Refus.** ISBN qui n'a pas 13 chiffres ou dont le chiffre de contrôle est faux ; ISBN déjà porté par une autre de mes œuvres ou par un autre tome de la même série (code `EO003`) ; série sans numéro de tome ; tout champ inconnu.
- Elle ne touche jamais au synopsis, aux étiquettes, au statut de lecture, à la progression, au ressenti, aux dates, à l'historique, à la lecture des tomes, aux médias ni aux notes.

Plusieurs tomes d'un geste (fonction `regler_tomes`, ajoutée le 20 novembre 2026), en tout ou rien :
- Elle reçoit une liste de tomes (1 à 1000), chacun avec sa possession, sa lecture, ou les deux. Elle sert à appliquer le choix d'une bulle de la barre d'actions, et à « Annuler », qui renvoie l'état d'avant tome par tome. Elle rend le nombre de tomes qui ont vraiment changé ; un tome déjà dans l'état demandé n'est pas réécrit.
- **Refus.** Liste vide ou trop longue, tome en double, numéro qui n'est pas un entier positif, valeur inconnue, tome sans rien à changer, tout champ inconnu, œuvre qui n'est pas une série (`EO001`) ; série ou tome introuvable dans ma bibliothèque (`EO002`). Un seul élément refusé fait tout refuser.
- Aucune cascade (§6.3). Elle ne touche qu'à la possession et à la lecture des tomes : ni à leur titre, ISBN ou couverture, ni au statut de la série, à ses dates, à son historique, à ses notes ou à ses médias.

### 6.2 Possession et statut

Ils sont indépendants : un livre peut être « Terminé » et « Non possédé » (emprunté), ou « À découvrir » et « Possédé ».

Possession d'une série (validé le 18 novembre 2026), calculée à partir de ses tomes :
- tous les tomes possédés : « Je l'ai » ; une partie seulement : « J'en ai une partie » ;
- aucun tome possédé : « À acheter » si au moins un tome est à acheter, sinon « Je ne l'ai pas ».
- Dans les filtres, une série apparaît dans « Je l'ai » dès qu'un tome est possédé, et dans « À acheter » dès qu'un tome est à acheter. C'est voulu : on retrouve ainsi les séries où il manque des tomes.
- Sur la fiche : la pastille de possession d'une série résume (« J'en ai une partie ») et mène à « Mes tomes ».

« Mes tomes » : sélectionner d'abord, puis appliquer, comme dans l'app Photos (décidé le 20 novembre 2026, retouché le même jour après un essai sur iPhone ; remplace le menu « Tous les tomes », le lien « Changer plusieurs tomes » et le choix de lecture et de possession dans le panneau d'un tome) :
- **Le haut de la section.** « Mes tomes » seul en titre, puis une ligne d'aide, courte, sur une ligne à 393 points : « Toucher ou glisser pour sélectionner. » Rien d'autre avant la grille.
- **La grille.** De vrais cercles : cinq colonnes sur iPhone (environ 58 points à 393, 69 à 440), des cercles de taille fixe (60 points) et plus de colonnes sur iPad. Le remplissage du cercle dit la possession : plein (Je l'ai), pointillé (À acheter), vide, avec un contour fin d'au moins 3:1 sur le fond (Je ne l'ai pas). Une petite marque en haut à droite du cercle dit la lecture : coche (Lu), signet (En cours), rien (À lire). Les cercles restent même quand un tome a sa couverture.
- **La légende,** sous la grille, en petit et en couleur discrète : c'est une référence, pas la première chose à lire. « Possession » (les trois cercles), « Lecture » (la coche et le signet seulement : un tome sans marque se comprend comme « à lire », et l'étiquette VoiceOver de chaque tome le dit, « Tome 20, à lire, je ne l'ai pas »), puis « Appui long sur un tome : ses détails. »
- **Sélectionner.** Toucher un tome le sélectionne ou le désélectionne, sans mode à activer. Glisser le doigt en sélectionne plusieurs d'un geste : le premier tome touché décide du sens (pas sélectionné : on sélectionne ; sélectionné : on désélectionne), et tous les tomes entre lui et le doigt suivent, dans l'ordre des numéros, sur plusieurs lignes ; revenir en arrière rend leur état aux tomes quittés. Un tome sélectionné porte un anneau d'accent (`#550000` en clair, `#C46A6A` en sombre, pour le contraste) ; VoiceOver dit « sélectionné ».
- **Sélection ou défilement.** La sélection ne démarre que si le doigt part d'un tome et que ses 10 premiers points de mouvement sont plutôt horizontaux ; dès que le geste penche vers l'horizontale, la page ne défile plus. Sinon, la page défile normalement. Une fois la sélection lancée, le doigt peut descendre sur plusieurs lignes. À la souris, tout glissement sélectionne. Pas de défilement automatique près du bord. Sur la grille, ni sélection de texte ni menu « Copier / Chercher ».
- **Pourquoi des événements tactiles** (constaté sur iPhone le 20 novembre 2026). Au doigt, les gestes passent par `touchstart`, `touchmove` et `touchend`, jamais par les événements de pointeur : sur iOS, Safari cesse d'envoyer les événements de pointeur dès qu'il prend le geste pour un défilement, sans toujours envoyer `pointercancel`. Le minuteur de l'appui long, armé sur `pointerdown`, restait alors armé et ouvrait les détails au milieu d'un glissement, et la sélection ne démarrait jamais. Les `touchmove` continuent d'arriver, et `preventDefault()` sur `touchmove` (écouteur non passif) empêche le défilement. La grille a `touch-action: manipulation` (seul le double toucher qui zoome est retiré). La souris garde les événements de pointeur.
- **Appui long.** Une demi-seconde sans bouger ouvre les détails du tome, avec un petit enfoncement visible pendant l'attente (une légère transparence si l'iPhone réduit les animations). Le moindre mouvement (10 points) ou un défilement l'annule. Il ne change pas la sélection. À la souris : le clic droit. Au clavier : la touche I sur un tome (`aria-keyshortcuts`). Avec VoiceOver : toucher deux fois et maintenir, qui produit un appui long (le web ne permet pas d'ajouter une action personnalisée au rotor).
- **Le menu de sélection.** Il n'apparaît qu'une fois le doigt levé (après un toucher, ou à la fin du glissement) : pendant le glissement, rien ne couvre la grille. Il remplace alors la barre du bas de l'iPhone, au-dessus de la zone de sécurité (sur iPad, la barre latérale reste, et le menu se centre à côté d'elle). Compact, pour laisser voir la grille (172 points à 393, 232 avec le message, soit moins d'un tiers de l'écran) : en haut, « 3 tomes sélectionnés », un bouton « Tout sélectionner » (seulement s'il reste des tomes à sélectionner) et une croix (VoiceOver : « Annuler la sélection ») ; puis la possession (Je l'ai, À acheter, Je ne l'ai pas) et la lecture (Lu, En cours, À lire), chacune sur une ligne, en contrôle segmenté, avec icône et texte (« À lire » a un petit livre fermé, qui ne ressemble pas aux cercles de possession). Pas de lien souligné, pas de « Détails du tome », pas de grand bouton « Annuler la sélection ». VoiceOver annonce le menu à son apparition (« 1 tome sélectionné. Actions en bas de l'écran. »), puis le nombre. La page garde en bas la place du menu.
- **L'état actuel** (décidé le 20 novembre 2026). Si tous les tomes sélectionnés ont la même possession, ce choix est mis en avant, avec le style des bulles actives de l'appli (fond d'accent, texte sur accent) ; pareil pour la lecture. S'ils sont mélangés, rien n'est mis en avant dans ce groupe. VoiceOver lit « Je l'ai, choisi » sur le choix mis en avant, et rien de plus quand c'est mélangé.
- **Fermer.** La croix, Échap au clavier, ou un toucher ailleurs que sur la grille et le menu (par exemple en haut de la page) vident la sélection, ferment le menu et emportent le message. Un défilement ne compte pas : il ne produit pas de clic.
- **Appliquer.** Toucher un choix l'applique aux tomes sélectionnés en une seule écriture, en tout ou rien (fonction `regler_tomes`, §6.1). Seuls les tomes qui changent vraiment comptent. La sélection reste en place et le menu reste ouvert (décidé le 20 novembre 2026, à la place de « la sélection se vide ») : le choix s'allume tout de suite, et on peut marquer les mêmes tomes « Je l'ai » puis « Lu » sans les resélectionner. Le message s'affiche environ 5 secondes en haut du menu, sur une ligne, sans rien recouvrir : à gauche l'icône du choix et un texte court (« 6 tomes : Je l'ai », « Tome 4 : Lu »), à droite un vrai bouton « Annuler » (VoiceOver : « Annuler : 6 tomes, Je l'ai »). « Annuler » remet exactement l'état d'avant, possession et lecture, lui aussi en tout ou rien, et la mise en avant suit. Aucune confirmation, sauf au-delà de 10 tomes qui changent : « Changer 12 tomes ? ». Toucher le choix déjà mis en avant ne change rien : « Déjà « Je l'ai » : rien n'a changé. », sans « Annuler ». Le même message (icône facultative, vrai bouton « Annuler ») sert à « Modifier », où il reste au-dessus de la barre « Annuler / Enregistrer ».
- **Clavier (iPad).** Espace ou Entrée sur un tome le sélectionne ; Maj + clic sélectionne la plage depuis le dernier tome touché ; I ouvre les détails ; Échap vide la sélection.
- **Hors connexion.** La sélection reste possible ; les choix sont grisés, avec « Hors connexion : les tomes pourront changer au retour du réseau. » Les détails d'un tome restent consultables.
- Code : `src/tomes/MesTomes.tsx` (grille, gestes, menu, panneau), `src/bibliotheque/tomes.ts` (sélection glissée, changements et leur annulation, textes), `src/composants/MessageTemporaire.tsx`.

### 6.3 Progression et éditions

- La progression s'exprime dans l'unité choisie. Le pourcentage est calculé quand un total est connu.
- La pagination dépend de l'édition. Le total se renseigne pour son propre exemplaire, il n'est jamais deviné. Si mon édition a un nombre de pages connu, il est proposé comme total pour l'unité « page » (« d'après mon édition ») et reste modifiable.
- Une progression peut rester vide. Changer d'unité remet la position à zéro.
- Série (validé le 19 novembre 2026) : une seule source, les tomes. Le tome courant est le plus haut tome « en cours », ou à défaut le plus haut tome « lu » ; le total est le nombre de tomes. Noter « tome 6 » : le tome 6 passe en cours, les précédents pas encore lus passent lus, un tome suivant resté en cours repasse à lire. Le menu de sélection de « Mes tomes » (§6.2) change la lecture des tomes sélectionnés telle quelle, sans cascade : « En cours » sur plusieurs tomes les met tous en cours, sans toucher aux autres ; la cascade reste réservée à « Où j'en suis » et aux boutons − et +. Le tome courant se recalcule ensuite à partir des tomes, comme toujours. Aucune trace n'est ajoutée à l'historique.
- Changements de statut (fonction `changer_statut`, en tout ou rien) : passer en « En cours » note la date de début si elle est vide et un événement « commencé », ou « repris » si une lecture est ouverte (livre en pause) ; « Terminé » note la date de fin et « terminé », mais seulement si une lecture était commencée dans l'appli : rien n'est inventé pour un livre lu autrefois ; « En pause » note « mis en pause ».
- Relecture : repasser un livre terminé en « En cours » ouvre une nouvelle lecture. La progression repart de zéro (unité et total gardés), les tomes d'une série repassent « à lire », l'historique de la lecture précédente reste intact.
- Date de fin saisie à la main, facultative, sur la fiche d'un livre terminé : au jour, au mois ou à l'année près (« Terminé en 2019 »). Jamais à venir, jamais avant le début de la lecture.
- Une seule trace de progression par jour et par livre (la dernière position du jour).
- « Mon parcours » sur la fiche : « Commencé le 3 mars · terminé le 20 avril », puis les relectures. Jamais de statistiques, de pages par jour ni de séries de jours.

### 6.4 Appréciation

Choix facultatif parmi quelques mots :
- « M'a marqué »
- « Beau moment »
- « Pas pour moi, pas maintenant »
- « À relire un jour »

« M'a marqué », « Beau moment » et « À relire un jour » renforcent les thèmes de l'œuvre dans les recommandations (« À relire un jour » compte comme un signe positif depuis le 21 novembre 2026 : on ne veut relire que ce qu'on a aimé). « Pas pour moi, pas maintenant » les atténue doucement, sans jamais exclure un auteur ou un genre (§7.2).

Il est proposé, sans obligation, quand je termine un livre (« Plus tard » ferme sans rien choisir), puis se voit et se change sur la fiche sous « Mon ressenti ». Un lien « Retirer » l'efface ; toucher à nouveau le mot choisi aussi.

## 7. Recommandations (version 1)

Algorithme déterministe fondé sur les étiquettes, sans IA (étape 7, réalisée le 21 novembre 2026). Seul le mode séparé « Découvrir ailleurs » (§7.6) fait appel à l'IA. Rien n'est mesuré, compté ni affiché en chiffres : aucun score n'apparaît à l'écran.

Code : `src/recommandations/` (calcul pur, sans écran ni base : `modele.ts`, `envies.ts`, `score.ts`, `proposer.ts`, `phrase.ts`, `hasard.ts`), lu par `useIdees()` (`src/bibliotheque/requetes.ts`) ; écrans `src/ecrans/Decouvrir.tsx` et `src/ecrans/Accueil.tsx`, carte commune `src/composants/CarteIdee.tsx`. Mêmes entrées, mêmes sorties : on lui donne ma bibliothèque, l'envie, la date et une graine ; il rend au plus trois propositions, chacune avec sa phrase. Les propositions sont calculées sur l'appareil, à partir de ce qui est déjà chargé : elles s'affichent aussi hors connexion.

### 7.1 Candidats

- Les œuvres « À découvrir » et « Envie de lire », et « En pause » avec douceur (§7.5, « Un livre en pause »).
- Jamais « En cours » ni « Terminé ». Jamais une idée mise de côté depuis moins de 3 semaines.
- **Mes dernières lectures**, qui servent au contraste et à la phrase : au plus les trois plus récentes parmi mes lectures « En cours » (date : la dernière fois que j'y ai touché ; sans date connue, elle compte en dernier) et mes lectures « Terminé » dont la date de fin est connue et a moins de six mois (183 jours). La plus récente compte pleinement, la deuxième à 60 %, la troisième à 30 %. Un livre « Terminé » sans date (lu autrefois) ne compte pas comme lecture récente, mais son ressenti compte pour l'affinité. Sans lecture récente, le contraste est neutre pour tout le monde et la phrase n'y fait pas allusion.

### 7.2 Score

Chaque composante vaut entre 0 et 1.

| Composante | Ce qu'elle mesure | Calcul |
|---|---|---|
| **Affinité** | Ce livre parle-t-il de ce qui compte pour moi ? | 60 % : la part de ses thèmes qui sont des thèmes de cœur. 40 % : ses thèmes en commun avec les œuvres dont le ressenti est « M'a marqué », « Beau moment » ou « À relire un jour ». « Pas pour moi, pas maintenant » retire un peu (20 % au plus), sans jamais écarter un auteur ou un genre. |
| **Contraste** | Change-t-il de mes dernières lectures ? | Pour chaque lecture récente : 50 % l'écart de tonalité (de 1 sombre à 5 lumineux), 25 % les genres différents, 25 % les atmosphères différentes. Plus le petit coup de pouce de l'alternance (§7.5). |
| **Accord avec l'envie** | Dans une envie à filtre, à quel point le livre y correspond | Propre à chaque envie (`envies.ts`). Exemple : pour « réconfortant », une tonalité 5 compte plus qu'une tonalité 4. |
| **Envie** | Il est dans « Envie de lire » | 1 ou 0. |
| **Disponibilité** | Je l'ai | 1 si je l'ai ; pour une série, dès que j'en ai une partie ; sinon 0. |
| **Hasard doux** | Éviter de revoir toujours les mêmes | Un nombre tiré de la graine et de l'œuvre (§7.5, « Hasard qu'on peut fixer »). |

Poids, selon l'envie :

| | Surprends-moi | Envies à filtre (réconfortant, philosophique, remise en question, lecture courte) | Changer d'univers |
|---|---|---|---|
| Accord avec l'envie | — | 25 % | — |
| Affinité | 30 % | 25 % | 15 % |
| Contraste | 25 % | 20 % | 60 % |
| Envie | 10 % | 10 % | 10 % |
| Disponibilité | 5 % | 5 % | 5 % |
| Hasard doux | 30 % | 15 % | 10 % |

L'affinité est une *part* des thèmes, pas un nombre de thèmes : au premier essai, la moitié du catalogue obtenait la note maximale (15 de mes 54 thèmes sont des thèmes de cœur) et les trois mêmes livres sortaient dans presque toutes les envies.

Vérifié sur le catalogue (300 graines, « Surprends-moi ») : sans lecture récente, 1,70 proposition lumineuse sur trois en moyenne ; après Crime et Châtiment, 1,96, et la première des trois est lumineuse 299 fois sur 300. Le test demande « plus de neuf fois sur dix, et plus souvent qu'avant ».

**Variété.** Les trois propositions sont choisies une à une : une candidate perd des points si elle ressemble à une proposition déjà retenue (mêmes genres, tonalité proche, même famille, §7.5). Deux règles fermes : jamais deux œuvres du même auteur ; jamais deux œuvres aux mêmes genres et à la même tonalité. En « Surprends-moi » et « Changer d'univers », la ressemblance coûte plus cher.

**« Pas maintenant ».** Seul ce geste compte comme « ignorée » : voir trois idées et demander « D'autres idées » n'ignore rien. L'idée est mise de côté 3 semaines (21 jours), pour toutes les envies et pour l'accueil, rangée dans `recommendation_log` (§6.1). Passé ce délai, elle revient avec exactement la même note qu'avant : aucune pénalité.

### 7.3 Modes

Les filtres s'appuient sur les étiquettes de mon vocabulaire. On ne complète jamais avec une œuvre hors sujet : le filtre s'applique d'abord, et ce qui reste est ce qui est proposé.

| Envie | Filtre |
|---|---|
| Surprends-moi | Aucun. Variété maximale, davantage de hasard. |
| Quelque chose de réconfortant | Tonalité 4 ou 5, **et** atmosphère Douce, Chaleureuse ou Sereine, ou genre Récit humaniste. |
| Une réflexion philosophique | Genre Roman philosophique, Littérature existentielle, Philosophie ou Spiritualité, **ou** atmosphère Introspective. |
| Remets mes idées en question | Genre Dystopie ou Critique sociale, **ou** atmosphère Dérangeante. |
| Une lecture courte | Longueur courte, ou conte, nouvelle, roman court. Jamais une série (une série de 29 tomes n'est pas une lecture courte). |
| Changer d'univers | Aucun filtre d'étiquette, mais seulement les œuvres dont le contraste avec mes trois dernières lectures atteint la moitié de l'échelle. |

Une œuvre presque sans étiquettes (ajoutée à la main) reste proposable en « Surprends-moi », avec une note neutre et la phrase « Une idée parmi mes livres à découvrir. » ; elle n'entre dans aucune envie à filtre.

### 7.4 Explication

Une phrase de deux morceaux courts au plus, pris dans les raisons réelles du score : d'abord ce qui distingue l'œuvre maintenant (contraste avec ma dernière lecture, ou ce qui la fait entrer dans l'envie), puis ce qui me la rapproche (thèmes de cœur, œuvre aimée) ; à défaut, ce que le livre est, ou ce qui est au cœur du livre.

| Raison | Morceau |
|---|---|
| Tonalité plus haute d'au moins 2 crans que ma dernière lecture | « Lumineux, après *Titre*. » (tonalité 5) ou « Plus lumineux, après *Titre*. » |
| Tonalité plus basse d'au moins 2 crans | « Plus grave, après *Titre*. » |
| Aucun genre en commun avec ma dernière lecture | « Un autre registre, après *Titre* : *genre*. » |
| Envie « réconfortant » | « Atmosphère chaleureuse et douce. » |
| Ce que le livre est | « Dystopie, atmosphère dérangeante et oppressante. » (le genre nommé est le plus rare de ma bibliothèque) |
| Envie « lecture courte » | « Court : un conte. », ou « Court. » seul pour un roman court |
| Thèmes de cœur | « Parmi mes thèmes de cœur : compassion et liberté. » |
| Deux thèmes en commun avec une œuvre aimée | « Des thèmes proches de *Titre* : amitié et enfance. » |
| Sinon | « Au cœur du livre : liberté et propagande. » |
| « Envie de lire », si la place reste | « Déjà dans mes envies de lire. » |
| Je l'ai, si la place reste | « Je l'ai déjà. » ; pour une série dont j'ai une partie : « J'en ai déjà une partie. » |
| En pause | « En pause pour l'instant. Le reprendre ? » |

- Un même morceau n'est jamais dit deux fois dans un groupe de trois : « Parmi mes thèmes de cœur » ne sert qu'une fois (les autres disent « Au cœur du livre »), « Plus grave, après Momo. » ou « Court. » n'apparaissent que sur une carte.
- Grammaire : « après *Titre* » ne se contracte jamais ; les thèmes viennent après deux-points, sans article, dans l'ordre alphabétique (la base ne garde pas d'ordre entre les étiquettes d'une œuvre) ; un thème dont le nom contient « et » est séparé par un point-virgule (« liberté ; technologie et attention ») ; les atmosphères s'accordent avec « atmosphère » ; les noms d'étiquettes perdent leur majuscule initiale.
- Jamais de chiffre, de note ni de pourcentage. Voix (§3) : première personne pour ce qui m'appartient (« mes thèmes de cœur », « Je l'ai déjà »), tournure neutre pour le livre, infinitif pour la question (« Le reprendre ? »). Jamais « tu », « vous » ni impératif.
- Exemples figés dans `src/recommandations/phrase.test.ts`. Après Crime et Châtiment, « Quelque chose de réconfortant » : *La Maison au milieu de la mer céruléenne* — « Lumineux, après Crime et Châtiment. Atmosphère chaleureuse et douce. »
- À l'écran, la phrase d'une carte reste celle de son arrivée tant que la page est affichée : commencer une idée (qui devient une dernière lecture) ne réécrit pas sous mes yeux la phrase des cartes voisines.

### 7.5 Alternance indicative

Cinq familles, dans l'ordre du cahier des charges : philosophique ou introspectif → lumineux ou réconfortant → classique existentiel → dystopie ou réflexion sociale → autre chose (fiction, manga, découverte). Chaque œuvre tombe dans une famille d'après ses étiquettes, le genre d'abord : dystopie ou critique sociale, puis littérature existentielle, puis roman philosophique ou philosophie, puis lumineux et doux, sinon « autre chose » (Siddhartha est donc « philosophique » avant d'être « réconfortant »). Les œuvres de la famille qui *suit* celle de ma dernière lecture reçoivent un petit supplément de contraste (+0,15). Ce n'est jamais un filtre ni un ordre, et rien ne le montre à l'écran.

**Un livre en pause.** Au plus un par groupe de trois, jamais en première position, et sa note est légèrement réduite (× 0,8) : il n'insiste pas. S'il ne reste que des livres en pause à proposer, un seul est montré. Sa phrase commence par « En pause pour l'instant. Le reprendre ? » et son bouton dit « Reprendre ». Jamais sur l'accueil, où il ressemblerait à un rappel.

**Hasard qu'on peut fixer.** Le hasard vient d'une graine (un texte), jamais de `Math.random`. Dans l'appli, la graine est la date du jour et l'envie : mes idées restent les mêmes toute la journée si je reviens sur l'écran, et changent le lendemain. Dans les tests, elle est écrite en dur.

### 7.6 Découvrir ailleurs

Un mode séparé de « Mon envie du moment », pour trouver des œuvres qui ne sont pas encore dans ma bibliothèque.

- **Ce que l'appli envoie à l'API Claude** (modèle Sonnet 5.5, sortie JSON structurée) : l'envie choisie, mes lectures récentes et appréciées (titres et étiquettes), mes thèmes de cœur (les thèmes marqués centres d'intérêt, §6.1) et les titres déjà présents. Jamais mes notes ni mes citations.
- **Ce que Claude propose** : 3 œuvres absentes de ma bibliothèque, chacune avec une raison et une fiche en français (synopsis sans spoiler, étiquettes du vocabulaire existant, tonalité, exigence, longueur).
- **Version originale** : pour une œuvre écrite en anglais, Claude dit si la lire en version originale vaut le coup, avec une raison courte (style, jeux de langue, vocabulaire inventé), ou rien si la traduction convient aussi bien.
- **Vérification avant affichage** : chaque proposition est vérifiée sur Google Books ou la BnF. L'ISBN, l'éditeur et la couverture viennent toujours de ces sources, jamais de l'IA. Une proposition introuvable dans ces sources n'est pas affichée.
- **« Ajouter à ma liste »** enregistre l'œuvre en « À découvrir », déjà étiquetée. Rien n'est enregistré sans ce geste.
- Si l'IA est indisponible ou si la limite de dépense est atteinte, ce mode l'indique simplement ; tout le reste de l'appli fonctionne.

### 7.7 Écrans (étape 7)

**Découvrir** (`#/decouvrir`), de haut en bas :

1. Le titre, puis « Mon envie du moment » : une grande bulle qui ouvre le menu des six envies (le composant des bulles Statut et Possession). À la première ouverture : « Surprends-moi ». L'envie est portée par l'adresse (`#/decouvrir?envie=reconfortant`) : rien n'est rangé sur l'appareil, le retour arrière fonctionne, et une envie inconnue revient à « Surprends-moi ». Changer d'envie repart de zéro (idées vues oubliées) et rend le focus au sélecteur.
2. Trois idées, chacune dans une carte. La couverture, le titre, l'auteur et la phrase forment un seul lien vers la fiche (VoiceOver : « Voir la fiche de Momo », puis l'auteur et la phrase). Dessous, deux boutons : **« Commencer »** (« Reprendre » pour un livre en pause), sur l'accent doux, et **« Pas maintenant »**, plus discret (simple contour, texte secondaire). VoiceOver : « Commencer Momo », « Pas maintenant pour Momo ». La page affichée ne bouge pas quand les données se relisent.
3. Une phrase calme quand il y a peu d'idées, puis « D'autres idées », puis une ligne discrète : « « Pas maintenant » met l'idée de côté quelques semaines. Rien d'autre ne change. »

Ce que je peux faire d'une idée :

- **Ouvrir la fiche** : toucher la carte.
- **Commencer** : une confirmation courte (« Commencer Momo ? » — « Oui, commencer » / « Pas tout de suite »), parce qu'un début de lecture ne s'efface pas proprement de mon parcours. Puis `changer_statut`. La carte laisse place, au même endroit, à une ligne calme : le titre, « En cours. » et « Voir la fiche ». Le livre apparaît sur l'accueil.
- **Pas maintenant** : l'idée suivante prend sa place, et le message « Idée mise de côté · Annuler » s'affiche environ 5 secondes, sur une ligne. Sur iPhone, il prend la place de la barre du bas le temps de son affichage, pour ne recouvrir aucune carte ; sur iPad, il se pose en bas de la colonne de contenu. « Annuler » remet l'idée exactement à sa place. Le focus va à l'idée arrivée (ou revenue), qui reste visible au-dessus du message.
- **D'autres idées** : les trois suivantes, en écartant celles déjà vues depuis l'ouverture de l'écran ; rien n'est écrit. VoiceOver annonce les titres. Quand tout a été vu : « Toutes les idées pour cette envie ont été vues. » et le bouton devient « Revoir depuis le début ».

États (aucune de ces phrases ne compte, ne félicite ni ne presse) :

| Situation | Ce que l'écran montre |
|---|---|
| 1 ou 2 idées | Elles seules, puis « Une seule idée pour cette envie, pour l'instant. » ou « Deux idées seulement pour cette envie, pour l'instant. » Pas de bouton « D'autres idées ». |
| Aucune (tout est lu, en cours ou de côté) | « Aucune idée pour cette envie pour l'instant. » Le sélecteur reste juste au-dessus. |
| « Changer d'univers » sans lecture récente | « Cette envie part de mes dernières lectures : rien de récent pour l'instant. » |
| Rien à découvrir dans toute la bibliothèque | « Tout ce qui est dans ma bibliothèque est lu ou en cours. » et « Ajouter une œuvre ». |
| Bibliothèque vide | « Dès que ma bibliothèque aura quelques œuvres à découvrir, des idées selon mon humeur apparaîtront ici. » |
| Hors connexion | Les idées s'affichent ; « Commencer » et « Pas maintenant » sont grisés, avec « Hors connexion : ces choix reviendront avec le réseau. » ; « D'autres idées » fonctionne. |

iPad : en portrait (colonne de contenu d'environ 500 points à côté de la barre latérale), les cartes restent l'une sous l'autre, comme sur iPhone : trois cartes côte à côte y seraient trop étroites pour la phrase ; dès que la colonne atteint 48 rem (iPad en paysage), elles se mettent côte à côte, couverture au-dessus, boutons empilés en bas de carte. Phrases de 65 caractères au plus.

**Accueil, « Une idée pour la suite »**, sous « En ce moment » : une seule idée, la première de « Surprends-moi » aujourd'hui (même graine que Découvrir), jamais un livre en pause. La carte mène à la fiche (même carte que Découvrir, en un peu plus grand) ; « Une autre idée » montre la suivante sans rien écrire, puis revient à la première quand tout a été vu ; puis le lien « Selon mon humeur ». Pas de « Commencer » ni de « Pas maintenant » ici : l'accueil reste léger. Sans idée à proposer (ou le temps de les lire), la section n'apparaît pas : seul reste « Selon mon humeur ».

Nulle part : aucun score, aucun classement, aucun « x idées restantes », aucun rappel d'un livre mis de côté ou en pause, aucune notification, aucun objectif.

### 7.8 Limites connues

- **Vocabulaire renommé.** Les envies reconnaissent les étiquettes par leur nom (réunis au début de `src/recommandations/envies.ts`, comparés sans tenir compte des majuscules ni des accents). Si je renomme « Dystopie », l'envie « Remets mes idées en question » ne la reconnaît plus. Accepté pour la version 1 ; un test vérifie que chaque nom existe dans le catalogue.
- **Nom propre en minuscule.** Les étiquettes perdent leur majuscule dans la phrase : un thème « Japon » s'écrirait « japon ».
- **Thèmes par ordre alphabétique**, faute d'ordre gardé par la base.
- **Quand une envie est vide parce que tout y est de côté**, rien ne propose de « les reproposer maintenant » : elles reviennent seules au bout de trois semaines. À revoir si cela gêne à l'usage.

## 8. Couvertures et métadonnées

### 8.1 Recherche automatique

Une fonction serveur (Supabase Edge Function « assistant », §10.2) interroge trois catalogues publics. (Ordre validé le 19 novembre 2026 : il remplace « Google Books d'abord ».)

Métadonnées, champ par champ, dans cet ordre de confiance :
1. **La BnF** (catalogue général, sans clé) : la plus sûre pour une édition française (titre, auteur tel qu'il est imprimé sur le livre, traducteur, éditeur, pagination, langue d'origine, numéro de tome).
2. **Google Books** (avec une clé) : complète ce qui manque, et donne une présentation et une couverture.
3. **Open Library** (sans clé) : complète encore, surtout pour les éditions étrangères, et donne une couverture.

Règles :
- Chaque champ rempli garde sa source, affichée pendant l'ajout. Ce qu'aucune source ne donne reste vide ; une pagination ambiguë (deux volumes, « non paginé ») reste vide.
- L'année de première parution ne vient que d'Open Library, et seulement quand elle se rapporte clairement à l'œuvre originale (fiche au titre original, ou œuvre que rien ne signale comme traduite). Jamais pour une série : Open Library date ses tomes. Elle s'affiche avec la mention « à vérifier ».
- Par ISBN (13 chiffres, chiffre de contrôle vérifié) : l'édition exacte. L'ISBN d'un tome prépare la série, et l'ISBN va sur ce tome.
- Par titre (et auteur) : une liste d'au plus huit œuvres, les éditions d'une même œuvre regroupées ; je choisis. La fiche est commune à toutes les éditions : ni ISBN, ni éditeur, ni pagination.

Couvertures :
- Par ISBN : Google Books, puis Open Library. Pour un manga, par l'ISBN du tome français ; aucune base de traductions de fans (§3).
- La fonction construit elle-même l'adresse de l'image, vers ces deux sites seulement, vérifie que c'est une vraie image (ni vignette, ni image « indisponible »), et la rend à l'appli avec sa largeur et sa hauteur. L'appli écarte encore, sur l'appareil, une image presque uniforme (page blanche, toile unie : §8.5).
- Elle cherche la plus grande image (§8.5), et interroge Google Books tel qu'on le voit depuis la Suisse (`country=CH`).
- L'appli ne la range que lorsque je valide la fiche : dans un bucket privé de Supabase Storage, dans mon dossier, sous un nom tiré de son contenu. Elle est réduite juste avant (§8.5). Elle est servie par URL signée et gardée sur l'appareil pour la consultation hors ligne ; à la déconnexion, cette copie est effacée.
- Une couverture trouvée par le seul titre m'est montrée avant d'être gardée, comme les autres : je peux toujours ne pas la garder, ou la retirer plus tard depuis « Modifier ».
- Pour ce qui est déjà dans ma bibliothèque : « Chercher les couvertures manquantes », dans les Réglages (§5). Sans ISBN, rien n'est cherché, pour ne pas risquer une mauvaise couverture.

### 8.2 Dernier recours

Une couverture typographique générée (titre et auteur sur fond de couleur douce, choisie parmi une petite palette chaude). Jamais de case vide.

### 8.3 Droits

Les couvertures ne sont jamais enregistrées dans le dépôt GitHub public.

### 8.4 Fiche automatique

À l'ajout d'un livre, les métadonnées publiques sont d'abord récupérées (§8.1). L'API Claude propose ensuite un synopsis et des étiquettes, en suggestion modifiable : rien n'est enregistré tant que la fiche n'est pas validée. Sans l'IA, l'ajout fonctionne de la même façon, avec ces champs à remplir à la main. La fiche est toujours en français, même pour une édition en anglais.

Précisions de l'étape 6 (validées le 19 novembre 2026) :
- **Ce que l'IA reçoit** : le titre, l'auteur, l'année et la langue d'origine trouvés, les présentations des catalogues, et mon vocabulaire d'étiquettes. Jamais mes notes, mon statut, mon ressenti, ni rien de ce que j'ai écrit. La fonction refuse toute demande qui porte un champ en trop.
- **Ce qu'elle propose** : un synopsis sans spoiler, des genres, thèmes et atmosphères pris dans mon vocabulaire, la tonalité, l'exigence et la longueur. Elle peut s'appuyer sur ce qu'elle sait d'une œuvre connue, pour cela seulement.
- **Ce qu'elle ne fournit jamais** : aucune donnée bibliographique (année, traducteur, éditeur, ISBN, nombre de pages, nombre de tomes). Ces champs viennent des sources ou restent vides. Le schéma de sa réponse ne les contient pas, et la fonction reconstruit la réponse champ par champ : ils ne peuvent pas en sortir.
- Si elle ne connaît pas l'œuvre et qu'aucune source ne la décrit, le synopsis reste vide.
- Une notion importante absente de mon vocabulaire peut être proposée comme thème nouveau (deux au plus), affiché à part, marqué « Nouveau », ajouté seulement si je le choisis.
- La proposition ne remplit que les champs encore vides : ce que j'ai écrit pendant qu'elle se préparait reste.
- Les textes venus des catalogues sont traités comme des données, jamais comme des consignes (protection contre une consigne cachée dans une description).
- Si l'IA ne répond pas, refuse, ou si la limite du jour est atteinte : une phrase calme, et la fiche se remplit à la main.

### 8.5 Taille, affichage et choix des couvertures

Validé le 19 novembre 2026, après le premier essai sur iPhone (couvertures floues, rognées, et trop peu de tomes illustrés).

Affichage (décidé le 20 novembre 2026, après essai sur iPhone ; remplace le cadre 2:3 et ses bandes colorées) :
- La case a le format 5:8 (0,625). Mesuré sur Open Library : les poches français (Folio, GF, Le Livre de poche, 108 à 110 × 178 mm) font 0,60 à 0,63 ; avec un cadre 2:3 (0,667), presque toute la bibliothèque aurait eu des bandes.
- Trois règles, appliquées sur l'appareil au moment d'afficher, une seule fois par image. L'image rangée n'est jamais modifiée : les couvertures déjà rangées en profitent sans rien renvoyer.
  1. **Les marges unies d'un scan sont rognées.** Une ligne de bord est unie si 98 % de ses points sont à 20 nuances près (sur 255, par canal) de la couleur du milieu de ce bord. Un côté n'est rogné que si sa bande fait moins de 4 % de la dimension, ou si le côté opposé a lui aussi une bande d'au moins 1 % (cadre de scan). Une bande large d'un seul côté (le blanc du haut d'un Folio, 5,5 %) fait partie du dessin : elle reste.
  2. **À 6 % au plus de 5:8**, l'image remplit la case, recadrée au centre : elle perd au plus 3 % de chaque côté.
  3. **Sinon**, elle est montrée à sa vraie forme, posée en bas de la case et centrée, comme un livre sur une étagère (mangas, 0,70 ; Minuit, 0,74). Aucune bande colorée : le reste de la case est vide, et les titres restent alignés d'une case à l'autre.
- Deux précisions décidées en codant : une zone unie qui atteint 15 % de la dimension n'est pas une marge mais le fond de la couverture (rien n'est rogné de ce côté) ; et un simple liseré en face (moins de 1 %) ne fait pas un cadre de scan.
- **Marque invisible.** Une couverture que j'ai cadrée moi-même (photo redressée) porte un commentaire dans son fichier JPEG (« Ichnos : cadrée à la main »). À l'affichage, elle n'est jamais rognée ni recadrée : elle remplit la case si elle en a déjà le format, à 1 % près, sinon elle est posée en bas. La réduction (voir « Poids ») garde la marque. Les photos rangées avant ce changement n'ont pas de marque : elles suivent la règle générale.
- Limites : une marge de scan large d'un seul côté est gardée ; une marge dégradée ou bruitée (scan jauni) n'est pas reconnue ; une couverture blanche dont le dessin est centré, avec des marges blanches de moins de 15 % sur deux côtés opposés, est prise pour un scan et rognée ; un texte collé au bord peut être effleuré par les 3 %. Code : `src/couvertures/cadrage.ts`, `marque.ts`.

Taille :
- La fiche affiche la couverture sur près de 200 points : il faut environ 600 px de large pour une image nette sur iPhone. En dessous de 450 px, une couverture est dite « de petite taille », sauf si son grand côté atteint déjà 1200 px (voir « Poids ») : c'est alors la plus grande que l'appli range.
- La fonction essaie les adresses de la plus grande image à la plus petite. Google Books : `fife=w1200-h1800`, puis `zoom=0`, puis `fife=w480-h720` (cette dernière ne rend souvent qu'une vignette). Open Library : l'image d'origine par numéro de couverture (`/b/id/<n>.jpg`), puis la taille « L ».
- Sous 450 px, elle essaie les adresses suivantes et l'autre source, et garde la plus large.
- Par ISBN, Open Library donne la couverture de l'édition elle-même : son numéro est lu sur la fiche de l'édition. Le numéro que rend sa recherche est celui de l'œuvre en général (souvent une autre édition) : il ne sert jamais pour un ISBN. L'adresse par ISBN (limitée à une centaine de demandes par 5 minutes) ne sert qu'en dernier recours.
- Pour un livre sans image, Google Books renvoie parfois une fausse couverture grise, qui passe les autres contrôles. Elles sont reconnues à leur empreinte SHA-256 et traitées comme « pas de couverture ». Si Google en sert une autre : ajouter son empreinte dans `couverture.ts`, et un test.
- Fausses couvertures presque uniformes (décidé le 20 novembre 2026) : une page de titre blanche avec deux lignes de texte (Siddhartha, ISBN 9782253008484 : Open Library rattache à cette édition une page de titre de livre numérique, 2480 × 3509 px), ou la toile unie d'un livre relié sans jaquette. L'iPhone regarde chaque image reçue en tout petit (48 × 72 points) : si plus de 98 % de ses points ont presque la même couleur (à 24 nuances près sur 255), elle est traitée comme « pas de couverture », pour toutes les recherches (ajout, achat, « Chercher cette édition », autres couvertures, couvertures manquantes, petites couvertures). Mesuré : page de Siddhartha 99,2 %, toile verte 100 % ; vraies couvertures sobres gardées : La Jalousie (Minuit) 95,5 %, L'Homme qui plantait des arbres (Gallimard) 94,2 %. Une image qu'on ne sait pas mesurer n'est jamais écartée. Limite : une page de titre plus chargée (94 %) passe encore ; la croix de « Modifier » la retire. Code : `src/couvertures/uniformite.ts`.
- Constat du 20 novembre 2026, L'Homme qui plantait des arbres (ISBN 9782070744619) : Open Library n'a que 300 × 475 px (17 Ko), c'est son image d'origine ; Google Books ne donne qu'une page de titre de 300 × 478 px, puis une vignette. Aucune source n'a mieux : la photo de mon exemplaire ou une autre édition est la seule voie.

Poids (décidé le 20 novembre 2026) :
- Toute image rangée dans mon stockage privé suit la même règle, qu'elle vienne d'un catalogue ou d'une photo : au plus 1200 px sur le grand côté, en JPEG de bonne qualité (0,85), soit 150 à 300 Ko environ. L'image d'origine d'un catalogue pèse parfois près de 1 Mo.
- La réduction se fait sur l'appareil, au moment où l'image est rangée : à la validation de la fiche, à l'achat, au choix d'une autre couverture, à la recherche des couvertures manquantes et au remplacement des petites. Un aperçu que je ne garde pas n'est pas touché.
- Une image n'est jamais agrandie. Déjà dans les 1200 px et sous 350 Ko, elle est rangée telle quelle (une photo redressée n’est pas compressée deux fois) ; de bonne taille mais lourde, elle est recompressée, et la version la plus légère est gardée. Si la réduction échoue, l'image d'origine est rangée.
- La marge reste large pour la fiche : une couverture ordinaire réduite à 1200 px de haut garde 750 à 800 px de large, pour 588 pixels affichés sur un iPhone.
- Mesuré le 20 novembre 2026 sur L'Étranger en Folio : 911 × 1500 px et 937 Ko à l'origine, 729 × 1200 px et 138 Ko une fois rangée.

« Remplacer les couvertures de petite taille » (Réglages) :
- Chaque couverture rangée est mesurée sur l'appareil, sans rien changer à la base.
- Seulement pour celles de petite taille dont l'ISBN est connu (celui de l'édition ou du tome qui porte la couverture) : la couverture de cette même édition est redemandée, et ne remplace l'ancienne que si, une fois rangée, elle est plus large. Une image déjà réduite à 1200 px n'est jamais tenue pour petite.
- Même rythme que la recherche (une demande à la fois, pause de 1,5 s, « Arrêter »), et la liste de ce qui a été fait : « remplacée (300 → 800 px) », « pas de plus grande image », « sans ISBN, laissée telle quelle ».
- Limite connue : une petite couverture que j'aurais choisie parmi d'autres éditions, rangée sur mon édition, peut être remplacée par celle de mon édition. Je peux la rechoisir.

« Choisir une image » (dans « Modifier », par le menu « Changer la couverture », et dans le panneau d'un tome) :
- Dans le panneau d'un tome, un seul bouton : l'iPhone propose la photothèque, l'appareil photo ou les fichiers. Dans « Modifier », « Prendre une photo » ouvre directement l'appareil photo, « Choisir dans mes photos » laisse l'iPhone proposer.
- La photo est redressée, à la manière du scanner de documents de l'iPhone (voir « Redressement d'une photo », plus bas). Le recadrage en rectangle du 19 novembre 2026 est remplacé.
- Tout se fait sur l'appareil, sans dépendance ajoutée : l'image est réduite (même règle de poids que les autres couvertures) puis rangée dans mon stockage privé. Un fichier qui n'est pas une image, ou de plus de 30 Mo, est refusé.

Redressement d'une photo (décidé le 20 novembre 2026) : un panneau en deux temps, pour toute photo (« Prendre une photo », « Choisir dans mes photos », panneau d'un tome, « Prendre une photo de mon exemplaire »).
- **1. « Redresser la photo ».** Les quatre coins se placent d'eux-mêmes sur le livre trouvé. Je les ajuste au doigt (une loupe suit le coin, au-dessus du doigt) ou aux flèches du clavier ; chaque coin a un nom pour VoiceOver. Boutons : « Redresser », « Image entière » (les coins reviennent aux coins de la photo), « Reprendre la photo ». Si le livre n'est pas trouvé : « Livre introuvable sur la photo : placer les coins à la main. »
- **2. « Vérifier la couverture ».** La couverture droite et rectangulaire, sans la table autour. Boutons : « Valider », « Revoir les coins », « Reprendre la photo ». Rien n'est rangé avant « Valider ».
- **Détection des coins** : vision par ordinateur classique, sans IA ni réseau, sur la photo réduite à 512 px. Les couleurs du fond s'apprennent sur les bords de la photo (il peut y en avoir plusieurs : soleil et ombre, tapis à motifs) ; ce qui n'a pas une couleur du fond est le livre, morceaux proches compris ; puis, de chaque côté, on cherche le bord droit du livre, au ras de cette zone ou juste au-delà, là où l'image change le plus nettement. Si rien de plausible n'est trouvé (moins de 5 % de la photo, angle de moins de 40°), les coins sont ceux de la photo.
- **Redressement** : homographie (système 8 × 8), interpolation bilinéaire. Le format du livre est déduit de la perspective en supposant l'objectif principal d'un iPhone (focale de 0,72 fois le grand côté de la photo) : la moyenne des côtés est fausse dès que le livre est vu de biais. Sortie : 1200 px au plus, JPEG, avec la marque invisible.
- **Module maison** de 11 Ko (4,8 Ko compressé), sans dépendance, chargé seulement à l'ouverture du panneau (`src/couvertures/redressement`). OpenCV.js (10 Mo) et `jscanify` ont été écartés.
- **Mesuré le 20 novembre 2026 sur six vraies photos** (Siddhartha au Livre de poche sur un drap gris foncé, à plat et de biais ; Vinland Saga tome 2 sur un parquet au soleil avec un reflet, en forte perspective avec un meuble et un tapis dans le champ, dans l'ombre, et sur un tissu à motifs) : les quatre coins sont trouvés sur les six, à quelques points près ; formats redressés 0,61 pour le Livre de poche (réel : 0,62) et 0,70 à 0,72 pour le manga (réel : 0,70). Détection : 0,2 à 0,3 s sur un ordinateur, à mesurer sur iPhone. Ces photos ne sont ni dans le dépôt ni dans les tests, qui n'utilisent que des images dessinées par le code.
- **Limites** : six photos ne font pas une preuve. La détection est moins sûre si toute une bordure de la couverture a la couleur du fond, si le livre est tenu à la main ou coupé par le bord de la photo, ou sur un fond très chargé ; les coins restent toujours réglables. Avec un autre objectif que le principal (grand-angle, zoom) et un livre très penché, le format peut être faux de quelques centièmes. Une couverture souple ou cornée n'est pas plane : la courbure n'est pas corrigée. Avec VoiceOver sur iPhone, sans clavier, les coins ne se déplacent pas : restent les coins trouvés, ou « Image entière ».

Lumière d'une photo (ajouté le 20 novembre 2026) : le redressement corrige la forme, pas la lumière.
- **Conseil** : « Lumière douce, sans flash, téléphone bien à plat au-dessus du livre. » Affiché sous les boutons de photo les trois premières fois (l'appareil ne retient qu'un compte), puis seulement replié dans le panneau de redressement (« Conseils pour la photo »).
- **Correction légère, sans IA**, appliquée à la couverture redressée, à la manière du bouton « Améliorer » de Photos : balance des couleurs mesurée sur les gris de l'image (corrigée aux deux tiers, 8 % au plus par canal, et pas du tout s'il n'y a pas assez de gris : une couleur franche vient du dessin, pas de la lumière), niveaux (le noir ne monte pas de plus de 32 nuances, le blanc ne descend pas de plus de 60), un soupçon de contraste. Activée par défaut ; l'interrupteur « Couleurs d'origine » la retire, et c'est l'image que je vois qui est gardée.
- **Ni les reflets ni les ombres nettes ne sont effacés** : ce serait peu fiable. La correction agit sur toute l'image de la même façon. Le remède est « Reprendre la photo », toujours proposé à côté de « Valider ».

« Chercher d'autres couvertures » (dans « Modifier », pour une œuvre, jamais pour un tome) :
- La recherche part avec le titre et le premier auteur ; je peux la corriger et la relancer. Pas d'IA.
- Les images ne viennent que de Google Books (dans la langue de mon édition, français ou anglais) et d'Open Library. La BnF n'est interrogée que pour la collection, la hauteur du livre et l'année, rapprochées par l'ISBN : aucune image ne vient de la BnF.
- Au plus huit propositions, sans doublon, de la plus probable à la moins probable : l'édition qui porte l'ISBN de mon édition ; puis le même éditeur ou la même collection ; puis les poches dans la langue demandée (18 cm au plus, ou collection de poche connue : Folio, Le Livre de Poche, Pocket, J'ai lu, 10/18, Points, GF, Babel), les plus récentes d'abord ; puis le reste.
- Sous chaque image : « éditeur · collection · année », et « petite taille » s'il y a lieu. Je touche une image, puis « Garder cette couverture ». Rien n'est gardé sans mon choix, et la couverture gardée n'est rangée qu'avec « Enregistrer » (§5).

Où va une couverture que je choisis (photo ou autre édition) :
- Là où elle s'affiche : sur mon édition si j'en ai une, sinon sur l'œuvre ; sur le tome pour un tome.
- Pour une série, depuis « Modifier » : sur la série elle-même. Elle s'affiche tant qu'aucun tome n'a sa couverture ; chaque tome se règle dans son panneau.
- Depuis « Modifier », c'est décidé à l'enregistrement : sur mon édition telle qu'elle vient d'être enregistrée (si je viens d'en changer, sur la nouvelle). Dans le panneau d'un tome, le geste reste immédiat.
- « Je l'ai acheté » : sur l'édition achetée, qui devient la mienne (§6.1).

## 9. Catalogue initial

Les 32 œuvres listées dans le cahier des charges (qui en annonce 30), plus 3 mangas ajoutés le 17 novembre 2026, soit 35 œuvres, toutes en « À découvrir » et « Non possédé ». Vinland Saga est une seule œuvre avec 29 tomes et un média associé (anime, 2 saisons de 24 épisodes).

Ajouts du 17 novembre 2026 (à vérifier à l'étape 3 comme le reste) :

| Œuvre | Auteur | Repères | Pistes de thèmes |
|---|---|---|---|
| Vagabond | Takehiko Inoue | 37 tomes, série en pause indéfinie depuis 2015 ; éditeur français : Tonkam | Voie du sabre, quête de soi, humilité, violence et sagesse |
| Chainsaw Man | Tatsuki Fujimoto | Série terminée en 2026 (24 tomes au Japon), parution française en cours chez Kazé ; anime associé | Désir, solitude, humanité, absurde |
| Elden Ring : Le chemin vers l'Arbre-Monde | Nikiichi Tobita | Manga humoristique tiré du jeu vidéo, en cours ; éditeur français : Mana Books | Parodie, légèreté, fantasy décalée |

- Le nombre de tomes d'une série en cours doit rester modifiable.

Préparation :
- Vérifier titres français, auteurs et éditions françaises de référence.
- ISBN seulement s'il est vérifié dans une source fiable.
- Synopsis rédigés, sans spoiler.
- Étiquettes de genre, thèmes et atmosphère ; tonalité, exigence, longueur.
- Aucun avertissement de contenu.
- Suites signalées (Un psaume pour les recyclés sauvages, La Maison au milieu de la mer céruléenne) sans être ajoutées d'office.

Le fichier du catalogue de départ ne contient que des informations bibliographiques publiques, jamais de statut personnel.

Import (validé le 18 novembre 2026) :
- Le catalogue est le fichier `catalogue/catalogue-initial.json`. Les thèmes de cœur y sont marqués, la même liste figurant déjà dans le cahier des charges.
- Il s'installe depuis l'écran Bibliothèque, quand elle est vide, par le bouton « Installer le catalogue de départ ». L'appli appelle alors la fonction `importer_catalogue` de la base, sous le compte connecté.
- Tout ou rien : à la moindre erreur, rien n'est enregistré. Un second import est refusé dès que la bibliothèque contient des œuvres.
- « À découvrir », « Non possédé » et « À voir » viennent des valeurs par défaut des tables. Chaque œuvre est reliée à son édition de référence.

## 10. Technique

### 10.1 Stack

- React, TypeScript, Vite, Tailwind CSS.
- Supabase : PostgreSQL, authentification, stockage, Edge Functions.
- `supabase-js` et TanStack Query, avec cache persistant pour la consultation hors ligne.
- PWA avec `vite-plugin-pwa`, installable depuis Safari.
- `isbn3` (version exacte 2.0.13) pour la place des tirets d'un ISBN : la seule dépendance ajoutée depuis l'étape 6.
- Routage par hash (`#/…`), fiable sur GitHub Pages et invisible dans l'application installée.
- Tests : Vitest, en priorité sur l'algorithme de recommandation et la progression.
- Migrations de base de données versionnées dans `supabase/migrations`.

### 10.2 Sécurité

- Connexion par e-mail et mot de passe. Le compte est créé à la main dans Supabase, avec un mot de passe long généré par le gestionnaire de mots de passe ; les inscriptions publiques sont désactivées.
- L'application ne crée jamais de compte et n'envoie aucun e-mail : ni inscription, ni « mot de passe oublié ». Un mot de passe perdu se réinitialise depuis le tableau de bord Supabase.
- Formulaire de connexion : un vrai élément `form`, champs `autocomplete="email"` et `autocomplete="current-password"`, pour le remplissage automatique de Bitwarden sur iPhone. Le message d'erreur ne dit jamais si c'est l'adresse ou le mot de passe qui est faux.
- Session longue : gardée sur l'appareil et renouvelée automatiquement, jusqu'à la déconnexion depuis les Réglages.
- RLS activé sur toutes les tables, avec politiques en lecture et en écriture.
- Dix fonctions de la base sont appelables par le compte connecté, et par lui seul (la huitième, `regler_tomes`, ajoutée le 20 novembre 2026 : possession et lecture de plusieurs tomes, et leur annulation, en tout ou rien, §6.1 ; les neuvième et dixième, `mettre_idee_de_cote` et `reprendre_idee`, ajoutées le 21 novembre 2026 : « Pas maintenant » et son « Annuler », §6.1 et §7.2) : `importer_catalogue` (§9), `enregistrer_oeuvre` (ajout et modification d'une œuvre avec ses auteurs, étiquettes, éditions, tomes et médias, en tout ou rien ; elle ne touche ni au statut, ni à la possession, ni à la progression, ni aux notes, et garde les couvertures de ce qu'elle ne supprime pas), depuis l'étape 5, `changer_statut`, `noter_progression` et `dater_fin` (statut, dates et historique ; position ou tome courant et sa trace ; date de fin approximative, §6.3), chacune en tout ou rien, et, depuis l'étape 6, `reserver_appel_ia` (compte mes appels à l'IA des dernières 24 heures et en réserve un si la limite n'est pas atteinte) et `noter_achat` (« Je l'ai acheté » : mon édition ou le tome, son ISBN, sa couverture et la possession, en tout ou rien, §6.1). Elles s'exécutent avec les droits de l'appelant, donc sous RLS, et vérifient en plus elles-mêmes que l'œuvre est à moi : les tests coupent la RLS un instant pour s'assurer que ce second contrôle tient seul. Toute nouvelle fonction ouverte doit être ajoutée aux tests de sécurité. Pour `regler_tomes`, on a aussi vérifié que les tests échouent bien si l'on retire le `revoke`, si la fonction passe en `security definer`, ou si l'on retire son contrôle d'appartenance (faute glissée dans une copie de la migration, une à la fois). Même contre-épreuve pour `mettre_idee_de_cote` et `reprendre_idee` (`supabase/tests/11_idees_de_cote_test.sql`), avec dix fautes en tout (dont droit donné à `anon`, ancienne ligne non remplacée, envie non vérifiée), toutes attrapées sur le banc local ; l'Action « Migrations » sur la vraie base jetable fait foi.
- Seule la clé publique Supabase dans le frontend. Toutes les autres clés dans les secrets GitHub ou les secrets Supabase.
- Fonction serveur « assistant » (§7.6, §8) : une seule Edge Function porte tout ce qui a besoin d'une clé (Google Books, API Claude). L'étape 7b y ajoutera son action.
  - Elle n'est appelable que par le compte connecté : elle vérifie elle-même le jeton de session auprès de Supabase, à chaque appel. Sans compte, rien ne passe ; dans le doute (service de connexion muet), rien ne passe non plus.
  - Elle n'accepte que les appels venus du site publié (GitHub Pages) et de l'aperçu local. Cette barrière arrête un autre site dans un navigateur ; la vraie protection reste le jeton.
  - Les clés `ANTHROPIC_API_KEY` et `GOOGLE_BOOKS_API_KEY` sont dans les secrets du projet Supabase (Edge Functions → Secrets), jamais dans l'appli, le dépôt, les réponses ou les journaux. La clé Google voyage dans un en-tête, jamais dans une adresse ; la clé Google est restreinte à « Books API ».
  - Elle n'utilise aucune clé de service de Supabase : ce qu'elle lit et écrit dans la base (mon vocabulaire, la réservation d'un appel), elle le fait avec mon propre jeton, donc sous RLS.
  - Entrées relues champ par champ (ISBN à 13 chiffres valide, longueurs maximales), tout champ inconnu fait refuser la demande.
  - Elle ne télécharge une image que depuis Google Books et Open Library, à une adresse qu'elle construit elle-même ; une redirection n'est suivie que vers ces sites.
  - Son action « autres couvertures » (§8.5) n'appelle pas l'IA et ne télécharge aucune image : elle ne rend que des références, que l'appli redemande une à une. La langue demandée ne peut être que le français ou l'anglais.
  - Une réponse d'erreur ne porte qu'un code. Rien de ce qu'un service extérieur répond n'est recopié.
  - Ses journaux : une ligne par appel (action, résultat, durée, état des sources), aucun contenu, aucun identifiant.
  - Au plus 30 appels à l'IA par 24 heures, réservés dans `ai_calls` avant chaque appel ; si la réservation ne peut pas être vérifiée, l'IA n'est pas appelée. En plus, une limite de dépense mensuelle est fixée dans la console Anthropic, sur un espace de travail dédié.
  - Tout cela est vérifié par des tests (`supabase/functions/assistant/*.test.ts`), lancés avec ceux de l'appli.
- Politiques de stockage restreintes à l'utilisateur : chaque compte ne lit et n'écrit que son dossier du bucket privé `couvertures` (tests avec un second compte).
- Les journaux des GitHub Actions d'un dépôt public sont publics : aucune donnée ni clé ne doit y être affichée.

### 10.3 Sauvegarde et veille

- Export JSON complet depuis les réglages.
- Une GitHub Action planifiée tous les trois jours :
  - interroge la base pour éviter la mise en veille de l'offre gratuite ;
  - une fois par semaine, exporte les données vers un dépôt GitHub privé.

### 10.4 Déploiement

- GitHub Actions construit et publie sur GitHub Pages à chaque fusion dans `main`.
- Une autre Action applique les migrations Supabase, puis met en ligne la fonction « assistant ». Le jeton `SUPABASE_ACCESS_TOKEN` doit pour cela avoir, en plus de ses droits de l'étape 2, « Edge Functions » en lecture-écriture. Si ce déploiement est refusé, l'Action le dit clairement et rien d'autre ne casse : l'appli fonctionne sans la fonction. Ce travail ne connaît que le jeton d'accès (les clés Anthropic et Google n'y passent jamais), et tout ce qui ressemblerait à un jeton ou à une clé est masqué avant d'être affiché dans son journal, y compris en cas d'échec.

## 11. Plan de développement

Objectif : une application complète et en ligne avant le départ, sans sacrifier la qualité. Chaque étape se termine par une version utilisable.

| # | Étape | Modèle et effort |
|---|---|---|
| 0 | Préparation : Node.js, Claude Code, comptes, dépôt GitHub, projet Supabase, secrets | — |
| 1 | Squelette : React, TypeScript, Vite, Tailwind, thème clair/sombre, navigation, déploiement GitHub Pages, base PWA | Opus 5.5, moyen |
| 2 | Base de données et sécurité : schéma, RLS, stockage, connexion par e-mail et mot de passe, Action de migrations | Fable 5.2, élevé |
| 3 | Catalogue initial : vérification, étiquettes, synopsis, import | Fable 5.2, élevé |
| 4 | Bibliothèque et fiches : grille, recherche, filtres, ajout, modification, statuts, possession | Opus 5.5, moyen |
| 5 | Suivi de lecture : unités, tomes, média associé, mise à jour rapide, ressenti facultatif proposé quand je termine un livre (§6.4) | Opus 5.5, élevé |
| 6 | Couvertures, métadonnées automatiques et fiche automatique (§8.4) | Fable 5.2, élevé |
| 7 | Recommandations : algorithme, tests, écran Découvrir, suggestion d'accueil (**faite le 21 novembre 2026** : algorithme, base et dépôt en Fable 5.2, élevé ; écrans en Opus 5.5, moyen) | Fable 5.2, élevé |
| 7b | « Découvrir ailleurs » (§7.6) : Edge Function, vérification des propositions, écran | Fable 5.2, élevé |
| 8 | Accueil final, notes, export, sauvegarde et veille | Opus 5.5, moyen |
| 9 | Finitions : animations, PWA complète, hors ligne (dont le cache qui survit à la fermeture de l'appli, reporté de l'étape 4 : jusque-là, on consulte hors connexion ce qui a déjà été chargé), accessibilité, animations des interactions (§4.3), mouvements réduits (voir plus bas), audit design (Impeccable) | Opus 5.5, moyen |
| 10 | Nettoyage et optimisation : fichiers temporaires et code obsolète, dépendances inutilisées, poids de l'appli et vitesse sur iPhone, images de couverture qui ne servent plus à aucune œuvre dans le stockage (voir plus bas) | Opus 5.5, élevé |
| 11 | Revue de sécurité finale, sur le code nettoyé, dont les alertes `npm audit` (voir plus bas) | Fable 5.2, élevé |

Points reportés :

- **Étape 5, accueil.** Les lectures « En cours » apparaissent sur l'accueil, chacune avec le bouton « Où j'en suis » (§5).
- **Étape 6, deux manières d'ajouter une œuvre.** Automatique avec l'ISBN à 13 chiffres (l'édition de mon exemplaire) ; ou avec le seul titre quand je n'ai pas encore d'édition précise : la fiche commune à toutes les éditions est remplie (synopsis, étiquettes, auteur), sans ISBN ni pagination. La saisie manuelle de l'étape 4 reste disponible comme deuxième option.
- **Étape 6, à constater après la mise en ligne.** La fonction a été testée contre la vraie BnF et le vrai Open Library, mais Google Books et l'API Claude n'ont pu être essayés qu'avec de fausses réponses (aucune clé sur le poste de développement, c'est voulu). Leur premier essai réel se fait sur mes appareils, après la fusion : prévoir un tour de corrections. Constat du 19 novembre 2026 : Open Library a une couverture pour 16 de mes 31 éditions, et pour 3 tomes de manga sur 20 essayés ; la part de Google Books reste à mesurer.
- **Étape 6, corrections de couvertures : à constater sur l'iPhone, après la fusion.** Google Books avec sa clé (effet de `langRestrict` et de `country=CH`, tailles réellement obtenues, autres images grises éventuelles : la clé n'est pas sur le poste de développement, c'est voulu). Le voile de la zone du haut (l'aperçu n'a pas d'encoche). La photothèque et l'appareil photo, le format HEIC, l'orientation des photos, le recadrage au doigt. « Remplacer les couvertures de petite taille » sur la vraie bibliothèque, et les limites de débit d'Open Library.
- **Étape 7b, « Découvrir ailleurs ».** Elle ajoute une action à la fonction « assistant » (même sécurité, même limite d'appels) et réutilise la recherche par titre pour vérifier chaque proposition.
- **Étape 9, mouvements réduits.** Quand l'iPhone demande de réduire les animations, remplacer les mouvements (glissements, agrandissements) par des fondus courts, plutôt que de couper toutes les animations d'un bloc comme aujourd'hui. Relevé par l'audit de l'étape 4.
- **Étape 9, deux détails relevés par l'audit de l'étape 5.** Sur la fiche, VoiceOver annonce le chiffre de la progression à chaque appui sur − ou + : regrouper l'annonce au moment de l'enregistrement (une seconde après le dernier appui). La barre de défilement du carrousel « En ce moment » est visible sur ordinateur (invisible sur iPhone et iPad) : la rendre discrète sans gêner le défilement au clavier.
- **Étape 9, relevés par l'audit de l'étape 6.** Chargement progressif des couvertures de la grille : aujourd'hui, toutes les couvertures de la bibliothèque sont demandées dès l'ouverture de l'écran ; ne charger que celles qui approchent de l'écran. Langue des titres originaux étrangers : la donner à VoiceOver par l'attribut `lang` (d'après la langue d'origine de l'œuvre), sur la fiche, dans les résultats de recherche et dans le formulaire, pour qu'un titre anglais ou allemand ne soit pas lu à la française.
- **Coins au clavier : fait le 20 novembre 2026**, avec le redressement (§8.5). Relevé par l'audit des corrections de couvertures.
- **ISBN et couvertures (20 novembre 2026) : à constater sur l'iPhone, après la fusion.** « Prendre une photo de mon exemplaire » ouvre-t-il directement l'appareil photo ; le format HEIC, l'orientation et le poids des photos (12 à 48 mégapixels) ; le temps de détection et de redressement ; le glisser des coins au doigt, la loupe au-dessus du doigt, la page qui ne doit pas défiler pendant le geste ; la justesse des coins sur mes livres et ma table ; mes couvertures réellement rangées (dont celles de Google Books) dans la case 5:8 ; la saisie à tirets avec le clavier numérique et le collage ; VoiceOver sur un ISBN affiché et sur les coins.
- **Étape 9, relevés par l'audit « ISBN et couvertures ».** Déplacer les coins avec VoiceOver sur iPhone, sans clavier. Mesurer les couvertures au fil du défilement, avec leur chargement progressif. À 393 px, « Reprendre la photo » demande un petit défilement du panneau au premier temps. Dans « Modifier », la croix d'une couverture posée sur l'étagère est au coin de la case, pas de l'image.
- **Étape 10, plages d'ISBN.** Mettre `isbn3` à jour : les plages des éditeurs évoluent, et un ISBN récent hors plages s'affiche sans tirets.
- **Test intermittent, antérieur à ce travail.** « tire la progression d'une série de ses tomes » (`Suivi.test.tsx`) échoue environ une fois sur six quand toute la suite tourne, y compris avant ces changements : à stabiliser.
- **Poids des couvertures trouvées : fait le 20 novembre 2026, sans attendre l'étape 10.** Relevé par l'audit des corrections de couvertures : la fonction garde désormais la plus grande image, et l'image d'origine d'Open Library pèse parfois près de 1 Mo. Toute image est maintenant réduite au moment d'être rangée (§8.5). Rien à reprendre pour les couvertures rangées avant ce changement : elles venaient de la taille « L » d'Open Library, 500 px de haut au plus.
- **Étape 9, relevé par l'audit de la refonte de « Modifier ».** Les titres des sections repliées n'apparaissent pas dans la liste des titres de VoiceOver (rotor) : les y faire figurer sans casser le bouton qui les déplie. À essayer sur l'iPhone : « Prendre une photo » (ouverture directe de l'appareil photo), la barre fixe au-dessus de l'indicateur d'accueil, le message temporaire avec VoiceOver.
- **Étape 10, nettoyage des images qui ne servent plus.** Depuis la refonte de « Modifier » (20 novembre 2026), une image choisie puis abandonnée n'est jamais envoyée : elle n'est rangée qu'avec « Enregistrer ». Restent les couvertures retirées et celles des œuvres supprimées : elles restent dans mon dossier du stockage privé : elle n'est jamais effacée sur le moment, car une même image (nommée d'après son contenu) peut servir à deux œuvres. Prévoir un nettoyage des images qui ne sont plus rattachées à aucune œuvre, édition ni tome.
- **Étape 11, alertes `npm audit`.** Au 18 novembre 2026 : 14 alertes (12 élevées, 2 modérées), toutes dans les outils de développement et de compilation : picomatch, glob et minimatch, par vite-plugin-pwa et workbox-build, mais aussi par Vite et Vitest. `npm audit --omit=dev` n'en trouve aucune : rien ne concerne le code livré dans l'appli. Ces failles (lenteurs provoquées par des motifs de fichiers piégés) ne jouent qu'au moment de compiler, sur les fichiers du dépôt. La correction proposée (`npm audit fix --force`) change vite-plugin-pwa et Vitest de version majeure : à examiner à l'étape 11, sans forcer. (Le tri des dépendances inutilisées, lui, se fait à l'étape 10.)

- **Tomes, sélection : à constater sur l'iPhone.** Premier essai le 20 novembre 2026 : le glissement déclenchait l'appui long au lieu de sélectionner (cause et correction au §6.2). Après la correction, vérifiés dans les tests (séquence d'iOS reproduite) et dans Chromium avec de vrais événements tactiles, mais pas encore sur un écran tactile : le partage entre sélection et défilement ; l'absence du menu « Copier / Chercher » et de la loupe d'iOS ; l'appui long d'une demi-seconde et son annulation au moindre mouvement ; le toucher ailleurs qui vide la sélection (Safari n'envoie un clic que sur un élément qui en écoute : à vérifier sur un endroit vide de la page) ; VoiceOver (« sélectionné » au double toucher, annonce du menu, toucher deux fois et maintenir pour les détails) ; le menu au-dessus de l'indicateur d'accueil.
- **Étape 9, sélection des tomes.** Animer l'apparition et la disparition du menu de sélection (`data-etat` et `hidden`), l'anneau de sélection (`data-etat="selectionne"` sur chaque tome) et le message « Annuler » (`data-etat` du message).
- **Étape 7, deux corrections du 21 novembre 2026.** L'accueil ne défile plus sur le côté sur iPhone (un texte réservé à VoiceOver, dans le carrousel, élargissait la page ; un test le garde) ; le bandeau « Hors connexion » reste collé en haut de l'écran pendant le défilement. Mesurés dans Chromium seulement.
- **Étape 7, à constater sur l'iPhone, après la fusion.** La pertinence des idées sur ma vraie bibliothèque (Découvrir et l'accueil : c'est le seul endroit où mes vrais statuts sont visibles) ; le menu des envies au doigt ; VoiceOver sur les cartes (nom « Voir la fiche de … », puis l'auteur et la phrase ; « Commencer Momo », « Pas maintenant pour Momo ») ; le message « Idée mise de côté · Annuler » à la place de la barre du bas ; le glissement sur le côté de l'accueil et le filet `overflow-x: clip` dans Safari ; le bandeau hors connexion collé en haut. La migration des idées mises de côté n'a été essayée que sur le banc local : l'Action « Migrations » de la pull request est la première vérification sur une vraie base.
- **Étape 9, recommandations.** Animer l'arrivée d'une idée à la place d'une autre (`data-etat="proposee"` sur chaque carte de Découvrir), son passage à la ligne « En cours. » (`data-etat="commencee"`), le message « Idée mise de côté » (`data-etat` du message) et le retour de la barre du bas. Relevés par l'audit de l'étape 7 : la barre du bas disparaît 5 secondes pendant le message (VoiceOver lit le message, la barre revient seule) ; après « D'autres idées », les nouvelles cartes peuvent être au-dessus de l'écran à 393 points (VoiceOver annonce les titres, le focus reste sur le bouton).

Signal pour monter l'effort : un fichier oublié, des tests non lancés, une modification abandonnée en cours de route.

## 12. Hors périmètre de la version 1

- Citation du jour.
- Statistiques de lecture.
- Toute fonction sociale.

### Idées pour plus tard

- **« Trouver une version nette de ma photo »** (noté le 20 novembre 2026) : recherche par image avec l'API Google Cloud Vision (Web Detection, 1 000 requêtes gratuites par mois, compte de facturation requis), en me laissant choisir parmi les images trouvées. À envisager seulement si le redressement des photos déçoit à l'usage. Jamais de récupération automatique des pages de Google Images.
