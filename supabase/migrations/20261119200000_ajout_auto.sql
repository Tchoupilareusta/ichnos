-- Ichnos — étape 6 : ajout automatique (docs/reference.md §8 et §10.2).
--
-- 1. Le journal des appels à l'IA, pour la limite par jour de la fonction serveur.
-- 2. La fonction reserver_appel_ia, qui compte et réserve un appel en une seule fois.
-- 3. Une règle sur les chemins de couverture : toujours dans le dossier du compte.

-- ---------------------------------------------------------------------------
-- ai_calls — journal des appels à l'IA
-- ---------------------------------------------------------------------------
-- Une ligne par appel : le compte, le nom de l'action, l'heure. Aucun contenu
-- (ni titre, ni ISBN, ni texte). Ce n'est pas une statistique de lecture et rien
-- n'en est affiché : il sert seulement à plafonner les appels payants.
--
-- Le journal ne se trafique pas, même avec une session volée :
--   · une ligne ne peut être ajoutée qu'à l'heure présente (pas d'antidatage) ;
--   · personne ne modifie ni ne supprime une ligne (politiques toujours fausses).
-- Les lignes partent avec le compte (on delete cascade).

create table public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  action text not null check (action ~ '^[a-z_]{1,40}$'),
  occurred_at timestamptz not null default now()
);

comment on table public.ai_calls is
  'Journal des appels à l''IA (compte, action, heure), pour la limite par jour. Aucun contenu.';

create index ai_calls_user_id_occurred_at_idx on public.ai_calls (user_id, occurred_at);

alter table public.ai_calls enable row level security;

revoke all on table public.ai_calls from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.ai_calls to authenticated;

create policy ai_calls_lecture on public.ai_calls
  for select to authenticated
  using ((select auth.uid()) = user_id);
-- now() est l'heure de la transaction, comme la valeur par défaut de la colonne :
-- seule une ligne datée de l'instant présent passe.
create policy ai_calls_ajout on public.ai_calls
  for insert to authenticated
  with check ((select auth.uid()) = user_id and occurred_at = now());
create policy ai_calls_modification on public.ai_calls
  for update to authenticated
  using (false)
  with check (false);
create policy ai_calls_suppression on public.ai_calls
  for delete to authenticated
  using (false);

-- ---------------------------------------------------------------------------
-- reserver_appel_ia — compte les appels des dernières 24 heures et en réserve un
-- ---------------------------------------------------------------------------
-- Appelée par la fonction serveur « assistant », avec le jeton du compte connecté,
-- juste avant chaque appel à l'IA. Rend vrai si l'appel est réservé, faux si la
-- limite est atteinte (rien n'est alors écrit).
--   · Droits de l'appelant (security invoker) : la RLS s'applique.
--   · Elle ne compte que les lignes de l'appelant, même si la RLS était coupée.
--   · Un verrou par compte : deux appels simultanés ne dépassent pas la limite.

create function public.reserver_appel_ia(action_demandee text, limite integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  deja integer;
begin
  if moi is null then
    raise exception 'Connexion requise.' using errcode = '28000';
  end if;
  if limite is null or limite < 1 or limite > 1000 then
    raise exception 'Limite invalide.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ai_calls:' || moi::text, 0));

  select count(*) into deja
  from public.ai_calls c
  where c.user_id = moi and c.occurred_at > now() - interval '24 hours';

  if deja >= limite then
    return false;
  end if;

  insert into public.ai_calls (action) values (action_demandee);
  return true;
end;
$$;

comment on function public.reserver_appel_ia(text, integer) is
  'Réserve un appel à l''IA pour le compte connecté si la limite des dernières 24 heures n''est pas atteinte.';

-- Seul le compte connecté peut l'appeler : rien pour public, anon ni service_role.
revoke all on function public.reserver_appel_ia(text, integer) from public, anon, authenticated, service_role;
grant execute on function public.reserver_appel_ia(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Couvertures : le chemin enregistré est toujours dans le dossier du compte
-- ---------------------------------------------------------------------------
-- couvertures/<user_id>/<empreinte de l'image>.<jpg|png|webp>
-- Le stockage refuse déjà de lire le dossier d'un autre compte ; cette règle
-- empêche en plus d'écrire un chemin étranger, une adresse ou un chemin qui remonte.

alter table public.works
  add constraint works_cover_path_check
  check (cover_path is null or cover_path ~ ('^' || user_id::text || '/[0-9a-f]{32}[.](jpg|png|webp)$'));

alter table public.editions
  add constraint editions_cover_path_check
  check (cover_path is null or cover_path ~ ('^' || user_id::text || '/[0-9a-f]{32}[.](jpg|png|webp)$'));

alter table public.volumes
  add constraint volumes_cover_path_check
  check (cover_path is null or cover_path ~ ('^' || user_id::text || '/[0-9a-f]{32}[.](jpg|png|webp)$'));
