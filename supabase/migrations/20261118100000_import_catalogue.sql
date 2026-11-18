-- Ichnos — import du catalogue de départ (docs/reference.md §9).
--
-- Une seule fonction, appelée une fois depuis l'appli par le compte connecté.
--   · Elle s'exécute avec les droits de celui qui l'appelle (security invoker) : la RLS et
--     les contraintes des tables s'appliquent, chaque ligne reçoit son user_id par défaut.
--   · Tout ou rien : à la moindre erreur, rien n'est enregistré.
--   · Elle refuse d'agir si la bibliothèque contient déjà des œuvres : pas de doublon possible.
--   · Le catalogue ne porte aucun statut personnel. « À découvrir », « Non possédé » et
--     « À voir » viennent des valeurs par défaut des tables.
--   · Les étiquettes que le compte a déjà sont gardées telles quelles.
--
-- Codes d'erreur propres à cette fonction :
--   IC001 : la bibliothèque contient déjà des œuvres ;
--   IC002 : le catalogue reçu est vide, illisible ou incohérent.

create function public.importer_catalogue(catalogue jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  oeuvre jsonb;
  ligne jsonb;
  id_oeuvre uuid;
  id_auteur uuid;
  id_edition uuid;
  id_edition_ajoutee uuid;
  nb_attendues integer;
  nb_posees integer;
  nb_ajoutes integer;
  nb_oeuvres integer := 0;
  nb_tomes integer := 0;
begin
  if moi is null then
    raise exception 'Connexion requise.' using errcode = '28000';
  end if;

  if jsonb_typeof(catalogue -> 'works') is distinct from 'array' or jsonb_array_length(catalogue -> 'works') = 0 then
    raise exception 'Catalogue vide ou illisible.' using errcode = 'IC002';
  end if;

  -- Un seul import à la fois pour un même compte (double appui, deux appareils).
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ichnos.importer_catalogue:' || moi::text, 0));

  if exists (select 1 from public.works w where w.user_id = moi) then
    raise exception 'La bibliothèque contient déjà des œuvres.' using errcode = 'IC001';
  end if;

  -- Vocabulaire : genres, atmosphères, thèmes (avec les centres d'intérêt).
  insert into public.tags (kind, name)
  select 'genre', v.nom
  from jsonb_array_elements_text(coalesce(catalogue #> '{tags,genre}', '[]'::jsonb)) as v(nom)
  on conflict (user_id, kind, name) do nothing;

  insert into public.tags (kind, name)
  select 'atmosphere', v.nom
  from jsonb_array_elements_text(coalesce(catalogue #> '{tags,atmosphere}', '[]'::jsonb)) as v(nom)
  on conflict (user_id, kind, name) do nothing;

  insert into public.tags (kind, name, is_interest)
  select 'theme', v.theme ->> 'name', coalesce((v.theme ->> 'is_interest')::boolean, false)
  from jsonb_array_elements(coalesce(catalogue #> '{tags,theme}', '[]'::jsonb)) as v(theme)
  on conflict (user_id, kind, name) do nothing;

  for oeuvre in
    select e.valeur
    from jsonb_array_elements(catalogue -> 'works') with ordinality as e(valeur, rang)
    order by e.rang
  loop
    insert into public.works (
      title_fr, title_original, original_language, first_published_year,
      form, synopsis, tone, density, length, is_series
    )
    values (
      oeuvre ->> 'title_fr',
      oeuvre ->> 'title_original',
      oeuvre ->> 'original_language',
      (oeuvre ->> 'first_published_year')::smallint,
      oeuvre ->> 'form',
      oeuvre ->> 'synopsis',
      (oeuvre ->> 'tone')::smallint,
      (oeuvre ->> 'density')::smallint,
      oeuvre ->> 'length',
      coalesce((oeuvre ->> 'is_series')::boolean, false)
    )
    returning id into id_oeuvre;
    nb_oeuvres := nb_oeuvres + 1;

    -- Auteurs : un même auteur n'est créé qu'une fois.
    for ligne in
      select e.valeur from jsonb_array_elements(coalesce(oeuvre -> 'authors', '[]'::jsonb)) as e(valeur)
    loop
      insert into public.authors (name) values (ligne ->> 'name')
      on conflict (user_id, name) do nothing;

      select a.id into strict id_auteur
      from public.authors a
      where a.user_id = moi and a.name = ligne ->> 'name';

      insert into public.work_authors (work_id, author_id, role)
      values (id_oeuvre, id_auteur, coalesce(ligne ->> 'role', 'auteur'));
    end loop;

    -- Étiquettes : chacune doit exister dans le vocabulaire.
    with voulues as (
      select 'genre'::text as kind, v.nom
      from jsonb_array_elements_text(coalesce(oeuvre -> 'genres', '[]'::jsonb)) as v(nom)
      union all
      select 'theme', v.nom
      from jsonb_array_elements_text(coalesce(oeuvre -> 'themes', '[]'::jsonb)) as v(nom)
      union all
      select 'atmosphere', v.nom
      from jsonb_array_elements_text(coalesce(oeuvre -> 'atmospheres', '[]'::jsonb)) as v(nom)
    ),
    ajoutees as (
      insert into public.work_tags (work_id, tag_id)
      select id_oeuvre, t.id
      from voulues
      join public.tags t on t.user_id = moi and t.kind = voulues.kind and t.name = voulues.nom
      returning 1
    )
    select (select count(*) from voulues), (select count(*) from ajoutees)
    into nb_attendues, nb_posees;

    if nb_attendues <> nb_posees then
      raise exception 'Étiquette absente du vocabulaire pour « % ».', oeuvre ->> 'title_fr' using errcode = 'IC002';
    end if;

    -- Éditions : la première est l'édition de référence de mon exemplaire à venir.
    id_edition := null;
    for ligne in
      select e.valeur
      from jsonb_array_elements(coalesce(oeuvre -> 'editions', '[]'::jsonb)) with ordinality as e(valeur, rang)
      order by e.rang
    loop
      insert into public.editions (work_id, isbn, publisher, language, format, translator, page_count)
      values (
        id_oeuvre,
        ligne ->> 'isbn',
        ligne ->> 'publisher',
        ligne ->> 'language',
        ligne ->> 'format',
        ligne ->> 'translator',
        (ligne ->> 'page_count')::integer
      )
      returning id into id_edition_ajoutee;
      id_edition := coalesce(id_edition, id_edition_ajoutee);
    end loop;

    -- Tomes d'une série.
    insert into public.volumes (work_id, number, title, isbn)
    select id_oeuvre, (v.tome ->> 'number')::integer, v.tome ->> 'title', v.tome ->> 'isbn'
    from jsonb_array_elements(coalesce(oeuvre -> 'volumes', '[]'::jsonb)) as v(tome);
    get diagnostics nb_ajoutes = row_count;
    nb_tomes := nb_tomes + nb_ajoutes;

    -- Médias associés (anime, film…).
    insert into public.media (work_id, kind, title, seasons, episodes_total)
    select
      id_oeuvre,
      m.media ->> 'kind',
      m.media ->> 'title',
      (m.media ->> 'seasons')::smallint,
      (m.media ->> 'episodes_total')::integer
    from jsonb_array_elements(coalesce(oeuvre -> 'media', '[]'::jsonb)) as m(media);

    -- Ma relation à l'œuvre : statut et possession prennent leurs valeurs par défaut.
    insert into public.library_entries (work_id, edition_id)
    values (id_oeuvre, id_edition);
  end loop;

  return jsonb_build_object('oeuvres', nb_oeuvres, 'tomes', nb_tomes);
end;
$$;

comment on function public.importer_catalogue(jsonb) is
  'Installe le catalogue de départ dans la bibliothèque vide du compte connecté. Tout ou rien.';

-- Seul le compte connecté peut l'appeler : rien pour anon ni service_role.
revoke all on function public.importer_catalogue(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.importer_catalogue(jsonb) to authenticated;
