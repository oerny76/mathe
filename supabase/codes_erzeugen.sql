-- Teil 2 von 3: Zugangscodes erzeugen. Im SQL-Editor ausführen. Das Ergebnis
-- zeigt die Codes EINMAL an, danach gibt es sie nur noch als Hash. Sofort
-- notieren (z.B. im Passwortmanager). Nie ins Repo oder in einen Chat stellen.
--
-- Erzeugt: je einen Code für Tim (kind1) und Marlene (kind2) und einen
-- Eltern-Code. Wer die Codes später erneuern will, führt die Datei noch einmal
-- aus. Die bisherigen Codes werden dabei ungültig (revoked_at).
-- Link für die Kinder: https://<deine-adresse>/tj/?t=<Code>  bzw. /mj/?t=<Code>

with alt as (
  update public.access_tokens set revoked_at = now() where revoked_at is null returning 1
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
  returning label
)
select n.label as wer,
       case when n.role = 'eltern'
            then substr(n.code, 1, 4) || '-' || substr(n.code, 5, 4) || '-' || substr(n.code, 9, 4) || '-' || substr(n.code, 13, 4)
            else n.code end as code
from neu n
join ins on ins.label = n.label
order by case n.label when 'Tim' then 1 when 'Marlene' then 2 else 3 end;
