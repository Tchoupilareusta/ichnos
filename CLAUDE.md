# Ichnos — consignes pour Claude Code

Ichnos est une bibliothèque personnelle de lecture (PWA, mobile d'abord). Son propriétaire ne code pas : il comprend l'informatique, utilise Git et GitHub, et valide les plans et les résultats, pas le code.

## Documents qui font foi

- `docs/reference.md` : décisions validées, modèle de données, recommandations, plan de développement. **À lire avant toute tâche.**
- `docs/cahier-des-charges.md` : cahier des charges d'origine. La phase de discussion décrite à sa section 11 est **terminée** : les décisions sont dans `docs/reference.md`. On est en phase de développement.

En cas de contradiction, `docs/reference.md` l'emporte. Si une demande contredit les deux, demander avant d'agir.

## Façon de travailler

- Toujours répondre et expliquer en français, simplement, sans jargon inutile.
- **Au début de chaque tâche, indiquer le modèle et l'effort recommandés** (voir le plan, §11 de `docs/reference.md`). Si le réglage actuel ne convient pas, le dire avant de commencer. Rappel : Fable 5.2 en effort élevé pour la base de données, la sécurité, l'algorithme de recommandation et les couvertures ; Opus 5.5 en effort moyen pour l'interface et les ajustements.
- Avant une étape importante, présenter un plan court et attendre la validation.
- Après chaque étape : lancer les tests et la compilation, vérifier le rendu, puis résumer en quelques lignes ce qui a changé et comment le voir.
- Commits petits et clairs, messages en français.
- Ne jamais ajouter de dépendance sans raison. Préférer les fonctions natives du navigateur.
- Ne rien ajouter qui ne soit pas demandé, surtout pas d'objectifs, de statistiques, de compteurs, de badges ou de notifications.

## Règles de sécurité (non négociables)

- Toutes les tables portent `user_id` et ont Row Level Security activé, avec des politiques explicites. Aucune exception.
- Seule la clé publique Supabase peut apparaître dans le frontend. Toute autre clé va dans les secrets GitHub ou les secrets Supabase.
- Rien de personnel dans le dépôt : pas de données de lecture, de notes, d'e-mail, de couvertures téléchargées ni de fichier `.env` (il est dans `.gitignore`).
- Les journaux des GitHub Actions sont publics : ne jamais y afficher de donnée ni de clé.
- Les changements de base de données passent uniquement par des fichiers dans `supabase/migrations`.
- Le projet Supabase est créé avec « Automatically expose new tables » désactivé et « Enable automatic RLS » activé : chaque migration doit accorder explicitement les droits (`grant`) au seul rôle `authenticated`, jamais à `anon`, en plus des politiques RLS.

## Données

- Ne jamais inventer un ISBN, une pagination, un éditeur ou une date. Inconnu = vide.
- Synopsis rédigés, jamais copiés, et sans spoiler.
- Une œuvre est distincte de ses éditions. Une série (Vinland Saga) est une seule œuvre avec des tomes.

## Design

- Mise en page « galerie », formes très arrondies et fluides, palette chaude papier et encre, accent maroon `#550000` (`#8D3131` en thème sombre, pour les fonds seulement). Thèmes clair et sombre. Polices : Lora (titres) et Nunito (texte). Palette complète : §4 de `docs/reference.md`.
- Respecter les jetons de design définis dans le code (couleurs, rayons, typographie). Ne pas introduire de nouvelle couleur sans raison.
- Contraste WCAG AA, cibles tactiles d'au moins 44 px, `prefers-reduced-motion` respecté.
- Appareils cibles : iPhone 16 (393 pt), iPhone 18 Pro Max (440 pt), iPad Pro 11 pouces (834 × 1210 pt). Tester chaque écran à ces trois largeurs.
- Zones de sécurité : `viewport-fit=cover` et `env(safe-area-inset-*)` partout (haut : Dynamic Island ; bas : barre de navigation au-dessus de l'indicateur d'accueil). Aucun bouton sous l'encoche.
- iPad (≥ 768 px) : navigation latérale au lieu de la barre du bas, grilles sur plusieurs colonnes, fiche en deux colonnes, lignes de texte de 65 caractères maximum.
- Accessibilité VoiceOver : couvertures décoratives en `aria-hidden`, chaque carte de livre est un lien, boutons répétés nommés (« Voir la fiche de Momo »), menus avec `aria-haspopup`, `role="progressbar"`, styles de focus visibles, tailles de texte en `rem` pour respecter la taille de texte choisie sur l'iPhone.
- Couvertures générées : contraste titre/fond d'au moins 4,5:1, pas de texte sous 11 px, auteur seulement sur les grandes couvertures.
- Voix de l'interface : la première personne, celle du propriétaire (« Mon ressenti », « Mon envie du moment »). Pas de « tu ».
- Prévoir les états vides (premier lancement, aucune lecture en cours, aucune idée pour une envie) et les états hors ligne.
- Les maquettes validées (Accueil, Fiche, Découvrir) servent de référence visuelle. Pour l'interface, utiliser la skill Impeccable, et lancer `/impeccable audit` à la fin de chaque étape d'interface.

## Stack

React, TypeScript, Vite, Tailwind CSS, Supabase (PostgreSQL, Auth, Storage, Edge Functions), TanStack Query, vite-plugin-pwa, Vitest. Routage par hash pour GitHub Pages. Déploiement par GitHub Actions.
