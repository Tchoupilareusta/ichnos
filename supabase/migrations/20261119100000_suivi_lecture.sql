-- Ichnos — suivi de lecture (docs/reference.md §5, §6.1, §6.3, étape 5 du §11).
--
-- Trois fonctions, appelées par le compte connecté, qui écrivent plusieurs choses à la fois
-- et le font en tout ou rien :
--   · changer_statut      : le statut, les dates et l'événement d'historique ;
--   · noter_progression   : la position (ou le tome courant d'une série) et sa trace ;
--   · dater_fin           : la date de fin, même approximative, et sa trace.
-- Comme enregistrer_oeuvre, elles s'exécutent avec les droits de l'appelant (security invoker) :
-- la RLS et les contraintes des tables s'appliquent. L'œuvre d'un autre compte est « introuvable ».
--
-- Ce qui est noté dans l'historique (reading_events), jamais affiché en statistiques :
--   · passer en « En cours » : « commencé », ou « repris » si une lecture est déjà ouverte
--     (un livre en pause) ;
--   · relecture : repasser en « En cours » un livre déjà terminé ouvre une nouvelle lecture,
--     par un nouveau « commencé ». La progression repart de zéro (unité et total gardés),
--     les tomes d'une série repassent « à lire ». L'historique de la lecture précédente reste ;
--   · « Terminé » : « terminé » et la date de fin, seulement si une lecture est ouverte.
--     Un livre lu autrefois, marqué terminé sans être passé par « En cours », n'a pas de date :
--     rien n'est inventé. Je peux la saisir moi-même avec dater_fin ;
--   · « En pause » : « mis en pause », si une lecture est ouverte ;
--   · progression : une seule trace par jour et par livre (la dernière position du jour).
--
-- Une lecture est « ouverte » quand son dernier « commencé » n'a pas encore de « terminé ».
--
-- Une série n'enregistre sa progression qu'une fois, dans ses tomes (table volumes) :
-- le tome courant est le plus haut tome « en cours », ou à défaut le plus haut tome « lu ».
-- Noter le tome 6 : le tome 6 passe « en cours », les précédents pas encore lus passent « lus »,
-- un tome suivant resté « en cours » repasse « à lire », les autres tomes suivants ne changent pas.
--
-- Codes d'erreur (les mêmes qu'enregistrer_oeuvre) :
--   EO001 : la demande est incohérente (statut inconnu, date impossible…) ;
--   EO002 : l'œuvre ou le tome est introuvable dans la bibliothèque.

-- ---------------------------------------------------------------------------
-- Précision d'une date de fin saisie à la main : « en 2019 », « en mars 2019 »
-- ---------------------------------------------------------------------------

alter table public.reading_events
  add column date_precision text not null default 'jour'
    check (date_precision in ('jour', 'mois', 'annee'));

-- Seule une date de fin peut être approximative : les autres événements sont notés par l'appli.
alter table public.reading_events
  add constraint reading_events_precision_fin check (date_precision = 'jour' or kind = 'termine');

comment on column public.reading_events.date_precision is
  'jour, mois ou annee. « En 2019 » est enregistré au 1er janvier 2019 avec la précision annee, et ne s''affiche jamais autrement que « en 2019 ».';

-- ---------------------------------------------------------------------------
-- changer_statut
-- ---------------------------------------------------------------------------

create function public.changer_statut(oeuvre uuid, statut text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  entree public.library_entries%rowtype;
  est_serie boolean;
  ouverte boolean;
  deja_terminee boolean;
  position_actuelle integer;
  debut date;
  fin date;
  progression integer;
  instant timestamptz;
begin
  if moi is null then
    raise exception 'Connexion requise.' using errcode = '28000';
  end if;

  if statut is null or statut not in ('en_cours', 'envie_de_lire', 'termine', 'a_decouvrir', 'en_pause') then
    raise exception 'Statut inconnu.' using errcode = 'EO001';
  end if;

  -- La ligne est verrouillée jusqu'à la fin : deux changements du même livre se suivent.
  select le.* into entree
  from public.library_entries le
  where le.work_id = oeuvre and le.user_id = moi
  for update;

  if not found then
    raise exception 'Œuvre introuvable.' using errcode = 'EO002';
  end if;

  if entree.reading_status = statut then
    return;
  end if;

  select w.is_series into est_serie
  from public.works w
  where w.id = oeuvre and w.user_id = moi;

  ouverte := coalesce((
    select ev.kind = 'commence'
    from public.reading_events ev
    where ev.entry_id = entree.id and ev.user_id = moi and ev.kind in ('commence', 'termine')
    order by ev.occurred_at desc
    limit 1
  ), false);

  deja_terminee := exists (
    select 1 from public.reading_events ev
    where ev.entry_id = entree.id and ev.user_id = moi and ev.kind = 'termine'
  );

  -- L'instant de l'événement : toujours après le précédent de ce livre, pour que l'ordre
  -- de l'historique (et donc la lecture « ouverte ») ne dépende jamais de la précision de l'horloge.
  instant := greatest(clock_timestamp(), (
    select max(ev.occurred_at) + interval '1 microsecond'
    from public.reading_events ev
    where ev.entry_id = entree.id and ev.user_id = moi
  ));

  -- La position du moment, gardée dans l'événement : le tome courant pour une série.
  if est_serie then
    select coalesce(
      max(v.number) filter (where v.reading_status = 'en_cours'),
      max(v.number) filter (where v.reading_status = 'lu')
    ) into position_actuelle
    from public.volumes v
    where v.work_id = oeuvre and v.user_id = moi;
  else
    position_actuelle := entree.progress_current;
  end if;

  debut := entree.started_at;
  fin := entree.finished_at;
  progression := entree.progress_current;

  if statut = 'en_cours' then
    if entree.reading_status = 'termine' or (not ouverte and deja_terminee) then
      -- Relecture : une nouvelle lecture commence, la précédente reste dans l'historique.
      insert into public.reading_events (entry_id, kind, occurred_at) values (entree.id, 'commence', instant);
      debut := current_date;
      fin := null;
      progression := null;
      update public.volumes v
      set reading_status = 'a_lire'
      where v.work_id = oeuvre and v.user_id = moi and v.reading_status <> 'a_lire';
    elsif ouverte then
      insert into public.reading_events (entry_id, kind, value, occurred_at) values (entree.id, 'repris', position_actuelle, instant);
      debut := coalesce(debut, current_date);
    else
      insert into public.reading_events (entry_id, kind, occurred_at) values (entree.id, 'commence', instant);
      debut := coalesce(debut, current_date);
    end if;
  elsif statut = 'termine' then
    if ouverte then
      insert into public.reading_events (entry_id, kind, value, occurred_at) values (entree.id, 'termine', position_actuelle, instant);
      fin := current_date;
    end if;
  elsif statut = 'en_pause' then
    if ouverte then
      insert into public.reading_events (entry_id, kind, value, occurred_at) values (entree.id, 'mis_en_pause', position_actuelle, instant);
    end if;
  end if;

  update public.library_entries le
  set reading_status = statut,
      started_at = debut,
      finished_at = fin,
      progress_current = progression
  where le.id = entree.id and le.user_id = moi;
end;
$$;

comment on function public.changer_statut(uuid, text) is
  'Change le statut de lecture d''une œuvre du compte connecté, avec ses dates et son événement d''historique. Tout ou rien.';

-- ---------------------------------------------------------------------------
-- noter_progression
-- ---------------------------------------------------------------------------

create function public.noter_progression(oeuvre uuid, valeur integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  entree public.library_entries%rowtype;
  est_serie boolean;
  nb_changes integer;
  id_derniere uuid;
  type_derniere text;
  moment_derniere timestamptz;
  instant timestamptz;
begin
  if moi is null then
    raise exception 'Connexion requise.' using errcode = '28000';
  end if;

  select le.* into entree
  from public.library_entries le
  where le.work_id = oeuvre and le.user_id = moi
  for update;

  if not found then
    raise exception 'Œuvre introuvable.' using errcode = 'EO002';
  end if;

  select w.is_series into est_serie
  from public.works w
  where w.id = oeuvre and w.user_id = moi;

  if est_serie then
    if valeur is null then
      raise exception 'Un numéro de tome est attendu.' using errcode = 'EO001';
    end if;
    if not exists (
      select 1 from public.volumes v
      where v.work_id = oeuvre and v.user_id = moi and v.number = valeur
    ) then
      raise exception 'Tome introuvable.' using errcode = 'EO002';
    end if;

    update public.volumes v
    set reading_status = case
      when v.number < valeur then 'lu'
      when v.number = valeur then 'en_cours'
      else 'a_lire'
    end
    where v.work_id = oeuvre
      and v.user_id = moi
      and (
        (v.number < valeur and v.reading_status <> 'lu')
        or (v.number = valeur and v.reading_status <> 'en_cours')
        or (v.number > valeur and v.reading_status = 'en_cours')
      );
    get diagnostics nb_changes = row_count;

    if nb_changes = 0 then
      return;
    end if;

    -- La dernière activité, pour l'ordre des lectures sur l'accueil.
    update public.library_entries le
    set updated_at = now()
    where le.id = entree.id and le.user_id = moi;
  else
    if valeur is not distinct from entree.progress_current then
      return;
    end if;

    update public.library_entries le
    set progress_current = valeur
    where le.id = entree.id and le.user_id = moi;

    -- Vider la progression ne laisse pas de trace.
    if valeur is null then
      return;
    end if;
  end if;

  -- Une seule trace par jour et par livre : la dernière position du jour remplace la précédente,
  -- tant qu'aucun autre événement n'est venu entre-temps.
  select ev.id, ev.kind, ev.occurred_at into id_derniere, type_derniere, moment_derniere
  from public.reading_events ev
  where ev.entry_id = entree.id and ev.user_id = moi
  order by ev.occurred_at desc
  limit 1;

  -- Toujours après le dernier événement de ce livre (voir changer_statut).
  instant := greatest(clock_timestamp(), moment_derniere + interval '1 microsecond');

  if type_derniere = 'progression'
     and (moment_derniere at time zone 'UTC')::date = (now() at time zone 'UTC')::date then
    update public.reading_events ev
    set value = valeur,
        occurred_at = instant
    where ev.id = id_derniere and ev.user_id = moi;
  else
    insert into public.reading_events (entry_id, kind, value, occurred_at) values (entree.id, 'progression', valeur, instant);
  end if;
end;
$$;

comment on function public.noter_progression(uuid, integer) is
  'Note la position dans une œuvre du compte connecté (le tome courant pour une série), avec une trace par jour au plus. Tout ou rien.';

-- ---------------------------------------------------------------------------
-- dater_fin
-- ---------------------------------------------------------------------------

create function public.dater_fin(oeuvre uuid, jour date, precision_date text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  entree public.library_entries%rowtype;
  champ text;
  debut timestamptz;
  id_fin uuid;
  moment timestamptz;
begin
  if moi is null then
    raise exception 'Connexion requise.' using errcode = '28000';
  end if;

  if jour is not null and (precision_date is null or precision_date not in ('jour', 'mois', 'annee')) then
    raise exception 'Précision inconnue.' using errcode = 'EO001';
  end if;

  select le.* into entree
  from public.library_entries le
  where le.work_id = oeuvre and le.user_id = moi
  for update;

  if not found then
    raise exception 'Œuvre introuvable.' using errcode = 'EO002';
  end if;

  if entree.reading_status <> 'termine' then
    raise exception 'Seul un livre terminé a une date de fin.' using errcode = 'EO001';
  end if;

  -- La date concerne la dernière lecture : celle qui suit le dernier « commencé », s'il y en a un.
  select max(ev.occurred_at) into debut
  from public.reading_events ev
  where ev.entry_id = entree.id and ev.user_id = moi and ev.kind = 'commence';

  select ev.id into id_fin
  from public.reading_events ev
  where ev.entry_id = entree.id
    and ev.user_id = moi
    and ev.kind = 'termine'
    and (debut is null or ev.occurred_at >= debut)
  order by ev.occurred_at desc
  limit 1;

  if jour is null then
    delete from public.reading_events ev
    where ev.id = id_fin and ev.user_id = moi;

    update public.library_entries le
    set finished_at = null
    where le.id = entree.id and le.user_id = moi;
    return;
  end if;

  champ := case precision_date when 'jour' then 'day' when 'mois' then 'month' else 'year' end;
  jour := date_trunc(champ, jour)::date;

  -- Un jour de marge pour les fuseaux horaires.
  if jour > current_date + 1 then
    raise exception 'Une date de fin ne peut pas être à venir.' using errcode = 'EO001';
  end if;

  if debut is not null and jour < date_trunc(champ, debut at time zone 'UTC')::date then
    raise exception 'La fin ne peut pas précéder le début.' using errcode = 'EO001';
  end if;

  -- Midi (UTC) : la date reste la même quel que soit le fuseau. Jamais avant le début.
  moment := greatest((jour + time '12:00') at time zone 'UTC', debut + interval '1 second');

  if id_fin is null then
    insert into public.reading_events (entry_id, kind, occurred_at, date_precision)
    values (entree.id, 'termine', moment, precision_date);
  else
    update public.reading_events ev
    set occurred_at = moment,
        date_precision = precision_date
    where ev.id = id_fin and ev.user_id = moi;
  end if;

  update public.library_entries le
  set finished_at = jour
  where le.id = entree.id and le.user_id = moi;
end;
$$;

comment on function public.dater_fin(uuid, date, text) is
  'Saisit, corrige ou retire (jour vide) la date de fin de la dernière lecture d''une œuvre terminée du compte connecté, au jour, au mois ou à l''année près. Tout ou rien.';

-- ---------------------------------------------------------------------------
-- Droits : le compte connecté seul, rien pour public, anon ni service_role.
-- ---------------------------------------------------------------------------

revoke all on function public.changer_statut(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.changer_statut(uuid, text) to authenticated;

revoke all on function public.noter_progression(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.noter_progression(uuid, integer) to authenticated;

revoke all on function public.dater_fin(uuid, date, text) from public, anon, authenticated, service_role;
grant execute on function public.dater_fin(uuid, date, text) to authenticated;
