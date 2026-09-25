-- ===================================================================
-- AUSGEFUEHRT am 24.09.2026 als Migration
-- "zeitachse_uebernacht_auf_privat".
--
-- Problem: 15 Aufenthalte am Betrieb (Wartburgstr. 12) waren als
-- "Betrieb / Büro" erfasst. Sie begannen abends und endeten am
-- naechsten Vormittag - das Handy stand nur dort, gearbeitet wurde
-- nicht. Zusammen ergaben sie 308,53 Std. in 16 Tagen.
--
-- Nach der Umbuchung: 11 Zeilen, 35,33 Std. - ein realistischer Wert.
-- ===================================================================

create table if not exists public.zeitachse_sicherung_20260924 (
  id            bigint primary key,
  art_alt       text,
  start         timestamptz,
  ende          timestamptz,
  gesichert_am  timestamptz not null default now()
);

-- Supabase vergibt auf neuen Tabellen automatisch Rechte an anon und
-- authenticated. Eine Sicherungstabelle darf niemand von aussen sehen.
revoke all on public.zeitachse_sicherung_20260924 from anon, authenticated;
alter table public.zeitachse_sicherung_20260924 enable row level security;
-- Keine Policy = kein Zugriff ausser fuer service_role und den Eigentuemer.

insert into public.zeitachse_sicherung_20260924 (id, art_alt, start, ende)
select z.id, z.art, z.start, z.ende
  from public.zeitachse z
 where z.art = 'Betrieb / Büro'
   and z.ende - z.start > interval '12 hours'
on conflict (id) do nothing;

-- geaendert_am setzt der Trigger zeitachse_geaendert_am von selbst.
update public.zeitachse z
   set art = 'Privat'
 where z.art = 'Betrieb / Büro'
   and z.ende - z.start > interval '12 hours';

-- ===================================================================
-- SCHRITT ZURUECK, falls die Umbuchung doch falsch war:
--
--   update public.zeitachse z
--      set art = s.art_alt
--     from public.zeitachse_sicherung_20260924 s
--    where z.id = s.id;
--
-- Die Sicherungstabelle bitte NICHT loeschen, solange dieser Weg
-- zurueck offen bleiben soll.
-- ===================================================================
