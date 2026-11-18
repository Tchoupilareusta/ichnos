-- Ichnos — enregistrement d'une œuvre depuis le formulaire d'ajout et de modification
-- (docs/reference.md §5 « Ajouter / modifier », §10.2).
--
-- Une seule fonction, appelée par le compte connecté quand il valide le formulaire.
--   · Elle s'exécute avec les droits de celui qui l'appelle (security invoker) : la RLS et
--     les contraintes des tables s'appliquent, chaque ligne reçoit son user_id par défaut.
--   · Tout ou rien : à la moindre erreur, rien n'est enregistré ni modifié.
--   · Sans « id », elle crée l'œuvre ; avec « id », elle modifie cette œuvre, qui doit être
--     dans la bibliothèque de l'appelant. L'œuvre d'un autre compte est « introuvable ».
--   · La fiche reçue décrit l'œuvre en entier : ses cinq listes (authors, tags, editions,
--     volumes, media) sont obligatoires, même vides. Ce qui n'y figure plus est retiré.
--   · Un texte vide devient « inconnu » (null). Rien n'est jamais complété ni deviné.
--   · Elle ne touche jamais à ce qui est personnel : statut de lecture, possession,
--     progression, appréciation, notes, historique. Les tomes gardés conservent leur
--     possession et leur lecture ; les médias gardés conservent leur avancement.
--     Seule exception : « mon édition », choisie dans la fiche par « mienne ».
--   · Une étiquette ou un auteur qui n'existe pas encore est créé. Un auteur que cet
--     enregistrement détache de sa dernière œuvre est retiré.
--
-- Forme de la fiche :
--   { "id": uuid ou absent,
--     "title_fr", "title_original", "original_language", "first_published_year",
--     "form", "synopsis", "tone", "density", "length", "is_series",
--     "authors":  [{ "name", "role" }],
--     "tags":     [{ "kind", "name" }],
--     "editions": [{ "id"?, "isbn", "publisher", "language", "format", "translator", "page_count", "mienne"? }],
--     "volumes":  [{ "number", "title", "isbn" }],
--     "media":    [{ "id"?, "kind", "title", "seasons", "episodes_total" }] }
--
-- Codes d'erreur propres à cette fonction :
--   EO001 : la fiche reçue est illisible ou incohérente ;
--   EO002 : l'œuvre, l'édition ou le média à modifier est introuvable dans la bibliothèque.

create function public.enregistrer_oeuvre(fiche jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  cle text;
  ligne jsonb;
  id_oeuvre uuid;
  id_ligne uuid;
  id_mienne uuid;
  ids_gardes uuid[];
  anciens_auteurs uuid[];
  nb_trouves integer;
begin
  if moi is null then
    raise exception 'Connexion requise.' using errcode = '28000';
  end if;

  -- La fiche doit être complète : un oubli ne doit jamais effacer une liste par accident.
  if jsonb_typeof(fiche) is distinct from 'object' then
    raise exception 'Fiche illisible.' using errcode = 'EO001';
  end if;
  foreach cle in array array['authors', 'tags', 'editions', 'volumes', 'media'] loop
    if jsonb_typeof(fiche -> cle) is distinct from 'array' then
      raise exception 'Fiche incomplète : liste « % » absente.', cle using errcode = 'EO001';
    end if;
    if exists (select 1 from jsonb_array_elements(fiche -> cle) as e(valeur) where jsonb_typeof(e.valeur) <> 'object') then
      raise exception 'Fiche illisible : liste « % ».', cle using errcode = 'EO001';
    end if;
  end loop;

  if (
    select count(*) from jsonb_array_elements(fiche -> 'editions') as e(valeur)
    where coalesce((e.valeur ->> 'mienne')::boolean, false)
  ) > 1 then
    raise exception 'Une seule édition peut être la mienne.' using errcode = 'EO001';
  end if;

  if not coalesce((fiche ->> 'is_series')::boolean, false) and jsonb_array_length(fiche -> 'volumes') > 0 then
    raise exception 'Seule une série a des tomes.' using errcode = 'EO001';
  end if;

  if (select count(*) <> count(distinct e.valeur ->> 'number') from jsonb_array_elements(fiche -> 'volumes') as e(valeur)) then
    raise exception 'Un numéro de tome est absent ou en double.' using errcode = 'EO001';
  end if;

  -- ---------------------------------------------------------------------------
  -- L'œuvre
  -- ---------------------------------------------------------------------------
  id_oeuvre := nullif(fiche ->> 'id', '')::uuid;

  if id_oeuvre is null then
    insert into public.works (
      title_fr, title_original, original_language, first_published_year,
      form, synopsis, tone, density, length, is_series
    )
    values (
      btrim(fiche ->> 'title_fr'),
      nullif(btrim(fiche ->> 'title_original'), ''),
      nullif(btrim(fiche ->> 'original_language'), ''),
      (fiche ->> 'first_published_year')::smallint,
      fiche ->> 'form',
      nullif(btrim(fiche ->> 'synopsis'), ''),
      (fiche ->> 'tone')::smallint,
      (fiche ->> 'density')::smallint,
      nullif(fiche ->> 'length', ''),
      coalesce((fiche ->> 'is_series')::boolean, false)
    )
    returning id into id_oeuvre;
  else
    -- La ligne est verrouillée jusqu'à la fin : deux enregistrements de la même œuvre se suivent.
    update public.works w
    set title_fr = btrim(fiche ->> 'title_fr'),
        title_original = nullif(btrim(fiche ->> 'title_original'), ''),
        original_language = nullif(btrim(fiche ->> 'original_language'), ''),
        first_published_year = (fiche ->> 'first_published_year')::smallint,
        form = fiche ->> 'form',
        synopsis = nullif(btrim(fiche ->> 'synopsis'), ''),
        tone = (fiche ->> 'tone')::smallint,
        density = (fiche ->> 'density')::smallint,
        length = nullif(fiche ->> 'length', ''),
        is_series = coalesce((fiche ->> 'is_series')::boolean, false)
    where w.id = id_oeuvre and w.user_id = moi;

    if not found then
      raise exception 'Œuvre introuvable.' using errcode = 'EO002';
    end if;
  end if;

  -- Ma relation à l'œuvre : créée avec ses valeurs par défaut, jamais modifiée ici.
  insert into public.library_entries (work_id)
  values (id_oeuvre)
  on conflict (user_id, work_id) do nothing;

  -- ---------------------------------------------------------------------------
  -- Auteurs (un nom absent ou vide est refusé par les règles de la table)
  -- ---------------------------------------------------------------------------
  select coalesce(array_agg(wa.author_id), '{}')
  into anciens_auteurs
  from public.work_authors wa
  where wa.work_id = id_oeuvre and wa.user_id = moi;

  delete from public.work_authors wa
  where wa.work_id = id_oeuvre and wa.user_id = moi;

  insert into public.authors (name)
  select distinct btrim(e.valeur ->> 'name')
  from jsonb_array_elements(fiche -> 'authors') as e(valeur)
  on conflict (user_id, name) do nothing;

  insert into public.work_authors (work_id, author_id, role)
  select distinct id_oeuvre, a.id, coalesce(nullif(e.valeur ->> 'role', ''), 'auteur')
  from jsonb_array_elements(fiche -> 'authors') as e(valeur)
  join public.authors a on a.user_id = moi and a.name = btrim(e.valeur ->> 'name');

  -- Un auteur détaché de sa dernière œuvre (nom corrigé, auteur retiré) ne reste pas en plan.
  delete from public.authors a
  where a.user_id = moi
    and a.id = any (anciens_auteurs)
    and not exists (select 1 from public.work_authors wa where wa.author_id = a.id and wa.user_id = moi);

  -- ---------------------------------------------------------------------------
  -- Étiquettes : genres, thèmes, atmosphères
  -- ---------------------------------------------------------------------------
  delete from public.work_tags wt
  where wt.work_id = id_oeuvre and wt.user_id = moi;

  insert into public.tags (kind, name)
  select distinct e.valeur ->> 'kind', btrim(e.valeur ->> 'name')
  from jsonb_array_elements(fiche -> 'tags') as e(valeur)
  on conflict (user_id, kind, name) do nothing;

  insert into public.work_tags (work_id, tag_id)
  select distinct id_oeuvre, t.id
  from jsonb_array_elements(fiche -> 'tags') as e(valeur)
  join public.tags t on t.user_id = moi and t.kind = e.valeur ->> 'kind' and t.name = btrim(e.valeur ->> 'name');

  -- ---------------------------------------------------------------------------
  -- Éditions
  -- ---------------------------------------------------------------------------
  select coalesce(array_agg((e.valeur ->> 'id')::uuid), '{}')
  into ids_gardes
  from jsonb_array_elements(fiche -> 'editions') as e(valeur)
  where nullif(e.valeur ->> 'id', '') is not null;

  select count(*) into nb_trouves
  from public.editions ed
  where ed.work_id = id_oeuvre and ed.user_id = moi and ed.id = any (ids_gardes);

  -- Une édition citée doit déjà appartenir à cette œuvre, et n'être citée qu'une fois.
  if nb_trouves <> coalesce(array_length(ids_gardes, 1), 0) then
    raise exception 'Édition introuvable.' using errcode = 'EO002';
  end if;

  delete from public.editions ed
  where ed.work_id = id_oeuvre and ed.user_id = moi and ed.id <> all (ids_gardes);

  id_mienne := null;
  for ligne in
    select e.valeur
    from jsonb_array_elements(fiche -> 'editions') with ordinality as e(valeur, rang)
    order by e.rang
  loop
    id_ligne := nullif(ligne ->> 'id', '')::uuid;
    if id_ligne is null then
      insert into public.editions (work_id, isbn, publisher, language, format, translator, page_count)
      values (
        id_oeuvre,
        nullif(upper(regexp_replace(ligne ->> 'isbn', '[\s-]', '', 'g')), ''),
        nullif(btrim(ligne ->> 'publisher'), ''),
        nullif(btrim(ligne ->> 'language'), ''),
        nullif(btrim(ligne ->> 'format'), ''),
        nullif(btrim(ligne ->> 'translator'), ''),
        (ligne ->> 'page_count')::integer
      )
      returning id into id_ligne;
    else
      update public.editions ed
      set isbn = nullif(upper(regexp_replace(ligne ->> 'isbn', '[\s-]', '', 'g')), ''),
          publisher = nullif(btrim(ligne ->> 'publisher'), ''),
          language = nullif(btrim(ligne ->> 'language'), ''),
          format = nullif(btrim(ligne ->> 'format'), ''),
          translator = nullif(btrim(ligne ->> 'translator'), ''),
          page_count = (ligne ->> 'page_count')::integer
      where ed.id = id_ligne and ed.work_id = id_oeuvre and ed.user_id = moi;
    end if;

    if coalesce((ligne ->> 'mienne')::boolean, false) then
      id_mienne := id_ligne;
    end if;
  end loop;

  -- Mon édition : celle que la fiche désigne, ou aucune.
  update public.library_entries le
  set edition_id = id_mienne
  where le.work_id = id_oeuvre and le.user_id = moi and le.edition_id is distinct from id_mienne;

  -- ---------------------------------------------------------------------------
  -- Tomes : un tome gardé conserve sa possession et sa lecture
  -- ---------------------------------------------------------------------------
  delete from public.volumes v
  where v.work_id = id_oeuvre
    and v.user_id = moi
    and v.number not in (
      select (e.valeur ->> 'number')::integer from jsonb_array_elements(fiche -> 'volumes') as e(valeur)
    );

  insert into public.volumes as v (work_id, number, title, isbn)
  select
    id_oeuvre,
    (e.valeur ->> 'number')::integer,
    nullif(btrim(e.valeur ->> 'title'), ''),
    nullif(upper(regexp_replace(e.valeur ->> 'isbn', '[\s-]', '', 'g')), '')
  from jsonb_array_elements(fiche -> 'volumes') as e(valeur)
  on conflict (user_id, work_id, number) do update
  set title = excluded.title,
      isbn = excluded.isbn
  where (v.title, v.isbn) is distinct from (excluded.title, excluded.isbn);

  -- ---------------------------------------------------------------------------
  -- Médias associés : un média gardé conserve son avancement
  -- ---------------------------------------------------------------------------
  select coalesce(array_agg((e.valeur ->> 'id')::uuid), '{}')
  into ids_gardes
  from jsonb_array_elements(fiche -> 'media') as e(valeur)
  where nullif(e.valeur ->> 'id', '') is not null;

  select count(*) into nb_trouves
  from public.media m
  where m.work_id = id_oeuvre and m.user_id = moi and m.id = any (ids_gardes);

  if nb_trouves <> coalesce(array_length(ids_gardes, 1), 0) then
    raise exception 'Média introuvable.' using errcode = 'EO002';
  end if;

  delete from public.media m
  where m.work_id = id_oeuvre and m.user_id = moi and m.id <> all (ids_gardes);

  for ligne in
    select e.valeur
    from jsonb_array_elements(fiche -> 'media') with ordinality as e(valeur, rang)
    order by e.rang
  loop
    id_ligne := nullif(ligne ->> 'id', '')::uuid;
    if id_ligne is null then
      insert into public.media (work_id, kind, title, seasons, episodes_total)
      values (
        id_oeuvre,
        ligne ->> 'kind',
        nullif(btrim(ligne ->> 'title'), ''),
        (ligne ->> 'seasons')::smallint,
        (ligne ->> 'episodes_total')::integer
      );
    else
      update public.media m
      set kind = ligne ->> 'kind',
          title = nullif(btrim(ligne ->> 'title'), ''),
          seasons = (ligne ->> 'seasons')::smallint,
          episodes_total = (ligne ->> 'episodes_total')::integer
      where m.id = id_ligne and m.work_id = id_oeuvre and m.user_id = moi;
    end if;
  end loop;

  return id_oeuvre;
end;
$$;

comment on function public.enregistrer_oeuvre(jsonb) is
  'Crée ou modifie une œuvre de la bibliothèque du compte connecté, avec ses auteurs, étiquettes, éditions, tomes et médias. Tout ou rien.';

-- Seul le compte connecté peut l'appeler : rien pour public, anon ni service_role.
revoke all on function public.enregistrer_oeuvre(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.enregistrer_oeuvre(jsonb) to authenticated;
