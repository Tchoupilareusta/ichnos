-- Tests de l’import du catalogue de départ.
-- Catalogues et comptes fictifs : aucun titre, auteur ni ISBN réel.

begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@exemple.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@exemple.test');

-- Un petit catalogue : une série et un roman lu en anglais, qui partagent un auteur.
select set_config('essai.catalogue', $json$
{
  "tags": {
    "genre": ["Genre d’essai"],
    "atmosphere": ["Calme"],
    "theme": [
      { "name": "Thème de cœur", "is_interest": true },
      { "name": "Thème ordinaire", "is_interest": false }
    ]
  },
  "works": [
    {
      "key": "ignorée",
      "title_fr": "Série d’essai", "title_original": "Shirīzu", "original_language": "ja",
      "first_published_year": 2001, "form": "manga", "is_series": true,
      "authors": [{ "name": "Auteur Un", "role": "auteur" }],
      "synopsis": "Texte d’essai.", "tone": 3, "density": 2, "length": "long",
      "genres": ["Genre d’essai"], "themes": ["Thème de cœur"], "atmospheres": ["Calme"],
      "editions": [{ "publisher": "Éditeur d’essai", "language": "fr", "format": "manga", "translator": null, "isbn": null, "page_count": null }],
      "volumes": [
        { "number": 1, "title": "Premier", "isbn": "9780000000002" },
        { "number": 2, "title": null, "isbn": null }
      ],
      "media": [{ "kind": "anime", "title": "Série d’essai", "seasons": 1, "episodes_total": 12 }],
      "relecture": { "sources": [] }
    },
    {
      "title_fr": "Roman d’essai", "title_original": "Test Novel", "original_language": "en",
      "first_published_year": null, "form": "roman", "is_series": false,
      "authors": [{ "name": "Auteur Un", "role": "auteur" }, { "name": "Auteur Deux", "role": "illustrateur" }],
      "synopsis": "Autre texte d’essai.", "tone": 1, "density": 5, "length": "court",
      "genres": ["Genre d’essai"], "themes": ["Thème ordinaire"], "atmospheres": [],
      "editions": [{ "publisher": "Test Press", "language": "en", "format": null, "translator": null, "isbn": "9780000000019", "page_count": 120 }],
      "volumes": [], "media": []
    }
  ]
}
$json$, true);

-- ---------------------------------------------------------------------------
-- Qui peut appeler la fonction
-- ---------------------------------------------------------------------------

select ok(
  has_function_privilege('authenticated', 'public.importer_catalogue(jsonb)', 'execute'),
  'Le compte connecté peut lancer l’import'
);
select ok(
  not has_function_privilege('anon', 'public.importer_catalogue(jsonb)', 'execute'),
  'Un visiteur non connecté ne peut pas lancer l’import'
);
select ok(
  not has_function_privilege('service_role', 'public.importer_catalogue(jsonb)', 'execute'),
  'La clé de service ne peut pas lancer l’import'
);

-- Les droits accordés sur la fonction, lus tels qu'ils sont enregistrés dans la base.
-- Sans révocation, PostgreSQL laisse toute fonction exécutable par « public », c'est-à-dire par tout le monde.
select ok(
  (select p.proacl is not null from pg_proc p where p.oid = 'public.importer_catalogue(jsonb)'::regprocedure),
  'Les droits par défaut de la fonction ont été remplacés par des droits explicites'
);
select is_empty(
  $$
    select a.privilege_type
    from pg_proc p
    cross join lateral aclexplode(p.proacl) a
    where p.oid = 'public.importer_catalogue(jsonb)'::regprocedure
      and a.grantee in (0, 'anon'::regrole, 'service_role'::regrole) -- 0 désigne « public »
  $$,
  'Aucun droit sur l’import n’est accordé à public, à anon ni à service_role'
);
select results_eq(
  $$
    select a.privilege_type::text
    from pg_proc p
    cross join lateral aclexplode(p.proacl) a
    where p.oid = 'public.importer_catalogue(jsonb)'::regprocedure and a.grantee = 'authenticated'::regrole
  $$,
  $$ values ('EXECUTE') $$,
  'Le rôle authenticated a le droit d’exécuter l’import, et rien d’autre'
);

set local role anon;
set local request.jwt.claim.sub = '';
select throws_ok(
  $$ select public.importer_catalogue(current_setting('essai.catalogue')::jsonb) $$,
  '42501', null,
  'L’appel d’un visiteur est refusé'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '';
select throws_ok(
  $$ select public.importer_catalogue(current_setting('essai.catalogue')::jsonb) $$,
  '28000', null,
  'Sans compte identifié, rien n’est importé'
);

-- ---------------------------------------------------------------------------
-- Le compte A installe le catalogue
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- A avait déjà créé ce genre : il doit être gardé, pas doublé.
insert into public.tags (kind, name) values ('genre', 'Genre d’essai');

select throws_ok(
  $$ select public.importer_catalogue('{"works": []}'::jsonb) $$,
  'IC002', null,
  'Un catalogue vide est refusé'
);
select throws_ok(
  $$ select public.importer_catalogue('{"tags": {}}'::jsonb) $$,
  'IC002', null,
  'Un catalogue sans œuvres est refusé'
);

select results_eq(
  $$ select public.importer_catalogue(current_setting('essai.catalogue')::jsonb) $$,
  $$ values ('{"oeuvres": 2, "tomes": 2}'::jsonb) $$,
  'L’import rend le nombre d’œuvres et de tomes installés'
);

select results_eq(
  $$ select title_fr, title_original, original_language, first_published_year::integer, form, tone::integer, density::integer, length, is_series
     from public.works order by title_fr $$,
  $$ values
       ('Roman d’essai', 'Test Novel', 'en', null::integer, 'roman', 1, 5, 'court', false),
       ('Série d’essai', 'Shirīzu', 'ja', 2001, 'manga', 3, 2, 'long', true) $$,
  'Les œuvres sont créées avec leurs informations'
);
select results_eq(
  $$ select name from public.authors order by name $$,
  $$ values ('Auteur Deux'), ('Auteur Un') $$,
  'Un auteur commun à deux œuvres n’est créé qu’une fois'
);
select results_eq(
  $$ select w.title_fr, a.name, wa.role
     from public.work_authors wa
     join public.works w on w.id = wa.work_id
     join public.authors a on a.id = wa.author_id
     order by 1, 2 $$,
  $$ values
       ('Roman d’essai', 'Auteur Deux', 'illustrateur'),
       ('Roman d’essai', 'Auteur Un', 'auteur'),
       ('Série d’essai', 'Auteur Un', 'auteur') $$,
  'Chaque œuvre est reliée à ses auteurs, avec leur rôle'
);
select results_eq(
  $$ select kind, name, is_interest from public.tags order by kind, name $$,
  $$ values
       ('atmosphere', 'Calme', false),
       ('genre', 'Genre d’essai', false),
       ('theme', 'Thème de cœur', true),
       ('theme', 'Thème ordinaire', false) $$,
  'Le vocabulaire est créé, centres d’intérêt compris, sans doubler une étiquette existante'
);
select results_eq(
  $$ select w.title_fr, t.kind, t.name
     from public.work_tags wt
     join public.works w on w.id = wt.work_id
     join public.tags t on t.id = wt.tag_id
     order by 1, 2, 3 $$,
  $$ values
       ('Roman d’essai', 'genre', 'Genre d’essai'),
       ('Roman d’essai', 'theme', 'Thème ordinaire'),
       ('Série d’essai', 'atmosphere', 'Calme'),
       ('Série d’essai', 'genre', 'Genre d’essai'),
       ('Série d’essai', 'theme', 'Thème de cœur') $$,
  'Chaque œuvre porte ses étiquettes'
);
select results_eq(
  $$ select w.title_fr, e.publisher, e.language, e.format, e.isbn, e.page_count
     from public.editions e join public.works w on w.id = e.work_id order by 1 $$,
  $$ values
       ('Roman d’essai', 'Test Press', 'en', null, '9780000000019', 120),
       ('Série d’essai', 'Éditeur d’essai', 'fr', 'manga', null, null::integer) $$,
  'Les éditions sont créées ; ce qui est inconnu reste vide'
);
select results_eq(
  $$ select number, title, isbn, ownership, reading_status from public.volumes order by number $$,
  $$ values
       (1, 'Premier', '9780000000002', 'non_possede', 'a_lire'),
       (2, null, null, 'non_possede', 'a_lire') $$,
  'Les tomes sont créés, non possédés et à lire'
);
select results_eq(
  $$ select kind, title, seasons::integer, episodes_total, episodes_watched, status from public.media $$,
  $$ values ('anime', 'Série d’essai', 1, 12, null::integer, 'a_voir') $$,
  'Le média associé est créé, à voir'
);
select results_eq(
  $$ select w.title_fr, le.reading_status, le.ownership, le.edition_id = e.id, le.progress_unit, le.appreciation, le.started_at
     from public.library_entries le
     join public.works w on w.id = le.work_id
     join public.editions e on e.work_id = w.id
     order by 1 $$,
  $$ values
       ('Roman d’essai', 'a_decouvrir', 'non_possede', true, null, null, null::date),
       ('Série d’essai', 'a_decouvrir', 'non_possede', true, null, null, null::date) $$,
  'Chaque œuvre entre « À découvrir » et « Non possédé », reliée à son édition de référence'
);
select is_empty(
  $$ select 1 from public.reading_events union all select 1 from public.notes union all select 1 from public.recommendation_log $$,
  'L’import ne crée ni historique, ni note, ni proposition'
);
select results_eq(
  $$ select count(*)::integer from (
       select user_id from public.works union all select user_id from public.authors
       union all select user_id from public.work_authors union all select user_id from public.tags
       union all select user_id from public.work_tags union all select user_id from public.editions
       union all select user_id from public.volumes union all select user_id from public.media
       union all select user_id from public.library_entries
     ) lignes where user_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  'values (0)',
  'Toutes les lignes créées appartiennent au compte A'
);

-- ---------------------------------------------------------------------------
-- Pas de second import
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.importer_catalogue(current_setting('essai.catalogue')::jsonb) $$,
  'IC001', null,
  'Un second import est refusé quand la bibliothèque contient déjà des œuvres'
);
select results_eq(
  $$ select count(*)::integer from public.works $$,
  'values (2)',
  'Le refus ne crée aucun doublon'
);

-- ---------------------------------------------------------------------------
-- Le compte B : tout ou rien, et chacun chez soi
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is_empty(
  $$ select 1 from public.works union all select 1 from public.tags union all select 1 from public.volumes $$,
  'Le compte B ne voit rien de ce que A a importé'
);

select throws_ok(
  $$ select public.importer_catalogue(
       jsonb_set(current_setting('essai.catalogue')::jsonb, '{works,1,themes}', '["Thème inconnu"]'::jsonb)
     ) $$,
  'IC002', null,
  'Une étiquette absente du vocabulaire arrête l’import'
);
select is_empty(
  $$ select 1 from public.works union all select 1 from public.tags union all select 1 from public.authors
     union all select 1 from public.editions union all select 1 from public.library_entries $$,
  'Un import interrompu ne laisse rien derrière lui'
);

select throws_ok(
  $$ select public.importer_catalogue(
       jsonb_set(current_setting('essai.catalogue')::jsonb, '{works,1,tone}', '9'::jsonb)
     ) $$,
  '23514', null,
  'Les règles des tables s’appliquent : une tonalité hors échelle arrête l’import'
);
select is_empty(
  $$ select 1 from public.works union all select 1 from public.tags $$,
  'Là encore, rien n’est enregistré'
);

select lives_ok(
  $$ select public.importer_catalogue(current_setting('essai.catalogue')::jsonb) $$,
  'Le compte B peut installer le catalogue dans sa propre bibliothèque'
);
select results_eq(
  $$ select count(*)::integer from public.works $$,
  'values (2)',
  'Le compte B voit ses 2 œuvres, pas celles de A'
);
select results_eq(
  $$ select count(*)::integer from public.authors $$,
  'values (2)',
  'Les auteurs de B sont les siens : aucun partage avec A'
);

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select results_eq(
  $$ select count(*)::integer from public.works $$,
  'values (2)',
  'L’import de B n’a rien changé chez A'
);

reset role;
select results_eq(
  $$ select count(*)::integer from public.library_entries where reading_status <> 'a_decouvrir' or ownership <> 'non_possede' $$,
  'values (0)',
  'Aucun statut personnel n’a été posé par l’import'
);

select * from finish();
rollback;
