-- Ichnos — sélection des tomes : changer plusieurs tomes d'une série d'un seul geste
-- (docs/reference.md §6.2, §6.3, §10.2).
--
-- Une seule fonction, appelée par le compte connecté quand il touche une bulle de la barre
-- d'actions (« Je l'ai », « Lu »…) après avoir sélectionné des tomes, et aussi quand il touche
-- « Annuler » juste après : elle remet alors chaque tome dans l'état qu'il avait. Tout ou rien.
--   · Elle s'exécute avec les droits de celui qui l'appelle (security invoker) : la RLS et les
--     contraintes des tables s'appliquent.
--   · Elle vérifie en plus elle-même que la série est à moi : même si la RLS était coupée,
--     la série d'un autre compte reste « introuvable ».
--   · Elle applique exactement ce qui est demandé, tome par tome : aucune cascade (passer un
--     tome « en cours » ne marque pas les précédents « lus » ; c'est le rôle de noter_progression).
--     Le tome courant se déduit ensuite des tomes, comme toujours (§6.3).
--   · Elle ne touche qu'à la possession et à la lecture des tomes : ni à leur numéro, titre, ISBN
--     ou couverture, ni au statut de la série, à son historique, à ses notes ou à ses médias.
--
-- Forme des changements : une liste non vide, d'au plus 1000 éléments,
--   [ { "numero": 3, "possession"?: "possede" | "a_acheter" | "non_possede",
--                    "lecture"?: "a_lire" | "en_cours" | "lu" }, … ]
--   Chaque élément porte au moins la possession ou la lecture. Un tome n'apparaît qu'une fois.
--   Tout autre champ fait refuser l'ensemble.
--
-- Codes d'erreur (les mêmes que les autres fonctions) :
--   EO001 : les changements sont illisibles ou incohérents (champ inconnu, valeur inconnue,
--           tome en double, œuvre qui n'est pas une série…) ;
--   EO002 : la série, ou l'un des tomes, est introuvable dans ma bibliothèque.
-- Rend le nombre de tomes qui ont vraiment changé.

create function public.regler_tomes(oeuvre uuid, changements jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  element jsonb;
  cle text;
  numero numeric;
  numeros integer[] := '{}';
  est_serie boolean;
  connus integer;
  changes integer;
begin
  if moi is null then
    raise exception 'Connexion requise.' using errcode = '28000';
  end if;

  -- -------------------------------------------------------------------------
  -- Les changements, relus élément par élément (rien ici ne dépend de la bibliothèque)
  -- -------------------------------------------------------------------------
  if jsonb_typeof(changements) is distinct from 'array' then
    raise exception 'Changements illisibles.' using errcode = 'EO001';
  end if;
  if jsonb_array_length(changements) = 0 or jsonb_array_length(changements) > 1000 then
    raise exception 'Entre 1 et 1000 tomes à la fois.' using errcode = 'EO001';
  end if;

  for element in select value from jsonb_array_elements(changements) loop
    if jsonb_typeof(element) is distinct from 'object' then
      raise exception 'Changement illisible.' using errcode = 'EO001';
    end if;
    for cle in select jsonb_object_keys(element) loop
      if cle not in ('numero', 'possession', 'lecture') then
        raise exception 'Champ inconnu.' using errcode = 'EO001';
      end if;
    end loop;

    -- Le numéro : un entier positif. Le type est vérifié avant la valeur.
    if jsonb_typeof(element -> 'numero') is distinct from 'number' then
      raise exception 'Numéro de tome manquant ou illisible.' using errcode = 'EO001';
    end if;
    numero := (element ->> 'numero')::numeric;
    if numero <> trunc(numero) or numero < 1 or numero > 2147483647 then
      raise exception 'Numéro de tome invalide.' using errcode = 'EO001';
    end if;
    if numero::integer = any (numeros) then
      raise exception 'Tome en double.' using errcode = 'EO001';
    end if;
    numeros := numeros || numero::integer;

    if not (element ? 'possession' or element ? 'lecture') then
      raise exception 'Rien à changer pour ce tome.' using errcode = 'EO001';
    end if;
    if element ? 'possession' and (
      jsonb_typeof(element -> 'possession') is distinct from 'string'
      or element ->> 'possession' not in ('possede', 'a_acheter', 'non_possede')
    ) then
      raise exception 'Possession inconnue.' using errcode = 'EO001';
    end if;
    if element ? 'lecture' and (
      jsonb_typeof(element -> 'lecture') is distinct from 'string'
      or element ->> 'lecture' not in ('a_lire', 'en_cours', 'lu')
    ) then
      raise exception 'Lecture inconnue.' using errcode = 'EO001';
    end if;
  end loop;

  -- -------------------------------------------------------------------------
  -- La série : à moi, et verrouillée jusqu'à la fin (deux changements de la même série se suivent)
  -- -------------------------------------------------------------------------
  select w.is_series into est_serie
  from public.works w
  where w.id = oeuvre and w.user_id = moi
  for update;

  if not found then
    raise exception 'Œuvre introuvable.' using errcode = 'EO002';
  end if;
  if not est_serie then
    raise exception 'Seule une série a des tomes.' using errcode = 'EO001';
  end if;

  -- Tous les tomes demandés doivent exister : sinon, rien n'est changé.
  select count(*) into connus
  from public.volumes v
  where v.work_id = oeuvre and v.user_id = moi and v.number = any (numeros);

  if connus <> cardinality(numeros) then
    raise exception 'Tome introuvable.' using errcode = 'EO002';
  end if;

  -- -------------------------------------------------------------------------
  -- Une seule écriture ; un tome déjà dans l'état demandé n'est pas réécrit
  -- -------------------------------------------------------------------------
  update public.volumes v
  set ownership = coalesce(c.possession, v.ownership),
      reading_status = coalesce(c.lecture, v.reading_status)
  from (
    select (e ->> 'numero')::numeric::integer as numero,
           e ->> 'possession' as possession,
           e ->> 'lecture' as lecture
    from jsonb_array_elements(changements) as e
  ) as c
  where v.work_id = oeuvre
    and v.user_id = moi
    and v.number = c.numero
    and (v.ownership, v.reading_status)
        is distinct from (coalesce(c.possession, v.ownership), coalesce(c.lecture, v.reading_status));

  get diagnostics changes = row_count;
  return changes;
end;
$$;

comment on function public.regler_tomes(uuid, jsonb) is
  'Sélection des tomes : change la possession et/ou la lecture de plusieurs tomes d''une série (et sert aussi à « Annuler »). Tout ou rien ; rend le nombre de tomes changés.';

-- Seul le compte connecté peut l'appeler : rien pour public, anon ni service_role.
revoke all on function public.regler_tomes(uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.regler_tomes(uuid, jsonb) to authenticated;
