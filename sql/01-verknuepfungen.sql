-- ===================================================================
-- NOCH NICHT AUSGEFUEHRT. Bitte erst lesen und freigeben.
--
-- Zweck: Zeiten mit Kunde, Auftrag, Aufgabe und Abrechnung verbinden.
--
-- Grundsatz: Es wird NUR HINZUGEFUEGT. Keine Spalte wird umbenannt,
-- keine geloescht. Die vorhandenen Textspalten "kunde" und "projekt"
-- bleiben unveraendert stehen. Dadurch laufen weiter:
--   - die Auswertung  Baustellen_Auswertung
--   - die Edge Function  stunden-import
--   - die Cockpit-Seiten  arbeitszeiten.tsx  und  liste.tsx
-- ===================================================================

-- --- 1. Neue Spalten in "Stunden" -----------------------------------
-- Alle duerfen leer sein, damit die 392 vorhandenen Zeilen unveraendert
-- gueltig bleiben.

alter table public."Stunden"
  add column if not exists kontakt_id bigint
    references public."Kontakte"(id) on delete set null;

alter table public."Stunden"
  add column if not exists auftrag_id bigint
    references public."Auftraege"(id) on delete set null;

alter table public."Stunden"
  add column if not exists aufgabe_id bigint
    references public."Aufgaben"(id) on delete set null;

alter table public."Stunden"
  add column if not exists abrechenbar boolean;

alter table public."Stunden"
  add column if not exists abgerechnet_am date;

-- ACHTUNG, bewusst getrennt:
-- "add column ... default ..." wuerde PostgreSQL dazu bringen, sofort
-- alle 392 Altzeilen zu befuellen. Deshalb erst die Spalte anlegen
-- (oben, ohne Vorgabewert) und den Vorgabewert erst danach setzen -
-- er gilt dann nur fuer NEUE Zeilen.
alter table public."Stunden"
  alter column abrechenbar set default true;

-- --- 2. Register fuer schnelles Suchen -------------------------------
create index if not exists stunden_kontakt_id_idx on public."Stunden" (kontakt_id);
create index if not exists stunden_auftrag_id_idx on public."Stunden" (auftrag_id);
create index if not exists stunden_aufgabe_id_idx on public."Stunden" (aufgabe_id);

-- --- 3. Dieselben Felder an der Schicht ------------------------------
-- Damit die Zuordnung schon beim Einstempeln gesetzt werden kann und
-- stempel_ausstempeln() sie spaeter nach "Stunden" durchreicht.

alter table public.stempel_schicht
  add column if not exists kontakt_id bigint
    references public."Kontakte"(id) on delete set null;

alter table public.stempel_schicht
  add column if not exists auftrag_id bigint
    references public."Auftraege"(id) on delete set null;

alter table public.stempel_schicht
  add column if not exists aufgabe_id bigint
    references public."Aufgaben"(id) on delete set null;

-- ===================================================================
-- NICHT in dieser Datei, weil es eigene Freigaben braucht:
--
--   a) stempel_ausstempeln() erweitern, damit sie die drei neuen
--      IDs mit in "Stunden" schreibt.
--
--   b) Eine zusaetzliche Auswertung "zeit_abrechnung"
--      (Stunden je Auftrag, offen / abgerechnet).
--
--   c) stunden-import von "alles loeschen und neu schreiben" auf
--      "abgleichen" umbauen. Solange das nicht passiert ist, gehen
--      Zuordnungen an importierten Zeilen beim naechsten Import
--      verloren. Zeilen aus App und Stempeluhr sind davon nicht
--      betroffen.
-- ===================================================================
