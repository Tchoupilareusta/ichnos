-- Tests de sécurité de la base.
-- Deux comptes fictifs (A et B) et un visiteur non connecté vérifient que chacun
-- ne voit et ne modifie que ses propres données. Aucune donnée réelle ici.
--
-- Les règles générales (partie 1) valent pour toute table, présente ou future :
-- une nouvelle table sans RLS, sans user_id ou ouverte à « anon » fait échouer ces tests.

begin;
create extension if not exists pgtap with schema extensions;

select plan(125);

-- ---------------------------------------------------------------------------
-- 1. Règles générales
-- ---------------------------------------------------------------------------

select tables_are(
  'public',
  array[
    'works', 'authors', 'work_authors', 'tags', 'work_tags', 'editions', 'volumes',
    'media', 'library_entries', 'reading_events', 'notes', 'recommendation_log', 'ai_calls'
  ],
  'Le schéma public contient exactement les tables prévues'
);

select is_empty(
  $$
    select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  $$,
  'RLS est activée sur toutes les tables'
);

select is_empty(
  $$
    select t.tablename::text
    from pg_tables t
    where t.schemaname = 'public'
      and not exists (
        select 1
        from information_schema.columns c
        where c.table_schema = 'public'
          and c.table_name = t.tablename
          and c.column_name = 'user_id'
          and c.is_nullable = 'NO'
      )
  $$,
  'Toutes les tables portent un user_id obligatoire'
);

select is_empty(
  $$
    select c.table_name::text
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'user_id'
      and c.column_default is distinct from 'auth.uid()'
  $$,
  'user_id est rempli par défaut avec le compte connecté'
);

select is_empty(
  $$
    select c.relname::text, a.privilege_type
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(c.relacl) a
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
      and (a.grantee = 0 or a.grantee = 'anon'::regrole)
  $$,
  'Le rôle anon (visiteur non connecté) n’a aucun droit sur aucun objet'
);

select is_empty(
  $$
    select c.relname::text, a.privilege_type
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(c.relacl) a
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
      and a.grantee = 'service_role'::regrole
  $$,
  'Le rôle service_role n’a aucun droit non plus'
);

select is_empty(
  $$
    with attendu as (
      select t.tablename::text as nom, p.droit
      from pg_tables t
      cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) as p (droit)
      where t.schemaname = 'public'
    ),
    reel as (
      select c.relname::text as nom, a.privilege_type::text as droit
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(c.relacl) a
      where n.nspname = 'public'
        and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
        and a.grantee = 'authenticated'::regrole
    )
    (select * from attendu except select * from reel)
    union all
    (select * from reel except select * from attendu)
  $$,
  'Le rôle authenticated a exactement lire, ajouter, modifier, supprimer sur chaque table'
);

select is_empty(
  $$
    select t.tablename::text
    from pg_tables t
    where t.schemaname = 'public'
      and (
        select count(distinct p.cmd)
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = t.tablename
          and p.permissive = 'PERMISSIVE'
          and p.roles = array['authenticated']::name[]
          and p.cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
      ) <> 4
  $$,
  'Chaque table a ses quatre politiques (lire, ajouter, modifier, supprimer)'
);

select is_empty(
  $$
    select p.tablename::text, p.policyname::text
    from pg_policies p
    where p.schemaname = 'public'
      and (p.roles <> array['authenticated']::name[] or p.cmd = 'ALL')
  $$,
  'Aucune politique ne s’adresse à un autre rôle que authenticated'
);

select is_empty(
  $$
    select p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        has_function_privilege('anon', p.oid, 'execute')
        or has_function_privilege('service_role', p.oid, 'execute')
      )
  $$,
  'Aucune fonction de public n’est appelable sans compte connecté'
);

-- Toute nouvelle fonction ouverte au compte connecté doit être ajoutée ici, en connaissance de cause.
select is_empty(
  $$
    select p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('authenticated', p.oid, 'execute')
      and p.proname not in ('importer_catalogue', 'enregistrer_oeuvre', 'changer_statut', 'noter_progression', 'dater_fin', 'reserver_appel_ia', 'noter_achat', 'regler_tomes')
  $$,
  'Le compte connecté ne peut appeler que l’import du catalogue, l’enregistrement d’une œuvre, le suivi de lecture, la réservation d’un appel à l’IA, la note d’un achat et le réglage des tomes'
);

select is_empty(
  $$
    select p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  $$,
  'Aucune fonction ne s’exécute avec des droits supérieurs à ceux de l’appelant'
);

-- ---------------------------------------------------------------------------
-- 2. Le compte A remplit sa bibliothèque
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@exemple.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@exemple.test');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  $$ insert into public.works (id, title_fr, form) values ('a0000000-0000-4000-8000-000000000001', 'Œuvre de A', 'roman') $$,
  'A ajoute une œuvre'
);
select lives_ok(
  $$ insert into public.authors (id, name) values ('a0000000-0000-4000-8000-000000000002', 'Auteur de A') $$,
  'A ajoute un auteur'
);
select lives_ok(
  $$ insert into public.work_authors (work_id, author_id) values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002') $$,
  'A relie l’auteur à l’œuvre'
);
select lives_ok(
  $$ insert into public.tags (id, kind, name) values ('a0000000-0000-4000-8000-000000000003', 'theme', 'Thème de A') $$,
  'A ajoute un thème'
);
select lives_ok(
  $$ insert into public.work_tags (work_id, tag_id) values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003') $$,
  'A relie le thème à l’œuvre'
);
select lives_ok(
  $$ insert into public.editions (id, work_id) values ('a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001') $$,
  'A ajoute une édition'
);
select lives_ok(
  $$ insert into public.volumes (work_id, number) values ('a0000000-0000-4000-8000-000000000001', 1) $$,
  'A ajoute un tome'
);
select lives_ok(
  $$ insert into public.media (work_id, kind) values ('a0000000-0000-4000-8000-000000000001', 'anime') $$,
  'A ajoute un média associé'
);
select lives_ok(
  $$ insert into public.library_entries (id, work_id) values ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001') $$,
  'A range l’œuvre dans sa bibliothèque'
);
select lives_ok(
  $$ insert into public.reading_events (entry_id, kind) values ('a0000000-0000-4000-8000-000000000005', 'commence') $$,
  'A note un événement de lecture'
);
select lives_ok(
  $$ insert into public.notes (work_id, kind, body) values ('a0000000-0000-4000-8000-000000000001', 'citation', 'Note de A') $$,
  'A ajoute une note'
);
select lives_ok(
  $$ insert into public.recommendation_log (mode, work_id) values ('surprise', 'a0000000-0000-4000-8000-000000000001') $$,
  'A reçoit une proposition'
);
select lives_ok(
  $$ insert into public.ai_calls (action) values ('fiche') $$,
  'A laisse une trace d’appel à l’IA'
);

reset role;

select results_eq(
  format('select count(*)::int from public.%I where user_id = %L', t.tablename, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'values (1)',
  format('%s : la ligne de A porte bien son user_id', t.tablename)
)
from pg_tables t
where t.schemaname = 'public'
order by t.tablename;

-- ---------------------------------------------------------------------------
-- 3. Le compte B ne voit rien de A et ne peut rien lui faire
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is_empty(
  format('select 1 from public.%I', t.tablename),
  format('%s : B ne voit aucune ligne de A', t.tablename)
)
from pg_tables t
where t.schemaname = 'public'
order by t.tablename;

select lives_ok(
  format('delete from public.%I', t.tablename),
  format('%s : la suppression tentée par B ne touche rien', t.tablename)
)
from pg_tables t
where t.schemaname = 'public'
order by t.tablename;

select lives_ok(
  format('update public.%I set user_id = %L', t.tablename, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  format('%s : le détournement tenté par B ne touche rien', t.tablename)
)
from pg_tables t
where t.schemaname = 'public'
order by t.tablename;

reset role;

select results_eq(
  format('select count(*)::int from public.%I where user_id = %L', t.tablename, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'values (1)',
  format('%s : la ligne de A est intacte après les tentatives de B', t.tablename)
)
from pg_tables t
where t.schemaname = 'public'
order by t.tablename;

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select throws_ok(
  $$ insert into public.works (user_id, title_fr, form) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Intrus', 'roman') $$,
  '42501', null,
  'B ne peut pas créer une œuvre au nom de A'
);

select lives_ok(
  $$ insert into public.works (id, title_fr, form) values ('b0000000-0000-4000-8000-000000000001', 'Œuvre de B', 'roman') $$,
  'B ajoute sa propre œuvre'
);
select lives_ok(
  $$ insert into public.authors (id, name) values ('b0000000-0000-4000-8000-000000000002', 'Auteur de B') $$,
  'B ajoute son propre auteur'
);
select lives_ok(
  $$ insert into public.tags (id, kind, name) values ('b0000000-0000-4000-8000-000000000003', 'theme', 'Thème de B') $$,
  'B ajoute son propre thème'
);

select results_eq(
  'select title_fr from public.works',
  $$ values ('Œuvre de B') $$,
  'B ne voit que sa propre œuvre'
);

-- B connaît (par hypothèse) les identifiants de A : il ne peut rien y rattacher.
select throws_ok(
  $$ insert into public.work_authors (work_id, author_id) values ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002') $$,
  '23503', null,
  'B ne peut pas rattacher son auteur à l’œuvre de A'
);
select throws_ok(
  $$ insert into public.work_authors (work_id, author_id) values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002') $$,
  '23503', null,
  'B ne peut pas rattacher l’auteur de A à son œuvre'
);
select throws_ok(
  $$ insert into public.work_tags (work_id, tag_id) values ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003') $$,
  '23503', null,
  'B ne peut pas rattacher son thème à l’œuvre de A'
);
select throws_ok(
  $$ insert into public.work_tags (work_id, tag_id) values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003') $$,
  '23503', null,
  'B ne peut pas rattacher le thème de A à son œuvre'
);
select throws_ok(
  $$ insert into public.work_authors (work_id, author_id) values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002') $$,
  '23503', null,
  'B ne peut pas recopier le lien œuvre-auteur de A (et l’erreur ne révèle pas qu’il existe)'
);
select throws_ok(
  $$ insert into public.work_tags (work_id, tag_id) values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003') $$,
  '23503', null,
  'B ne peut pas recopier le lien œuvre-thème de A (et l’erreur ne révèle pas qu’il existe)'
);
select throws_ok(
  $$ insert into public.editions (work_id) values ('a0000000-0000-4000-8000-000000000001') $$,
  '23503', null,
  'B ne peut pas ajouter d’édition à l’œuvre de A'
);
select throws_ok(
  $$ insert into public.volumes (work_id, number) values ('a0000000-0000-4000-8000-000000000001', 1) $$,
  '23503', null,
  'B ne peut pas ajouter de tome à l’œuvre de A'
);
select throws_ok(
  $$ insert into public.media (work_id, kind) values ('a0000000-0000-4000-8000-000000000001', 'film') $$,
  '23503', null,
  'B ne peut pas ajouter de média à l’œuvre de A'
);
select throws_ok(
  $$ insert into public.notes (work_id, kind, body) values ('a0000000-0000-4000-8000-000000000001', 'commentaire', 'Intrus') $$,
  '23503', null,
  'B ne peut pas ajouter de note à l’œuvre de A'
);
select throws_ok(
  $$ insert into public.library_entries (work_id) values ('a0000000-0000-4000-8000-000000000001') $$,
  '23503', null,
  'B ne peut pas ranger l’œuvre de A dans sa bibliothèque'
);
select throws_ok(
  $$ insert into public.reading_events (entry_id, kind) values ('a0000000-0000-4000-8000-000000000005', 'termine') $$,
  '23503', null,
  'B ne peut pas ajouter d’événement à la lecture de A'
);
select throws_ok(
  $$ insert into public.recommendation_log (mode, work_id) values ('surprise', 'a0000000-0000-4000-8000-000000000001') $$,
  '23503', null,
  'B ne peut pas enregistrer de proposition sur l’œuvre de A'
);

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select throws_ok(
  $$ update public.works set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'A ne peut pas céder son œuvre à B'
);
select results_eq(
  'select title_fr from public.works',
  $$ values ('Œuvre de A') $$,
  'A ne voit que sa propre œuvre'
);

-- ---------------------------------------------------------------------------
-- 4. Un visiteur non connecté n’a accès à rien
-- ---------------------------------------------------------------------------

set local role anon;
set local request.jwt.claim.sub = '';

select throws_ok(
  format('select 1 from public.%I', t.tablename),
  '42501', null,
  format('%s : lecture refusée au visiteur non connecté', t.tablename)
)
from pg_tables t
where t.schemaname = 'public'
order by t.tablename;

select throws_ok(
  $$ insert into public.works (title_fr, form) values ('Intrus', 'roman') $$,
  '42501', null,
  'Le visiteur non connecté ne peut rien ajouter'
);

-- Un jeton « authenticated » sans identité ne donne rien non plus.
set local role authenticated;

select is_empty(
  'select 1 from public.works',
  'Sans identité, aucune œuvre n’est visible'
);

reset role;

select * from finish();
rollback;
