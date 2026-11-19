-- Tests de l'étape 6 (migration 20261119200000_ajout_auto) :
-- le journal des appels à l'IA et sa limite par jour, et le rangement des couvertures.
-- Comptes et œuvres fictifs.

begin;
create extension if not exists pgtap with schema extensions;

select plan(41);

-- ---------------------------------------------------------------------------
-- 1. Droits : le compte connecté seul, sans droits supérieurs
-- ---------------------------------------------------------------------------

select ok(has_function_privilege('authenticated', 'public.reserver_appel_ia(text, integer)', 'execute'),
  'reserver_appel_ia est appelable par le compte connecté');
select ok(not has_function_privilege('anon', 'public.reserver_appel_ia(text, integer)', 'execute'),
  'reserver_appel_ia est fermée au rôle anon');
select ok(not has_function_privilege('service_role', 'public.reserver_appel_ia(text, integer)', 'execute'),
  'reserver_appel_ia est fermée au rôle service_role');
select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'reserver_appel_ia'
       and (p.prosecdef or exists (
         select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')) $$,
  'La fonction s’exécute avec les droits de l’appelant et est fermée à public'
);

-- ---------------------------------------------------------------------------
-- 2. La limite par jour
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@exemple.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@exemple.test');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is(public.reserver_appel_ia('fiche', 3), true, 'Le premier appel de A est accepté');
select is(public.reserver_appel_ia('fiche', 3), true, 'Le deuxième appel de A est accepté');
select is(public.reserver_appel_ia('fiche', 3), true, 'Le troisième appel de A est accepté');
select is(public.reserver_appel_ia('fiche', 3), false, 'Le quatrième appel est refusé : la limite est atteinte');
select results_eq(
  'select count(*)::int from public.ai_calls',
  'values (3)',
  'Un appel refusé ne laisse aucune trace : le journal compte trois lignes'
);
select results_eq(
  $$ select distinct user_id::text, action from public.ai_calls $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'fiche') $$,
  'Chaque ligne porte le compte de A et le nom de l’action, rien d’autre'
);

-- ---------------------------------------------------------------------------
-- 3. Le journal ne se trafique pas, même avec la session de A
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.ai_calls (action, occurred_at) values ('fiche', now() - interval '2 days') $$,
  '42501', null,
  'A ne peut pas ajouter une ligne antidatée'
);
select throws_ok(
  $$ insert into public.ai_calls (user_id, action) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'fiche') $$,
  '42501', null,
  'A ne peut pas ajouter une ligne au nom de B'
);
select lives_ok(
  $$ update public.ai_calls set occurred_at = now() - interval '2 days' $$,
  'La modification tentée par A ne touche rien'
);
select lives_ok(
  $$ delete from public.ai_calls $$,
  'La suppression tentée par A ne touche rien'
);
select is(public.reserver_appel_ia('fiche', 3), false, 'Après ces tentatives, la limite de A tient toujours');

select throws_ok(
  $$ select public.reserver_appel_ia('fiche', 0) $$,
  '22023', null,
  'Une limite nulle est refusée'
);
select throws_ok(
  $$ select public.reserver_appel_ia('fiche', null) $$,
  '22023', null,
  'Une limite absente est refusée'
);
select throws_ok(
  $$ select public.reserver_appel_ia('Fiche; drop table', 30) $$,
  '23514', null,
  'Un nom d’action mal formé est refusé'
);

-- ---------------------------------------------------------------------------
-- 4. Le compte B a sa propre limite et ne voit rien de A
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is_empty('select 1 from public.ai_calls', 'B ne voit aucune ligne du journal de A');
select is(public.reserver_appel_ia('fiche', 1), true, 'Les appels de A ne comptent pas pour B');
select is(public.reserver_appel_ia('fiche', 1), false, 'B atteint sa propre limite');

-- Contre-épreuve : RLS coupée un instant, la fonction ne compte toujours que les lignes de l'appelant.
reset role;
alter table public.ai_calls disable row level security;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select results_eq(
  'select count(*)::int from public.ai_calls',
  'values (4)',
  'Contre-épreuve : sans RLS, B voit bien les quatre lignes (trois de A, une à lui)'
);
select is(public.reserver_appel_ia('fiche', 2), true, 'Contre-épreuve : sans RLS, seules les lignes de B comptent');
select is(public.reserver_appel_ia('fiche', 2), false, 'Contre-épreuve : et la limite de B tient');

reset role;
alter table public.ai_calls enable row level security;

-- ---------------------------------------------------------------------------
-- 5. La limite porte sur les dernières 24 heures
-- ---------------------------------------------------------------------------

update public.ai_calls
set occurred_at = now() - interval '25 hours'
where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is(public.reserver_appel_ia('fiche', 1), true, 'Les appels de plus de 24 heures ne comptent plus');

-- ---------------------------------------------------------------------------
-- 6. Sans compte connecté
-- ---------------------------------------------------------------------------

set local role anon;
set local request.jwt.claim.sub = '';

select throws_ok(
  $$ select public.reserver_appel_ia('fiche', 30) $$,
  '42501', null,
  'Le visiteur non connecté ne peut pas réserver d’appel'
);

set local role authenticated;

select throws_ok(
  $$ select public.reserver_appel_ia('fiche', 30) $$,
  '28000', null,
  'Sans identité, la fonction refuse'
);

-- ---------------------------------------------------------------------------
-- 7. Une couverture ne se range que dans le dossier de son compte
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

insert into public.works (id, title_fr, form, is_series)
values ('a0000000-0000-4000-8000-000000000001', 'Série d’essai', 'manga', true);
insert into public.editions (id, work_id)
values ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001');
insert into public.volumes (work_id, number)
values ('a0000000-0000-4000-8000-000000000001', 1);

select lives_ok(
  $$ update public.works set cover_path = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef.jpg' $$,
  'A range la couverture de son œuvre dans son dossier'
);
select lives_ok(
  $$ update public.editions set cover_path = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef.png' $$,
  'A range la couverture de son édition dans son dossier'
);
select lives_ok(
  $$ update public.volumes set cover_path = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef.webp' $$,
  'A range la couverture de son tome dans son dossier'
);
select throws_ok(
  $$ update public.works set cover_path = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/0123456789abcdef0123456789abcdef.jpg' $$,
  '23514', null,
  'Une œuvre de A ne peut pas pointer vers le dossier de B'
);
select throws_ok(
  $$ update public.editions set cover_path = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/0123456789abcdef0123456789abcdef.jpg' $$,
  '23514', null,
  'Une édition de A ne peut pas pointer vers le dossier de B'
);
select throws_ok(
  $$ update public.volumes set cover_path = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/0123456789abcdef0123456789abcdef.jpg' $$,
  '23514', null,
  'Un tome de A ne peut pas pointer vers le dossier de B'
);
select throws_ok(
  $$ update public.works set cover_path = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/../bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/x.jpg' $$,
  '23514', null,
  'Un chemin qui remonte vers un autre dossier est refusé'
);
select throws_ok(
  $$ update public.works set cover_path = 'https://exemple.test/image.jpg' $$,
  '23514', null,
  'Une adresse extérieure n’est pas un chemin de couverture'
);
select throws_ok(
  $$ update public.works set cover_path = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef.svg' $$,
  '23514', null,
  'Seules les images jpg, png et webp sont acceptées'
);
select lives_ok(
  $$ update public.works set cover_path = null $$,
  'A retire la couverture de son œuvre'
);

-- La fonction du formulaire garde les couvertures de ce qu'elle ne supprime pas.
update public.works set cover_path = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef.jpg';
select lives_ok(
  $$ select public.enregistrer_oeuvre('{
    "id": "a0000000-0000-4000-8000-000000000001",
    "title_fr": "Série d’essai, titre corrigé", "form": "manga", "is_series": true,
    "authors": [], "tags": [], "media": [],
    "editions": [{ "id": "a0000000-0000-4000-8000-000000000002", "publisher": "Éditeur d’essai" }],
    "volumes": [{ "number": 1, "title": "Premier tome" }, { "number": 2 }]
  }'::jsonb) $$,
  'A modifie la fiche depuis le formulaire'
);
select results_eq(
  $$ select cover_path from public.works $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef.jpg') $$,
  'La couverture de l’œuvre survit à une modification de la fiche'
);
select results_eq(
  $$ select cover_path from public.editions $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef.png') $$,
  'La couverture de l’édition gardée survit aussi'
);
select results_eq(
  $$ select number, cover_path from public.volumes order by number $$,
  $$ values (1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/0123456789abcdef0123456789abcdef.webp'), (2, null) $$,
  'La couverture du tome gardé survit, le nouveau tome n’en a pas'
);

reset role;

select * from finish();
rollback;
