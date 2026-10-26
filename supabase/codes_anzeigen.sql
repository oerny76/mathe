-- Codes jederzeit nachsehen. Einmal im SQL-Editor ausführen: legt die Ansicht
-- zugangscodes_anzeigen an. Danach genügt diese eine Zeile:
--
--   select * from public.zugangscodes_anzeigen;
--
-- Tipp: Im SQL-Editor die Abfrage über "Save" / das Stern-Symbol als
-- Favorit speichern, dann ist sie jederzeit mit einem Klick erreichbar.
--
-- Funktioniert für Codes, die mit der aktuellen codes_erzeugen.sql erzeugt
-- wurden. Ältere Codes sind nur als Hash gespeichert und lassen sich nicht
-- anzeigen: einmal codes_erzeugen.sql erneut ausführen, dann sind sie dabei.
--
-- Die Ansicht ist für die App gesperrt, nur Dashboard und SQL-Editor sehen sie.

create or replace view public.zugangscodes_anzeigen
with (security_invoker = true) as
select
  t.label as wer,
  case when t.role = 'eltern'
       then substr(k.code, 1, 4) || '-' || substr(k.code, 5, 4) || '-' || substr(k.code, 9, 4) || '-' || substr(k.code, 13, 4)
       else k.code end as code,
  case t.kid_id when 'kind1' then 'tj/?t=' || k.code when 'kind2' then 'mj/?t=' || k.code
       else 'eltern/?t=' || k.code end as link_ende,
  t.created_at as erzeugt
from public.access_tokens t
join public.access_codes_klartext k on k.id = t.id
where t.revoked_at is null
order by case t.label when 'Tim' then 1 when 'Marlene' then 2 else 3 end;

revoke all on public.zugangscodes_anzeigen from anon, authenticated;
