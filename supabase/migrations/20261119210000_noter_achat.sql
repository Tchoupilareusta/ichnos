-- Ichnos — étape 6, corrections : « Je l'ai acheté » (docs/reference.md §5, §6.1, §10.2).
--
-- Une seule fonction, appelée par le compte connecté quand il valide « C'est mon exemplaire » :
-- elle note l'ISBN de mon exemplaire, en fait mon édition (ou complète le tome), et passe la
-- possession à « Je l'ai ». Tout ou rien.
--   · Elle s'exécute avec les droits de celui qui l'appelle (security invoker) : la RLS et les
--     contraintes des tables s'appliquent (ISBN bien formé, chemin de couverture dans mon dossier).
--   · Elle vérifie en plus elle-même que l'œuvre est à moi : même si la RLS était coupée,
--     l'œuvre d'un autre compte reste « introuvable ».
--   · Elle ne touche jamais au synopsis, aux étiquettes, au statut de lecture, à la progression,
--     au ressenti, aux dates, à l'historique, à la lecture des tomes, aux médias ni aux notes.
--   · Rien n'est inventé : un champ absent ou vide reste vide.
--
-- Forme de l'achat :
--   { "isbn", "publisher"?, "language"?, "format"?, "translator"?, "page_count"?, "tome"?, "couverture"? }
--   Tout autre champ fait refuser l'achat.
--
-- Sans « tome » (une œuvre qui n'est pas une série) :
--   · l'édition de cette œuvre qui porte déjà cet ISBN est reprise, et seuls ses champs vides
--     sont complétés : rien de ce que j'ai écrit n'est remplacé ; sinon, une édition est créée ;
--   · elle devient « mon édition », et la possession passe à « possede » ;
--   · la couverture donnée est rangée sur cette édition (c'est elle qui s'affiche) ;
--   · sans couverture sur l'édition achetée, celle qui s'affichait reste affichée : la couverture
--     de mon ancienne édition, s'il y en avait une, devient celle de l'œuvre.
-- Avec « tome » (une série ; le tome doit exister) :
--   · le tome reçoit l'ISBN de mon exemplaire et passe à « possede » ;
--   · sa couverture est remplacée si une couverture est donnée, gardée sinon.
--
-- Codes d'erreur (les mêmes que enregistrer_oeuvre, plus un) :
--   EO001 : l'achat est illisible ou incohérent (ISBN faux, champ inconnu, série sans tome…) ;
--   EO002 : l'œuvre ou le tome est introuvable dans ma bibliothèque ;
--   EO003 : cet ISBN est déjà porté ailleurs dans ma bibliothèque (une autre de mes œuvres,
--           ou un autre tome de la même série).
-- Rend l'identifiant de l'édition, ou null pour un tome.

create function public.noter_achat(oeuvre uuid, achat jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  cle text;
  isbn_recu text;
  somme integer;
  numero_tome integer;
  chemin text;
  est_serie boolean;
  id_edition uuid;
  id_ancienne uuid;
  couverture_ancienne text;
  couverture_achetee text;
begin
  if moi is null then
    raise exception 'Connexion requise.' using errcode = '28000';
  end if;

  -- -------------------------------------------------------------------------
  -- L'achat, relu champ par champ (rien ici ne dépend de la bibliothèque)
  -- -------------------------------------------------------------------------
  if jsonb_typeof(achat) is distinct from 'object' then
    raise exception 'Achat illisible.' using errcode = 'EO001';
  end if;
  for cle in select jsonb_object_keys(achat) loop
    if cle not in ('isbn', 'publisher', 'language', 'format', 'translator', 'page_count', 'tome', 'couverture') then
      raise exception 'Champ inconnu.' using errcode = 'EO001';
    end if;
  end loop;
  foreach cle in array array['publisher', 'language', 'format', 'translator', 'couverture'] loop
    if jsonb_typeof(achat -> cle) not in ('string', 'null') then
      raise exception 'Champ « % » illisible.', cle using errcode = 'EO001';
    end if;
  end loop;
  -- Deux nombres entiers, s'ils sont donnés. Le type est vérifié avant la valeur.
  foreach cle in array array['page_count', 'tome'] loop
    if jsonb_typeof(achat -> cle) not in ('number', 'null') then
      raise exception 'Champ « % » illisible.', cle using errcode = 'EO001';
    end if;
    if (achat ->> cle)::numeric <> trunc((achat ->> cle)::numeric) then
      raise exception 'Champ « % » : un nombre entier est attendu.', cle using errcode = 'EO001';
    end if;
  end loop;

  -- L'ISBN de mon exemplaire : 13 chiffres commençant par 978 ou 979, chiffre de contrôle juste.
  if jsonb_typeof(achat -> 'isbn') is distinct from 'string' then
    raise exception 'ISBN manquant.' using errcode = 'EO001';
  end if;
  isbn_recu := regexp_replace(achat ->> 'isbn', '[\s-]', '', 'g');
  if isbn_recu !~ '^97[89][0-9]{10}$' then
    raise exception 'ISBN mal formé.' using errcode = 'EO001';
  end if;
  select sum(substr(isbn_recu, rang, 1)::integer * case when rang % 2 = 1 then 1 else 3 end)
  into somme
  from generate_series(1, 13) as g(rang);
  if somme % 10 <> 0 then
    raise exception 'ISBN faux : chiffre de contrôle.' using errcode = 'EO001';
  end if;

  numero_tome := (achat ->> 'tome')::numeric::integer;
  chemin := nullif(btrim(achat ->> 'couverture'), '');

  -- -------------------------------------------------------------------------
  -- L'œuvre : à moi, et verrouillée jusqu'à la fin (deux achats de la même œuvre se suivent)
  -- -------------------------------------------------------------------------
  select w.is_series into est_serie
  from public.works w
  where w.id = oeuvre and w.user_id = moi
  for update;

  if not found then
    raise exception 'Œuvre introuvable.' using errcode = 'EO002';
  end if;

  if est_serie and numero_tome is null then
    raise exception 'Pour une série, l’achat porte sur un tome.' using errcode = 'EO001';
  end if;
  if not est_serie and numero_tome is not null then
    raise exception 'Seule une série a des tomes.' using errcode = 'EO001';
  end if;

  -- Cet ISBN est-il déjà porté ailleurs dans MA bibliothèque ? (Jamais celle d'un autre compte.)
  if exists (
    select 1 from public.editions e
    where e.user_id = moi and e.isbn = isbn_recu and e.work_id <> oeuvre
  ) or exists (
    select 1 from public.volumes v
    where v.user_id = moi and v.isbn = isbn_recu
      and (v.work_id <> oeuvre or v.number is distinct from numero_tome)
  ) then
    raise exception 'Cet ISBN est déjà dans ma bibliothèque.' using errcode = 'EO003';
  end if;

  -- -------------------------------------------------------------------------
  -- Un tome
  -- -------------------------------------------------------------------------
  if numero_tome is not null then
    update public.volumes v
    set isbn = isbn_recu,
        ownership = 'possede',
        cover_path = coalesce(chemin, v.cover_path)
    where v.work_id = oeuvre and v.user_id = moi and v.number = numero_tome;

    if not found then
      raise exception 'Tome introuvable.' using errcode = 'EO002';
    end if;
    return null;
  end if;

  -- -------------------------------------------------------------------------
  -- Un livre : l'édition achetée devient la mienne
  -- -------------------------------------------------------------------------
  select le.edition_id into id_ancienne
  from public.library_entries le
  where le.work_id = oeuvre and le.user_id = moi
  for update;

  select e.cover_path into couverture_ancienne
  from public.editions e
  where e.id = id_ancienne and e.work_id = oeuvre and e.user_id = moi;

  select e.id into id_edition
  from public.editions e
  where e.work_id = oeuvre and e.user_id = moi and e.isbn = isbn_recu
  order by e.created_at, e.id
  limit 1;

  if id_edition is null then
    insert into public.editions (work_id, isbn, publisher, language, format, translator, page_count, cover_path)
    values (
      oeuvre,
      isbn_recu,
      nullif(btrim(achat ->> 'publisher'), ''),
      nullif(btrim(achat ->> 'language'), ''),
      nullif(btrim(achat ->> 'format'), ''),
      nullif(btrim(achat ->> 'translator'), ''),
      (achat ->> 'page_count')::numeric::integer,
      chemin
    )
    returning id, cover_path into id_edition, couverture_achetee;
  else
    -- Reprise : seuls les champs vides sont complétés. La couverture, elle, est celle que je
    -- viens de choisir de garder : donnée, elle remplace ; absente, l'ancienne reste.
    update public.editions e
    set publisher = coalesce(e.publisher, nullif(btrim(achat ->> 'publisher'), '')),
        language = coalesce(e.language, nullif(btrim(achat ->> 'language'), '')),
        format = coalesce(e.format, nullif(btrim(achat ->> 'format'), '')),
        translator = coalesce(e.translator, nullif(btrim(achat ->> 'translator'), '')),
        page_count = coalesce(e.page_count, (achat ->> 'page_count')::numeric::integer),
        cover_path = coalesce(chemin, e.cover_path)
    where e.id = id_edition and e.work_id = oeuvre and e.user_id = moi
    returning e.cover_path into couverture_achetee;
  end if;

  -- Sans couverture sur l'édition achetée, celle qui s'affichait reste affichée : la couverture
  -- de mon ancienne édition passe sur l'œuvre (l'affichage montre mon édition, sinon l'œuvre).
  if couverture_achetee is null and couverture_ancienne is not null then
    update public.works w
    set cover_path = couverture_ancienne
    where w.id = oeuvre and w.user_id = moi and w.cover_path is distinct from couverture_ancienne;
  end if;

  insert into public.library_entries as le (work_id, edition_id, ownership)
  values (oeuvre, id_edition, 'possede')
  on conflict (user_id, work_id) do update
  set edition_id = excluded.edition_id,
      ownership = 'possede'
  where (le.edition_id, le.ownership) is distinct from (excluded.edition_id, 'possede');

  return id_edition;
end;
$$;

comment on function public.noter_achat(uuid, jsonb) is
  '« Je l''ai acheté » : note l''ISBN de mon exemplaire, en fait mon édition (ou complète le tome) et passe la possession à « possede ». Tout ou rien.';

-- Seul le compte connecté peut l'appeler : rien pour public, anon ni service_role.
revoke all on function public.noter_achat(uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.noter_achat(uuid, jsonb) to authenticated;
