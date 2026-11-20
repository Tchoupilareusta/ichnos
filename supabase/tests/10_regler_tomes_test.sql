-- Tests de la fonction regler_tomes (migration 20261120100000_regler_tomes) :
-- changer plusieurs tomes d'une série d'un seul geste, et « Annuler ». Comptes et œuvres fictifs.

begin;
create extension if not exists pgtap with schema extensions;

select plan(47);

-- ---------------------------------------------------------------------------
-- 1. Droits : le compte connecté seul, sans droits supérieurs
-- ---------------------------------------------------------------------------

select ok(has_function_privilege('authenticated', 'public.regler_tomes(uuid, jsonb)', 'execute'),
  'regler_tomes est appelable par le compte connecté');
select ok(not has_function_privilege('anon', 'public.regler_tomes(uuid, jsonb)', 'execute'),
  'regler_tomes est fermée au rôle anon');
select ok(not has_function_privilege('service_role', 'public.regler_tomes(uuid, jsonb)', 'execute'),
  'regler_tomes est fermée au rôle service_role');
select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'regler_tomes'
       and exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE') $$,
  'regler_tomes est fermée à public'
);
select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'regler_tomes' and p.prosecdef $$,
  'regler_tomes s’exécute avec les droits de l’appelant (security invoker)'
);

-- ---------------------------------------------------------------------------
-- Décor : deux comptes. A a une série de cinq tomes et un roman ; B a sa propre série.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@exemple.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@exemple.test');

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

insert into public.works (id, title_fr, form, is_series) values ('b0000000-0000-4000-8000-000000000001', 'Série de B', 'manga', true);
insert into public.library_entries (work_id) values ('b0000000-0000-4000-8000-000000000001');
insert into public.volumes (work_id, number) values ('b0000000-0000-4000-8000-000000000001', 1), ('b0000000-0000-4000-8000-000000000001', 2);

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

insert into public.works (id, title_fr, form, is_series) values ('a0000000-0000-4000-8000-000000000001', 'Série d’essai', 'manga', true);
insert into public.library_entries (id, work_id, reading_status, started_at)
values ('a0000000-0000-4000-8000-0000000000f1', 'a0000000-0000-4000-8000-000000000001', 'en_cours', '2026-03-03');
insert into public.reading_events (entry_id, kind, value)
values ('a0000000-0000-4000-8000-0000000000f1', 'commence', null), ('a0000000-0000-4000-8000-0000000000f1', 'progression', 2);
insert into public.volumes (work_id, number, title, isbn, reading_status, ownership, cover_path)
values
  ('a0000000-0000-4000-8000-000000000001', 1, 'Le début', '9782351420010', 'lu', 'possede',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1.jpg'),
  ('a0000000-0000-4000-8000-000000000001', 2, null, null, 'en_cours', 'possede', null),
  ('a0000000-0000-4000-8000-000000000001', 3, null, null, 'a_lire', 'a_acheter', null),
  ('a0000000-0000-4000-8000-000000000001', 4, null, null, 'a_lire', 'non_possede', null),
  ('a0000000-0000-4000-8000-000000000001', 5, null, null, 'a_lire', 'non_possede', null);

insert into public.works (id, title_fr, form) values ('a0000000-0000-4000-8000-000000000002', 'Roman d’essai', 'roman');
insert into public.library_entries (work_id) values ('a0000000-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------------------
-- 2. Appliquer un choix à une sélection de tomes dispersés
-- ---------------------------------------------------------------------------

select is(
  public.regler_tomes('a0000000-0000-4000-8000-000000000001',
    '[{"numero": 1, "possession": "possede"}, {"numero": 3, "possession": "possede"}, {"numero": 5, "possession": "possede"}]'::jsonb),
  2,
  'Trois tomes sélectionnés, deux changent vraiment : la fonction rend 2'
);
select results_eq(
  $$ select number, ownership, reading_status from public.volumes
     where work_id = 'a0000000-0000-4000-8000-000000000001' order by number $$,
  $$ values (1, 'possede'::text, 'lu'::text), (2, 'possede', 'en_cours'), (3, 'possede', 'a_lire'),
            (4, 'non_possede', 'a_lire'), (5, 'possede', 'a_lire') $$,
  'Seuls les tomes sélectionnés changent de possession ; leur lecture ne bouge pas'
);

-- « En cours » sur plusieurs tomes : appliqué tel quel, sans cascade.
select is(
  public.regler_tomes('a0000000-0000-4000-8000-000000000001',
    '[{"numero": 4, "lecture": "en_cours"}, {"numero": 5, "lecture": "en_cours"}]'::jsonb),
  2,
  'Deux tomes passent « en cours »'
);
select results_eq(
  $$ select number, reading_status from public.volumes
     where work_id = 'a0000000-0000-4000-8000-000000000001' order by number $$,
  $$ values (1, 'lu'::text), (2, 'en_cours'), (3, 'a_lire'), (4, 'en_cours'), (5, 'en_cours') $$,
  'Aucune cascade : le tome 3, avant eux, reste « à lire », et le tome 2 reste « en cours »'
);

-- Rien à changer : rien n'est réécrit.
select is(
  public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[{"numero": 1, "lecture": "lu"}, {"numero": 2, "possession": "possede"}]'::jsonb),
  0,
  'Des tomes déjà dans l’état demandé : la fonction rend 0'
);

-- ---------------------------------------------------------------------------
-- 3. « Annuler » : chaque tome retrouve son état, possession et lecture ensemble
-- ---------------------------------------------------------------------------

select is(
  public.regler_tomes('a0000000-0000-4000-8000-000000000001',
    '[{"numero": 1, "possession": "possede", "lecture": "lu"}, {"numero": 2, "possession": "possede", "lecture": "en_cours"},
      {"numero": 3, "possession": "a_acheter", "lecture": "a_lire"}, {"numero": 4, "possession": "non_possede", "lecture": "a_lire"},
      {"numero": 5, "possession": "non_possede", "lecture": "a_lire"}]'::jsonb),
  3,
  'L’état d’avant, tome par tome : trois tomes reviennent en arrière'
);
select results_eq(
  $$ select number, ownership, reading_status from public.volumes
     where work_id = 'a0000000-0000-4000-8000-000000000001' order by number $$,
  $$ values (1, 'possede'::text, 'lu'::text), (2, 'possede', 'en_cours'), (3, 'a_acheter', 'a_lire'),
            (4, 'non_possede', 'a_lire'), (5, 'non_possede', 'a_lire') $$,
  'Chaque tome a retrouvé exactement son état de départ'
);

-- ---------------------------------------------------------------------------
-- 4. Rien d'autre ne change
-- ---------------------------------------------------------------------------

select results_eq(
  $$ select number, title, isbn, cover_path from public.volumes
     where work_id = 'a0000000-0000-4000-8000-000000000001' and number = 1 $$,
  $$ values (1, 'Le début'::text, '9782351420010'::text, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1.jpg'::text) $$,
  'Le titre, l’ISBN et la couverture d’un tome ne bougent pas'
);
select results_eq(
  $$ select reading_status, ownership, started_at, finished_at from public.library_entries
     where work_id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values ('en_cours'::text, 'non_possede'::text, '2026-03-03'::date, null::date) $$,
  'Le statut de la série et ses dates ne bougent pas'
);
select results_eq(
  $$ select kind, value from public.reading_events where entry_id = 'a0000000-0000-4000-8000-0000000000f1' order by kind $$,
  $$ values ('commence'::text, null::integer), ('progression', 2) $$,
  'L’historique est intact : aucun événement ajouté'
);

-- ---------------------------------------------------------------------------
-- 5. Ce qui est refusé, et ne laisse aucune trace
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[]'::jsonb) $$,
  'EO001', null, 'Une liste vide est refusée'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', null) $$,
  'EO001', null, 'Des changements absents sont refusés'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '{"numero": 1, "lecture": "lu"}'::jsonb) $$,
  'EO001', null, 'Un objet seul, hors d’une liste, est refusé'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001',
       (select jsonb_agg(jsonb_build_object('numero', n, 'lecture', 'lu')) from generate_series(1, 1001) as n)) $$,
  'EO001', null, 'Plus de 1000 tomes à la fois est refusé'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '["1"]'::jsonb) $$,
  'EO001', null, 'Un élément qui n’est pas un objet est refusé'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[{"numero": 1, "lecture": "lu", "isbn": "9782253004226"}]'::jsonb) $$,
  'EO001', null, 'Un champ inconnu fait tout refuser : rien d’autre que la possession et la lecture ne peut passer'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[{"lecture": "lu"}]'::jsonb) $$,
  'EO001', null, 'Un changement sans numéro est refusé'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[{"numero": "1", "lecture": "lu"}]'::jsonb) $$,
  'EO001', null, 'Un numéro qui n’est pas un nombre est refusé'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[{"numero": 1.5, "lecture": "lu"}]'::jsonb) $$,
  'EO001', null, 'Un numéro qui n’est pas entier est refusé'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[{"numero": 0, "lecture": "lu"}]'::jsonb) $$,
  'EO001', null, 'Un numéro nul est refusé'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[{"numero": 99999999999, "lecture": "lu"}]'::jsonb) $$,
  'EO001', null, 'Un numéro démesuré est refusé'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[{"numero": 1}]'::jsonb) $$,
  'EO001', null, 'Un tome sans rien à changer est refusé'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[{"numero": 1, "possession": "emprunte"}]'::jsonb) $$,
  'EO001', null, 'Une possession inconnue est refusée'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[{"numero": 1, "lecture": "abandonne"}]'::jsonb) $$,
  'EO001', null, 'Une lecture inconnue est refusée'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[{"numero": 1, "lecture": null}]'::jsonb) $$,
  'EO001', null, 'Une lecture vide est refusée'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001',
       '[{"numero": 3, "lecture": "lu"}, {"numero": 3, "lecture": "a_lire"}]'::jsonb) $$,
  'EO001', null, 'Un tome en double est refusé'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000002', '[{"numero": 1, "lecture": "lu"}]'::jsonb) $$,
  'EO001', null, 'Une œuvre qui n’est pas une série est refusée'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-00000000dead', '[{"numero": 1, "lecture": "lu"}]'::jsonb) $$,
  'EO002', null, 'Une œuvre qui n’existe pas est introuvable'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001',
       '[{"numero": 3, "lecture": "lu"}, {"numero": 4, "lecture": "lu"}, {"numero": 6, "lecture": "lu"}]'::jsonb) $$,
  'EO002', null, 'Un seul tome qui n’existe pas fait tout refuser'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001',
       '[{"numero": 3, "lecture": "lu"}, {"numero": 4, "possession": "emprunte"}]'::jsonb) $$,
  'EO001', null, 'Une seule valeur fausse dans la liste fait tout refuser'
);
select results_eq(
  $$ select number, ownership, reading_status from public.volumes
     where work_id = 'a0000000-0000-4000-8000-000000000001' order by number $$,
  $$ values (1, 'possede'::text, 'lu'::text), (2, 'possede', 'en_cours'), (3, 'a_acheter', 'a_lire'),
            (4, 'non_possede', 'a_lire'), (5, 'non_possede', 'a_lire') $$,
  'Les changements refusés ne laissent aucune trace : tout ou rien'
);

-- ---------------------------------------------------------------------------
-- 6. B ne peut pas changer les tomes de A
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[{"numero": 1, "possession": "non_possede"}]'::jsonb) $$,
  'EO002', null, 'Pour B, la série de A est introuvable'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000002', '[{"numero": 1, "lecture": "lu"}]'::jsonb) $$,
  'EO002', null, 'B n’apprend pas que le roman de A n’est pas une série : il est introuvable, pas « incohérent »'
);
select is(
  public.regler_tomes('b0000000-0000-4000-8000-000000000001', '[{"numero": 1, "lecture": "lu"}, {"numero": 2, "lecture": "lu"}]'::jsonb),
  2,
  'B peut changer ses propres tomes'
);

-- ---------------------------------------------------------------------------
-- 7. Contre-épreuve : sans RLS, la fonction refuse encore
-- ---------------------------------------------------------------------------

reset role;
alter table public.works disable row level security;
alter table public.volumes disable row level security;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select results_eq(
  $$ select count(*)::int from public.volumes where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  $$ values (5) $$,
  'Contre-épreuve : sans RLS, B voit bien les tomes de A (la RLS est vraiment coupée)'
);
select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[{"numero": 1, "possession": "non_possede"}]'::jsonb) $$,
  'EO002', null, 'Sans RLS, regler_tomes refuse encore la série d’un autre compte'
);
-- Même avec sa propre série, B ne peut pas atteindre les tomes de A qui portent les mêmes numéros.
select is(
  public.regler_tomes('b0000000-0000-4000-8000-000000000001', '[{"numero": 1, "possession": "possede"}, {"numero": 2, "possession": "possede"}]'::jsonb),
  2,
  'Sans RLS, B change ses deux tomes, et seulement les siens'
);

reset role;
select results_eq(
  $$ select number, ownership, reading_status from public.volumes
     where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' order by number $$,
  $$ values (1, 'possede'::text, 'lu'::text), (2, 'possede', 'en_cours'), (3, 'a_acheter', 'a_lire'),
            (4, 'non_possede', 'a_lire'), (5, 'non_possede', 'a_lire') $$,
  'Les tomes de A n’ont pas bougé'
);
select results_eq(
  $$ select number, ownership, reading_status from public.volumes
     where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' order by number $$,
  $$ values (1, 'possede'::text, 'lu'::text), (2, 'possede', 'lu') $$,
  'Les tomes de B ont changé comme demandé'
);

alter table public.works enable row level security;
alter table public.volumes enable row level security;

-- ---------------------------------------------------------------------------
-- 8. Sans compte connecté
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '';

select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[{"numero": 1, "lecture": "lu"}]'::jsonb) $$,
  '28000', null, 'regler_tomes demande une connexion'
);

reset role;
set local role anon;

select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[{"numero": 1, "lecture": "lu"}]'::jsonb) $$,
  '42501', null, 'Le rôle anon ne peut pas appeler regler_tomes'
);

reset role;
set local role service_role;

select throws_ok(
  $$ select public.regler_tomes('a0000000-0000-4000-8000-000000000001', '[{"numero": 1, "lecture": "lu"}]'::jsonb) $$,
  '42501', null, 'Le rôle service_role ne peut pas appeler regler_tomes'
);

select * from finish();
rollback;
