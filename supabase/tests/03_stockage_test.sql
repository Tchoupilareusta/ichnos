-- Tests du stockage des couvertures : bucket privé, un dossier par compte.
-- Les fichiers d’essai sont de simples lignes, sans image réelle.

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

select results_eq(
  $$ select public from storage.buckets where id = 'couvertures' $$,
  'values (false)',
  'Le bucket des couvertures existe et il est privé'
);
select results_eq(
  $$ select file_size_limit from storage.buckets where id = 'couvertures' $$,
  'values (5242880::bigint)',
  'Un fichier ne dépasse pas 5 Mo'
);
select results_eq(
  $$ select allowed_mime_types from storage.buckets where id = 'couvertures' $$,
  $$ values (array['image/jpeg', 'image/png', 'image/webp']) $$,
  'Seules les images sont acceptées'
);
select is_empty(
  $$
    select p.policyname::text
    from pg_policies p
    where p.schemaname = 'storage'
      and p.tablename = 'objects'
      and (p.roles <> array['authenticated']::name[] or p.cmd = 'ALL')
  $$,
  'Aucune politique de stockage ne s’adresse à un autre rôle que authenticated'
);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@exemple.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@exemple.test');

insert into storage.buckets (id, name, public) values ('autre-bucket', 'autre-bucket', false);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('couvertures', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/essai.jpg') $$,
  'A dépose une couverture dans son dossier'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('couvertures', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/essai.jpg') $$,
  '42501', null,
  'A ne peut pas déposer dans le dossier de B'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('couvertures', 'essai.jpg') $$,
  '42501', null,
  'A ne peut pas déposer hors de son dossier'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('autre-bucket', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/essai.jpg') $$,
  '42501', null,
  'Les politiques ne valent que pour le bucket des couvertures'
);
select results_eq(
  $$ select name from storage.objects where bucket_id = 'couvertures' $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/essai.jpg') $$,
  'A voit sa couverture'
);

set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'couvertures' $$,
  'B ne voit pas la couverture de A'
);
select lives_ok(
  $$ delete from storage.objects where bucket_id = 'couvertures' $$,
  'La suppression tentée par B ne touche rien'
);
select lives_ok(
  $$ update storage.objects set name = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/essai.jpg' where bucket_id = 'couvertures' $$,
  'Le détournement tenté par B ne touche rien'
);

set local role anon;
set local request.jwt.claim.sub = '';

select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'couvertures' $$,
  'Le visiteur non connecté ne voit aucune couverture'
);

reset role;

select results_eq(
  $$ select name from storage.objects where bucket_id = 'couvertures' $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/essai.jpg') $$,
  'La couverture de A est intacte'
);

select * from finish();
rollback;
