-- 見積番号カウンターが既存最大連番より遅れていると
-- UNIQUE(company_id, estimate_no) で新規作成が毎回失敗する（件数採番・削除・別経路採番のずれ）。

update document_counters dc
set current_value = sub.max_seq
from (
  select
    company_id,
    coalesce(max((regexp_match(estimate_no, '^EST-(?:\d{4}-)?(\d+)$'))[1]::int), 0) as max_seq
  from estimates
  group by company_id
) sub
where dc.company_id = sub.company_id
  and dc.kind = 'estimate'
  and dc.current_value < sub.max_seq;

create or replace function next_document_number(p_kind text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_next integer;
  v_seed integer := 0;
begin
  select company_id into v_company from profiles where id = auth.uid();
  if v_company is null then
    raise exception 'not authenticated';
  end if;

  if p_kind = 'estimate' then
    select coalesce(max((regexp_match(estimate_no, '^EST-(?:\d{4}-)?(\d+)$'))[1]::int), 0)
    into v_seed
    from estimates
    where company_id = v_company;
  end if;

  insert into document_counters (company_id, kind, current_value)
  values (v_company, p_kind, v_seed)
  on conflict (company_id, kind) do nothing;

  update document_counters
  set current_value = greatest(current_value, v_seed) + 1
  where company_id = v_company and kind = p_kind
  returning current_value into v_next;

  return v_next;
end;
$$;
