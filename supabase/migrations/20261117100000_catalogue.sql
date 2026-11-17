-- Ichnos — catalogue : œuvres, auteurs, étiquettes, éditions, tomes, médias associés.
-- (docs/reference.md §6)
--
-- Règles communes à toutes les tables :
--   · user_id obligatoire, rempli par défaut avec le compte connecté ;
--   · RLS activée, quatre politiques explicites limitées à « mes lignes » ;
--   · droits accordés au seul rôle authenticated — rien pour anon ni service_role ;
--   · une ligne rattachée à une œuvre doit appartenir au même compte que l'œuvre
--     (clé étrangère sur le couple identifiant + user_id) ;
--   · les contraintes d'unicité commencent par user_id, pour qu'un message d'erreur
--     ne révèle jamais l'existence d'une ligne d'un autre compte.
-- Les valeurs codées (forme, statut…) sont en français sans accent ; les libellés
-- affichés sont dans l'interface. Ce qui est inconnu reste vide (null).

-- ---------------------------------------------------------------------------
-- Date de modification tenue à jour automatiquement
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- works — les œuvres
-- ---------------------------------------------------------------------------

create table public.works (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title_fr text not null check (btrim(title_fr) <> ''),
  title_original text,
  original_language text,
  first_published_year smallint check (first_published_year between -3000 and 2100),
  form text not null check (
    form in ('roman', 'roman_court', 'nouvelle', 'conte', 'poesie', 'essai', 'philosophie', 'manga', 'autre')
  ),
  synopsis text,
  tone smallint check (tone between 1 and 5),
  density smallint check (density between 1 and 5),
  length text check (length in ('court', 'moyen', 'long')),
  cover_path text,
  is_series boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

comment on table public.works is 'Les œuvres. Une série (Vinland Saga) est une seule œuvre avec des tomes.';
comment on column public.works.tone is '1 (sombre) à 5 (lumineux)';
comment on column public.works.density is '1 (accessible) à 5 (exigeant)';

create index works_user_id_idx on public.works (user_id);

create trigger works_set_updated_at
before update on public.works
for each row execute function public.set_updated_at();

alter table public.works enable row level security;

revoke all on table public.works from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.works to authenticated;

create policy works_lecture on public.works
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy works_ajout on public.works
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy works_modification on public.works
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy works_suppression on public.works
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- authors — les auteurs
-- ---------------------------------------------------------------------------

create table public.authors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

comment on table public.authors is 'Auteurs, traducteurs et illustrateurs.';

create trigger authors_set_updated_at
before update on public.authors
for each row execute function public.set_updated_at();

alter table public.authors enable row level security;

revoke all on table public.authors from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.authors to authenticated;

create policy authors_lecture on public.authors
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy authors_ajout on public.authors
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy authors_modification on public.authors
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy authors_suppression on public.authors
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- work_authors — qui a fait quoi sur une œuvre
-- ---------------------------------------------------------------------------

create table public.work_authors (
  work_id uuid not null,
  author_id uuid not null,
  role text not null default 'auteur' check (role in ('auteur', 'traducteur', 'illustrateur')),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (user_id, work_id, author_id, role),
  foreign key (work_id, user_id) references public.works (id, user_id) on delete cascade,
  foreign key (author_id, user_id) references public.authors (id, user_id) on delete cascade
);

comment on table public.work_authors is 'Lien entre une œuvre et ses auteurs, avec leur rôle.';

create index work_authors_author_id_idx on public.work_authors (author_id);

alter table public.work_authors enable row level security;

revoke all on table public.work_authors from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.work_authors to authenticated;

create policy work_authors_lecture on public.work_authors
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy work_authors_ajout on public.work_authors
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy work_authors_modification on public.work_authors
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy work_authors_suppression on public.work_authors
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- tags — genres, thèmes et atmosphères (vocabulaire modifiable)
-- ---------------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('genre', 'theme', 'atmosphere')),
  name text not null check (btrim(name) <> ''),
  is_interest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, kind, name),
  constraint tags_interest_only_on_theme check (not is_interest or kind = 'theme')
);

comment on table public.tags is 'Genres, thèmes et atmosphères.';
comment on column public.tags.is_interest is 'Thème qui compte personnellement : il oriente les recommandations.';

create trigger tags_set_updated_at
before update on public.tags
for each row execute function public.set_updated_at();

alter table public.tags enable row level security;

revoke all on table public.tags from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.tags to authenticated;

create policy tags_lecture on public.tags
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy tags_ajout on public.tags
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy tags_modification on public.tags
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy tags_suppression on public.tags
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- work_tags — étiquettes posées sur une œuvre
-- ---------------------------------------------------------------------------

create table public.work_tags (
  work_id uuid not null,
  tag_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (user_id, work_id, tag_id),
  foreign key (work_id, user_id) references public.works (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags (id, user_id) on delete cascade
);

comment on table public.work_tags is 'Lien entre une œuvre et ses étiquettes.';

create index work_tags_tag_id_idx on public.work_tags (tag_id);

alter table public.work_tags enable row level security;

revoke all on table public.work_tags from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.work_tags to authenticated;

create policy work_tags_lecture on public.work_tags
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy work_tags_ajout on public.work_tags
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy work_tags_modification on public.work_tags
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy work_tags_suppression on public.work_tags
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- editions — une œuvre peut en avoir plusieurs
-- ---------------------------------------------------------------------------

create table public.editions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_id uuid not null,
  -- ISBN sans tirets ni espaces : 13 chiffres, ou 10 caractères (le dernier peut être X).
  isbn text check (isbn ~ '^(97[89][0-9]{10}|[0-9]{9}[0-9X])$'),
  publisher text,
  language text,
  format text,
  translator text,
  page_count integer check (page_count > 0),
  cover_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (id, work_id),
  foreign key (work_id, user_id) references public.works (id, user_id) on delete cascade
);

comment on table public.editions is 'Éditions d''une œuvre. ISBN et pagination restent vides s''ils sont inconnus.';

create index editions_work_id_idx on public.editions (work_id);
create index editions_user_id_idx on public.editions (user_id);

create trigger editions_set_updated_at
before update on public.editions
for each row execute function public.set_updated_at();

alter table public.editions enable row level security;

revoke all on table public.editions from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.editions to authenticated;

create policy editions_lecture on public.editions
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy editions_ajout on public.editions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy editions_modification on public.editions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy editions_suppression on public.editions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- volumes — tomes d'une série
-- ---------------------------------------------------------------------------

create table public.volumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_id uuid not null,
  number integer not null check (number > 0),
  title text,
  isbn text check (isbn ~ '^(97[89][0-9]{10}|[0-9]{9}[0-9X])$'),
  cover_path text,
  ownership text not null default 'non_possede' check (ownership in ('possede', 'a_acheter', 'non_possede')),
  reading_status text not null default 'a_lire' check (reading_status in ('a_lire', 'en_cours', 'lu')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_id, number),
  foreign key (work_id, user_id) references public.works (id, user_id) on delete cascade
);

comment on table public.volumes is 'Tomes d''une série : possession et lecture suivies tome par tome.';

create index volumes_work_id_idx on public.volumes (work_id);

create trigger volumes_set_updated_at
before update on public.volumes
for each row execute function public.set_updated_at();

alter table public.volumes enable row level security;

revoke all on table public.volumes from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.volumes to authenticated;

create policy volumes_lecture on public.volumes
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy volumes_ajout on public.volumes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy volumes_modification on public.volumes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy volumes_suppression on public.volumes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- media — médias associés à une œuvre (anime, film…), jamais comptés comme des livres
-- ---------------------------------------------------------------------------

create table public.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_id uuid not null,
  kind text not null check (kind in ('anime', 'film', 'serie', 'autre')),
  title text,
  seasons smallint check (seasons > 0),
  episodes_total integer check (episodes_total > 0),
  episodes_watched integer check (episodes_watched >= 0),
  status text not null default 'a_voir' check (status in ('a_voir', 'en_cours', 'termine', 'en_pause', 'abandonne')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_watched_within_total check (episodes_watched <= episodes_total),
  foreign key (work_id, user_id) references public.works (id, user_id) on delete cascade
);

comment on table public.media is 'Médias associés à une œuvre (anime, film…).';

create index media_work_id_idx on public.media (work_id);
create index media_user_id_idx on public.media (user_id);

create trigger media_set_updated_at
before update on public.media
for each row execute function public.set_updated_at();

alter table public.media enable row level security;

revoke all on table public.media from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.media to authenticated;

create policy media_lecture on public.media
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy media_ajout on public.media
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy media_modification on public.media
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy media_suppression on public.media
  for delete to authenticated
  using ((select auth.uid()) = user_id);
