-- Tests du suivi de lecture (migration 20261119100000_suivi_lecture) :
-- changer_statut, noter_progression et dater_fin. Comptes et œuvres fictifs.

begin;
create extension if not exists pgtap with schema extensions;

select plan(102);

-- ---------------------------------------------------------------------------
-- 1. Droits : le compte connecté seul, sans droits supérieurs
-- ---------------------------------------------------------------------------

select ok(has_function_privilege('authenticated', 'public.changer_statut(uuid, text)', 'execute'),
  'changer_statut est appelable par le compte connecté');
select ok(not has_function_privilege('anon', 'public.changer_statut(uuid, text)', 'execute'),
  'changer_statut est fermée au rôle anon');
select ok(not has_function_privilege('service_role', 'public.changer_statut(uuid, text)', 'execute'),
  'changer_statut est fermée au rôle service_role');
select ok(has_function_privilege('authenticated', 'public.noter_progression(uuid, integer)', 'execute'),
  'noter_progression est appelable par le compte connecté');
select ok(not has_function_privilege('anon', 'public.noter_progression(uuid, integer)', 'execute'),
  'noter_progression est fermée au rôle anon');
select ok(not has_function_privilege('service_role', 'public.noter_progression(uuid, integer)', 'execute'),
  'noter_progression est fermée au rôle service_role');
select ok(has_function_privilege('authenticated', 'public.dater_fin(uuid, date, text)', 'execute'),
  'dater_fin est appelable par le compte connecté');
select ok(not has_function_privilege('anon', 'public.dater_fin(uuid, date, text)', 'execute'),
  'dater_fin est fermée au rôle anon');
select ok(not has_function_privilege('service_role', 'public.dater_fin(uuid, date, text)', 'execute'),
  'dater_fin est fermée au rôle service_role');
select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('changer_statut', 'noter_progression', 'dater_fin')
       and (p.prosecdef or exists (
         select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')) $$,
  'Les trois fonctions s’exécutent avec les droits de l’appelant et sont fermées à public'
);

-- ---------------------------------------------------------------------------
-- 2. Deux comptes et leurs œuvres d'essai
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@exemple.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@exemple.test');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- A : un roman (unité page, 230 pages), un livre lu autrefois, une série de trois tomes.
insert into public.works (id, title_fr, form, is_series)
values
  ('a0000000-0000-4000-8000-000000000001', 'Roman d’essai', 'roman', false),
  ('a0000000-0000-4000-8000-000000000002', 'Livre lu autrefois', 'roman', false),
  ('a0000000-0000-4000-8000-000000000003', 'Série d’essai', 'manga', true),
  ('a0000000-0000-4000-8000-000000000004', 'Essai sans historique', 'essai', false);
insert into public.library_entries (work_id, progress_unit, progress_total)
values
  ('a0000000-0000-4000-8000-000000000001', 'page', 230),
  ('a0000000-0000-4000-8000-000000000002', null, null),
  ('a0000000-0000-4000-8000-000000000003', null, null),
  ('a0000000-0000-4000-8000-000000000004', 'lettre', null);
insert into public.volumes (work_id, number)
values
  ('a0000000-0000-4000-8000-000000000003', 1),
  ('a0000000-0000-4000-8000-000000000003', 2),
  ('a0000000-0000-4000-8000-000000000003', 3);

-- Raccourcis de lecture (comme le compte A).
create temporary view essai_entree as
  select w.title_fr, le.*
  from public.library_entries le join public.works w on w.id = le.work_id;
create temporary view essai_evenements as
  select w.title_fr, ev.kind, ev.value, ev.occurred_at, ev.date_precision
  from public.reading_events ev
  join public.library_entries le on le.id = ev.entry_id
  join public.works w on w.id = le.work_id;

-- B : une œuvre à lui.
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
insert into public.works (id, title_fr, form) values ('b0000000-0000-4000-8000-000000000001', 'Œuvre de B', 'roman');
insert into public.library_entries (work_id) values ('b0000000-0000-4000-8000-000000000001');

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- ---------------------------------------------------------------------------
-- 3. Refus de base
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000001', 'abandonne') $$,
  'EO001', null, 'Un statut inconnu est refusé'
);
select throws_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000001', null) $$,
  'EO001', null, 'Un statut vide est refusé'
);
select throws_ok(
  $$ select public.changer_statut('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'en_cours') $$,
  'EO002', null, 'Une œuvre inconnue est introuvable'
);
select throws_ok(
  $$ select public.changer_statut('b0000000-0000-4000-8000-000000000001', 'en_cours') $$,
  'EO002', null, 'L’œuvre d’un autre compte est introuvable pour changer_statut'
);
select throws_ok(
  $$ select public.noter_progression('b0000000-0000-4000-8000-000000000001', 3) $$,
  'EO002', null, 'L’œuvre d’un autre compte est introuvable pour noter_progression'
);
select throws_ok(
  $$ select public.dater_fin('b0000000-0000-4000-8000-000000000001', '2019-01-01', 'annee') $$,
  'EO002', null, 'L’œuvre d’un autre compte est introuvable pour dater_fin'
);

select lives_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000004', 5) $$,
  'Une première progression sans aucun historique est acceptée'
);
select results_eq(
  $$ select kind, value from essai_evenements where title_fr = 'Essai sans historique' $$,
  $$ values ('progression'::text, 5) $$,
  'Elle laisse sa trace'
);

-- ---------------------------------------------------------------------------
-- 4. Commencer, avancer, mettre en pause, reprendre, terminer
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000001', 'en_cours') $$,
  'Je commence le roman'
);
select results_eq(
  $$ select reading_status, started_at, finished_at from essai_entree where title_fr = 'Roman d’essai' $$,
  $$ values ('en_cours'::text, current_date, null::date) $$,
  'Le roman est en cours, commencé aujourd’hui'
);
select results_eq(
  $$ select kind from essai_evenements where title_fr = 'Roman d’essai' order by occurred_at $$,
  $$ values ('commence'::text) $$,
  'Un événement « commencé » est noté'
);

select lives_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000001', 'en_cours') $$,
  'Redemander le même statut ne fait rien'
);
select is((select count(*)::int from essai_evenements where title_fr = 'Roman d’essai'), 1,
  'Le même statut ne note pas d’événement');

select lives_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000001', 75) $$,
  'Je note la page 75'
);
select is((select progress_current from essai_entree where title_fr = 'Roman d’essai'), 75,
  'La position est la page 75');
select lives_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000001', 80) $$,
  'Je note la page 80 le même jour'
);
select results_eq(
  $$ select kind, value from essai_evenements where title_fr = 'Roman d’essai' and kind = 'progression' $$,
  $$ values ('progression'::text, 80) $$,
  'Une seule trace de progression par jour : la dernière position remplace la précédente'
);
select lives_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000001', 80) $$,
  'Noter la même page ne fait rien'
);
select throws_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000001', 231) $$,
  '23514', null, 'Une page au-delà du total est refusée'
);
select throws_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000001', -1) $$,
  '23514', null, 'Une page négative est refusée'
);
select is((select progress_current from essai_entree where title_fr = 'Roman d’essai'), 80,
  'Une progression refusée ne change rien');

select lives_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000001', 'en_pause') $$,
  'Je mets le roman en pause'
);
select results_eq(
  $$ select kind, value from essai_evenements where title_fr = 'Roman d’essai' order by occurred_at desc limit 1 $$,
  $$ values ('mis_en_pause'::text, 80) $$,
  'La mise en pause est notée avec la position'
);
select lives_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000001', 'en_cours') $$,
  'Je reprends le roman'
);
select results_eq(
  $$ select kind, value from essai_evenements where title_fr = 'Roman d’essai' order by occurred_at desc limit 1 $$,
  $$ values ('repris'::text, 80) $$,
  'La reprise est notée « repris », pas « commencé »'
);
select is((select started_at from essai_entree where title_fr = 'Roman d’essai'), current_date,
  'La reprise garde la date de début');

select lives_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000001', 120) $$,
  'Je note la page 120 après la reprise'
);
select is((select count(*)::int from essai_evenements where title_fr = 'Roman d’essai' and kind = 'progression'), 2,
  'Après un autre événement, une nouvelle trace de progression est notée');

select lives_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000001', null) $$,
  'Je vide la progression'
);
select results_eq(
  $$ select progress_current, (select count(*)::int from essai_evenements where title_fr = 'Roman d’essai' and kind = 'progression')
     from essai_entree where title_fr = 'Roman d’essai' $$,
  $$ values (null::integer, 2) $$,
  'Vider la progression ne laisse pas de trace'
);
select lives_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000001', 230) $$,
  'J’arrive à la dernière page'
);

select lives_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000001', 'termine') $$,
  'Je termine le roman'
);
select results_eq(
  $$ select reading_status, finished_at, progress_current from essai_entree where title_fr = 'Roman d’essai' $$,
  $$ values ('termine'::text, current_date, 230) $$,
  'Le roman est terminé aujourd’hui ; la position reste'
);
select results_eq(
  $$ select kind, value from essai_evenements where title_fr = 'Roman d’essai' order by occurred_at desc limit 1 $$,
  $$ values ('termine'::text, 230) $$,
  'La fin est notée « terminé » avec la position'
);

-- ---------------------------------------------------------------------------
-- 5. Relecture
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000001', 'en_cours') $$,
  'Je relis le roman'
);
select results_eq(
  $$ select reading_status, started_at, finished_at, progress_current, progress_unit, progress_total
     from essai_entree where title_fr = 'Roman d’essai' $$,
  $$ values ('en_cours'::text, current_date, null::date, null::integer, 'page'::text, 230) $$,
  'La relecture repart de zéro, avec la même unité et le même total'
);
select results_eq(
  $$ select kind from essai_evenements where title_fr = 'Roman d’essai' order by occurred_at $$,
  $$ values ('commence'::text), ('progression'), ('mis_en_pause'), ('repris'), ('progression'), ('termine'), ('commence') $$,
  'La relecture ouvre une nouvelle lecture ; l’historique de la précédente reste intact'
);

select lives_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000001', 'envie_de_lire') $$,
  'Je repasse le roman en « Envie de lire »'
);
select is((select count(*)::int from essai_evenements where title_fr = 'Roman d’essai'), 7,
  '« Envie de lire » ne note pas d’événement');
select lives_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000001', 'en_cours') $$,
  'Je le reprends'
);
select results_eq(
  $$ select kind from essai_evenements where title_fr = 'Roman d’essai' order by occurred_at desc limit 1 $$,
  $$ values ('repris'::text) $$,
  'La relecture encore ouverte est reprise, sans nouvelle lecture'
);

-- ---------------------------------------------------------------------------
-- 6. Livre lu autrefois : pas de date inventée, date saisie à la main
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.dater_fin('a0000000-0000-4000-8000-000000000002', '2019-05-17', 'annee') $$,
  'EO001', null, 'Un livre qui n’est pas terminé n’a pas de date de fin'
);
select lives_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000002', 'termine') $$,
  'Je marque comme terminé un livre lu autrefois'
);
select results_eq(
  $$ select reading_status, finished_at, (select count(*)::int from essai_evenements where title_fr = 'Livre lu autrefois')
     from essai_entree where title_fr = 'Livre lu autrefois' $$,
  $$ values ('termine'::text, null::date, 0) $$,
  'Sans lecture commencée dans l’appli, ni date ni événement ne sont inventés'
);

select lives_ok(
  $$ select public.dater_fin('a0000000-0000-4000-8000-000000000002', '2019-05-17', 'annee') $$,
  'Je note que je l’ai terminé en 2019'
);
select results_eq(
  $$ select kind, (occurred_at at time zone 'UTC')::date, date_precision from essai_evenements where title_fr = 'Livre lu autrefois' $$,
  $$ values ('termine'::text, '2019-01-01'::date, 'annee'::text) $$,
  '« En 2019 » est noté au 1er janvier 2019, avec la précision « année »'
);
select is((select finished_at from essai_entree where title_fr = 'Livre lu autrefois'), '2019-01-01'::date,
  'La date de fin du livre suit');

select lives_ok(
  $$ select public.dater_fin('a0000000-0000-4000-8000-000000000002', '2019-03-28', 'mois') $$,
  'Je précise : en mars 2019'
);
select results_eq(
  $$ select (occurred_at at time zone 'UTC')::date, date_precision from essai_evenements where title_fr = 'Livre lu autrefois' $$,
  $$ values ('2019-03-01'::date, 'mois'::text) $$,
  'La même date est corrigée, sans nouvel événement'
);

select throws_ok(
  $$ select public.dater_fin('a0000000-0000-4000-8000-000000000002', '2019-03-28', 'semaine') $$,
  'EO001', null, 'Une précision inconnue est refusée'
);
select throws_ok(
  $$ select public.dater_fin('a0000000-0000-4000-8000-000000000002', current_date + 30, 'jour') $$,
  'EO001', null, 'Une date de fin à venir est refusée'
);

select lives_ok(
  $$ select public.dater_fin('a0000000-0000-4000-8000-000000000002', null, null) $$,
  'Je retire la date de fin'
);
select results_eq(
  $$ select finished_at, (select count(*)::int from essai_evenements where title_fr = 'Livre lu autrefois')
     from essai_entree where title_fr = 'Livre lu autrefois' $$,
  $$ values (null::date, 0) $$,
  'Retirer la date efface la date et sa trace'
);

-- La relecture d'un livre daté à la main garde la date approximative de la première lecture.
select lives_ok(
  $$ select public.dater_fin('a0000000-0000-4000-8000-000000000002', '2019-01-01', 'annee') $$,
  'Je remets « en 2019 »'
);
select lives_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000002', 'en_cours') $$,
  'Je le relis'
);
select results_eq(
  $$ select kind, date_precision from essai_evenements where title_fr = 'Livre lu autrefois' order by occurred_at $$,
  $$ values ('termine'::text, 'annee'::text), ('commence', 'jour') $$,
  'La première lecture reste « en 2019 » ; la relecture commence'
);
select lives_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000002', 'termine') $$,
  'Je termine la relecture'
);
select throws_ok(
  $$ select public.dater_fin('a0000000-0000-4000-8000-000000000002', '2020-06-01', 'jour') $$,
  'EO001', null, 'La fin d’une lecture ne peut pas précéder son début'
);
select lives_ok(
  $$ select public.dater_fin('a0000000-0000-4000-8000-000000000002', current_date, 'annee') $$,
  'Je dis seulement que la relecture s’est terminée cette année'
);
select results_eq(
  $$ select kind, date_precision from essai_evenements where title_fr = 'Livre lu autrefois' order by occurred_at $$,
  $$ values ('termine'::text, 'annee'::text), ('commence', 'jour'), ('termine', 'annee') $$,
  'Seule la fin de la relecture change, jamais avant son début'
);
select ok(
  (select max(occurred_at) filter (where kind = 'termine') > max(occurred_at) filter (where kind = 'commence')
   from essai_evenements where title_fr = 'Livre lu autrefois'),
  'La fin approximative reste placée après le début dans l’historique'
);

select throws_ok(
  $$ insert into public.reading_events (entry_id, kind, value, date_precision)
     select id, 'progression', 3, 'mois' from essai_entree where title_fr = 'Roman d’essai' $$,
  '23514', null, 'Seule une date de fin peut être approximative'
);

-- ---------------------------------------------------------------------------
-- 7. Série : la progression vient des tomes
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000003', 9) $$,
  'EO002', null, 'Un tome qui n’existe pas est introuvable'
);
select throws_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000003', null) $$,
  'EO001', null, 'Une série attend un numéro de tome'
);
select lives_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000003', 'en_cours') $$,
  'Je commence la série'
);
select lives_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000003', 2) $$,
  'J’en suis au tome 2'
);
select results_eq(
  $$ select number, reading_status from public.volumes where work_id = 'a0000000-0000-4000-8000-000000000003' order by number $$,
  $$ values (1, 'lu'::text), (2, 'en_cours'), (3, 'a_lire') $$,
  'Tome 2 en cours, le tome 1 passe lu, le tome 3 ne change pas'
);
select results_eq(
  $$ select progress_current from essai_entree where title_fr = 'Série d’essai' $$,
  $$ values (null::integer) $$,
  'La progression d’une série n’est pas enregistrée une seconde fois'
);
select lives_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000003', 3) $$,
  'J’en suis au tome 3'
);
select lives_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000003', 2) $$,
  'Je reviens au tome 2'
);
select results_eq(
  $$ select number, reading_status from public.volumes where work_id = 'a0000000-0000-4000-8000-000000000003' order by number $$,
  $$ values (1, 'lu'::text), (2, 'en_cours'), (3, 'a_lire') $$,
  'Revenir en arrière remet le tome suivant à lire'
);
select results_eq(
  $$ select kind, value from essai_evenements where title_fr = 'Série d’essai' and kind = 'progression' $$,
  $$ values ('progression'::text, 2) $$,
  'La trace de la série porte le numéro du tome, une fois par jour'
);
select lives_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000003', 2) $$,
  'Noter le même tome ne fait rien'
);

select lives_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000003', 'en_pause') $$,
  'Je mets la série en pause'
);
select results_eq(
  $$ select kind, value from essai_evenements where title_fr = 'Série d’essai' order by occurred_at desc limit 1 $$,
  $$ values ('mis_en_pause'::text, 2) $$,
  'La pause d’une série garde le tome courant'
);
select lives_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000003', 'termine') $$,
  'Je termine la série depuis la pause'
);
select lives_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000003', 'en_cours') $$,
  'Je relis la série'
);
select results_eq(
  $$ select distinct reading_status from public.volumes where work_id = 'a0000000-0000-4000-8000-000000000003' $$,
  $$ values ('a_lire'::text) $$,
  'À la relecture d’une série, ses tomes repassent à lire'
);

-- ---------------------------------------------------------------------------
-- 8. Rien n'a bougé chez B, et B ne voit rien de A
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select results_eq(
  $$ select reading_status, (select count(*)::int from public.reading_events) from public.library_entries $$,
  $$ values ('a_decouvrir'::text, 0) $$,
  'B ne voit que sa propre œuvre, intacte, et aucun historique de A'
);

-- ---------------------------------------------------------------------------
-- 9. Les contrôles des fonctions tiennent même sans la RLS
--    (deuxième serrure : la RLS est coupée le temps de ce test, puis tout est annulé)
-- ---------------------------------------------------------------------------

reset role;
alter table public.library_entries disable row level security;
alter table public.works disable row level security;
alter table public.volumes disable row level security;
alter table public.reading_events disable row level security;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select throws_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000001', 'en_pause') $$,
  'EO002', null, 'Sans RLS, changer_statut refuse encore l’œuvre d’un autre compte'
);
select throws_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000001', 10) $$,
  'EO002', null, 'Sans RLS, noter_progression refuse encore l’œuvre d’un autre compte'
);
select throws_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000003', 3) $$,
  'EO002', null, 'Sans RLS, noter_progression refuse encore la série d’un autre compte'
);
select throws_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000002', 'en_pause') $$,
  'EO002', null, 'Sans RLS, changer_statut refuse encore un livre terminé d’un autre compte'
);
select throws_ok(
  $$ select public.dater_fin('a0000000-0000-4000-8000-000000000002', null, null) $$,
  'EO002', null, 'Sans RLS, dater_fin refuse encore l’œuvre d’un autre compte'
);

reset role;
select results_eq(
  $$ select w.title_fr, le.reading_status, le.progress_current
     from public.library_entries le join public.works w on w.id = le.work_id
     where w.user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' order by w.title_fr $$,
  $$ values ('Essai sans historique'::text, 'a_decouvrir'::text, 5),
            ('Livre lu autrefois', 'termine', null::integer),
            ('Roman d’essai', 'en_cours', null),
            ('Série d’essai', 'en_cours', null) $$,
  'Les lectures de A n’ont pas bougé'
);
select results_eq(
  $$ select count(*)::int from public.volumes where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and reading_status <> 'a_lire' $$,
  $$ values (0) $$,
  'Les tomes de A n’ont pas bougé'
);

-- ---------------------------------------------------------------------------
-- 10. Sans compte connecté
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '';

select throws_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000001', 'en_pause') $$,
  '28000', null, 'changer_statut demande une connexion'
);
select throws_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000001', 1) $$,
  '28000', null, 'noter_progression demande une connexion'
);
select throws_ok(
  $$ select public.dater_fin('a0000000-0000-4000-8000-000000000001', null, null) $$,
  '28000', null, 'dater_fin demande une connexion'
);

reset role;
set local role anon;

select throws_ok(
  $$ select public.changer_statut('a0000000-0000-4000-8000-000000000001', 'en_pause') $$,
  '42501', null, 'Le rôle anon ne peut pas appeler changer_statut'
);
select throws_ok(
  $$ select public.noter_progression('a0000000-0000-4000-8000-000000000001', 1) $$,
  '42501', null, 'Le rôle anon ne peut pas appeler noter_progression'
);
select throws_ok(
  $$ select public.dater_fin('a0000000-0000-4000-8000-000000000001', null, null) $$,
  '42501', null, 'Le rôle anon ne peut pas appeler dater_fin'
);

select * from finish();
rollback;
