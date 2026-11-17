-- Ichnos — stockage des couvertures (docs/reference.md §8.1 et §10.2).
-- Bucket privé : les images ne sont servies que par URL signée.
-- Chaque compte n'accède qu'à son propre dossier, nommé d'après son identifiant :
--   couvertures/<user_id>/<fichier>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'couvertures',
  'couvertures',
  false,
  5242880, -- 5 Mo
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy couvertures_lecture on storage.objects
  for select to authenticated
  using (
    bucket_id = 'couvertures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy couvertures_ajout on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'couvertures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy couvertures_modification on storage.objects
  for update to authenticated
  using (
    bucket_id = 'couvertures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'couvertures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy couvertures_suppression on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'couvertures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
