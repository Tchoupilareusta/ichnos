-- Ichnos — recommandations : mettre une idée de côté, et la reprendre
-- (docs/reference.md §7.2, §10.2 ; étape 7 du §11).
--
-- Sur l'écran Découvrir, « Pas maintenant » met une proposition de côté : elle n'est pas
-- reproposée pendant trois semaines, puis revient sans pénalité. La table recommendation_log
-- existe depuis l'étape 2 (user_id, RLS, quatre politiques, droits au seul rôle authenticated) :
-- elle n'est pas modifiée. Deux fonctions, appelées par le compte connecté :
--   · mettre_idee_de_cote : remplace l'éventuelle mise de côté précédente de cette œuvre par
--     la nouvelle, datée par la base. Deux écritures, en tout ou rien. Il n'y a donc jamais plus
--     d'une ligne par œuvre : ce n'est pas un historique, et rien n'en est affiché.
--   · reprendre_idee      : retire la mise de côté de cette œuvre. Sert à « Annuler ».
-- Comme les autres fonctions :
--   · elles s'exécutent avec les droits de celui qui les appelle (security invoker) : la RLS
--     et les contraintes de la table s'appliquent ;
--   · elles vérifient en plus elles-mêmes que l'œuvre est à moi : même si la RLS était coupée,
--     l'œuvre d'un autre compte reste « introuvable », et ses mises de côté intouchables ;
--   · elles ne touchent à rien d'autre : ni au statut, ni à la possession, ni à la progression,
--     ni à l'historique de lecture, ni aux notes.
-- La durée (trois semaines) n'est pas dans la base : l'appli la calcule à partir de la date rangée.
--
-- Codes d'erreur (les mêmes que les autres fonctions) :
--   EO001 : l'envie n'est pas l'une des six ;
--   EO002 : l'œuvre est introuvable dans ma bibliothèque.

-- ---------------------------------------------------------------------------
-- mettre_idee_de_cote — « Pas maintenant »
-- ---------------------------------------------------------------------------

create function public.mettre_idee_de_cote(oeuvre uuid, envie text)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  instant timestamptz := now();
begin
  if moi is null then
    raise exception 'Connexion requise.' using errcode = '28000';
  end if;

  if envie is null or envie not in (
    'surprise', 'reconfortant', 'philosophique', 'remise_en_question', 'lecture_courte', 'changer_d_univers'
  ) then
    raise exception 'Envie inconnue.' using errcode = 'EO001';
  end if;

  -- L'œuvre : à moi, et verrouillée jusqu'à la fin (deux appuis rapprochés se suivent).
  perform 1
  from public.works w
  where w.id = oeuvre and w.user_id = moi
  for update;

  if not found then
    raise exception 'Œuvre introuvable.' using errcode = 'EO002';
  end if;

  -- Une seule ligne par œuvre : la nouvelle mise de côté remplace l'ancienne.
  delete from public.recommendation_log r
  where r.work_id = oeuvre and r.user_id = moi;

  insert into public.recommendation_log (user_id, mode, work_id, response, shown_at)
  values (moi, envie, oeuvre, 'ignoree', instant);

  return instant;
end;
$$;

comment on function public.mettre_idee_de_cote(uuid, text) is
  '« Pas maintenant » : met une proposition de côté (une seule ligne par œuvre, datée par la base). Tout ou rien ; rend la date de mise de côté.';

-- ---------------------------------------------------------------------------
-- reprendre_idee — « Annuler » juste après « Pas maintenant »
-- ---------------------------------------------------------------------------

create function public.reprendre_idee(oeuvre uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  retirees integer;
begin
  if moi is null then
    raise exception 'Connexion requise.' using errcode = '28000';
  end if;

  perform 1
  from public.works w
  where w.id = oeuvre and w.user_id = moi
  for update;

  if not found then
    raise exception 'Œuvre introuvable.' using errcode = 'EO002';
  end if;

  delete from public.recommendation_log r
  where r.work_id = oeuvre and r.user_id = moi;

  get diagnostics retirees = row_count;
  return retirees;
end;
$$;

comment on function public.reprendre_idee(uuid) is
  'Retire la mise de côté d''une œuvre (« Annuler »). Rend le nombre de lignes retirées : 0 si elle n''était pas de côté.';

-- Seul le compte connecté peut les appeler : rien pour public, anon ni service_role.
revoke all on function public.mettre_idee_de_cote(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.mettre_idee_de_cote(uuid, text) to authenticated;

revoke all on function public.reprendre_idee(uuid) from public, anon, authenticated, service_role;
grant execute on function public.reprendre_idee(uuid) to authenticated;
