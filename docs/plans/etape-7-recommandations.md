# Plan — Étape 7 : recommandations

*Rédigé le 21 novembre 2026. **Validé le 21 novembre 2026**, avec les douze recommandations du §7 et les précisions du §7 bis. Branche : `etape-7-recommandations`.*

Ce plan couvre `docs/reference.md` §7.1 à §7.5 : l'algorithme, l'écran Découvrir avec « Mon envie du moment », et la suggestion de l'accueil. « Découvrir ailleurs » (§7.6) n'en fait pas partie : c'est l'étape 7b.

Pour préparer ce plan, la formule a été essayée sur les 35 œuvres du catalogue (`catalogue/catalogue-initial.json`) avec un petit script jetable, hors du dépôt. Les chiffres et les phrases cités plus bas en sortent : ils ne sont pas imaginés. Mes vrais statuts de lecture, eux, sont privés et n'ont pas été lus : les situations (« je viens de terminer Crime et Châtiment ») sont des hypothèses.

---

## 0. En bref

- Un algorithme simple, sans IA, écrit comme un calcul pur : on lui donne ma bibliothèque, l'envie choisie, la date et une « graine » de hasard ; il rend au plus trois propositions, chacune avec sa phrase. Mêmes entrées, mêmes sorties : il se teste entièrement.
- Rien n'est mesuré, compté ni affiché en chiffres. Aucun score n'apparaît à l'écran.
- « Pas maintenant » met une idée de côté pendant 3 semaines. C'est la seule chose que l'étape écrit dans la base, avec « Commencer » (qui passe par la fonction de statut existante).
- Un seul changement de base : deux petites fonctions pour mettre une idée de côté et la reprendre. La table existe déjà depuis l'étape 2.
- Aucune dépendance ajoutée.

---

## 1. L'algorithme

### 1.1 Où il vit

Un nouveau dossier `src/recommandations/`, sans rien d'écran ni de base dedans :

- `modes.ts` : les six envies, leur filtre et leurs poids ;
- `score.ts` : les composantes du score ;
- `proposer.ts` : le choix des trois propositions (variété, hasard, mises de côté) ;
- `phrase.ts` : la phrase d'explication ;
- `hasard.ts` : un hasard qu'on peut fixer.

L'appli lui fournit ce qu'il lui faut par une nouvelle lecture de la base, `lireIdees` : pour chaque œuvre, sa tonalité, sa difficulté, sa longueur, son type, ses étiquettes (avec les thèmes de cœur), mon statut, ma possession, mon ressenti, mes dates ; plus les idées mises de côté. Une seule demande, gardée en cache comme le reste (consultable hors connexion une fois chargée).

### 1.2 Candidats (§7.1)

- Les œuvres « À découvrir » et « Envie de lire ».
- Les œuvres « En pause », avec douceur (règles au §1.8).
- Jamais « En cours » ni « Terminé ». Jamais une idée mise de côté depuis moins de 3 semaines.

### 1.3 Mes dernières lectures

Elles servent au contraste et à la phrase (« après Crime et Châtiment »). Ce sont, au plus, les trois plus récentes parmi :

- mes lectures « En cours » (date : la dernière fois que j'y ai touché) ;
- mes lectures « Terminé » dont la date de fin est connue et a moins de six mois.

La plus récente compte pleinement, la deuxième à 60 %, la troisième à 30 %. Un livre marqué « Terminé » sans date (lu autrefois) ne compte pas comme lecture récente, mais son ressenti compte pour l'affinité. Sans aucune lecture récente, le contraste est neutre pour tout le monde et la phrase n'y fait pas allusion.

### 1.4 Les composantes du score (§7.2)

Chaque composante vaut entre 0 et 1.

| Composante | Ce qu'elle mesure | Calcul |
|---|---|---|
| **Affinité** | Ce livre parle-t-il de ce qui compte pour moi ? | 60 % : la part de ses thèmes qui sont des thèmes de cœur. 40 % : ses thèmes en commun avec les œuvres dont le ressenti est « M'a marqué » ou « Beau moment ». « Pas pour moi, pas maintenant » retire un peu (20 % au plus), sans jamais écarter un auteur ou un genre. |
| **Contraste** | Change-t-il de mes dernières lectures ? | Pour chaque lecture récente : 50 % l'écart de tonalité (de 1 sombre à 5 lumineux), 25 % les genres différents, 25 % les atmosphères différentes. Plus le petit coup de pouce de l'alternance (§1.5). |
| **Accord avec l'envie** | Dans une envie à filtre, à quel point le livre y correspond | Propre à chaque envie (§2). Exemple : pour « réconfortant », une tonalité 5 compte plus qu'une tonalité 4. |
| **Envie** | Il est dans « Envie de lire » | 1 ou 0. |
| **Disponibilité** | Je l'ai | 1 si je l'ai ; pour une série, 1 dès que j'en ai une partie ; sinon 0. |
| **Hasard doux** | Éviter de revoir toujours les mêmes | Un nombre tiré de la graine et de l'œuvre (§1.7). |

Les poids, selon l'envie :

| | Surprends-moi | Envies à filtre (réconfortant, philosophique, remise en question, lecture courte) | Changer d'univers |
|---|---|---|---|
| Accord avec l'envie | — | 25 % | — |
| Affinité | 30 % | 25 % | 15 % |
| Contraste | 25 % | 20 % | 60 % |
| Envie | 10 % | 10 % | 10 % |
| Disponibilité | 5 % | 5 % | 5 % |
| Hasard doux | 30 % | 15 % | 10 % |

Pourquoi l'affinité est calculée en « part des thèmes » : au premier essai, elle comptait le nombre de thèmes de cœur, et comme 15 de mes 54 thèmes sont des thèmes de cœur, la moitié du catalogue obtenait la note maximale. Les trois mêmes livres (Siddhartha, Jonathan Livingston le goéland, Un psaume pour les recyclés sauvages) sortaient alors dans presque toutes les envies. Avec la part des thèmes, les notes s'étalent.

**Vérifié sur le catalogue, avec le code final** (300 graines, « Surprends-moi ») : sans lecture récente, 1,70 proposition lumineuse sur trois en moyenne ; après Crime et Châtiment, 1,96, et la première des trois est lumineuse 299 fois sur 300 (260 fois sans lecture récente). Le contraste de chaque œuvre de tonalité 4 ou 5 passe au-dessus du neutre, celui de chaque œuvre de tonalité 1 ou 2 reste au neutre ou en dessous. Les lumineuses remontent, sans chasser tout le reste : la variété garde une place à un autre ton, et le hasard doux (30 % dans cette envie) garde sa part. (Les chiffres du prototype, 1,34 et 1,62, et « 300 sur 300 », ont changé avec le classement des familles du §1.5.)

### 1.5 Alternance indicative (§7.5)

Cinq familles, dans l'ordre du cahier des charges : philosophique ou introspectif → lumineux ou réconfortant → classique existentiel → dystopie ou réflexion sociale → autre chose (fiction, manga, découverte).

Chaque œuvre tombe dans une famille d'après ses étiquettes, le genre d'abord : dystopie ou critique sociale, puis littérature existentielle, puis roman philosophique ou philosophie, puis lumineux et doux, sinon « autre chose ». (Siddhartha est donc « philosophique » avant d'être « réconfortant ».) Les œuvres de la famille qui *suit* celle de ma dernière lecture reçoivent un petit supplément de contraste (+0,15). C'est tout : une œuvre d'une autre famille peut très bien passer devant. Ce n'est jamais un filtre, jamais un ordre, et rien ne le montre à l'écran.

### 1.6 Variété : trois propositions qui diffèrent

Les trois propositions ne sont pas « les trois meilleures notes ». Elles sont choisies une à une : après la première, chaque candidate perd des points si elle ressemble à une proposition déjà retenue (mêmes genres, tonalité proche, même famille). Deux règles fermes en plus :

- jamais deux œuvres du même auteur ;
- jamais deux œuvres ayant exactement les mêmes genres et la même tonalité.

En « Surprends-moi » et « Changer d'univers », la ressemblance coûte plus cher : la variété y est maximale.

Vérifié : sur 1 800 tirages (6 envies × 300 graines), jamais deux fois le même auteur.

### 1.7 Hasard doux, qu'on peut fixer

- Le hasard vient d'une **graine** (un texte) : même graine, même résultat. Aucun `Math.random`.
- Dans l'appli, la graine est la date du jour et l'envie. Mes trois idées restent donc les mêmes toute la journée si je reviens sur l'écran, et changent le lendemain. C'est plus calme qu'un tirage neuf à chaque ouverture.
- Dans les tests, la graine est écrite en dur.
- « D'autres idées » ne retire rien : il montre les trois suivantes, en écartant celles déjà vues depuis l'ouverture de l'écran. Quand tout a été vu : « Toutes les idées pour cette envie ont été vues. » avec « Revoir depuis le début ».

### 1.8 Un livre « En pause »

- Au plus un par groupe de trois, jamais en première position, et sa note est légèrement réduite (× 0,8) : il n'insiste pas.
- Sa phrase commence par « En pause pour l'instant. Le reprendre ? » : une question, pas un rappel.
- Jamais sur l'accueil (question 9).
- « Pas maintenant » le met de côté comme les autres.

### 1.9 « Une proposition ignorée n'est pas reproposée pendant quelque temps »

- **Ce qui compte comme ignorée** : seulement « Pas maintenant ». Voir trois idées et demander « D'autres idées » n'ignore rien.
- **Combien de temps** : 3 semaines (21 jours). La maquette dit « quelques semaines ».
- **Où c'est rangé** : dans la table `recommendation_log`, créée à l'étape 2 pour cela (§6.1 de la référence). Une ligne : l'œuvre, l'envie, la date. Au plus une ligne par œuvre : une nouvelle mise de côté remplace l'ancienne. Ce n'est donc pas un historique, et rien n'en est affiché.
- **Pas de pénalité** : passé les 3 semaines, l'œuvre revient avec exactement la même note qu'avant. La mise de côté vaut pour toutes les envies et pour l'accueil.
- La durée est appliquée par l'appli à partir de la date rangée, avec une horloge qu'on peut fixer dans les tests.

---

## 2. Les six envies (§7.3)

Les filtres s'appuient sur les étiquettes de mon vocabulaire. Nombre de candidats si tout le catalogue était « À découvrir » :

| Envie | Filtre | Candidats |
|---|---|---|
| **Surprends-moi** | Aucun. Variété maximale, davantage de hasard. | 35 |
| **Quelque chose de réconfortant** | Tonalité 4 ou 5, **et** atmosphère Douce, Chaleureuse ou Sereine, ou genre Récit humaniste. | 15 |
| **Une réflexion philosophique** | Genre Roman philosophique, Littérature existentielle, Philosophie ou Spiritualité, **ou** atmosphère Introspective. | 19 |
| **Remets mes idées en question** | Genre Dystopie ou Critique sociale, **ou** atmosphère Dérangeante. | 10 |
| **Une lecture courte** | Longueur courte, ou conte, nouvelle, roman court. Jamais une série. | 9 |
| **Changer d'univers** | Aucun filtre d'étiquette, mais seulement les œuvres dont le contraste avec mes trois dernières lectures atteint la moitié de l'échelle. | selon mes lectures |

### Quand une envie n'a pas assez de candidats

Règle : **on ne complète jamais avec une œuvre hors sujet.** Le filtre de l'envie s'applique d'abord ; ce qui reste est ce qui est proposé.

| Situation | Ce que l'écran montre |
|---|---|
| 2 idées | Les deux, puis : « Deux idées seulement pour cette envie, pour l'instant. » |
| 1 idée | Elle seule, puis : « Une seule idée pour cette envie, pour l'instant. » |
| Aucune, parce que tout est lu, en cours ou de côté | « Aucune idée pour cette envie pour l'instant. » Le sélecteur reste juste au-dessus pour en choisir une autre. Pas de bouton « D'autres idées ». |
| « Changer d'univers » sans lecture récente | « Cette envie part de mes dernières lectures : rien de récent pour l'instant. » |
| Aucune œuvre à découvrir dans toute la bibliothèque | « Tout ce qui est dans ma bibliothèque est lu ou en cours. » et un lien « Ajouter une œuvre ». |
| Bibliothèque vide | La phrase actuelle de l'écran, inchangée. |

Aucune de ces phrases ne compte, ne félicite ni ne presse.

Limite connue : mon vocabulaire est modifiable. Si je renomme « Dystopie », l'envie « Remets mes idées en question » ne la reconnaît plus (question 8).

---

## 3. La phrase d'explication (§7.4)

### 3.1 Comment elle est construite

Deux morceaux courts au plus, pris dans les raisons réelles du score de cette œuvre, dans cet ordre :

1. **Ce qui la distingue maintenant** : le contraste avec ma dernière lecture, ou ce qui la fait entrer dans l'envie choisie.
2. **Ce qui me la rapproche** : mes thèmes de cœur, ou une œuvre que j'ai aimée.

| Raison | Morceau |
|---|---|
| Tonalité plus haute d'au moins 2 crans que ma dernière lecture | « Lumineux, après *Titre*. » (tonalité 5) ou « Plus lumineux, après *Titre*. » |
| Tonalité plus basse d'au moins 2 crans | « Plus grave, après *Titre*. » |
| Aucun genre en commun avec ma dernière lecture | « Un autre registre, après *Titre* : *genre*. » |
| Envie « réconfortant » | « Atmosphère douce et chaleureuse. » |
| Envies « philosophique » et « remise en question » | « Dystopie, atmosphère dérangeante et ironique. » |
| Envie « lecture courte » | « Court : un conte. » |
| Thèmes de cœur | « Parmi mes thèmes de cœur : liberté et compassion. » |
| Deux thèmes en commun avec une œuvre aimée | « Des thèmes proches de *Titre* : amitié et enfance. » |
| Rien de tout cela | « Au cœur du livre : pouvoir et propagande. » |
| « Envie de lire », si la place reste | « Déjà dans mes envies de lire. » |
| Je l'ai, si la place reste | « Je l'ai déjà. » |
| En pause | « En pause pour l'instant. Le reprendre ? » |

Précautions :

- Dans un même groupe de trois, la formule « Parmi mes thèmes de cœur » ne sert qu'une fois ; les autres disent « Au cœur du livre ».
- Les tournures évitent les pièges de grammaire. « après *Titre* » ne se contracte jamais (pas de « du », « des »). Les thèmes viennent après deux-points, sans article : cela marche pour « rapport au temps » comme pour « comprendre l'autre ». Les atmosphères sont au féminin dans mon vocabulaire et s'accordent avec « atmosphère ».
- Les noms d'étiquettes perdent leur majuscule initiale dans la phrase. Limite : un thème que j'ajouterais avec un nom propre (« Japon ») s'écrirait « japon ».
- La phrase ne contient jamais de chiffre, de note ni de pourcentage.

### 3.2 La voix (§3)

- Première personne pour ce qui m'appartient : « mes thèmes de cœur », « mes envies de lire », « Je l'ai déjà ».
- Tournure neutre pour décrire le livre : « Lumineux, après… », « Court : un conte. », « Au cœur du livre : … ».
- La question que l'appli me pose est à l'infinitif : « Le reprendre ? ».
- Jamais de « tu », de « vous », ni d'impératif (« lis », « découvre »).

### 3.3 Exemples produits par le code final, sur mon catalogue

Ces exemples sont figés dans `src/recommandations/phrase.test.ts` (graine du 21 novembre 2026). Ils remplacent ceux du prototype : les deux retouches demandées sont faites (« Court. » seul pour un roman court ; une formule répétée n'est gardée que sur la première carte), et les thèmes sont cités dans l'ordre où la base les rend (alphabétique).

Si je viens de terminer **Crime et Châtiment**, envie « Quelque chose de réconfortant » :

- *La Maison au milieu de la mer céruléenne* — « Lumineux, après Crime et Châtiment. Atmosphère chaleureuse et douce. »
- *Jonathan Livingston le goéland* — « Atmosphère sereine et poétique. Parmi mes thèmes de cœur : compassion et liberté. »
- *Un psaume pour les recyclés sauvages* — « Récit humaniste, atmosphère chaleureuse et contemplative. Au cœur du livre : acceptation de soi et beauté des choses simples. »

Même situation, « Surprends-moi » :

- *Un psaume pour les recyclés sauvages* — « Lumineux, après Crime et Châtiment. Parmi mes thèmes de cœur : acceptation de soi et beauté des choses simples. »
- *Découvrir un sens à sa vie* — « Témoignage, atmosphère âpre et introspective. Au cœur du livre : dignité et liberté. »
- *1984* — « Dystopie, atmosphère dérangeante et oppressante. Au cœur du livre : liberté et propagande. »

Même situation, « Une lecture courte » :

- *Un psaume pour les recyclés sauvages* — « Lumineux, après Crime et Châtiment. Court. »
- *Le Petit Prince* — « Court : un conte. Parmi mes thèmes de cœur : beauté des choses simples et relations humaines. »
- *Jonathan Livingston le goéland* — « Spiritualité, atmosphère poétique et sereine. Au cœur du livre : compassion et courage. »

Premier jour, rien de lu, « Une réflexion philosophique » :

- *La Bibliothèque de minuit* — « Roman philosophique, atmosphère introspective et douce. Parmi mes thèmes de cœur : acceptation de soi et quête de sens. »
- *La Chute* — « Littérature existentielle, atmosphère introspective et dérangeante. Au cœur du livre : conscience morale et culpabilité. »
- *Découvrir un sens à sa vie* — « Philosophie, atmosphère introspective et âpre. Au cœur du livre : dignité et liberté. »

Après **Momo** et **Le Petit Prince**, « Remets mes idées en question » :

- *La Ferme des animaux* — « Plus grave, après Momo. Critique sociale, atmosphère dérangeante et ironique. »
- *Le Meilleur des mondes* — « Dystopie, atmosphère dérangeante et ironique. Parmi mes thèmes de cœur : liberté ; technologie et attention. »
- *La Métamorphose* — « Atmosphère dérangeante et oppressante. Au cœur du livre : aliénation et différence. »

**Vinland Saga** en cours et **1984** terminé, « Changer d'univers » :

- *Siddhartha* — « Un autre registre, après Vinland Saga : roman philosophique. Parmi mes thèmes de cœur : paix intérieure et quête de sens. »
- *La Maison au milieu de la mer céruléenne* — « Fantasy et merveilleux, atmosphère chaleureuse et douce. Au cœur du livre : acceptation de soi et compassion. »
- *Le Désert des Tartares* — « Littérature existentielle, atmosphère contemplative et mélancolique. Au cœur du livre : attente et quête de sens. »

Un livre en pause (Lettres à Lucilius, « Une réflexion philosophique ») : « En pause pour l'instant. Le reprendre ? Philosophie, atmosphère introspective et sereine. »

---

## 4. Les écrans

Références : les maquettes validées Découvrir et Accueil. Pour l'interface : la skill Impeccable, et `/impeccable audit` à la fin. Aucune couleur nouvelle ; composants prêts à être animés à l'étape 9 (états portés par `data-etat`).

### 4.1 Découvrir

De haut en bas :

1. Le titre « Découvrir ».
2. **« Mon envie du moment »** : un seul sélecteur, une bulle qui ouvre le menu des six envies (le même composant que les bulles Statut et Possession de la bibliothèque). À la première ouverture : « Surprends-moi ». L'envie choisie est portée par l'adresse (`#/decouvrir?envie=reconfortant`) : rien n'est rangé sur l'appareil, et le retour arrière fonctionne.
3. **Trois propositions**, chacune dans une carte :
   - la couverture, le titre, l'auteur et la phrase. Cette partie de la carte est un lien vers la fiche (VoiceOver : « Voir la fiche de Momo ») ;
   - dessous, deux boutons : **« Commencer »** (ou « Reprendre » pour un livre en pause) et **« Pas maintenant »** (VoiceOver : « Commencer Momo », « Pas maintenant pour Momo »).
4. **« D'autres idées »**.
5. Une ligne discrète, comme sur la maquette : « « Pas maintenant » met l'idée de côté quelques semaines. Rien d'autre ne change. »

Ce que je peux faire d'une proposition :

- **Ouvrir la fiche** : toucher la carte.
- **La mettre « En cours »** : « Commencer » demande une confirmation courte (« Commencer Momo ? » — « Oui, commencer » / « Pas tout de suite »), puis utilise la fonction de statut qui existe déjà. La carte laisse alors place à une ligne calme : « En cours. » avec un lien vers la fiche. Le livre apparaît sur l'accueil (question 5).
- **La mettre de côté** : « Pas maintenant ». La carte est remplacée par l'idée suivante, et le message temporaire de l'appli s'affiche 5 secondes : « Idée mise de côté · Annuler ». « Annuler » la remet exactement à sa place.
- **En demander d'autres** : « D'autres idées » (§1.7).

Hors connexion : les propositions s'affichent (elles sont calculées sur l'appareil à partir de ce qui est déjà chargé) ; « Commencer » et « Pas maintenant » sont grisés, avec « Hors connexion : ces choix reviendront avec le réseau. » « D'autres idées » fonctionne.

iPad : les trois cartes côte à côte ; lignes de 65 caractères au plus.

Pas de place réservée à « Découvrir ailleurs » : il arrivera à l'étape 7b.

### 4.2 Accueil

Sous « En ce moment », une section **« Une idée pour la suite »** (maquette) :

- une seule proposition : couverture, titre, auteur, phrase ;
- « Voir la fiche » et « Une autre idée » ;
- puis le lien « Selon mon humeur », déjà là, qui mène à Découvrir.

Elle utilise le score général (celui de « Surprends-moi »), graine du jour. « Une autre idée » montre la suivante sans rien écrire. Pas de « Pas maintenant » ni de « Commencer » ici : l'accueil reste léger.

S'il n'y a aucune idée à proposer, la section n'apparaît pas : pas de case vide.

### 4.3 Ce qui n'apparaît nulle part

Aucun score, aucun classement, aucun « x idées restantes », aucun rappel d'un livre mis de côté ou en pause, aucune notification, aucun objectif.

---

## 5. Base de données

### 5.1 Ce qui existe déjà

La table `recommendation_log` (étape 2) : `user_id`, RLS activée, quatre politiques, droits au seul rôle `authenticated`, déjà couverte par les tests de sécurité. Elle n'est pas modifiée. Ses colonnes `reason` et `response` (« choisie », « aucune ») restent inutilisées : l'appli n'écrit que des mises de côté (question 3).

### 5.2 Une migration : deux fonctions

`supabase/migrations/20261121100000_idees_de_cote.sql`

- **`mettre_idee_de_cote(oeuvre, envie)`** : vérifie que l'œuvre est à moi et que l'envie est l'une des six ; supprime l'éventuelle mise de côté précédente de cette œuvre ; ajoute la nouvelle, datée par la base (pas par l'horloge du téléphone). Deux écritures, en tout ou rien.
- **`reprendre_idee(oeuvre)`** : retire la mise de côté de cette œuvre. Sert à « Annuler ».

Règles habituelles, pour les deux :

- `security invoker` : elles s'exécutent avec mes droits, donc sous la RLS ;
- elles vérifient en plus elles-mêmes que l'œuvre est à moi (code `EO002` sinon) ;
- `set search_path = ''` ;
- droits retirés nommément à `public`, `anon`, `authenticated` et `service_role`, puis exécution accordée à `authenticated` seul ;
- tout champ ou valeur inconnue fait tout refuser (`EO001`) ;
- elles ne touchent à rien d'autre : ni statut, ni possession, ni progression, ni historique, ni notes.

Pourquoi des fonctions plutôt qu'une écriture directe dans la table (que la RLS autoriserait déjà) : pour garantir « une seule ligne par œuvre » d'un seul geste, pour que la date soit celle de la base, et pour rester sur le modèle des huit fonctions existantes, tests compris.

« Commencer » n'a besoin de rien de nouveau : c'est `changer_statut`.

La référence passera de huit à dix fonctions appelables (§10.2).

### 5.3 Tests de la base, avec contre-épreuve

`supabase/tests/11_idees_de_cote_test.sql` :

- droits : appelables par le compte connecté ; fermées à `anon`, `service_role` et `public` ; `security invoker` ;
- une mise de côté s'écrit ; une seconde sur la même œuvre la remplace (une seule ligne) ; « reprendre » la retire ; reprendre une idée qui n'est pas de côté ne casse rien ;
- refus : envie inconnue, œuvre inexistante, œuvre d'un autre compte ; sans connexion ;
- un second compte ne voit ni ne touche mes mises de côté ;
- RLS coupée un instant : le contrôle d'appartenance de la fonction tient seul ;
- rien d'autre ne bouge (statut, historique, notes).

Les deux fonctions sont ajoutées à la liste de `01_securite_test.sql`.

**Contre-épreuve**, sur une copie de la migration, une faute à la fois : retirer le `revoke`, passer en `security definer`, retirer le contrôle d'appartenance. Les tests doivent échouer les trois fois. Lancés en local avec le banc PGlite, puis par l'Action « Migrations » sur la vraie base jetable.

---

## 6. Tests

### 6.1 L'algorithme, sur mon vrai catalogue

Les tests chargent `catalogue/catalogue-initial.json` (mes 35 œuvres et leurs étiquettes, déjà publiques). Les situations de lecture sont écrites dans chaque test ; mes vrais statuts restent hors du dépôt.

- **Après une lecture sombre, les lumineuses remontent.** Crime et Châtiment terminé hier : le contraste de chaque œuvre de tonalité 4 ou 5 dépasse le neutre, celui de chaque œuvre de tonalité 1 ou 2 ne le dépasse pas ; sur 300 graines, la première proposition de « Surprends-moi » est lumineuse plus de neuf fois sur dix (et plus souvent qu'avant), et il y a plus de lumineuses qu'avant parmi les trois.
- **Les trois propositions diffèrent.** Pour les six envies et 300 graines : jamais deux fois le même auteur, jamais mêmes genres et même tonalité, jamais deux fois la même œuvre.
- **Une envie vide.** Tout ce qui est court est terminé : « Une lecture courte » rend zéro proposition et la bonne phrase. Avec deux courtes restantes : deux propositions exactement, et aucune troisième « pour remplir ».
- **Jamais hors sujet.** Pour chaque envie à filtre et 300 graines, chaque proposition passe le filtre de l'envie.
- **Un livre « En pause », avec douceur.** Lettres à Lucilius en pause : au plus un livre en pause par groupe, jamais premier, phrase « En pause pour l'instant. Le reprendre ? » ; jamais dans la suggestion de l'accueil.
- **Mise de côté.** Écartée au jour 0 : absente aux jours 1 et 20, de retour au jour 21, avec la même note qu'avant.
- **Candidats.** Jamais une œuvre « En cours » ou « Terminé ».
- **Hasard fixé.** Même graine, même résultat, deux fois de suite ; graines différentes, résultats qui varient ; « D'autres idées » ne redonne pas une œuvre déjà vue.
- **« Changer d'univers »** sans lecture récente : rien, et la phrase prévue.
- **Affinité.** « M'a marqué » sur Momo fait monter les œuvres qui partagent ses thèmes ; « Pas pour moi, pas maintenant » les fait baisser un peu, sans jamais en retirer une des candidats.
- **Vocabulaire.** Chaque étiquette citée par une envie existe dans le catalogue.

### 6.2 La phrase

- Deux morceaux au plus ; jamais vide ; jamais de chiffre.
- Jamais « tu », « vous », ni impératif.
- Les exemples du §3.3 sont figés dans un test.
- Aucune phrase ne cite une lecture qui n'est pas dans mes dernières lectures.

### 6.3 Les écrans et le dépôt

- Découvrir : le sélecteur et ses six envies ; trois cartes, chacune un lien nommé ; « Pas maintenant » écrit, remplace la carte, « Annuler » la remet ; « Commencer » confirme puis change le statut ; « D'autres idées » ; tous les états du §2 ; hors connexion.
- Accueil : la suggestion, « Une autre idée », son absence quand il n'y a rien.
- Dépôt Supabase : la lecture `lireIdees` et les deux appels.
- Le test du débordement de l'accueil (commit précédent) continue de passer avec la nouvelle section.

Aucun test ne doit dépasser 1 seconde en local (le serveur de GitHub est 2,5 fois plus lent).

---

## 7. Questions, avec ma recommandation

1. **Durée de la mise de côté.** → **3 semaines.** La maquette dit « quelques semaines » ; avec 35 œuvres, plus long viderait vite les petites envies (9 lectures courtes).

2. **Où ranger « Pas maintenant ».** → **La table existante, par deux petites fonctions** (§5). L'autre choix, écrire directement dans la table sans migration, marche aussi mais ne garantit pas « une ligne par œuvre ».

3. **Faut-il aussi noter les propositions affichées et celles que je choisis ?** La table le permettrait. → **Non : seulement « Pas maintenant ».** Le reste ne sert à aucun calcul et ressemblerait à un historique de ce que je regarde.

4. **Quelles lectures comptent comme « dernières lectures » ?** → **Mes lectures en cours, et les terminées dont la date de fin est connue et a moins de six mois ; trois au plus.** Sinon, marquer dix vieux livres « Terminé » le même soir fausserait le contraste.

5. **« Commencer » depuis une proposition.** → **Un bouton, avec une confirmation courte.** Le changement de statut note un début de lecture dans mon parcours, qui ne s'efface pas proprement : mieux vaut éviter l'appui par erreur à côté de « Pas maintenant ». Autre choix : pas de bouton, passer par la fiche.

6. **Des idées stables dans la journée, ou nouvelles à chaque ouverture ?** → **Stables dans la journée**, et « D'autres idées » pour en voir d'autres.

7. **« À relire un jour »** : la référence (§6.4) dit que seuls « M'a marqué » et « Beau moment » renforcent les thèmes. → **Le compter aussi comme un signe positif** (on ne veut relire que ce qu'on a aimé), et corriger le §6.4. À défaut, il reste neutre.

8. **Vocabulaire renommé.** Les envies reconnaissent les étiquettes par leur nom. → **Accepter cette limite pour la version 1**, la noter dans la référence, et garder un test qui vérifie le catalogue. Y remédier demanderait un réglage de plus.

9. **Un livre en pause sur l'accueil ?** → **Non.** Sur l'accueil, il ressemblerait à un rappel. Il reste possible dans Découvrir, où j'ai demandé des idées.

10. **Les séries (mangas) dans « Une lecture courte ».** → **Exclues**, même si un tome se lit vite : une série de 29 tomes n'est pas une lecture courte.

11. **Quand une envie est vide parce que tout y est de côté**, proposer « Les reproposer maintenant » ? → **Non pour l'instant** : la phrase calme suffit, les œuvres restent dans la bibliothèque, et elles reviennent seules. À revoir si cela gêne à l'usage.

12. **La suggestion de l'accueil reste-t-elle affichée même avec plusieurs lectures en cours ?** → **Oui**, comme sur la maquette : une seule idée, discrète.

---

## 7 bis. Décisions du propriétaire (21 novembre 2026)

Les douze recommandations ci-dessus sont acceptées telles quelles. Précisions :

- **Question 5.** « Commencer » demande une confirmation courte, parce qu'un début de lecture ne s'efface pas proprement du parcours.
- **Questions 7 et 9.** D'accord : « À relire un jour » compte comme un signe positif (corriger le §6.4 de la référence) ; jamais de livre en pause dans la suggestion de l'accueil.
- **Cartes de Découvrir.** « Pas maintenant » doit être visuellement plus discret que « Commencer », pour que trois cartes à deux boutons ne chargent pas l'écran. À vérifier sur les captures.
- **Phrases.** Les retouches du §3.3 font partie du travail : « Court. » seul pour un roman court ; une formule répétée (« Plus grave, après Momo. ») n'est gardée que sur la première carte.
- **Organisation.** Les points 1, 2 et 3 du §8 se font dans une première session (Fable 5.2) ; les points 4 à 7 dans une nouvelle session (Opus 5.5), qui part de ce fichier et de sa section « Reprise ».
- Aucun envoi sur GitHub sans accord.

---

## 8. Ordre du travail

Chaque étape : tests, compilation, vérification du rendu, court résumé, commit en français.

| # | Travail | Modèle et effort |
|---|---|---|
| 1 | L'algorithme et sa phrase (`src/recommandations/`), avec tous les tests du §6.1 et du §6.2 | Fable 5.2, élevé |
| 2 | La migration, ses tests et la contre-épreuve (§5) | Fable 5.2, élevé |
| 3 | Le dépôt : `lireIdees`, mise de côté, reprise ; le faux dépôt des tests et l'aperçu local | Fable 5.2, élevé |
| 4 | L'écran Découvrir (§4.1), ses états vides et hors connexion | Opus 5.5, moyen |
| 5 | La suggestion de l'accueil (§4.2) | Opus 5.5, moyen |
| 6 | `/impeccable audit`, corrections, captures sur iPhone en clair et en sombre (393 et 440), iPad (834) | Opus 5.5, moyen |
| 7 | Mise à jour de `docs/reference.md` (§5, §6.1, §6.4, §7, §10.2, §11), puis retrait de ce plan | Fable 5.2, élevé |

Aucun envoi sur GitHub sans accord.

À constater sur l'iPhone après la fusion : la pertinence des idées sur ma vraie bibliothèque (c'est le seul endroit où mes vrais statuts sont visibles), le menu des envies au doigt, VoiceOver sur les cartes.

---

## Reprise

*Écrit le 21 novembre 2026, à la fin de la première session (Fable 5.2). La session suivante (Opus 5.5, effort moyen) part d'ici pour les points 4 à 7 du §8.*

### Où on en est

Branche `etape-7-recommandations`, partie de `main` à jour. Sept commits, **aucun envoyé sur GitHub** :

| Commit | Contenu |
|---|---|
| `7b8114d` | Accueil : la page ne défile plus sur le côté (iPhone) |
| `746d963` | Ce plan, validé |
| `a345a3f` | Bandeau « Hors connexion » : il reste collé en haut |
| `7252948` | Point 1 : l'algorithme et sa phrase |
| `5ecb194` | Point 2 : la migration, ses tests, la contre-épreuve |
| `6489165` | Point 3 : le dépôt et ses requêtes |
| le dernier | Plan mis à jour et cette section |

État vérifié à la fin : `npm test` → 1186 tests réussis (59 fichiers) ; `npm run build` réussi ; les onze fichiers de `supabase/tests` passent sur le banc local (594 vérifications).

**Rien n'est encore visible dans l'appli** : l'écran Découvrir affiche toujours sa phrase d'attente, et l'accueil n'a pas encore sa suggestion. C'est l'objet des points 4 et 5.

### Ce qui reste

| # | Travail | Détail |
|---|---|---|
| 4 | Écran Découvrir | §4.1 de ce plan, avec les précisions du §7 bis : « Pas maintenant » plus discret que « Commencer » ; confirmation courte avant « Commencer ». |
| 5 | Suggestion de l'accueil | §4.2. Jamais de livre en pause ; la section n'apparaît pas s'il n'y a rien à proposer. |
| 6 | Audit et captures | `/impeccable audit`, corrections, captures sur iPhone en clair et en sombre (393 et 440), iPad (834). Vérifier sur les captures que trois cartes à deux boutons ne chargent pas l'écran. |
| 7 | Référence | Mettre à jour `docs/reference.md` (liste plus bas), puis supprimer ce fichier. |

Puis s'arrêter : pas d'envoi sur GitHub sans accord. Une pull request ne lance que l'Action « Migrations » ; les tests de l'appli ne tournent sur GitHub qu'au déploiement de `main`.

### Ce que le code offre déjà

Tout est dans `src/recommandations/` (calcul pur) et `src/bibliotheque/` (dépôt et requêtes).

**Lire les idées** : `useIdees()` (`src/bibliotheque/requetes.ts`) rend `{ oeuvres, deCote }`. Elle se relit toute seule dès qu'une écriture relit la bibliothèque (statut, ressenti, possession, tomes, ajout, suppression) : sa clé de cache est rangée sous celle de la bibliothèque.

**Calculer les propositions** : `proposer(idees, demande)` (`proposer.ts`).

```ts
const resultat = proposer(idees, {
  envie,                                   // 'surprise' | 'reconfortant' | 'philosophique' | 'remise_en_question' | 'lecture_courte' | 'changer_d_univers'
  graine: graineDuJour(maintenant, envie), // hasard.ts : mêmes idées toute la journée
  maintenant,                              // à prendre une fois, à l'ouverture de l'écran
  dejaVues,                                // identifiants déjà vus : « D'autres idées »
  imposees, completer,                     // la page affichée, à garder telle quelle (voir plus bas)
  combien, sansPause,                      // accueil : combien: 1, sansPause: true
})
// resultat.propositions : [{ oeuvre, phrase, morceaux }]
// resultat.situation    : 'normal' | 'peu' | 'aucune' | 'tout_vu' | 'sans_lecture_recente' | 'rien_a_decouvrir' | 'bibliotheque_vide'
// resultat.suite        : 'autres' (il reste des idées) | 'debut' (tout a été vu) | null (pas de bouton)
```

- `messageDe(resultat)` rend la phrase calme du §2, ou `null`. L'écran n'a pas de texte à inventer.
- `ENVIES`, `libelleEnvie`, `estEnvie` (`modele.ts`) : les six envies, dans l'ordre du sélecteur.
- Chaque proposition porte `oeuvre.couverture`, `oeuvre.titre`, `oeuvre.auteurs`, `oeuvre.statut` (« en_pause » : le bouton dit « Reprendre »).

**Écrire** : `useIdeesDeCote()` rend `{ mettre, reprendre }`. `mettre.mutate({ id, envie })` pour « Pas maintenant », `reprendre.mutate(id)` pour « Annuler ». Les deux s'affichent tout de suite et se défont en cas d'échec. « Commencer » et « Reprendre » : `useModifierOeuvre(id).statut.mutate('en_cours')`, qui existe depuis l'étape 5 (un appel par carte, puisque la requête est liée à une œuvre).

**Recette pour l'écran Découvrir** (testée dans `proposer.test.ts`, bloc « D'autres idées ») :

- L'écran garde deux choses : `vues` (identifiants des pages précédentes) et `page` (identifiants affichés, ou rien au départ).
- Premier affichage : `proposer({ dejaVues: vues })`, puis retenir les identifiants dans `page`.
- Ensuite, tant que la page ne change pas : `proposer({ imposees: page, completer: false, dejaVues: vues })`. La page ne bouge pas sous le doigt quand les données se relisent. Une œuvre qui n'est plus candidate (je viens de la commencer) disparaît de la liste rendue : l'écran garde lui-même sa ligne « En cours. » à cet endroit.
- « D'autres idées » : ajouter `page` à `vues`, vider `page`. Si `suite` vaut `'debut'`, le bouton devient « Revoir depuis le début » : vider `vues` et `page`.
- « Pas maintenant » sur X : `mettre.mutate`, puis `proposer({ imposees: page sans X, dejaVues: vues + page })` ; la nouvelle venue est la dernière de la liste rendue : la placer là où était X. « Annuler » : `reprendre.mutate(X)` et remettre la page d'avant.
- L'envie vient de l'adresse (`#/decouvrir?envie=reconfortant`) : `useRouteCourante().parametres`, validée par `estEnvie`, « surprise » par défaut. `App.tsx` remonte l'écran quand l'adresse change : `vues` et `page` repartent de zéro, c'est voulu.

**Recette pour l'accueil** : `proposer(idees, { envie: 'surprise', graine: graineDuJour(maintenant, 'surprise'), maintenant, combien: 1, sansPause: true, dejaVues })`. Avec la même graine que Découvrir, l'idée de l'accueil est la première de « Surprends-moi ». « Une autre idée » : ajouter l'identifiant à `dejaVues` ; quand `suite` vaut `'debut'`, repartir de zéro. Si `propositions` est vide, ne rien afficher.

**Composants à réutiliser** : `Menu` (le sélecteur des envies, comme les bulles Statut et Possession), `Dialogue` (la confirmation de « Commencer »), `MessageTemporaire` (« Idée mise de côté · Annuler »), `Couverture`, `Bouton`, `EtatVide`, `Page`, `TitrePage`.

**Pour les tests des écrans** : `depotFictif({ oeuvres, deCote, maintenant })` connaît `lireIdees`, `mettreIdeeDeCote` et `reprendreIdee` ; ses écritures apparaissent dans `appels.ecritures` sous `ideeDeCote` et `ideeReprise`. Pour une bibliothèque réaliste, donner aux œuvres fictives leurs étiquettes (avec `coeur`), leur tonalité, et un historique daté (c'est de lui que viennent « terminé le » et « touché le »).

**Aperçu local** (`/ichnos/apercu.html#/decouvrir`, serveur `ichnos-dev`) : `src/apercu.tsx`, non suivi par Git, a déjà une lecture sombre terminée il y a trois jours et aimée (Crime et Châtiment), un livre en pause (Le Gai Savoir), trois lectures en cours, et une œuvre sur cinq en « Envie de lire ». Rien à y ajouter pour voir les écrans.

### Ce que le code a précisé ou changé par rapport au plan

Décisions prises en codant, à reporter dans la référence au point 7 :

1. **Familles de l'alternance** : le genre d'abord (§1.5). Coût si c'est un mauvais choix : seulement le petit coup de pouce (+0,15) et la variété entre familles.
2. **« La première est lumineuse sur 300 graines »** était vrai pour le prototype seulement. Avec le code final : 299 sur 300. Le test demande « plus de neuf fois sur dix, et plus souvent qu'avant ».
3. **Livre en pause tout seul** : s'il ne reste que des livres en pause à proposer, un seul est montré (sinon l'écran serait vide alors qu'il y a une idée). Jamais sur l'accueil.
4. **Phrase** : quand il reste de la place, un morceau dit ce que le livre est (« Dystopie, atmosphère dérangeante et oppressante. »). Le genre nommé est le plus rare de ma bibliothèque (« Dystopie » plutôt que « Classique »). Un thème dont le nom contient « et » est séparé par un point-virgule (« liberté ; technologie et attention »). Pour une série dont j'ai une partie : « J'en ai déjà une partie. » Un même morceau n'est jamais dit deux fois dans un groupe de trois : en « Une lecture courte », « Court. » peut donc n'apparaître que sur une carte.
5. **Ordre des thèmes cités** : alphabétique, parce que la base ne garde pas d'ordre entre les étiquettes d'une œuvre.
6. **Mise de côté** : la fonction rend la date de la base ; elle ne vérifie pas que l'œuvre est « à découvrir » (mettre de côté une œuvre déjà lue est sans effet).
7. **Six mois** : 183 jours. Une lecture en cours sans date connue compte, en dernier.
8. **Vocabulaire** : les noms d'étiquettes dont dépendent les envies sont réunis au début de `src/recommandations/envies.ts`, comparés sans tenir compte des majuscules ni des accents.
9. **Une œuvre presque sans étiquettes** (ajoutée à la main) reste proposable en « Surprends-moi », avec une note neutre et la phrase « Une idée parmi mes livres à découvrir. » ; elle n'entre dans aucune envie à filtre.

### Vérifications faites, et celles qui manquent

- **Algorithme** : 65 tests sur les 35 œuvres du catalogue ; quatorze fautes glissées une à une dans le code sont toutes attrapées.
- **Base** : 47 tests ; dix fautes glissées dans une copie de la migration (revoke retiré, `security definer`, contrôle d'appartenance retiré, droit donné à `anon`, ancienne ligne non remplacée, envie non vérifiée…) sont toutes attrapées. **Vérifié sur le banc local seulement** (Postgres embarqué PGlite, hors du dépôt) : l'Action « Migrations », sur la vraie base jetable, ne tournera qu'à l'envoi sur GitHub. C'est elle qui fait foi.
- **Dépôt et requêtes** : 20 tests, dont le cas du réseau qui tombe au milieu d'un « Pas maintenant ».
- **Débordement de l'accueil et bandeau « Hors connexion »** : corrigés et mesurés dans Chromium. **À confirmer sur l'iPhone** : le geste du doigt sur l'accueil, le filet `overflow-x: clip` dans Safari, le bandeau collé en haut hors connexion.
- Le banc local se remonte avec les paquets `@electric-sql/pglite` et `@electric-sql/pglite-pgtap` installés dans un dossier temporaire, jamais dans le projet. Attention : son décor ne doit pas retirer d'office le droit d'exécution à `public`, sinon « revoke retiré » passe inaperçu.

### Pièges connus pour les écrans

- **Texte caché pour VoiceOver dans une zone qui défile sur le côté** : il lui faut un ancêtre positionné dans cette zone, sinon toute la page s'élargit (c'était le bug de l'accueil). `src/ecrans/Accueil.test.tsx` le vérifie ; la nouvelle section de l'accueil doit passer ce test.
- **Mesurer un débordement** : comparer `scrollWidth` et `clientWidth` du document, et essayer aussi avec le texte à 17 px (taille par défaut de l'iPhone).
- **Trois boutons ne tiennent pas** sur une ligne à 393 points à côté d'une couverture : la carte elle-même est le lien vers la fiche, et il ne reste que deux boutons dessous.
- Aucun test ne doit dépasser 1 seconde en local.

### Pour la référence (point 7)

- **§5** : Découvrir (sélecteur, trois cartes, « Commencer » avec confirmation, « Pas maintenant » et son « Annuler », « D'autres idées », états vides) ; Accueil (« Une idée pour la suite »).
- **§6.1** : `recommendation_log` ne reçoit que des mises de côté, une ligne par œuvre ; `reason` et les réponses « choisie » et « aucune » restent inutilisées ; les deux fonctions.
- **§6.4** : « À relire un jour » compte comme un signe positif (décision du 21 novembre 2026).
- **§7** : tout ce plan, résumé : candidats, dernières lectures, composantes et poids, familles, variété, graine du jour, livre en pause, trois semaines, envies et leurs filtres, phrase, limites (vocabulaire renommé, nom propre en minuscule, thèmes par ordre alphabétique).
- **§10.2** : dix fonctions appelables au lieu de huit, avec la contre-épreuve.
- **§11** : l'étape 7 faite ; à constater sur l'iPhone (pertinence des idées sur ma vraie bibliothèque, menu des envies au doigt, VoiceOver sur les cartes) ; les deux corrections de ce jour (débordement de l'accueil, bandeau hors connexion).
- En tête : une ligne « Mise à jour du 21 novembre 2026 ».
