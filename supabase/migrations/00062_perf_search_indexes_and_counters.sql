-- パフォーマンス改善:
-- 1) ilike '%…%' 検索用の pg_trgm GIN インデックス（グローバル検索・顧客検索）
-- 2) 見積番号採番用のカウンターテーブル + RPC（全件走査の排除と同時採番の重複防止）

-- ── 1. trigram 検索インデックス ─────────────────────────────────────
create extension if not exists pg_trgm;

create index if not exists idx_customers_name_trgm
  on customers using gin (name gin_trgm_ops);
create index if not exists idx_customers_company_name_trgm
  on customers using gin (company_name gin_trgm_ops);
create index if not exists idx_customers_email_trgm
  on customers using gin (email gin_trgm_ops);
create index if not exists idx_constructions_title_trgm
  on constructions using gin (title gin_trgm_ops);
create index if not exists idx_constructions_no_trgm
  on constructions using gin (construction_no gin_trgm_ops);
create index if not exists idx_deals_title_trgm
  on deals using gin (title gin_trgm_ops);

-- ── 2. 採番カウンター ───────────────────────────────────────────────
create table if not exists document_counters (
  company_id uuid not null references companies(id) on delete cascade,
  kind text not null,
  current_value integer not null default 0,
  primary key (company_id, kind)
);

-- security definer 関数経由でのみ操作するため、直接アクセスは RLS で遮断
alter table document_counters enable row level security;

create or replace function next_document_number(p_kind text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_next integer;
  v_seed integer;
begin
  select company_id into v_company from profiles where id = auth.uid();
  if v_company is null then
    raise exception 'not authenticated';
  end if;

  -- 初回のみ既存データの最大連番を引き継ぐ
  if not exists (
    select 1 from document_counters
    where company_id = v_company and kind = p_kind
  ) then
    if p_kind = 'estimate' then
      select coalesce(max((regexp_match(estimate_no, '^EST-(?:\d{4}-)?(\d+)$'))[1]::int), 0)
      into v_seed
      from estimates
      where company_id = v_company;
    else
      v_seed := 0;
    end if;

    insert into document_counters (company_id, kind, current_value)
    values (v_company, p_kind, v_seed)
    on conflict (company_id, kind) do nothing;
  end if;

  update document_counters
  set current_value = current_value + 1
  where company_id = v_company and kind = p_kind
  returning current_value into v_next;

  return v_next;
end;
$$;

grant execute on function next_document_number(text) to authenticated;
