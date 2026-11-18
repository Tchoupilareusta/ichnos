-- Ichnos — cinq statuts de lecture au lieu de six (docs/reference.md §3, 18 novembre 2026).
--
-- « Laissé de côté » (abandonne) est fusionné dans « En pause » : « je ne lis pas ce livre
-- en ce moment », sans jugement.
--   · Les lectures éventuellement « abandonne » passent « en_pause ».
--   · Les événements d'historique « abandonne » deviennent « mis_en_pause ».
--   · La valeur « abandonne » n'est plus acceptée, ni comme statut ni comme événement.
--
-- Rien d'autre ne change : ni les tables, ni la RLS, ni les droits, ni les fonctions
-- (enregistrer_oeuvre et importer_catalogue n'écrivent aucun statut).
-- Le statut d'un média (media.status, ce que je regarde) n'est pas concerné.

-- 1. Les données d'abord, pendant que l'ancienne règle les accepte encore.
update public.library_entries
set reading_status = 'en_pause'
where reading_status = 'abandonne';

update public.reading_events
set kind = 'mis_en_pause'
where kind = 'abandonne';

-- 2. Puis la règle : cinq statuts, et plus d'événement « abandonne ».
alter table public.library_entries
  drop constraint library_entries_reading_status_check;
alter table public.library_entries
  add constraint library_entries_reading_status_check
  check (reading_status in ('en_cours', 'envie_de_lire', 'termine', 'a_decouvrir', 'en_pause'));

alter table public.reading_events
  drop constraint reading_events_kind_check;
alter table public.reading_events
  add constraint reading_events_kind_check
  check (kind in ('commence', 'progression', 'mis_en_pause', 'repris', 'termine'));
