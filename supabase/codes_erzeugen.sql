-- Teil 2 von 3: Zugangscodes erzeugen. Im SQL-Editor ausführen. Das Ergebnis
-- zeigt die Codes EINMAL an, danach gibt es sie nur noch als Hash. Sofort
-- notieren (z.B. im Passwortmanager). Nie ins Repo oder in einen Chat stellen.
--
-- Die Codes werden zusätzlich lesbar in der Tabelle access_codes_klartext
-- abgelegt (nur im Dashboard sichtbar, nie für die App) und lassen sich
-- jederzeit mit codes_anzeigen.sql nachsehen.
--
-- Erzeugt: je einen Code für Tim (kind1) und Marlene (kind2) und einen
-- Eltern-Code. Wer die Codes später erneuern will, führt die Datei noch einmal
-- aus. Die bisherigen Codes werden dabei ungültig (revoked_at).
-- Link für die Kinder: https://<deine-adresse>/tj/?t=<Code>  bzw. /mj/?t=<Code>

create table if not exists public.access_codes_klartext (
  id uuid primary key references public.access_tokens (id) on delete cascade,
  code text not null
);

alter table public.access_codes_klartext enable row level security;
revoke all on public.access_codes_klartext from anon, authenticated;

with alt as (
  update public.access_tokens set revoked_at = now()
  where revoked_at is null and role in ('kind', 'eltern') returning id
),
alt_klartext as (
  delete from public.access_codes_klartext where id in (select id from alt) returning 1
),
neu as (
  select 'kind1'::text as kid_id, 'kind'::text as role, 'Tim'::text as label,
         substr(replace(gen_random_uuid()::text, '-', ''), 1, 20) as code
  union all
  select 'kind2', 'kind', 'Marlene', substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)
  union all
  select null, 'eltern', 'Eltern', substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)
),
ins as (
  insert into public.access_tokens (role, kid_id, token_hash, label)
  select role, kid_id, public._code_hash(code), label from neu
  returning id, label
),
klartext as (
  insert into public.access_codes_klartext (id, code)
  select ins.id, neu.code from ins join neu on neu.label = ins.label
  returning 1
)
select n.label as wer,
       case when n.role = 'eltern'
            then substr(n.code, 1, 4) || '-' || substr(n.code, 5, 4) || '-' || substr(n.code, 9, 4) || '-' || substr(n.code, 13, 4)
            else n.code end as code
from neu n
join ins on ins.label = n.label
order by case n.label when 'Tim' then 1 when 'Marlene' then 2 else 3 end;
