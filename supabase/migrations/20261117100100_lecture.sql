-- Ichnos — lecture : ma relation aux œuvres, historique discret, notes, propositions.
-- (docs/reference.md §6)
-- Mêmes règles de sécurité que le catalogue : user_id, RLS, quatre politiques,
-- droits au seul rôle authenticated, rattachement vérifié sur le couple identifiant + user_id.

-- ---------------------------------------------------------------------------
-- library_entries — ma relation à une œuvre (une par œuvre)
-- ---------------------------------------------------------------------------

create table public.library_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_id uuid not null,
  edition_id uuid,
  reading_status text not null default 'a_decouvrir' check (
    reading_status in ('a_decouvrir', 'envie_de_lire', 'en_cours', 'termine', 'en_pause', 'abandonne')
  ),
  -- Pour une série, la possession affichée se déduit des tomes (table volumes).
  ownership text not null default 'non_possede' check (ownership in ('possede', 'a_acheter', 'non_possede')),
  progress_unit text check (progress_unit in ('page', 'chapitre', 'tome', 'lettre', 'section', 'pourcentage')),
  progress_current integer check (progress_current >= 0),
  progress_total integer check (progress_total > 0),
  appreciation text check (appreciation in ('marque', 'beau_moment', 'pas_pour_moi', 'a_relire')),
  started_at date,
  finished_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, work_id),
  constraint library_entries_progress_within_total check (progress_current <= progress_total),
  constraint library_entries_percentage_max check (progress_unit <> 'pourcentage' or progress_current <= 100),
  foreign key (work_id, user_id) references public.works (id, user_id) on delete cascade,
  -- L'édition choisie doit être une édition de cette œuvre ; si elle est supprimée, le champ se vide.
  foreign key (edition_id, work_id) references public.editions (id, work_id) on delete set null (edition_id)
);

comment on table public.library_entries is 'Ma relation à une œuvre : statut de lecture, possession, progression, appréciation.';
comment on column public.library_entries.appreciation is
  'marque = « M''a marqué », beau_moment = « Beau moment », pas_pour_moi = « Pas pour moi, pas maintenant », a_relire = « À relire un jour »';

create index library_entries_work_id_idx on public.library_entries (work_id);
create index library_entries_edition_id_idx on public.library_entries (edition_id);

create trigger library_entries_set_updated_at
before update on public.library_entries
for each row execute function public.set_updated_at();

alter table public.library_entries enable row level security;

revoke all on table public.library_entries from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.library_entries to authenticated;

create policy library_entries_lecture on public.library_entries
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy library_entries_ajout on public.library_entries
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy library_entries_modification on public.library_entries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy library_entries_suppression on public.library_entries
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- reading_events — historique discret, jamais affiché sous forme de statistiques
-- ---------------------------------------------------------------------------

create table public.reading_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id uuid not null,
  kind text not null check (kind in ('commence', 'progression', 'mis_en_pause', 'repris', 'termine', 'abandonne')),
  value integer check (value >= 0),
  occurred_at timestamptz not null default now(),
  foreign key (entry_id, user_id) references public.library_entries (id, user_id) on delete cascade
);

comment on table public.reading_events is 'Historique discret des lectures. Permet aussi les relectures.';

create index reading_events_entry_id_idx on public.reading_events (entry_id, occurred_at);
create index reading_events_user_id_idx on public.reading_events (user_id);

alter table public.reading_events enable row level security;

revoke all on table public.reading_events from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.reading_events to authenticated;

create policy reading_events_lecture on public.reading_events
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy reading_events_ajout on public.reading_events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy reading_events_modification on public.reading_events
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy reading_events_suppression on public.reading_events
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- notes — citations et réflexions, rangées dans la fiche de l'œuvre
-- ---------------------------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  work_id uuid not null,
  kind text not null check (kind in ('citation', 'commentaire', 'reflexion')),
  body text not null check (btrim(body) <> ''),
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (work_id, user_id) references public.works (id, user_id) on delete cascade
);

comment on table public.notes is 'Citations, commentaires et réflexions sur une œuvre.';
comment on column public.notes.location is 'Repère libre : « p. 75 », « lettre 12 »…';

create index notes_work_id_idx on public.notes (work_id, created_at);
create index notes_user_id_idx on public.notes (user_id);

create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

alter table public.notes enable row level security;

revoke all on table public.notes from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.notes to authenticated;

create policy notes_lecture on public.notes
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy notes_ajout on public.notes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy notes_modification on public.notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy notes_suppression on public.notes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- recommendation_log — propositions faites sur l'écran Découvrir
-- ---------------------------------------------------------------------------

create table public.recommendation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode text not null check (
    mode in ('surprise', 'reconfortant', 'philosophique', 'remise_en_question', 'lecture_courte', 'changer_d_univers')
  ),
  work_id uuid not null,
  reason text,
  response text not null default 'aucune' check (response in ('choisie', 'ignoree', 'aucune')),
  shown_at timestamptz not null default now(),
  foreign key (work_id, user_id) references public.works (id, user_id) on delete cascade
);

comment on table public.recommendation_log is
  'Propositions faites, pour ne pas reproposer trop vite une idée mise de côté. Jamais une statistique.';

create index recommendation_log_work_id_idx on public.recommendation_log (work_id, shown_at);
create index recommendation_log_user_id_idx on public.recommendation_log (user_id);

alter table public.recommendation_log enable row level security;

revoke all on table public.recommendation_log from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.recommendation_log to authenticated;

create policy recommendation_log_lecture on public.recommendation_log
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy recommendation_log_ajout on public.recommendation_log
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy recommendation_log_modification on public.recommendation_log
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy recommendation_log_suppression on public.recommendation_log
  for delete to authenticated
  using ((select auth.uid()) = user_id);
