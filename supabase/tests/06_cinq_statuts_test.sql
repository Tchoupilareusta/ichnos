-- Tests des cinq statuts de lecture (migration 20261118120000_cinq_statuts).
-- « abandonne » n'est plus accepté nulle part ; les cinq statuts restants le sont ;
-- les fonctions gardent exactement leurs droits. Aucune donnée réelle.

begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

-- ---------------------------------------------------------------------------
-- 1. Les droits des fonctions ne changent pas
-- ---------------------------------------------------------------------------

select ok(has_function_privilege('authenticated', 'public.enregistrer_oeuvre(jsonb)', 'execute'),
  'enregistrer_oeuvre reste appelable par le compte connecté');
select ok(not has_function_privilege('anon', 'public.enregistrer_oeuvre(jsonb)', 'execute'),
  'enregistrer_oeuvre reste fermée au rôle anon');
select ok(not has_function_privilege('service_role', 'public.enregistrer_oeuvre(jsonb)', 'execute'),
  'enregistrer_oeuvre reste fermée au rôle service_role');
select ok(has_function_privilege('authenticated', 'public.importer_catalogue(jsonb)', 'execute'),
  'importer_catalogue reste appelable par le compte connecté');
select ok(not has_function_privilege('anon', 'public.importer_catalogue(jsonb)', 'execute'),
  'importer_catalogue reste fermée au rôle anon');
select ok(not has_function_privilege('service_role', 'public.importer_catalogue(jsonb)', 'execute'),
  'importer_catalogue reste fermée au rôle service_role');
select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('enregistrer_oeuvre', 'importer_catalogue')
       and (p.prosecdef or exists (
         select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')) $$,
  'Les deux fonctions restent sans droits supérieurs (security invoker) et fermées à public'
);

-- ---------------------------------------------------------------------------
-- 2. Le compte A et une œuvre d'essai
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@exemple.test');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select set_config('essai.oeuvre', public.enregistrer_oeuvre(
  '{ "title_fr": "Œuvre d’essai", "form": "roman", "is_series": false,
     "authors": [], "tags": [], "editions": [], "volumes": [], "media": [] }'::jsonb)::text, true);

select results_eq(
  $$ select reading_status from public.library_entries where work_id = current_setting('essai.oeuvre')::uuid $$,
  $$ values ('a_decouvrir') $$,
  'enregistrer_oeuvre crée toujours la lecture « À découvrir »'
);

-- ---------------------------------------------------------------------------
-- 3. « abandonne » est refusé, les cinq statuts sont acceptés
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.library_entries set reading_status = 'abandonne' where work_id = current_setting('essai.oeuvre')::uuid $$,
  '23514', null,
  'Une lecture ne peut plus passer « abandonne »'
);
select throws_ok(
  $$ insert into public.works (id, title_fr, form) values ('a0000000-0000-4000-8000-0000000000a1', 'Autre essai', 'roman');
     insert into public.library_entries (work_id, reading_status) values ('a0000000-0000-4000-8000-0000000000a1', 'abandonne') $$,
  '23514', null,
  'Une lecture ne peut pas être créée « abandonne »'
);
select throws_ok(
  $$ update public.library_entries set reading_status = 'laisse_de_cote' where work_id = current_setting('essai.oeuvre')::uuid $$,
  '23514', null,
  'Un statut inconnu reste refusé'
);

select lives_ok(
  format($$ update public.library_entries set reading_status = %L where work_id = current_setting('essai.oeuvre')::uuid $$, statut),
  format('Le statut « %s » est accepté', statut)
)
from unnest(array['en_cours', 'envie_de_lire', 'termine', 'a_decouvrir', 'en_pause']) as statut;

select results_eq(
  $$ select reading_status from public.library_entries where work_id = current_setting('essai.oeuvre')::uuid $$,
  $$ values ('en_pause') $$,
  'La lecture est bien « En pause »'
);

-- ---------------------------------------------------------------------------
-- 4. L'historique : plus d'événement « abandonne »
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.reading_events (entry_id, kind)
     select id, 'abandonne' from public.library_entries where work_id = current_setting('essai.oeuvre')::uuid $$,
  '23514', null,
  'Un événement « abandonne » est refusé'
);
select lives_ok(
  $$ insert into public.reading_events (entry_id, kind)
     select id, k from public.library_entries, unnest(array['commence', 'progression', 'mis_en_pause', 'repris', 'termine']) as k
     where work_id = current_setting('essai.oeuvre')::uuid $$,
  'Les cinq autres événements sont acceptés'
);
select results_eq(
  $$ select count(*)::integer from public.reading_events $$,
  'values (5)',
  'Les cinq événements sont enregistrés'
);

-- ---------------------------------------------------------------------------
-- 5. enregistrer_oeuvre reste compatible et ne touche pas au statut
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ select public.enregistrer_oeuvre(jsonb_build_object(
       'id', current_setting('essai.oeuvre'), 'title_fr', 'Œuvre d’essai corrigée', 'form', 'roman', 'is_series', false,
       'authors', '[]'::jsonb, 'tags', '[]'::jsonb, 'editions', '[]'::jsonb, 'volumes', '[]'::jsonb, 'media', '[]'::jsonb)) $$,
  'enregistrer_oeuvre modifie une œuvre « En pause »'
);
select results_eq(
  $$ select w.title_fr, le.reading_status from public.works w join public.library_entries le on le.work_id = w.id
     where w.id = current_setting('essai.oeuvre')::uuid $$,
  $$ values ('Œuvre d’essai corrigée', 'en_pause') $$,
  'La modification garde le statut « En pause »'
);

-- ---------------------------------------------------------------------------
-- 6. Le statut d'un média n'est pas concerné
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ insert into public.media (work_id, kind, status) values (current_setting('essai.oeuvre')::uuid, 'anime', 'abandonne') $$,
  'Un média peut toujours être « abandonne » (ce que je regarde, hors de cette décision)'
);

select * from finish();
rollback;
