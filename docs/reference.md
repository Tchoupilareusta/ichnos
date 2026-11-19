# Ichnos — Document de référence

*Version 1 — 17 novembre 2026*
*Mise à jour du 17 novembre 2026 : l'IA comme aide à la suggestion (§2, §7.6, §8.4, §10.2, §11).*
*Mise à jour du 18 novembre 2026 : décisions de l'étape 4, bibliothèque et fiches (§3, §6.2, §10.2, §11) ; points reportés aux étapes 9 et 10 (§11).*
*Mise à jour du 18 novembre 2026 : corrections après essai sur iPhone : cinq statuts, libellés de possession, ordre des filtres, allègement de la bibliothèque et de la fiche, icônes ; ajout d'une œuvre à l'étape 6 (§2, §3, §5, §6, §11).*
*Mise à jour du 19 novembre 2026 : bulles-menus Statut et Possession, grille à colonnes fixes, recherche (§3, §5).*

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
| Légèreté | Une phrase d'explication seulement là où elle sert (hors connexion, états vides, confirmations). Ce que je range (ISBN, traducteur, suppression) passe après ce que je lis. |
| Voix de l'interface | Première personne du propriétaire (« Mon ressenti », « Mon envie du moment »). |
| Appréciation | Quelques mots plutôt que des étoiles (voir §6.4). Facultative. |
| Mangas | Possession et progression suivies tome par tome. La possession de la série se calcule à partir des tomes : « J'en ai une partie » quand je n'ai pas tous les tomes (§6.2). |
| Hors connexion, modifications | Les boutons de modification sont grisés, avec un message calme qui explique pourquoi. |
| Langue de lecture | Français ou anglais. Le catalogue n'ajoute pas d'édition anglaise d'office. Quand j'ajoute un livre par son ISBN, l'édition est celle de mon exemplaire. Pour une œuvre écrite en anglais, « Découvrir ailleurs » indique si la version originale vaut le coup (ex. 1984 et son vocabulaire inventé). Si mon édition est en anglais, le titre original s'affiche en premier. Les fiches (synopsis, étiquettes) restent toujours en français. |
| Anime | Média associé à l'œuvre (saisons, épisodes), jamais compté comme des livres. |
| Hors connexion | Consultation possible. Les modifications demandent une connexion. |
| Couvertures | Recherche automatique, copie dans le stockage Supabase, couverture typographique générée en dernier recours. |
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
| Bordures | `#DDD0C0` | `#3A3734` |
| Barre de progression | `#550000` | `#C46A6A` (sur piste `#3A3734`) |
| Ombres | brun chaud très léger | noir, plus marqué |
| Surlignage des thèmes | `#EBD3CD` | `#4A2524` |

En thème sombre, `#8D3131` sert de couleur de fond (boutons, éléments sélectionnés) : en texte sur fond sombre, il ne serait pas assez lisible.

Tous les couples texte/fond doivent atteindre un contraste WCAG AA.

### 4.3 Formes et mouvement

- Rayons généreux : environ 24 px pour les cartes, boutons en forme de pilule, couvertures arrondies à 12–14 px.
- Ombres très douces et chaudes, jamais grises et dures.
- Animations courtes et amorties (ressorts légers). Respect de `prefers-reduced-motion`.

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
| Accueil | Lectures en cours (carrousel de couvertures cliquables, progression en texte seul, bouton « Où j'en suis » qui ouvre un panneau de mise à jour : page/tome/lettre, « J'ai terminé ce livre », « Le mettre en pause »), une suggestion personnalisée avec sa raison, un lien « Selon mon humeur », dernières lectures terminées. Pas de barre de progression sur l'accueil. |
| Bibliothèque | Grille de couvertures (2 colonnes sur iPhone, 4 sur iPad en portrait, 6 en paysage, quelle que soit la taille du texte), recherche (« Rechercher » ; VoiceOver : « Rechercher un titre ou un auteur »), bulles-menus Statut et Possession, panneau « Filtres » avec les six filtres. |
| Fiche d'une œuvre | Couverture, titres français et original, auteur, thèmes juste sous le titre (Lora italique, surlignage doux sur toute la hauteur du mot, jamais en forme de bouton), statut et possession (pastilles avec icône ; pour une série, la possession résume et mène aux tomes), progression avec barre, synopsis sans spoiler, genre, longueur et atmosphère en une ligne, mon édition en une ligne (traduction et ISBN dans « Détails »), appréciation, notes et citations, média associé en une ligne. La fiche se termine sur l'œuvre, jamais sur la suppression. |
| Découvrir | « Mon envie du moment » : un seul sélecteur avec les six modes, puis trois propositions expliquées, « Pas maintenant » (met l'idée de côté quelques semaines), « D'autres idées ». Un mode séparé, « Découvrir ailleurs », propose des œuvres absentes de la bibliothèque (§7.6). |
| Ajouter / modifier | Saisie manuelle ou recherche par ISBN, couverture automatique, synopsis et étiquettes proposés en suggestion (§8.4), correction de chaque champ. La suppression d'une œuvre se fait au bas de « Modifier », après confirmation. |
| Réglages | Thème, export des données, compte, gestion des genres, thèmes et atmosphères. |

Mise à jour de la progression : depuis l'accueil, le bouton « Où j'en suis » ouvre un panneau (saisie directe du nombre, − / +, Enregistrer) ; sur la fiche, − / + et saisie directe.

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
- `progress_unit` : page, chapitre, tome, lettre, section, pourcentage
- `progress_current`, `progress_total` (facultatifs)
- `appreciation` (facultative, voir §6.4)
- `started_at`, `finished_at` (facultatifs)

**`reading_events`** — historique discret, jamais affiché sous forme de statistiques.
- `entry_id`, `kind` (commencé, progression, mis en pause, repris, terminé), `value`, `occurred_at`
- Permet aussi les relectures.

**`media`** — médias associés.
- `work_id`, `kind` (anime, film…), `title`, `seasons`, `episodes_total`, `episodes_watched`, `status`

**`notes`** — citations et réflexions.
- `work_id`, `kind` (citation, commentaire, réflexion), `body`, `location` (ex. « p. 75 », « lettre 12 »), `created_at`

**`recommendation_log`** — propositions faites.
- `mode`, `work_id`, `reason`, `response` (choisie, ignorée, aucune), `shown_at`

### 6.2 Possession et statut

Ils sont indépendants : un livre peut être « Terminé » et « Non possédé » (emprunté), ou « À découvrir » et « Possédé ».

Possession d'une série (validé le 18 novembre 2026), calculée à partir de ses tomes :
- tous les tomes possédés : « Je l'ai » ; une partie seulement : « J'en ai une partie » ;
- aucun tome possédé : « À acheter » si au moins un tome est à acheter, sinon « Je ne l'ai pas ».
- Dans les filtres, une série apparaît dans « Je l'ai » dès qu'un tome est possédé, et dans « À acheter » dès qu'un tome est à acheter. C'est voulu : on retrouve ainsi les séries où il manque des tomes.
- Sur la fiche : la pastille de possession d'une série résume (« J'en ai une partie ») et mène à « Mes tomes ». La grille change un tome ou une plage (« les tomes 1 à 8 ») ; le menu « Tous les tomes » applique un choix à tous, toujours après une confirmation qui dit combien de tomes vont changer.

### 6.3 Progression et éditions

- La progression s'exprime dans l'unité choisie. Le pourcentage est calculé quand un total est connu.
- La pagination dépend de l'édition. Le total se renseigne pour son propre exemplaire, il n'est jamais deviné.
- Une progression peut rester vide.

### 6.4 Appréciation

Choix facultatif parmi quelques mots :
- « M'a marqué »
- « Beau moment »
- « Pas pour moi, pas maintenant »
- « À relire un jour »

Les deux premiers renforcent les thèmes de l'œuvre dans les recommandations. Le troisième les atténue doucement, sans jamais exclure un auteur ou un genre.

## 7. Recommandations (version 1)

Algorithme déterministe fondé sur les étiquettes, sans IA. Seul le mode séparé « Découvrir ailleurs » (§7.6) fait appel à l'IA.

### 7.1 Candidats

Œuvres « À découvrir » ou « Envie de lire ». « En pause » peut être proposé avec douceur (« le reprendre ? »), jamais avec insistance.

### 7.2 Score

Pour chaque candidat :
- **Affinité** : thèmes en commun avec les centres d'intérêt et avec les œuvres appréciées.
- **Contraste** : écart de tonalité, de genre et d'atmosphère avec les deux ou trois dernières lectures. Après une lecture sombre, les œuvres lumineuses remontent.
- **Envie** : léger bonus pour « Envie de lire ».
- **Disponibilité** : léger bonus si le livre est possédé.
- **Variété** : les trois propositions d'une même demande doivent différer entre elles (genre, tonalité).
- **Hasard doux** : une petite part aléatoire pour éviter la répétition.

Une proposition ignorée n'est pas pénalisée : elle n'est simplement pas reproposée pendant quelque temps.

### 7.3 Modes

| Mode | Filtre principal |
|---|---|
| Surprends-moi | Aucun filtre, variété maximale |
| Quelque chose de réconfortant | Tonalité lumineuse, atmosphère douce ou humaniste |
| Une réflexion philosophique | Existentiel, moral ou introspectif |
| Remets mes idées en question | Dystopie, critique sociale, littérature dérangeante |
| Une lecture courte | Longueur courte, conte, nouvelle |
| Changer d'univers | Écart maximal avec les trois dernières lectures |

### 7.4 Explication

Chaque proposition est accompagnée d'une phrase courte construite à partir des raisons du score. Exemple : « Lumineux, après Crime et Châtiment. Il parle du temps et de l'attention aux autres. »

### 7.5 Alternance indicative

Philosophique → réconfortant → classique existentiel → dystopie → autre chose. Elle oriente le score de contraste, sans jamais devenir une règle.

### 7.6 Découvrir ailleurs

Un mode séparé de « Mon envie du moment », pour trouver des œuvres qui ne sont pas encore dans ma bibliothèque.

- **Ce que l'appli envoie à l'API Claude** (modèle Sonnet 5.5, sortie JSON structurée) : l'envie choisie, mes lectures récentes et appréciées (titres et étiquettes), mes thèmes de cœur (les thèmes marqués centres d'intérêt, §6.1) et les titres déjà présents. Jamais mes notes ni mes citations.
- **Ce que Claude propose** : 3 œuvres absentes de ma bibliothèque, chacune avec une raison et une fiche en français (synopsis sans spoiler, étiquettes du vocabulaire existant, tonalité, exigence, longueur).
- **Version originale** : pour une œuvre écrite en anglais, Claude dit si la lire en version originale vaut le coup, avec une raison courte (style, jeux de langue, vocabulaire inventé), ou rien si la traduction convient aussi bien.
- **Vérification avant affichage** : chaque proposition est vérifiée sur Google Books ou la BnF. L'ISBN, l'éditeur et la couverture viennent toujours de ces sources, jamais de l'IA. Une proposition introuvable dans ces sources n'est pas affichée.
- **« Ajouter à ma liste »** enregistre l'œuvre en « À découvrir », déjà étiquetée. Rien n'est enregistré sans ce geste.
- Si l'IA est indisponible ou si la limite de dépense est atteinte, ce mode l'indique simplement ; tout le reste de l'appli fonctionne.

## 8. Couvertures et métadonnées

### 8.1 Recherche automatique

Une fonction serveur (Supabase Edge Function) cherche dans cet ordre :
1. Google Books, par ISBN puis par titre et auteur.
2. Open Library, par ISBN.
3. Pour les mangas, une base spécialisée (couverture par tome quand elle existe, parfois dans l'édition japonaise).

L'image trouvée est copiée dans un bucket privé de Supabase Storage, servie par URL signée et mise en cache pour la consultation hors ligne.

La même recherche préremplit titre, auteur, éditeur et nombre de pages lors de l'ajout par ISBN. Chaque champ reste modifiable.

### 8.2 Dernier recours

Une couverture typographique générée (titre et auteur sur fond de couleur douce, choisie parmi une petite palette chaude). Jamais de case vide.

### 8.3 Droits

Les couvertures ne sont jamais enregistrées dans le dépôt GitHub public.

### 8.4 Fiche automatique

À l'ajout d'un livre, les métadonnées publiques sont d'abord récupérées (§8.1). L'API Claude propose ensuite un synopsis et des étiquettes, en suggestion modifiable : rien n'est enregistré tant que la fiche n'est pas validée. Sans l'IA, l'ajout fonctionne de la même façon, avec ces champs à remplir à la main. La fiche est toujours en français, même pour une édition en anglais.

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
- Routage par hash (`#/…`), fiable sur GitHub Pages et invisible dans l'application installée.
- Tests : Vitest, en priorité sur l'algorithme de recommandation et la progression.
- Migrations de base de données versionnées dans `supabase/migrations`.

### 10.2 Sécurité

- Connexion par e-mail et mot de passe. Le compte est créé à la main dans Supabase, avec un mot de passe long généré par le gestionnaire de mots de passe ; les inscriptions publiques sont désactivées.
- L'application ne crée jamais de compte et n'envoie aucun e-mail : ni inscription, ni « mot de passe oublié ». Un mot de passe perdu se réinitialise depuis le tableau de bord Supabase.
- Formulaire de connexion : un vrai élément `form`, champs `autocomplete="email"` et `autocomplete="current-password"`, pour le remplissage automatique de Bitwarden sur iPhone. Le message d'erreur ne dit jamais si c'est l'adresse ou le mot de passe qui est faux.
- Session longue : gardée sur l'appareil et renouvelée automatiquement, jusqu'à la déconnexion depuis les Réglages.
- RLS activé sur toutes les tables, avec politiques en lecture et en écriture.
- Deux fonctions de la base sont appelables par le compte connecté, et par lui seul : `importer_catalogue` (§9) et `enregistrer_oeuvre` (ajout et modification d'une œuvre avec ses auteurs, étiquettes, éditions, tomes et médias, en tout ou rien ; elle ne touche ni au statut, ni à la possession, ni à la progression, ni aux notes). Elles s'exécutent avec les droits de l'appelant, donc sous RLS. Toute nouvelle fonction ouverte doit être ajoutée aux tests de sécurité.
- Seule la clé publique Supabase dans le frontend. Toutes les autres clés dans les secrets GitHub ou les secrets Supabase.
- API Claude (§7.6, §8.4) :
  - une seule Edge Function porte tous les appels à l'API Claude ;
  - elle n'est appelable que par le compte connecté ;
  - la clé API est dans les secrets Supabase, jamais dans le frontend ni dans le dépôt ;
  - ses journaux ne contiennent aucun contenu personnel ;
  - une limite de dépense est fixée dans la console Anthropic.
- Politiques de stockage restreintes à l'utilisateur.
- Les journaux des GitHub Actions d'un dépôt public sont publics : aucune donnée ni clé ne doit y être affichée.

### 10.3 Sauvegarde et veille

- Export JSON complet depuis les réglages.
- Une GitHub Action planifiée tous les trois jours :
  - interroge la base pour éviter la mise en veille de l'offre gratuite ;
  - une fois par semaine, exporte les données vers un dépôt GitHub privé.

### 10.4 Déploiement

- GitHub Actions construit et publie sur GitHub Pages à chaque fusion dans `main`.
- Une autre Action applique les migrations Supabase.

## 11. Plan de développement

Objectif : une application complète et en ligne avant le départ, sans sacrifier la qualité. Chaque étape se termine par une version utilisable.

| # | Étape | Modèle et effort |
|---|---|---|
| 0 | Préparation : Node.js, Claude Code, comptes, dépôt GitHub, projet Supabase, secrets | — |
| 1 | Squelette : React, TypeScript, Vite, Tailwind, thème clair/sombre, navigation, déploiement GitHub Pages, base PWA | Opus 5.5, moyen |
| 2 | Base de données et sécurité : schéma, RLS, stockage, connexion par e-mail et mot de passe, Action de migrations | Fable 5.2, élevé |
| 3 | Catalogue initial : vérification, étiquettes, synopsis, import | Fable 5.2, élevé |
| 4 | Bibliothèque et fiches : grille, recherche, filtres, ajout, modification, statuts, possession | Opus 5.5, moyen |
| 5 | Suivi de lecture : unités, tomes, média associé, mise à jour rapide | Opus 5.5, élevé |
| 6 | Couvertures, métadonnées automatiques et fiche automatique (§8.4) | Fable 5.2, élevé |
| 7 | Recommandations : algorithme, tests, écran Découvrir, suggestion d'accueil | Fable 5.2, élevé |
| 7b | « Découvrir ailleurs » (§7.6) : Edge Function, vérification des propositions, écran | Fable 5.2, élevé |
| 8 | Accueil final, notes, export, sauvegarde et veille | Opus 5.5, moyen |
| 9 | Finitions : animations, PWA complète, hors ligne (dont le cache qui survit à la fermeture de l'appli, reporté de l'étape 4 : jusque-là, on consulte hors connexion ce qui a déjà été chargé), accessibilité, mouvements réduits (voir plus bas), audit design (Impeccable) | Opus 5.5, moyen |
| 10 | Revue de sécurité finale, dont les alertes `npm audit` (voir plus bas) | Fable 5.2, élevé |

Points reportés :

- **Étape 5, accueil.** Les lectures « En cours » apparaissent sur l'accueil, chacune avec le bouton « Où j'en suis » (§5).
- **Étape 6, deux manières d'ajouter une œuvre.** Automatique avec l'ISBN à 13 chiffres (l'édition de mon exemplaire) ; ou avec le seul titre quand je n'ai pas encore d'édition précise : la fiche commune à toutes les éditions est remplie (synopsis, étiquettes, auteur), sans ISBN ni pagination. La saisie manuelle de l'étape 4 reste disponible comme deuxième option.
- **Étape 9, mouvements réduits.** Quand l'iPhone demande de réduire les animations, remplacer les mouvements (glissements, agrandissements) par des fondus courts, plutôt que de couper toutes les animations d'un bloc comme aujourd'hui. Relevé par l'audit de l'étape 4.
- **Étape 10, alertes `npm audit`.** Au 18 novembre 2026 : 14 alertes (12 élevées, 2 modérées), toutes dans les outils de développement et de compilation : picomatch, glob et minimatch, par vite-plugin-pwa et workbox-build, mais aussi par Vite et Vitest. `npm audit --omit=dev` n'en trouve aucune : rien ne concerne le code livré dans l'appli. Ces failles (lenteurs provoquées par des motifs de fichiers piégés) ne jouent qu'au moment de compiler, sur les fichiers du dépôt. La correction proposée (`npm audit fix --force`) change vite-plugin-pwa et Vitest de version majeure : à examiner à l'étape 10, sans forcer.

Signal pour monter l'effort : un fichier oublié, des tests non lancés, une modification abandonnée en cours de route.

## 12. Hors périmètre de la version 1

- Citation du jour.
- Statistiques de lecture.
- Toute fonction sociale.
