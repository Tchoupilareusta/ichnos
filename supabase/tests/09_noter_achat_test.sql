-- Tests de la fonction noter_achat (migration 20261119210000_noter_achat) :
-- « Je l'ai acheté », pour un livre ou pour un tome. Comptes, œuvres et ISBN fictifs.

begin;
create extension if not exists pgtap with schema extensions;

select plan(70);

-- ---------------------------------------------------------------------------
-- 1. Droits : le compte connecté seul, sans droits supérieurs
-- ---------------------------------------------------------------------------

select ok(has_function_privilege('authenticated', 'public.noter_achat(uuid, jsonb)', 'execute'),
  'noter_achat est appelable par le compte connecté');
select ok(not has_function_privilege('anon', 'public.noter_achat(uuid, jsonb)', 'execute'),
  'noter_achat est fermée au rôle anon');
select ok(not has_function_privilege('service_role', 'public.noter_achat(uuid, jsonb)', 'execute'),
  'noter_achat est fermée au rôle service_role');
select is_empty(
  $$ select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'noter_achat'
       and (p.prosecdef or exists (
         select 1 from aclexplode(p.proacl) a where a.grantee = 0 and a.privilege_type = 'EXECUTE')) $$,
  'La fonction s’exécute avec les droits de l’appelant et est fermée à public'
);

-- ---------------------------------------------------------------------------
-- Décor : deux comptes. A a un roman suivi de près, une série, et deux autres œuvres.
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@exemple.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@exemple.test');

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

insert into public.works (id, title_fr, form) values ('b0000000-0000-4000-8000-000000000001', 'Œuvre de B', 'roman');
insert into public.editions (id, work_id, isbn) values ('b0000000-0000-4000-8000-0000000000e1', 'b0000000-0000-4000-8000-000000000001', '9782747024693');
insert into public.library_entries (work_id) values ('b0000000-0000-4000-8000-000000000001');

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- Roman d'essai : une œuvre avec sa propre couverture, une édition qui est la mienne (avec une
-- autre couverture, celle qui s'affiche), une seconde édition, et tout ce qui m'est personnel.
insert into public.works (id, title_fr, form, synopsis, cover_path)
values ('a0000000-0000-4000-8000-000000000001', 'Roman d’essai', 'roman', 'Un résumé écrit par moi.',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/11111111111111111111111111111111.jpg');
insert into public.editions (id, work_id, isbn, publisher, cover_path, created_at)
values
  ('a0000000-0000-4000-8000-0000000000e1', 'a0000000-0000-4000-8000-000000000001', '9782070000012', 'Bayard',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/00000000000000000000000000000000.jpg', now() - interval '2 days'),
  ('a0000000-0000-4000-8000-0000000000e2', 'a0000000-0000-4000-8000-000000000001', '9782070000029', 'Folio', null, now() - interval '1 day');
insert into public.library_entries (id, work_id, edition_id, reading_status, ownership, progress_unit, progress_current, progress_total, appreciation, started_at)
values ('a0000000-0000-4000-8000-0000000000f1', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000e1',
        'en_cours', 'a_acheter', 'page', 12, 200, 'marque', '2026-03-03');
insert into public.reading_events (entry_id, kind, value)
values ('a0000000-0000-4000-8000-0000000000f1', 'commence', null), ('a0000000-0000-4000-8000-0000000000f1', 'progression', 12);
insert into public.tags (id, kind, name) values ('a0000000-0000-4000-8000-0000000000a1', 'theme', 'Rapport au temps');
insert into public.work_tags (work_id, tag_id) values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000a1');
insert into public.notes (work_id, kind, body) values ('a0000000-0000-4000-8000-000000000001', 'citation', 'Une phrase notée.');
insert into public.media (work_id, kind, episodes_total, episodes_watched, status)
values ('a0000000-0000-4000-8000-000000000001', 'film', 1, 1, 'termine');

-- Série d'essai : trois tomes, dont deux avec ISBN, un en cours de lecture.
insert into public.works (id, title_fr, form, is_series) values ('a0000000-0000-4000-8000-000000000002', 'Série d’essai', 'manga', true);
insert into public.library_entries (work_id) values ('a0000000-0000-4000-8000-000000000002');
insert into public.volumes (work_id, number, isbn, reading_status, ownership, cover_path)
values
  ('a0000000-0000-4000-8000-000000000002', 1, '9782351420010', 'lu', 'a_acheter',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1.jpg'),
  ('a0000000-0000-4000-8000-000000000002', 2, '9782351420027', 'en_cours', 'non_possede',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2.jpg'),
  ('a0000000-0000-4000-8000-000000000002', 3, null, 'a_lire', 'non_possede', null);

-- Autre œuvre : son édition porte un ISBN qu'on ne doit pas pouvoir noter ailleurs.
insert into public.works (id, title_fr, form) values ('a0000000-0000-4000-8000-000000000003', 'Autre œuvre', 'essai');
insert into public.editions (id, work_id, isbn) values ('a0000000-0000-4000-8000-0000000000e3', 'a0000000-0000-4000-8000-000000000003', '9782070000036');
insert into public.library_entries (work_id) values ('a0000000-0000-4000-8000-000000000003');

-- Sans édition : une œuvre du catalogue, avec sa couverture, que je n'ai pas encore.
insert into public.works (id, title_fr, form, cover_path)
values ('a0000000-0000-4000-8000-000000000004', 'Sans édition', 'conte', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/44444444444444444444444444444444.jpg');
insert into public.library_entries (work_id) values ('a0000000-0000-4000-8000-000000000004');

-- ---------------------------------------------------------------------------
-- 2. Achat d'une nouvelle édition, avec sa couverture
-- ---------------------------------------------------------------------------

-- L'identifiant rendu est gardé dans un réglage propre à cette transaction, pour les vérifications qui suivent.
select isnt(
  set_config('essai.achat_1', public.noter_achat(
    'a0000000-0000-4000-8000-000000000004',
    '{"isbn": "978-2-07-000004 3", "publisher": "  Gallimard ", "language": "fr", "format": "Folio", "translator": "", "page_count": 190,
      "couverture": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1.jpg"}'::jsonb
  )::text, true),
  null,
  'L’achat rend l’identifiant de l’édition'
);
select results_eq(
  $$ select e.id = current_setting('essai.achat_1')::uuid, e.isbn, e.publisher, e.language, e.format, e.translator, e.page_count, e.cover_path
     from public.editions e where e.work_id = 'a0000000-0000-4000-8000-000000000004' $$,
  $$ values (true, '9782070000043'::text, 'Gallimard'::text, 'fr'::text, 'Folio'::text, null::text, 190,
             'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1.jpg'::text) $$,
  'L’édition est créée : ISBN sans tirets ni espaces, textes nettoyés, texte vide laissé vide, couverture rangée sur elle'
);
select results_eq(
  $$ select le.edition_id = current_setting('essai.achat_1')::uuid, le.ownership from public.library_entries le
     where le.work_id = 'a0000000-0000-4000-8000-000000000004' $$,
  $$ values (true, 'possede'::text) $$,
  'Elle devient mon édition, et la possession passe à « Je l’ai »'
);
select results_eq(
  $$ select cover_path from public.works where id = 'a0000000-0000-4000-8000-000000000004' $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/44444444444444444444444444444444.jpg'::text) $$,
  'La couverture propre de l’œuvre n’est pas touchée'
);

-- ---------------------------------------------------------------------------
-- 3. Reprise d'une édition existante par son ISBN, sans couverture trouvée
-- ---------------------------------------------------------------------------

select is(
  public.noter_achat(
    'a0000000-0000-4000-8000-000000000001',
    '{"isbn": "9782070000029", "publisher": "Un autre éditeur", "language": "fr", "translator": "Une traductrice", "page_count": 300}'::jsonb
  ),
  'a0000000-0000-4000-8000-0000000000e2'::uuid,
  'L’édition qui porte déjà cet ISBN est reprise : son identifiant est rendu'
);
select results_eq(
  $$ select count(*)::int from public.editions where work_id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values (2) $$,
  'Aucune édition n’est créée en double'
);
select results_eq(
  $$ select publisher, language, translator, page_count, cover_path from public.editions where id = 'a0000000-0000-4000-8000-0000000000e2' $$,
  $$ values ('Folio'::text, 'fr'::text, 'Une traductrice'::text, 300, null::text) $$,
  'Seuls ses champs vides sont complétés : l’éditeur que j’avais écrit reste'
);
select results_eq(
  $$ select edition_id, ownership from public.library_entries where work_id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values ('a0000000-0000-4000-8000-0000000000e2'::uuid, 'possede'::text) $$,
  'Elle devient mon édition, et la possession passe à « Je l’ai »'
);
select results_eq(
  $$ select cover_path from public.works where id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/00000000000000000000000000000000.jpg'::text) $$,
  'Sans couverture trouvée, celle qui s’affichait (mon ancienne édition) reste affichée : elle passe sur l’œuvre'
);
select results_eq(
  $$ select isbn, publisher, cover_path from public.editions where id = 'a0000000-0000-4000-8000-0000000000e1' $$,
  $$ values ('9782070000012'::text, 'Bayard'::text, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/00000000000000000000000000000000.jpg'::text) $$,
  'Mon ancienne édition n’est pas modifiée'
);

-- ---------------------------------------------------------------------------
-- 4. Rien d'autre ne change
-- ---------------------------------------------------------------------------

select results_eq(
  $$ select title_fr, synopsis from public.works where id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values ('Roman d’essai'::text, 'Un résumé écrit par moi.'::text) $$,
  'Le titre et le synopsis sont intacts'
);
select results_eq(
  $$ select reading_status, progress_unit, progress_current, progress_total, appreciation, started_at, finished_at
     from public.library_entries where work_id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values ('en_cours'::text, 'page'::text, 12, 200, 'marque'::text, '2026-03-03'::date, null::date) $$,
  'Le statut de lecture, la progression, le ressenti et les dates sont intacts'
);
select results_eq(
  $$ select kind, value from public.reading_events where entry_id = 'a0000000-0000-4000-8000-0000000000f1' order by kind $$,
  $$ values ('commence'::text, null::integer), ('progression', 12) $$,
  'L’historique est intact : aucun événement ajouté ni retiré'
);
select results_eq(
  $$ select (select count(*)::int from public.work_tags where work_id = 'a0000000-0000-4000-8000-000000000001'),
            (select count(*)::int from public.notes where work_id = 'a0000000-0000-4000-8000-000000000001'),
            (select episodes_watched from public.media where work_id = 'a0000000-0000-4000-8000-000000000001') $$,
  $$ values (1, 1, 1) $$,
  'Les étiquettes, les notes et les médias sont intacts'
);

-- ---------------------------------------------------------------------------
-- 5. Racheter la même édition ne change rien ; une couverture donnée remplace celle de l'édition
-- ---------------------------------------------------------------------------

select is(
  public.noter_achat('a0000000-0000-4000-8000-000000000001', '{"isbn": "9782070000029"}'::jsonb),
  'a0000000-0000-4000-8000-0000000000e2'::uuid,
  'Noter deux fois le même achat rend la même édition'
);
select results_eq(
  $$ select (select count(*)::int from public.editions where work_id = 'a0000000-0000-4000-8000-000000000001'),
            (select cover_path from public.works where id = 'a0000000-0000-4000-8000-000000000001') $$,
  $$ values (2, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/00000000000000000000000000000000.jpg'::text) $$,
  'Toujours deux éditions, et la même couverture affichée'
);
select lives_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000001',
       '{"isbn": "9782070000029", "couverture": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2.jpg"}'::jsonb) $$,
  'Une couverture peut être donnée pour une édition reprise'
);
select results_eq(
  $$ select cover_path from public.editions where id = 'a0000000-0000-4000-8000-0000000000e2' $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2.jpg'::text) $$,
  'La couverture donnée est rangée sur l’édition achetée, qui est la mienne : c’est elle qui s’affiche'
);

-- ---------------------------------------------------------------------------
-- 6. Un tome
-- ---------------------------------------------------------------------------

select is(
  public.noter_achat('a0000000-0000-4000-8000-000000000002',
    '{"isbn": "979-10-327-0001-3", "tome": 2, "couverture": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2.jpg"}'::jsonb),
  null::uuid,
  'Pour un tome, aucune édition n’est rendue'
);
select results_eq(
  $$ select isbn, ownership, cover_path, reading_status from public.volumes
     where work_id = 'a0000000-0000-4000-8000-000000000002' and number = 2 $$,
  $$ values ('9791032700013'::text, 'possede'::text, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2.jpg'::text, 'en_cours'::text) $$,
  'Le tome reçoit l’ISBN de mon exemplaire, « Je l’ai » et la couverture donnée ; sa lecture ne change pas'
);
select lives_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000002', '{"isbn": "9782351420010", "tome": 1}'::jsonb) $$,
  'Un tome peut être noté sans couverture, avec l’ISBN qu’il porte déjà'
);
select results_eq(
  $$ select number, isbn, ownership, cover_path, reading_status from public.volumes
     where work_id = 'a0000000-0000-4000-8000-000000000002' order by number $$,
  $$ values (1, '9782351420010'::text, 'possede'::text, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1.jpg'::text, 'lu'::text),
            (2, '9791032700013', 'possede', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2.jpg', 'en_cours'),
            (3, null, 'non_possede', null, 'a_lire') $$,
  'Sans couverture donnée, celle du tome est gardée ; les autres tomes ne bougent pas'
);
select results_eq(
  $$ select edition_id, ownership, reading_status from public.library_entries where work_id = 'a0000000-0000-4000-8000-000000000002' $$,
  $$ values (null::uuid, 'non_possede'::text, 'a_decouvrir'::text) $$,
  'Ma relation à la série n’est pas touchée : sa possession se calcule à partir des tomes'
);
select results_eq(
  $$ select count(*)::int from public.editions where work_id = 'a0000000-0000-4000-8000-000000000002' $$,
  $$ values (0) $$,
  'Aucune édition n’est créée pour une série'
);

-- ---------------------------------------------------------------------------
-- 7. Ce qui est refusé
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000003', '{"isbn": "9782070000044"}'::jsonb) $$,
  'EO001', null, 'Un ISBN au chiffre de contrôle faux est refusé'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000003', '{"isbn": "207036822X"}'::jsonb) $$,
  'EO001', null, 'Un ISBN à 10 caractères est refusé : il faut les 13 chiffres'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000003', '{"isbn": "9772070000048"}'::jsonb) $$,
  'EO001', null, 'Un ISBN qui ne commence ni par 978 ni par 979 est refusé'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000003', '{"publisher": "Gallimard"}'::jsonb) $$,
  'EO001', null, 'Un achat sans ISBN est refusé'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000003', '{"isbn": 9782070000043}'::jsonb) $$,
  'EO001', null, 'Un ISBN qui n’est pas un texte est refusé'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000003', '["9782070000043"]'::jsonb) $$,
  'EO001', null, 'Un achat qui n’est pas un objet est refusé'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000003', null) $$,
  'EO001', null, 'Un achat vide est refusé'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000003', '{"isbn": "9782070000043", "synopsis": "Un autre résumé"}'::jsonb) $$,
  'EO001', null, 'Un champ inconnu fait refuser l’achat : rien d’autre que l’édition ne peut passer'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000003', '{"isbn": "9782253004226", "page_count": "beaucoup"}'::jsonb) $$,
  'EO001', null, 'Un nombre de pages qui n’est pas un nombre est refusé'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000003', '{"isbn": "9782253004226", "page_count": 0}'::jsonb) $$,
  '23514', null, 'Un nombre de pages nul est refusé par la règle de la table'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000004', '{"isbn": "9782070000036"}'::jsonb) $$,
  'EO003', null, 'L’ISBN d’une édition d’une autre de mes œuvres est refusé'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000004', '{"isbn": "9782351420010"}'::jsonb) $$,
  'EO003', null, 'L’ISBN d’un tome d’une autre de mes œuvres est refusé'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000002', '{"isbn": "9782070000036", "tome": 3}'::jsonb) $$,
  'EO003', null, 'Pour un tome aussi, l’ISBN d’une autre de mes œuvres est refusé'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000002', '{"isbn": "9782351420010", "tome": 3}'::jsonb) $$,
  'EO003', null, 'L’ISBN d’un autre tome de la même série est refusé'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000002', '{"isbn": "9782253004226"}'::jsonb) $$,
  'EO001', null, 'Une série sans numéro de tome est refusée'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000003', '{"isbn": "9782253004226", "tome": 1}'::jsonb) $$,
  'EO001', null, 'Un numéro de tome pour une œuvre qui n’est pas une série est refusé'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000002', '{"isbn": "9782253004226", "tome": "2"}'::jsonb) $$,
  'EO001', null, 'Un numéro de tome qui n’est pas un nombre est refusé'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000002', '{"isbn": "9782253004226", "tome": 2.5}'::jsonb) $$,
  'EO001', null, 'Un numéro de tome qui n’est pas entier est refusé'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000002', '{"isbn": "9782253004226", "tome": 99}'::jsonb) $$,
  'EO002', null, 'Un tome qui n’existe pas est introuvable'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-00000000dead', '{"isbn": "9782253004226"}'::jsonb) $$,
  'EO002', null, 'Une œuvre qui n’existe pas est introuvable'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000003',
       '{"isbn": "9782253004226", "couverture": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/ffffffffffffffffffffffffffffffff.jpg"}'::jsonb) $$,
  '23514', null, 'Un chemin de couverture dans le dossier d’un autre compte est refusé (édition)'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000002',
       '{"isbn": "9782253004226", "tome": 3, "couverture": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/ffffffffffffffffffffffffffffffff.jpg"}'::jsonb) $$,
  '23514', null, 'Un chemin de couverture dans le dossier d’un autre compte est refusé (tome)'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000003',
       '{"isbn": "9782253004226", "couverture": "https://exemple.test/image.jpg"}'::jsonb) $$,
  '23514', null, 'Une adresse à la place d’un chemin de couverture est refusée'
);
select results_eq(
  $$ select (select count(*)::int from public.editions where work_id = 'a0000000-0000-4000-8000-000000000003'),
            (select ownership from public.library_entries where work_id = 'a0000000-0000-4000-8000-000000000003'),
            (select isbn from public.volumes where work_id = 'a0000000-0000-4000-8000-000000000002' and number = 3) $$,
  $$ values (1, 'non_possede'::text, null::text) $$,
  'Un achat refusé ne laisse aucune trace : tout ou rien'
);

-- L'ISBN d'un livre que B a aussi : rien ne le signale à A, et rien ne l'empêche de le noter.
select lives_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000003', '{"isbn": "9782747024693"}'::jsonb) $$,
  'L’ISBN d’un livre d’un autre compte n’est ni révélé ni refusé : chacun sa bibliothèque'
);
select results_eq(
  $$ select ownership, (select count(*)::int from public.editions where work_id = 'a0000000-0000-4000-8000-000000000003')
     from public.library_entries where work_id = 'a0000000-0000-4000-8000-000000000003' $$,
  $$ values ('possede'::text, 2) $$,
  'L’achat de A est noté'
);
select results_eq(
  $$ select cover_path is null from public.works where id = 'a0000000-0000-4000-8000-000000000003' $$,
  $$ values (true) $$,
  'Sans aucune couverture avant l’achat, il n’y en a pas davantage après : rien n’est inventé'
);

-- ---------------------------------------------------------------------------
-- 8. B ne peut pas acheter l'œuvre de A
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000001', '{"isbn": "9782253004226"}'::jsonb) $$,
  'EO002', null, 'Pour B, le roman de A est introuvable'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000002', '{"isbn": "9782253004226", "tome": 3}'::jsonb) $$,
  'EO002', null, 'Pour B, la série de A est introuvable'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000002', '{"isbn": "9782253004226"}'::jsonb) $$,
  'EO002', null, 'B n’apprend pas que l’œuvre de A est une série : elle est introuvable, pas « incohérente »'
);
select lives_ok(
  $$ select public.noter_achat('b0000000-0000-4000-8000-000000000001', '{"isbn": "9782070000012"}'::jsonb) $$,
  'B peut noter son propre achat, même avec un ISBN que A a aussi'
);

-- ---------------------------------------------------------------------------
-- 9. Contre-épreuve : sans RLS, la fonction refuse encore
-- ---------------------------------------------------------------------------

reset role;
alter table public.works disable row level security;
alter table public.editions disable row level security;
alter table public.library_entries disable row level security;
alter table public.volumes disable row level security;
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select results_eq(
  $$ select count(*)::int from public.works where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  $$ values (4) $$,
  'Contre-épreuve : sans RLS, B voit bien les œuvres de A (la RLS est vraiment coupée)'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000001', '{"isbn": "9782253004226"}'::jsonb) $$,
  'EO002', null, 'Sans RLS, noter_achat refuse encore le roman d’un autre compte'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000002', '{"isbn": "9782253004226", "tome": 3}'::jsonb) $$,
  'EO002', null, 'Sans RLS, noter_achat refuse encore la série d’un autre compte'
);
select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000001',
       '{"isbn": "9782070000029", "couverture": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/ffffffffffffffffffffffffffffffff.jpg"}'::jsonb) $$,
  'EO002', null, 'Sans RLS, B ne peut pas reprendre une édition de A ni y poser sa couverture'
);
-- Sans RLS, B voit les ISBN de A : la fonction ne doit pourtant comparer qu'avec les siens.
select lives_ok(
  $$ select public.noter_achat('b0000000-0000-4000-8000-000000000001', '{"isbn": "9782070000036"}'::jsonb) $$,
  'Sans RLS, l’ISBN d’une œuvre de A ne bloque pas un achat de B : seuls ses propres livres comptent'
);

reset role;
select results_eq(
  $$ select w.title_fr, le.ownership, le.edition_id
     from public.library_entries le join public.works w on w.id = le.work_id
     where w.user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' order by w.title_fr $$,
  $$ values ('Autre œuvre'::text, 'possede'::text, (select id from public.editions where work_id = 'a0000000-0000-4000-8000-000000000003' and isbn = '9782747024693')),
            ('Roman d’essai', 'possede', 'a0000000-0000-4000-8000-0000000000e2'::uuid),
            ('Sans édition', 'possede', current_setting('essai.achat_1')::uuid),
            ('Série d’essai', 'non_possede', null) $$,
  'Les achats de A n’ont pas bougé'
);
select results_eq(
  $$ select count(*)::int, count(*) filter (where cover_path like 'bbbbbbbb%')::int from public.editions
     where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  $$ values (5, 0) $$,
  'Aucune édition de A n’a été ajoutée ni modifiée par B'
);
select results_eq(
  $$ select number, isbn, ownership from public.volumes where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' order by number $$,
  $$ values (1, '9782351420010'::text, 'possede'::text), (2, '9791032700013', 'possede'), (3, null, 'non_possede') $$,
  'Les tomes de A n’ont pas bougé'
);
select results_eq(
  $$ select count(*)::int from public.editions where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  $$ values (3) $$,
  'Les achats de B sont restés dans sa propre bibliothèque'
);

alter table public.works enable row level security;
alter table public.editions enable row level security;
alter table public.library_entries enable row level security;
alter table public.volumes enable row level security;

-- ---------------------------------------------------------------------------
-- 10. Sans compte connecté
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '';

select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000001', '{"isbn": "9782253004226"}'::jsonb) $$,
  '28000', null, 'noter_achat demande une connexion'
);

reset role;
set local role anon;

select throws_ok(
  $$ select public.noter_achat('a0000000-0000-4000-8000-000000000001', '{"isbn": "9782253004226"}'::jsonb) $$,
  '42501', null, 'Le rôle anon ne peut pas appeler noter_achat'
);

select * from finish();
rollback;
