-- Tests des règles de données : ce que la base accepte et refuse.
-- Aucune donnée réelle : titres et ISBN sont des valeurs d’essai.

begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

insert into auth.users (id, email)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@exemple.test');

-- Les tests agissent comme le compte A.
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- ---------------------------------------------------------------------------
-- Œuvres
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ insert into public.works (id, title_fr, form, updated_at) values ('a0000000-0000-4000-8000-000000000001', 'Œuvre d’essai', 'roman', '2000-01-01') $$,
  'Une œuvre n’a besoin que d’un titre et d’une forme'
);
select results_eq(
  $$ select synopsis is null and tone is null and density is null and length is null and first_published_year is null and is_series = false
     from public.works where id = 'a0000000-0000-4000-8000-000000000001' $$,
  'values (true)',
  'Ce qui est inconnu reste vide'
);
select throws_ok(
  $$ insert into public.works (title_fr, form) values ('   ', 'roman') $$,
  '23514', null,
  'Un titre vide est refusé'
);
select throws_ok(
  $$ insert into public.works (title_fr, form) values ('Essai', 'bande dessinée') $$,
  '23514', null,
  'Une forme inconnue est refusée'
);
select throws_ok(
  $$ insert into public.works (title_fr, form, tone) values ('Essai', 'roman', 6) $$,
  '23514', null,
  'La tonalité va de 1 à 5'
);
select throws_ok(
  $$ insert into public.works (title_fr, form, density) values ('Essai', 'roman', 0) $$,
  '23514', null,
  'L’exigence va de 1 à 5'
);
select lives_ok(
  $$ update public.works set synopsis = 'Texte d’essai' where id = 'a0000000-0000-4000-8000-000000000001' $$,
  'Une œuvre se modifie'
);
select results_eq(
  $$ select updated_at > '2000-01-02' from public.works where id = 'a0000000-0000-4000-8000-000000000001' $$,
  'values (true)',
  'La date de modification se met à jour toute seule'
);

-- ---------------------------------------------------------------------------
-- Étiquettes
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ insert into public.tags (kind, name, is_interest) values ('theme', 'Thème d’essai', true) $$,
  'Un thème peut être marqué comme centre d’intérêt'
);
select throws_ok(
  $$ insert into public.tags (kind, name, is_interest) values ('genre', 'Genre d’essai', true) $$,
  '23514', null,
  'Seuls les thèmes peuvent être des centres d’intérêt'
);
select throws_ok(
  $$ insert into public.tags (kind, name) values ('theme', 'Thème d’essai') $$,
  '23505', null,
  'Une même étiquette n’existe qu’une fois'
);

-- ---------------------------------------------------------------------------
-- Éditions et tomes
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ insert into public.editions (id, work_id, isbn) values ('a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', '9780000000002') $$,
  'Un ISBN à 13 chiffres est accepté'
);
select lives_ok(
  $$ insert into public.editions (work_id, isbn) values ('a0000000-0000-4000-8000-000000000001', '000000000X') $$,
  'Un ISBN à 10 caractères est accepté'
);
select throws_ok(
  $$ insert into public.editions (work_id, isbn) values ('a0000000-0000-4000-8000-000000000001', '978-0-00-000000-2') $$,
  '23514', null,
  'Un ISBN mal formé est refusé'
);
select throws_ok(
  $$ insert into public.editions (work_id, page_count) values ('a0000000-0000-4000-8000-000000000001', 0) $$,
  '23514', null,
  'Un nombre de pages nul est refusé (inconnu = vide)'
);
select lives_ok(
  $$ insert into public.volumes (work_id, number) values ('a0000000-0000-4000-8000-000000000001', 1) $$,
  'Un tome s’ajoute avec son numéro'
);
select throws_ok(
  $$ insert into public.volumes (work_id, number) values ('a0000000-0000-4000-8000-000000000001', 1) $$,
  '23505', null,
  'Deux tomes ne portent pas le même numéro'
);
select throws_ok(
  $$ insert into public.media (work_id, kind, episodes_total, episodes_watched) values ('a0000000-0000-4000-8000-000000000001', 'anime', 24, 25) $$,
  '23514', null,
  'On ne peut pas avoir vu plus d’épisodes qu’il n’en existe'
);

-- ---------------------------------------------------------------------------
-- Ma relation à une œuvre
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ insert into public.library_entries (id, work_id, edition_id) values ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004') $$,
  'Une œuvre se range dans la bibliothèque avec son édition'
);
select results_eq(
  $$ select reading_status, ownership from public.library_entries where id = 'a0000000-0000-4000-8000-000000000005' $$,
  $$ values ('a_decouvrir', 'non_possede') $$,
  'Par défaut : à découvrir, non possédé'
);
select throws_ok(
  $$ insert into public.library_entries (work_id) values ('a0000000-0000-4000-8000-000000000001') $$,
  '23505', null,
  'Une œuvre n’est rangée qu’une fois'
);
select throws_ok(
  $$ update public.library_entries set progress_unit = 'page', progress_current = 301, progress_total = 300 where id = 'a0000000-0000-4000-8000-000000000005' $$,
  '23514', null,
  'La progression ne dépasse pas le total'
);
select throws_ok(
  $$ update public.library_entries set progress_unit = 'pourcentage', progress_current = 101 where id = 'a0000000-0000-4000-8000-000000000005' $$,
  '23514', null,
  'Un pourcentage ne dépasse pas 100'
);

insert into public.works (id, title_fr, form) values ('a0000000-0000-4000-8000-000000000011', 'Autre œuvre d’essai', 'essai');
insert into public.editions (id, work_id) values ('a0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000011');

select throws_ok(
  $$ update public.library_entries set edition_id = 'a0000000-0000-4000-8000-000000000014' where id = 'a0000000-0000-4000-8000-000000000005' $$,
  '23503', null,
  'L’édition choisie doit être une édition de la même œuvre'
);

delete from public.editions where id = 'a0000000-0000-4000-8000-000000000004';

select results_eq(
  $$ select edition_id is null from public.library_entries where id = 'a0000000-0000-4000-8000-000000000005' $$,
  'values (true)',
  'Supprimer une édition ne supprime pas ma relation à l’œuvre'
);

-- ---------------------------------------------------------------------------
-- Suppressions en cascade
-- ---------------------------------------------------------------------------

insert into public.notes (work_id, kind, body) values ('a0000000-0000-4000-8000-000000000001', 'reflexion', 'Note d’essai');
insert into public.reading_events (entry_id, kind) values ('a0000000-0000-4000-8000-000000000005', 'commence');

delete from public.works where id = 'a0000000-0000-4000-8000-000000000001';

select results_eq(
  $$ select (select count(*) from public.editions where work_id = 'a0000000-0000-4000-8000-000000000001')
          + (select count(*) from public.volumes)
          + (select count(*) from public.library_entries)
          + (select count(*) from public.reading_events)
          + (select count(*) from public.notes) $$,
  'values (0::bigint)',
  'Supprimer une œuvre supprime tout ce qui lui est rattaché'
);

reset role;
delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select results_eq(
  $$ select (select count(*) from public.works) + (select count(*) from public.tags) + (select count(*) from public.editions) $$,
  'values (0::bigint)',
  'Supprimer le compte supprime toutes ses données'
);

select * from finish();
rollback;
