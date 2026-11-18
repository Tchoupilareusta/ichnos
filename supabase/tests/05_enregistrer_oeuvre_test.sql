-- Tests de l’enregistrement d’une œuvre (ajout et modification depuis le formulaire).
-- Fiches et comptes fictifs : aucun titre, auteur ni ISBN réel.

begin;
create extension if not exists pgtap with schema extensions;

select plan(64);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@exemple.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@exemple.test');

-- Une série, saisie comme le ferait le formulaire : espaces en trop, champ laissé vide,
-- ISBN avec tirets, auteur cité deux fois.
select set_config('essai.fiche', $json$
{
  "title_fr": "  Série d’essai  ", "title_original": "Shirīzu", "original_language": "ja",
  "first_published_year": 2001, "form": "manga", "synopsis": "   ",
  "tone": 3, "density": 2, "length": "long", "is_series": true,
  "authors": [
    { "name": "Auteur Un", "role": "auteur" },
    { "name": " Auteur Deux ", "role": "illustrateur" },
    { "name": "Auteur Un", "role": "auteur" }
  ],
  "tags": [
    { "kind": "genre", "name": "Genre d’essai" },
    { "kind": "theme", "name": "Thème de cœur" },
    { "kind": "theme", "name": " Thème nouveau " },
    { "kind": "atmosphere", "name": "Calme" }
  ],
  "editions": [
    { "publisher": "Éditeur d’essai", "language": "fr", "format": "manga", "translator": "", "isbn": "978-0-0000-0000-2", "page_count": null },
    { "publisher": "Test Press", "language": "en", "format": null, "translator": null, "isbn": null, "page_count": 200, "mienne": true }
  ],
  "volumes": [
    { "number": 1, "title": "Premier", "isbn": null },
    { "number": 2, "title": null, "isbn": null }
  ],
  "media": [{ "kind": "anime", "title": "Série d’essai", "seasons": 1, "episodes_total": 12 }]
}
$json$, true);

-- Photographie de tout ce qu'un compte voit, pour vérifier qu'un refus ne change rien.
select set_config('essai.requete_etat', $sql$
  select jsonb_build_object(
    'works', (select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.works x),
    'authors', (select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.authors x),
    'work_authors', (select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.work_authors x),
    'tags', (select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.tags x),
    'work_tags', (select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.work_tags x),
    'editions', (select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.editions x),
    'volumes', (select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.volumes x),
    'media', (select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.media x),
    'library_entries', (select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.library_entries x),
    'notes', (select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.notes x)
  )::text
$sql$, true);

-- ---------------------------------------------------------------------------
-- Qui peut appeler la fonction
-- ---------------------------------------------------------------------------

select ok(
  has_function_privilege('authenticated', 'public.enregistrer_oeuvre(jsonb)', 'execute'),
  'Le compte connecté peut enregistrer une œuvre'
);
select ok(
  not has_function_privilege('anon', 'public.enregistrer_oeuvre(jsonb)', 'execute'),
  'Un visiteur non connecté ne peut pas enregistrer une œuvre'
);
select ok(
  not has_function_privilege('service_role', 'public.enregistrer_oeuvre(jsonb)', 'execute'),
  'La clé de service ne peut pas enregistrer une œuvre'
);

-- Les droits accordés sur la fonction, lus tels qu'ils sont enregistrés dans la base.
-- Sans révocation, PostgreSQL laisse toute fonction exécutable par « public », c'est-à-dire par tout le monde.
select ok(
  (select p.proacl is not null from pg_proc p where p.oid = 'public.enregistrer_oeuvre(jsonb)'::regprocedure),
  'Les droits par défaut de la fonction ont été remplacés par des droits explicites'
);
select is_empty(
  $$
    select a.privilege_type
    from pg_proc p
    cross join lateral aclexplode(p.proacl) a
    where p.oid = 'public.enregistrer_oeuvre(jsonb)'::regprocedure
      and a.grantee in (0, 'anon'::regrole, 'service_role'::regrole) -- 0 désigne « public »
  $$,
  'Aucun droit sur l’enregistrement n’est accordé à public, à anon ni à service_role'
);
select results_eq(
  $$
    select a.privilege_type::text
    from pg_proc p
    cross join lateral aclexplode(p.proacl) a
    where p.oid = 'public.enregistrer_oeuvre(jsonb)'::regprocedure and a.grantee = 'authenticated'::regrole
  $$,
  $$ values ('EXECUTE') $$,
  'Le rôle authenticated a le droit d’exécuter l’enregistrement, et rien d’autre'
);
select ok(
  (select not p.prosecdef from pg_proc p where p.oid = 'public.enregistrer_oeuvre(jsonb)'::regprocedure),
  'La fonction s’exécute avec les droits de l’appelant, donc sous la RLS'
);

set local role anon;
set local request.jwt.claim.sub = '';
select throws_ok(
  $$ select public.enregistrer_oeuvre(current_setting('essai.fiche')::jsonb) $$,
  '42501', null,
  'L’appel d’un visiteur est refusé'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '';
select throws_ok(
  $$ select public.enregistrer_oeuvre(current_setting('essai.fiche')::jsonb) $$,
  '28000', null,
  'Sans compte identifié, rien n’est enregistré'
);

-- ---------------------------------------------------------------------------
-- Le compte A : une fiche illisible ou incohérente est refusée
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- A avait déjà ces étiquettes, dont un thème de cœur : elles doivent être gardées telles quelles.
insert into public.tags (kind, name, is_interest)
values ('genre', 'Genre d’essai', false), ('theme', 'Thème de cœur', true);

select throws_ok(
  $$ select public.enregistrer_oeuvre('[]'::jsonb) $$,
  'EO001', null,
  'Une fiche illisible est refusée'
);
select throws_ok(
  $$ select public.enregistrer_oeuvre(current_setting('essai.fiche')::jsonb - 'media') $$,
  'EO001', null,
  'Une fiche à laquelle il manque une liste est refusée : un oubli ne peut rien effacer'
);
select throws_ok(
  $$ select public.enregistrer_oeuvre(current_setting('essai.fiche')::jsonb || '{"authors": ["Auteur Un"]}') $$,
  'EO001', null,
  'Une liste mal formée est refusée'
);
select throws_ok(
  $$ select public.enregistrer_oeuvre(
       jsonb_set(current_setting('essai.fiche')::jsonb, '{editions,0,mienne}', 'true')
     ) $$,
  'EO001', null,
  'Deux éditions ne peuvent pas être « la mienne » en même temps'
);
select throws_ok(
  $$ select public.enregistrer_oeuvre(current_setting('essai.fiche')::jsonb || '{"is_series": false}') $$,
  'EO001', null,
  'Une œuvre qui n’est pas une série ne peut pas avoir de tomes'
);
select throws_ok(
  $$ select public.enregistrer_oeuvre(
       jsonb_set(current_setting('essai.fiche')::jsonb, '{volumes,1,number}', '1')
     ) $$,
  'EO001', null,
  'Deux tomes ne peuvent pas porter le même numéro'
);
select is_empty(
  $$ select 1 from public.works union all select 1 from public.authors union all select 1 from public.editions
     union all select 1 from public.library_entries $$,
  'Aucun de ces refus n’a laissé de trace'
);

-- ---------------------------------------------------------------------------
-- Le compte A ajoute une série
-- ---------------------------------------------------------------------------

select set_config('essai.serie', public.enregistrer_oeuvre(current_setting('essai.fiche')::jsonb)::text, true);

select results_eq(
  $$ select id::text, title_fr, title_original, original_language, first_published_year::integer, form, synopsis,
            tone::integer, density::integer, length, is_series
     from public.works $$,
  $$ values (current_setting('essai.serie'), 'Série d’essai', 'Shirīzu', 'ja', 2001, 'manga', null, 3, 2, 'long', true) $$,
  'L’œuvre est créée, la fonction rend son identifiant ; les espaces en trop sont retirés, un texte vide reste vide'
);
select results_eq(
  $$ select a.name, wa.role
     from public.work_authors wa join public.authors a on a.id = wa.author_id order by 1 $$,
  $$ values ('Auteur Deux', 'illustrateur'), ('Auteur Un', 'auteur') $$,
  'L’œuvre est reliée à ses auteurs, avec leur rôle ; un auteur cité deux fois n’est créé qu’une fois'
);
select results_eq(
  $$ select kind, name, is_interest from public.tags order by kind, name $$,
  $$ values
       ('atmosphere', 'Calme', false),
       ('genre', 'Genre d’essai', false),
       ('theme', 'Thème de cœur', true),
       ('theme', 'Thème nouveau', false) $$,
  'Les étiquettes nouvelles sont créées ; celles qui existaient sont gardées, thème de cœur compris'
);
select results_eq(
  $$ select count(*)::integer from public.work_tags where work_id = current_setting('essai.serie')::uuid $$,
  'values (4)',
  'L’œuvre porte ses quatre étiquettes'
);
select results_eq(
  $$ select publisher, language, format, translator, isbn, page_count from public.editions order by publisher $$,
  $$ values
       ('Test Press', 'en', null, null, null, 200),
       ('Éditeur d’essai', 'fr', 'manga', null, '9780000000002', null::integer) $$,
  'Les éditions sont créées ; l’ISBN est débarrassé de ses tirets, ce qui est inconnu reste vide'
);
select results_eq(
  $$ select le.reading_status, le.ownership, e.publisher, le.progress_unit, le.appreciation, le.started_at
     from public.library_entries le left join public.editions e on e.id = le.edition_id $$,
  $$ values ('a_decouvrir', 'non_possede', 'Test Press', null, null, null::date) $$,
  'L’œuvre entre « À découvrir » et « Non possédé », avec l’édition désignée comme la mienne'
);
select results_eq(
  $$ select number, title, isbn, ownership, reading_status from public.volumes order by number $$,
  $$ values (1, 'Premier', null, 'non_possede', 'a_lire'), (2, null, null, 'non_possede', 'a_lire') $$,
  'Les tomes sont créés, non possédés et à lire'
);
select results_eq(
  $$ select kind, title, seasons::integer, episodes_total, episodes_watched, status from public.media $$,
  $$ values ('anime', 'Série d’essai', 1, 12, null::integer, 'a_voir') $$,
  'Le média associé est créé, à voir'
);
select is_empty(
  $$ select 1 from public.reading_events union all select 1 from public.notes union all select 1 from public.recommendation_log $$,
  'L’ajout ne crée ni historique, ni note, ni proposition'
);

-- Une seconde œuvre, qui partage un auteur avec la série.
select set_config('essai.roman', public.enregistrer_oeuvre($json$
{
  "title_fr": "Roman d’essai", "form": "roman", "is_series": false,
  "authors": [{ "name": "Auteur Un" }],
  "tags": [{ "kind": "genre", "name": "Genre d’essai" }],
  "editions": [{ "publisher": "Maison du roman", "language": "fr", "isbn": "000000000X", "page_count": 120, "mienne": true }],
  "volumes": [], "media": []
}
$json$::jsonb)::text, true);

select results_eq(
  $$ select w.title_fr, w.tone::integer, w.first_published_year::integer, wa.role, e.isbn
     from public.works w
     join public.work_authors wa on wa.work_id = w.id
     join public.library_entries le on le.work_id = w.id
     join public.editions e on e.id = le.edition_id
     where w.id = current_setting('essai.roman')::uuid $$,
  $$ values ('Roman d’essai', null::integer, null::integer, 'auteur', '000000000X') $$,
  'Une fiche presque vide s’enregistre : rien n’est complété ni deviné, le rôle par défaut est « auteur »'
);
select results_eq(
  $$ select count(*)::integer from public.authors $$,
  'values (2)',
  'L’auteur commun aux deux œuvres n’existe qu’une fois'
);

-- ---------------------------------------------------------------------------
-- Le compte A modifie la série, après avoir commencé à la lire
-- ---------------------------------------------------------------------------

update public.library_entries
set reading_status = 'en_cours', ownership = 'possede', progress_unit = 'tome', progress_current = 1,
    appreciation = 'beau_moment', started_at = '2026-01-02'
where work_id = current_setting('essai.serie')::uuid;
update public.volumes set ownership = 'possede', reading_status = 'lu' where number = 1;
update public.volumes set ownership = 'a_acheter' where number = 2;
update public.media set episodes_watched = 5, status = 'en_cours';
insert into public.notes (work_id, kind, body) values (current_setting('essai.serie')::uuid, 'citation', 'Phrase d’essai.');

select set_config('essai.edition', (select id::text from public.editions where publisher = 'Éditeur d’essai'), true);
select set_config('essai.media', (select id::text from public.media), true);

-- Tout change : titre, auteurs, étiquettes ; une édition corrigée et choisie, une retirée, une ajoutée ;
-- le tome 1 corrigé, le tome 2 retiré, un tome 3 ajouté ; le média corrigé.
select set_config('essai.modification', jsonb_build_object(
  'id', current_setting('essai.serie'),
  'title_fr', 'Série corrigée', 'title_original', '', 'original_language', 'ja',
  'first_published_year', null, 'form', 'manga', 'synopsis', 'Texte d’essai.',
  'tone', 4, 'density', 2, 'length', 'long', 'is_series', true,
  'authors', '[{ "name": "Auteur Trois" }, { "name": "Auteur Un", "role": "auteur" }]'::jsonb,
  'tags', '[{ "kind": "theme", "name": "Thème de cœur" }, { "kind": "atmosphere", "name": "Âpre" }]'::jsonb,
  'editions', jsonb_build_array(
    jsonb_build_object('id', current_setting('essai.edition'), 'publisher', 'Éditeur corrigé', 'language', 'fr',
                       'isbn', null, 'page_count', 192, 'mienne', true),
    jsonb_build_object('publisher', 'Troisième maison', 'language', 'fr')
  ),
  'volumes', '[{ "number": 1, "title": "Premier, corrigé", "isbn": "9780000000002" }, { "number": 3 }]'::jsonb,
  'media', jsonb_build_array(
    jsonb_build_object('id', current_setting('essai.media'), 'kind', 'anime', 'title', 'Titre corrigé',
                       'seasons', 2, 'episodes_total', 24)
  )
)::text, true);

select is(
  public.enregistrer_oeuvre(current_setting('essai.modification')::jsonb)::text,
  current_setting('essai.serie'),
  'La modification rend l’identifiant de la même œuvre'
);
select results_eq(
  $$ select title_fr, title_original, first_published_year::integer, synopsis, tone::integer from public.works
     where id = current_setting('essai.serie')::uuid $$,
  $$ values ('Série corrigée', null, null::integer, 'Texte d’essai.', 4) $$,
  'Les informations de l’œuvre sont corrigées ; un champ vidé redevient vide'
);
select results_eq(
  $$ select count(*)::integer from public.works $$,
  'values (2)',
  'Modifier ne crée pas de doublon'
);
select results_eq(
  $$ select a.name, wa.role
     from public.work_authors wa join public.authors a on a.id = wa.author_id
     where wa.work_id = current_setting('essai.serie')::uuid order by 1 $$,
  $$ values ('Auteur Trois', 'auteur'), ('Auteur Un', 'auteur') $$,
  'Les auteurs de l’œuvre sont remplacés par ceux de la fiche'
);
select results_eq(
  $$ select name from public.authors order by name $$,
  $$ values ('Auteur Trois'), ('Auteur Un') $$,
  'L’auteur détaché de sa dernière œuvre est retiré ; celui d’une autre œuvre est gardé'
);
select results_eq(
  $$ select t.kind, t.name
     from public.work_tags wt join public.tags t on t.id = wt.tag_id
     where wt.work_id = current_setting('essai.serie')::uuid order by 1, 2 $$,
  $$ values ('atmosphere', 'Âpre'), ('theme', 'Thème de cœur') $$,
  'Les étiquettes de l’œuvre sont remplacées par celles de la fiche'
);
select results_eq(
  $$ select count(*)::integer from public.tags $$,
  'values (5)',
  'Une étiquette retirée d’une œuvre reste dans mon vocabulaire'
);
select results_eq(
  $$ select publisher, (id::text = current_setting('essai.edition')), isbn, page_count
     from public.editions where work_id = current_setting('essai.serie')::uuid order by publisher $$,
  $$ values ('Troisième maison', false, null, null::integer), ('Éditeur corrigé', true, null, 192) $$,
  'L’édition gardée est corrigée sans changer d’identifiant, l’édition absente est retirée, la nouvelle ajoutée'
);
select results_eq(
  $$ select le.edition_id::text, le.reading_status, le.ownership, le.progress_unit, le.progress_current, le.appreciation, le.started_at
     from public.library_entries le where le.work_id = current_setting('essai.serie')::uuid $$,
  $$ values (current_setting('essai.edition'), 'en_cours', 'possede', 'tome', 1, 'beau_moment', '2026-01-02'::date) $$,
  'Mon édition suit la fiche ; statut, possession, progression et appréciation ne bougent pas'
);
select results_eq(
  $$ select number, title, isbn, ownership, reading_status from public.volumes order by number $$,
  $$ values
       (1, 'Premier, corrigé', '9780000000002', 'possede', 'lu'),
       (3, null, null, 'non_possede', 'a_lire') $$,
  'Le tome gardé conserve sa possession et sa lecture, le tome absent est retiré, le nouveau arrive non possédé'
);
select results_eq(
  $$ select id::text, title, seasons::integer, episodes_total, episodes_watched, status from public.media $$,
  $$ values (current_setting('essai.media'), 'Titre corrigé', 2, 24, 5, 'en_cours') $$,
  'Le média est corrigé et garde son avancement'
);
select results_eq(
  $$ select body from public.notes $$,
  $$ values ('Phrase d’essai.') $$,
  'Mes notes ne sont pas touchées'
);
select results_eq(
  $$ select w.title_fr, a.name, e.publisher
     from public.works w
     join public.work_authors wa on wa.work_id = w.id
     join public.authors a on a.id = wa.author_id
     join public.editions e on e.work_id = w.id
     where w.id = current_setting('essai.roman')::uuid $$,
  $$ values ('Roman d’essai', 'Auteur Un', 'Maison du roman') $$,
  'L’autre œuvre n’a pas bougé'
);

-- ---------------------------------------------------------------------------
-- Tout ou rien : une modification refusée ne change rien
-- ---------------------------------------------------------------------------

do $bloc$
declare etat text;
begin
  execute current_setting('essai.requete_etat') into etat;
  perform set_config('essai.avant', etat, true);
end;
$bloc$;

-- Une nouvelle fiche qui change tout, à laquelle chaque essai ajoute une seule erreur.
select set_config('essai.autre', (
  current_setting('essai.modification')::jsonb
  || '{"title_fr": "Titre qui ne doit pas rester", "tone": 1,
       "authors": [{ "name": "Auteur Quatre" }],
       "tags": [{ "kind": "genre", "name": "Genre qui ne doit pas rester" }],
       "volumes": [{ "number": 7 }]}'::jsonb
  || jsonb_build_object(
       'editions', '[{ "publisher": "Maison qui ne doit pas rester", "mienne": true }]'::jsonb,
       'media', jsonb_build_array(
         jsonb_build_object('id', current_setting('essai.media'), 'kind', 'film', 'title', 'Titre qui ne doit pas rester',
                            'seasons', 1, 'episodes_total', 30)
       )
     )
)::text, true);

select throws_ok(
  $$ select public.enregistrer_oeuvre(
       jsonb_set(current_setting('essai.autre')::jsonb, '{tags,1}', '{ "kind": "humeur", "name": "Étiquette invalide" }')
     ) $$,
  '23514', null,
  'Une étiquette invalide arrête la modification'
);
select throws_ok(
  $$ select public.enregistrer_oeuvre(
       jsonb_set(current_setting('essai.autre')::jsonb, '{tags,1}', '{ "kind": "theme", "name": "   " }')
     ) $$,
  '23514', null,
  'Une étiquette sans nom arrête la modification'
);
select throws_ok(
  $$ select public.enregistrer_oeuvre(
       jsonb_set(current_setting('essai.autre')::jsonb, '{authors,1}', '{ "name": "" }')
     ) $$,
  '23514', null,
  'Un auteur sans nom arrête la modification'
);
select throws_ok(
  $$ select public.enregistrer_oeuvre(
       jsonb_set(current_setting('essai.autre')::jsonb, '{editions,0,isbn}', '"12345"')
     ) $$,
  '23514', null,
  'Un ISBN mal formé arrête la modification'
);
-- La toute dernière étape de la fonction : tout le reste a déjà été écrit quand l'erreur survient.
select throws_ok(
  $$ select public.enregistrer_oeuvre(
       jsonb_set(current_setting('essai.autre')::jsonb, '{media,0,episodes_total}', '3')
     ) $$,
  '23514', null,
  'Un média incohérent (moins d’épisodes que d’épisodes vus) arrête la modification, même en toute fin'
);
select throws_ok(
  $$ select public.enregistrer_oeuvre(current_setting('essai.autre')::jsonb || '{"title_fr": "  "}') $$,
  '23514', null,
  'Un titre vide arrête la modification'
);
select throws_ok(
  $$ select public.enregistrer_oeuvre(
       jsonb_set(current_setting('essai.autre')::jsonb, '{editions,0,id}', to_jsonb(
         (select id::text from public.editions where work_id = current_setting('essai.roman')::uuid)
       ))
     ) $$,
  'EO002', null,
  'L’édition d’une autre œuvre ne peut pas être rattachée à celle-ci'
);
select throws_ok(
  $$ select public.enregistrer_oeuvre(
       current_setting('essai.autre')::jsonb || '{"id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc"}'
     ) $$,
  'EO002', null,
  'Une œuvre qui n’existe pas est introuvable'
);
select results_eq(
  current_setting('essai.requete_etat'),
  format('values (%L)', current_setting('essai.avant')),
  'Après ces huit refus, ma bibliothèque est exactement dans l’état d’avant : rien à moitié écrit'
);

-- ---------------------------------------------------------------------------
-- Le compte B : tout ou rien à l'ajout, et chacun chez soi
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is_empty(
  $$ select 1 from public.works union all select 1 from public.tags union all select 1 from public.volumes
     union all select 1 from public.authors union all select 1 from public.editions $$,
  'Le compte B ne voit rien de ce que A a enregistré'
);

select throws_ok(
  $$ select public.enregistrer_oeuvre(
       jsonb_set(current_setting('essai.fiche')::jsonb, '{tags,3}', '{ "kind": "humeur", "name": "Étiquette invalide" }')
     ) $$,
  '23514', null,
  'Une étiquette invalide arrête l’ajout'
);
select throws_ok(
  $$ select public.enregistrer_oeuvre(
       jsonb_set(current_setting('essai.fiche')::jsonb, '{media,0,kind}', '"jeu"')
     ) $$,
  '23514', null,
  'Un média invalide arrête l’ajout, même en toute fin'
);
select is_empty(
  $$ select 1 from public.works union all select 1 from public.authors union all select 1 from public.tags
     union all select 1 from public.editions union all select 1 from public.volumes
     union all select 1 from public.media union all select 1 from public.library_entries $$,
  'Un ajout interrompu ne laisse rien derrière lui : ni œuvre, ni auteur, ni étiquette'
);

select throws_ok(
  format(
    $$ select public.enregistrer_oeuvre(%L::jsonb) $$,
    current_setting('essai.autre')
  ),
  'EO002', null,
  'Le compte B ne peut pas modifier l’œuvre de A, même en connaissant son identifiant'
);
select throws_ok(
  format(
    $$ select public.enregistrer_oeuvre(jsonb_set(current_setting('essai.fiche')::jsonb, '{editions,0,id}', %L::jsonb)) $$,
    to_jsonb(current_setting('essai.edition'))
  ),
  'EO002', null,
  'Le compte B ne peut pas s’approprier une édition de A'
);
select throws_ok(
  format(
    $$ select public.enregistrer_oeuvre(jsonb_set(current_setting('essai.fiche')::jsonb, '{media,0,id}', %L::jsonb)) $$,
    to_jsonb(current_setting('essai.media'))
  ),
  'EO002', null,
  'Le compte B ne peut pas s’approprier un média de A'
);
select is_empty(
  $$ select 1 from public.works union all select 1 from public.authors union all select 1 from public.tags $$,
  'Ces tentatives n’ont rien créé chez B'
);

select lives_ok(
  $$ select public.enregistrer_oeuvre(current_setting('essai.fiche')::jsonb) $$,
  'Le compte B peut enregistrer la même fiche dans sa propre bibliothèque'
);
select results_eq(
  $$ select (select count(*)::integer from public.works), (select count(*)::integer from public.authors),
            (select count(*)::integer from public.tags) $$,
  'values (1, 2, 4)',
  'Le compte B a son œuvre, ses auteurs et ses étiquettes : aucun partage avec A'
);

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select results_eq(
  current_setting('essai.requete_etat'),
  format('values (%L)', current_setting('essai.avant')),
  'Rien de ce que B a tenté ou enregistré n’a changé quoi que ce soit chez A'
);

-- Retirer toutes les éditions : « mon édition » se vide.
select lives_ok(
  format(
    $$ select public.enregistrer_oeuvre(%L::jsonb) $$,
    jsonb_build_object('id', current_setting('essai.roman'), 'title_fr', 'Roman d’essai', 'form', 'roman',
                       'authors', '[{ "name": "Auteur Un" }]'::jsonb, 'tags', '[]'::jsonb,
                       'editions', '[]'::jsonb, 'volumes', '[]'::jsonb, 'media', '[]'::jsonb)
  ),
  'Une œuvre peut être enregistrée sans édition ni étiquette'
);
select results_eq(
  $$ select (select count(*)::integer from public.editions e where e.work_id = le.work_id), le.edition_id
     from public.library_entries le where le.work_id = current_setting('essai.roman')::uuid $$,
  $$ values (0, null::uuid) $$,
  'Sans édition, « mon édition » reste vide'
);

reset role;
select results_eq(
  $$ select user_id::text, count(*)::integer from public.works group by 1 order by 1 $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 2), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 1) $$,
  'Chaque œuvre appartient au compte qui l’a enregistrée'
);
select is_empty(
  $$ select 1 from public.reading_events union all select 1 from public.recommendation_log $$,
  'L’enregistrement n’écrit jamais dans l’historique ni dans les propositions'
);

select * from finish();
rollback;
