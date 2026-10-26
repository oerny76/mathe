-- Teil 3 von 3: Offene Zugriffe schließen. ERST ausführen, wenn die neue
-- App-Version läuft und beide Kinder sowie die Eltern-Übersicht mit ihren
-- Codes angemeldet sind. Danach kommt man nur noch über die geprüften
-- Funktionen (zugangscodes.sql) an die Daten. Alte App-Versionen auf Geräten
-- ohne Update können dann nicht mehr speichern.

drop policy if exists "anon can insert attempts" on public.attempts;
drop policy if exists "anon can read attempts" on public.attempts;
drop policy if exists "extra_practice lesen" on public.extra_practice;
drop policy if exists "extra_practice eintragen" on public.extra_practice;
drop policy if exists "extra_practice entfernen" on public.extra_practice;
drop policy if exists "kid_state lesen" on public.kid_state;
drop policy if exists "kid_state anlegen" on public.kid_state;
drop policy if exists "kid_state aendern" on public.kid_state;

revoke all on public.attempts from anon, authenticated;
revoke all on public.extra_practice from anon, authenticated;
revoke all on public.kid_state from anon, authenticated;

-- Die Ansicht latest_attempt (greift auf attempts zu) wird von der App nicht
-- benutzt. Sicherheitshalber auch hier alles entziehen.
revoke all on public.latest_attempt from anon, authenticated;

-- Die App arbeitet nur mit dem öffentlichen (anon) Schlüssel. Angemeldete
-- Nutzer (authenticated) gibt es nicht, deshalb dort die Funktionen schließen.
revoke execute on function
  public.app_check(text), public.app_eltern_check(text), public.app_ping(),
  public.app_attempt_add(text, text, text, text, text, integer, integer, jsonb, timestamptz),
  public.app_attempts_list(text, text, timestamptz),
  public.app_state_get(text, text), public.app_state_put(text, text, jsonb, integer),
  public.app_extra_list(text, text, date), public.app_extra_add(text, text, uuid, date, integer, text),
  public.app_extra_delete(text, uuid)
  from authenticated;
