-- ============================================================
-- 昨対比グラフ検証用：前年度（R7年度＝2025-04〜2026-03）実績モック
--   BIダッシュボードの「売上昨対比」で前期の棒を表示させるためのデータ。
--   default の実績データソース（完工工事）に載るよう status='completed' で投入。
--   Supabase SQL Editor に全文コピー → 実行。
--
--   投入先：工事データが最も多い会社（＝BIを見ている会社）。
--            無ければ最初の会社にフォールバック。
--   取消し：末尾の DELETE を実行（construction_no が 'MOCK-R7-%' の行のみ削除）。
-- ============================================================

DO $$
DECLARE
  cid      UUID;
  end_dates DATE[] := ARRAY[
    '2025-04-20','2025-05-20','2025-06-20','2025-07-20','2025-08-20','2025-09-20',
    '2025-10-20','2025-11-20','2025-12-20','2026-01-20','2026-02-20','2026-03-20'
  ];
  amounts  NUMERIC[] := ARRAY[
    2000000, 2400000, 1800000, 3200000, 2100000, 2600000,
    3000000, 2300000, 3500000, 1900000, 2200000, 2000000
  ];
  depts    TEXT[] := ARRAY['一般住宅','新築','公共工事','リフォーム'];
  i        INT;
  amt      NUMERIC;
  ed       DATE;
BEGIN
  -- 対象会社を決定：工事が最も多い会社を優先
  SELECT company_id INTO cid
  FROM constructions
  GROUP BY company_id
  ORDER BY count(*) DESC
  LIMIT 1;

  IF cid IS NULL THEN
    SELECT id INTO cid FROM companies ORDER BY created_at LIMIT 1;
  END IF;

  IF cid IS NULL THEN
    RAISE EXCEPTION '会社が見つかりません。先に会社データを作成してください。';
  END IF;

  FOR i IN 1..12 LOOP
    ed  := end_dates[i];
    amt := amounts[i];
    INSERT INTO constructions (
      company_id, construction_no, customer_id, title, status,
      start_date, end_date, order_amount, budget_cost, actual_cost,
      worker_count, progress, department_name
    )
    VALUES (
      cid,
      'MOCK-R7-' || lpad(i::text, 2, '0'),
      NULL,
      '（前年度実績モック）' || to_char(ed, 'YYYY年MM月') || ' 完工工事',
      'completed',
      (ed - INTERVAL '60 days')::date,
      ed,
      amt,
      round(amt * 0.68),
      round(amt * 0.68),
      4,
      100,
      depts[((i - 1) % 4) + 1]
    )
    ON CONFLICT (company_id, construction_no) DO NOTHING;
  END LOOP;

  RAISE NOTICE '前年度モック工事を投入しました（company_id=%）', cid;
END $$;

-- ── 取消し（モックを消したいとき） ──────────────────────────
-- DELETE FROM constructions WHERE construction_no LIKE 'MOCK-R7-%';
