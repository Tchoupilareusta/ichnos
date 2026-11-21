-- Tests des fonctions mettre_idee_de_cote et reprendre_idee (migration 20261121100000_idees_de_cote) :
-- « Pas maintenant » sur une proposition, et « Annuler ». Comptes et œuvres fictifs.

begin;
create extension if not exists pgtap with schema extensions;

select plan(47);

-- ---------------------------------------------------------------------------
-- 1. Droits : le compte connecté seul, sans droits supérieurs
-- ---------------------------------------------------------------------------

select ok(has_function_privilege('authenticated', 'public.mettre_idee_de_cote(uuid, text)', 'execute'),
  'mettre_idee_de_cote est appelable par le compte connecté');
select ok(not has_function_privilege('anon', 'public.mettre_idee_de_cote(uuid, text)', 'execute'),
  'mettre_idee_de_cote est fermée au rôle anon');
select ok(not has_function_privilege('service_role', 'public.mettre_idee_de_cote(uuid, text)', 'execute'),
  'mettre_idee_de_cote est fermée au rôle service_role');
select ok(has_function_privilege('authenticated', 'public.reprendre_idee(uuid)', 'execute'),
  'reprendre_idee est appelable par le compte connecté');
select ok(not has_function_privilege('anon', 'public.reprendre_idee(uuid)', 'execute'),
  'reprendre_idee est fermée au rôle anon');
select ok(not has_function_privilege('service_role', 'public.reprendre_idee(uuid)', 'execute'),
  'reprendre_idee est fermée au rôle service_role');
select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('mettre_idee_de_cote', 'reprendre_idee')
       and exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE') $$,
  'Les deux fonctions sont fermées à public'
);
select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('mettre_idee_de_cote', 'reprendre_idee') and p.prosecdef $$,
  'Les deux fonctions s’exécutent avec les droits de l’appelant (security invoker)'
);
select results_eq(
  $$ select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('mettre_idee_de_cote', 'reprendre_idee') $$,
  $$ values (2) $$,
  'Contre-épreuve : les deux fonctions existent bien sous ces noms'
);

-- ---------------------------------------------------------------------------
-- Décor : deux comptes. A a deux romans, dont un en cours avec son historique et une note ;
-- B a son propre roman, déjà mis de côté.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@exemple.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@exemple.test');

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

insert into public.works (id, title_fr, form) values ('b0000000-0000-4000-8000-000000000001', 'Roman de B', 'roman');
insert into public.library_entries (work_id) values ('b0000000-0000-4000-8000-000000000001');
select isnt(
  public.mettre_idee_de_cote('b0000000-0000-4000-8000-000000000001', 'surprise'), null,
  'B met son propre roman de côté'
);

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

insert into public.works (id, title_fr, form) values ('a0000000-0000-4000-8000-000000000001', 'Roman d’essai', 'roman');
insert into public.library_entries (id, work_id, reading_status, ownership, progress_unit, progress_current, progress_total, appreciation, started_at)
values ('a0000000-0000-4000-8000-0000000000f1', 'a0000000-0000-4000-8000-000000000001', 'en_pause', 'possede', 'page', 40, 200, 'beau_moment', '2026-03-03');
insert into public.reading_events (entry_id, kind, value)
values ('a0000000-0000-4000-8000-0000000000f1', 'commence', null), ('a0000000-0000-4000-8000-0000000000f1', 'mis_en_pause', 40);
insert into public.notes (work_id, kind, body) values ('a0000000-0000-4000-8000-000000000001', 'citation', 'Une phrase notée.');

insert into public.works (id, title_fr, form) values ('a0000000-0000-4000-8000-000000000002', 'Autre roman', 'roman');
insert into public.library_entries (work_id) values ('a0000000-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------------------
-- 2. Mettre de côté : une ligne, datée par la base
-- ---------------------------------------------------------------------------

select is_empty(
  $$ select 1 from public.recommendation_log $$,
  'Au départ, A n’a rien de côté (et ne voit pas la mise de côté de B)'
);
select is(
  public.mettre_idee_de_cote('a0000000-0000-4000-8000-000000000001', 'surprise'),
  now(),
  'La fonction rend la date de mise de côté : celle de la base'
);
select results_eq(
  $$ select work_id, mode, response, reason, shown_at = now(), user_id from public.recommendation_log $$,
  $$ values ('a0000000-0000-4000-8000-000000000001'::uuid, 'surprise'::text, 'ignoree'::text, null::text, true,
             'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid) $$,
  'Une ligne : l’œuvre, l’envie, « ignorée », la date, à mon nom'
);

-- Une seconde mise de côté de la même œuvre remplace la première.
select isnt(
  public.mettre_idee_de_cote('a0000000-0000-4000-8000-000000000001', 'reconfortant'), null,
  'La même œuvre est mise de côté une seconde fois'
);
select results_eq(
  $$ select work_id, mode from public.recommendation_log $$,
  $$ values ('a0000000-0000-4000-8000-000000000001'::uuid, 'reconfortant'::text) $$,
  'Toujours une seule ligne pour cette œuvre : la nouvelle a remplacé l’ancienne'
);

-- Une vieille ligne (propositions d'avant, quelle que soit leur réponse) est remplacée elle aussi.
insert into public.recommendation_log (mode, work_id, response, shown_at)
values ('surprise', 'a0000000-0000-4000-8000-000000000002', 'aucune', now() - interval '90 days'),
       ('surprise', 'a0000000-0000-4000-8000-000000000002', 'ignoree', now() - interval '60 days');
select isnt(
  public.mettre_idee_de_cote('a0000000-0000-4000-8000-000000000002', 'lecture_courte'), null,
  'Une seconde œuvre est mise de côté'
);
select results_eq(
  $$ select work_id, mode, response, shown_at = now() from public.recommendation_log order by work_id $$,
  $$ values ('a0000000-0000-4000-8000-000000000001'::uuid, 'reconfortant'::text, 'ignoree'::text, true),
            ('a0000000-0000-4000-8000-000000000002'::uuid, 'lecture_courte', 'ignoree', true) $$,
  'Une ligne par œuvre, jamais plus : ce n’est pas un historique'
);

-- Les six envies sont acceptées.
select lives_ok(
  $$ select public.mettre_idee_de_cote('a0000000-0000-4000-8000-000000000002', e)
     from unnest(array['surprise', 'reconfortant', 'philosophique', 'remise_en_question', 'lecture_courte', 'changer_d_univers']) as e $$,
  'Les six envies sont acceptées'
);
select results_eq(
  $$ select count(*)::int from public.recommendation_log where work_id = 'a0000000-0000-4000-8000-000000000002' $$,
  $$ values (1) $$,
  'Après six mises de côté de suite, toujours une seule ligne'
);

-- ---------------------------------------------------------------------------
-- 3. Reprendre : « Annuler »
-- ---------------------------------------------------------------------------

select is(
  public.reprendre_idee('a0000000-0000-4000-8000-000000000002'), 1,
  'Reprendre une idée retire sa ligne : la fonction rend 1'
);
select results_eq(
  $$ select work_id from public.recommendation_log $$,
  $$ values ('a0000000-0000-4000-8000-000000000001'::uuid) $$,
  'L’autre œuvre reste de côté'
);
select is(
  public.reprendre_idee('a0000000-0000-4000-8000-000000000002'), 0,
  'Reprendre une idée qui n’est pas de côté ne casse rien : la fonction rend 0'
);

-- ---------------------------------------------------------------------------
-- 4. Rien d'autre ne change
-- ---------------------------------------------------------------------------

select results_eq(
  $$ select reading_status, ownership, progress_unit, progress_current, progress_total, appreciation, started_at, finished_at
     from public.library_entries where work_id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values ('en_pause'::text, 'possede'::text, 'page'::text, 40, 200, 'beau_moment'::text, '2026-03-03'::date, null::date) $$,
  'Le statut, la possession, la progression, le ressenti et les dates ne bougent pas'
);
select results_eq(
  $$ select kind, value from public.reading_events where entry_id = 'a0000000-0000-4000-8000-0000000000f1' order by kind $$,
  $$ values ('commence'::text, null::int), ('mis_en_pause', 40) $$,
  'L’historique de lecture ne bouge pas'
);
select results_eq(
  $$ select body from public.notes where work_id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values ('Une phrase notée.'::text) $$,
  'Les notes ne bougent pas'
);

-- ---------------------------------------------------------------------------
-- 5. Refus : tout ou rien
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.mettre_idee_de_cote('a0000000-0000-4000-8000-000000000001', 'autre') $$,
  'EO001', null, 'Une envie inconnue est refusée'
);
select throws_ok(
  $$ select public.mettre_idee_de_cote('a0000000-0000-4000-8000-000000000001', null) $$,
  'EO001', null, 'Une envie absente est refusée'
);
select throws_ok(
  $$ select public.mettre_idee_de_cote('a0000000-0000-4000-8000-000000000001', '') $$,
  'EO001', null, 'Une envie vide est refusée'
);
select throws_ok(
  $$ select public.mettre_idee_de_cote('a0000000-0000-4000-8000-00000000dead', 'surprise') $$,
  'EO002', null, 'Une œuvre inexistante est introuvable'
);
select throws_ok(
  $$ select public.mettre_idee_de_cote(null, 'surprise') $$,
  'EO002', null, 'Une œuvre absente est introuvable'
);
select throws_ok(
  $$ select public.reprendre_idee('a0000000-0000-4000-8000-00000000dead') $$,
  'EO002', null, 'Reprendre une œuvre inexistante : introuvable'
);
select results_eq(
  $$ select work_id, mode from public.recommendation_log $$,
  $$ values ('a0000000-0000-4000-8000-000000000001'::uuid, 'reconfortant'::text) $$,
  'Les demandes refusées ne laissent aucune trace, et l’ancienne mise de côté est toujours là'
);

-- ---------------------------------------------------------------------------
-- 6. B ne peut ni mettre de côté ni reprendre les œuvres de A
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select throws_ok(
  $$ select public.mettre_idee_de_cote('a0000000-0000-4000-8000-000000000001', 'surprise') $$,
  'EO002', null, 'Pour B, l’œuvre de A est introuvable'
);
select throws_ok(
  $$ select public.reprendre_idee('a0000000-0000-4000-8000-000000000001') $$,
  'EO002', null, 'B ne peut pas reprendre l’idée que A a mise de côté'
);
select results_eq(
  $$ select work_id from public.recommendation_log $$,
  $$ values ('b0000000-0000-4000-8000-000000000001'::uuid) $$,
  'B ne voit que sa propre mise de côté'
);

-- ---------------------------------------------------------------------------
-- 7. Contre-épreuve : sans RLS, les fonctions refusent encore
-- ---------------------------------------------------------------------------

reset role;
alter table public.works disable row level security;
alter table public.recommendation_log disable row level security;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select results_eq(
  $$ select count(*)::int from public.recommendation_log where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  $$ values (1) $$,
  'Contre-épreuve : sans RLS, B voit bien la mise de côté de A (la RLS est vraiment coupée)'
);
select throws_ok(
  $$ select public.mettre_idee_de_cote('a0000000-0000-4000-8000-000000000001', 'surprise') $$,
  'EO002', null, 'Sans RLS, mettre_idee_de_cote refuse encore l’œuvre d’un autre compte'
);
select throws_ok(
  $$ select public.reprendre_idee('a0000000-0000-4000-8000-000000000001') $$,
  'EO002', null, 'Sans RLS, reprendre_idee refuse encore l’œuvre d’un autre compte'
);
select is(
  public.reprendre_idee('b0000000-0000-4000-8000-000000000001'), 1,
  'Sans RLS, B reprend sa propre idée, et seulement la sienne'
);

reset role;
select results_eq(
  $$ select user_id, work_id, mode from public.recommendation_log $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'a0000000-0000-4000-8000-000000000001'::uuid, 'reconfortant'::text) $$,
  'La mise de côté de A n’a pas bougé ; celle de B a été retirée'
);

alter table public.works enable row level security;
alter table public.recommendation_log enable row level security;

-- ---------------------------------------------------------------------------
-- 8. Une œuvre supprimée emporte sa mise de côté
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

delete from public.works where id = 'a0000000-0000-4000-8000-000000000001';
select is_empty(
  $$ select 1 from public.recommendation_log $$,
  'Supprimer l’œuvre supprime sa mise de côté'
);

-- ---------------------------------------------------------------------------
-- 9. Sans compte connecté
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = '';

select throws_ok(
  $$ select public.mettre_idee_de_cote('a0000000-0000-4000-8000-000000000002', 'surprise') $$,
  '28000', null, 'mettre_idee_de_cote demande une connexion'
);
select throws_ok(
  $$ select public.reprendre_idee('a0000000-0000-4000-8000-000000000002') $$,
  '28000', null, 'reprendre_idee demande une connexion'
);

reset role;
set local role anon;

select throws_ok(
  $$ select public.mettre_idee_de_cote('a0000000-0000-4000-8000-000000000002', 'surprise') $$,
  '42501', null, 'Le rôle anon ne peut pas appeler mettre_idee_de_cote'
);
select throws_ok(
  $$ select public.reprendre_idee('a0000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'Le rôle anon ne peut pas appeler reprendre_idee'
);

reset role;
set local role service_role;

select throws_ok(
  $$ select public.mettre_idee_de_cote('a0000000-0000-4000-8000-000000000002', 'surprise') $$,
  '42501', null, 'Le rôle service_role ne peut pas appeler mettre_idee_de_cote'
);
select throws_ok(
  $$ select public.reprendre_idee('a0000000-0000-4000-8000-000000000002') $$,
  '42501', null, 'Le rôle service_role ne peut pas appeler reprendre_idee'
);

select * from finish();
rollback;
