-- ============================================================
-- BRIDGE デモデータ投入スクリプト
-- ※ seed.sql（ユーザー作成）を実行済みの環境で実行してください。
-- Supabase SQL Editor で全文コピー → 実行
-- ============================================================

DO $$
DECLARE
  cid   UUID := '00000000-0000-0000-0000-000000000001'; -- BRIDGE テスト株式会社
  u_own UUID := '00000000-0000-0000-0000-000000000010'; -- オーナー
  u_hq  UUID := '00000000-0000-0000-0000-000000000020'; -- 本部管理者
  u_con UUID := '00000000-0000-0000-0000-000000000030'; -- 施工店管理者
  u_emp UUID := '00000000-0000-0000-0000-000000000040'; -- 社員

  -- 顧客
  cu1 UUID := '00000000-0000-0001-0000-000000000001';
  cu2 UUID := '00000000-0000-0001-0000-000000000002';
  cu3 UUID := '00000000-0000-0001-0000-000000000003';
  cu4 UUID := '00000000-0000-0001-0000-000000000004';
  cu5 UUID := '00000000-0000-0001-0000-000000000005';
  cu6 UUID := '00000000-0000-0001-0000-000000000006';

  -- 商談
  de1 UUID := '00000000-0000-0002-0000-000000000001';
  de2 UUID := '00000000-0000-0002-0000-000000000002';
  de3 UUID := '00000000-0000-0002-0000-000000000003';
  de4 UUID := '00000000-0000-0002-0000-000000000004';
  de5 UUID := '00000000-0000-0002-0000-000000000005';
  de6 UUID := '00000000-0000-0002-0000-000000000006';

  -- 職人
  cr1 UUID := '00000000-0000-0003-0000-000000000001';
  cr2 UUID := '00000000-0000-0003-0000-000000000002';
  cr3 UUID := '00000000-0000-0003-0000-000000000003';
  cr4 UUID := '00000000-0000-0003-0000-000000000004';
  cr5 UUID := '00000000-0000-0003-0000-000000000005';

  -- 見積
  es1 UUID := '00000000-0000-0004-0000-000000000001';
  es2 UUID := '00000000-0000-0004-0000-000000000002';
  es3 UUID := '00000000-0000-0004-0000-000000000003';
  ec1 UUID := '00000000-0000-0004-0001-000000000001'; -- カテゴリ
  ec2 UUID := '00000000-0000-0004-0001-000000000002';
  ec3 UUID := '00000000-0000-0004-0001-000000000003';

  -- 契約
  co1 UUID := '00000000-0000-0005-0000-000000000001';
  co2 UUID := '00000000-0000-0005-0000-000000000002';
  co3 UUID := '00000000-0000-0005-0000-000000000003';

  -- 工事
  cs1 UUID := '00000000-0000-0006-0000-000000000001';
  cs2 UUID := '00000000-0000-0006-0000-000000000002';
  cs3 UUID := '00000000-0000-0006-0000-000000000003';

  -- 請求
  iv1 UUID := '00000000-0000-0007-0000-000000000001';
  iv2 UUID := '00000000-0000-0007-0000-000000000002';
  iv3 UUID := '00000000-0000-0007-0000-000000000003';

  -- 予算
  bu1 UUID := '00000000-0000-0008-0000-000000000001';
  bu2 UUID := '00000000-0000-0008-0000-000000000002';

  -- ワークフロー種別
  wt1 UUID := '00000000-0000-0009-0000-000000000001';
  wt2 UUID := '00000000-0000-0009-0000-000000000002';
  wt3 UUID := '00000000-0000-0009-0000-000000000003';

  -- ワークフロー申請
  wr1 UUID := '00000000-0000-0009-0001-000000000001';
  wr2 UUID := '00000000-0000-0009-0001-000000000002';
  wr3 UUID := '00000000-0000-0009-0001-000000000003';
  wr4 UUID := '00000000-0000-0009-0001-000000000004';
  wr5 UUID := '00000000-0000-0009-0001-000000000005';

  -- 回覧
  an1 UUID := '00000000-0000-0010-0000-000000000001';
  an2 UUID := '00000000-0000-0010-0000-000000000002';
  an3 UUID := '00000000-0000-0010-0000-000000000003';
  an4 UUID := '00000000-0000-0010-0000-000000000004';

BEGIN

-- ============================================================
-- 1. 顧客 (customers)
-- ============================================================
INSERT INTO customers (id, company_id, name, company_name, email, phone, address, source, status, assigned_to, budget_min, budget_max, ai_score, notes, created_at)
VALUES
  (cu1, cid, '田中 健太郎', NULL,          'tanaka@example.com',  '090-1111-2222', '東京都世田谷区用賀2-1-5',   'referral',   'active', u_con, 15000000, 25000000, 87, '注文住宅希望。延床35坪程度。現地調査済み。', NOW() - INTERVAL '60 days'),
  (cu2, cid, '鈴木 美由紀', NULL,          'suzuki@example.com',  '080-3333-4444', '神奈川県横浜市青葉区藤が丘3-8', 'web',      'active', u_hq,  8000000,  12000000, 72, 'リフォーム検討中。キッチン・浴室・外壁。', NOW() - INTERVAL '45 days'),
  (cu3, cid, '伊藤 正彦', '伊藤建設株式会社', 'ito@ito-kensetsu.co.jp','03-5678-9012', '東京都港区赤坂1-2-3',       'exhibition', 'active', u_con, 30000000, 50000000, 91, '企業案件。倉庫+事務所の新築。来月着工予定。', NOW() - INTERVAL '90 days'),
  (cu4, cid, '佐藤 涼子', NULL,            'sato@example.com',    '070-5555-6666', '埼玉県さいたま市浦和区高砂7-2', 'sns',      'active', u_own, 20000000, 30000000, 65, '二世帯住宅希望。親世帯分離型。', NOW() - INTERVAL '30 days'),
  (cu5, cid, '山田 次郎', NULL,            'yamada@example.com',  '090-7777-8888', '千葉県松戸市常盤平1-10-4',    'referral',  'active', u_hq,  5000000,  8000000,  58, '外構・造園工事のみ。来春工事希望。', NOW() - INTERVAL '20 days'),
  (cu6, cid, '渡辺 由美子', NULL,          'watanabe@example.com','080-9999-0000', '東京都練馬区石神井町5-1-1',   'web',      'active', u_con, 12000000, 18000000, 44, '屋根・外壁塗装リフォーム。築20年。', NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 2. 商談 (deals)
-- ============================================================
INSERT INTO deals (id, company_id, customer_id, title, stage, value, priority, assigned_to, expected_close_date, next_action, days_in_stage, created_at)
VALUES
  (de1, cid, cu1, '田中様 注文住宅新築', 'closing',         22000000, 'high',   u_con, CURRENT_DATE + 14,  '最終契約書確認・押印日程調整',  5,  NOW() - INTERVAL '55 days'),
  (de2, cid, cu2, '鈴木様 水回りリフォーム', 'quote_submitted', 9800000, 'medium', u_hq,  CURRENT_DATE + 30,  '見積回答期限フォロー',          12, NOW() - INTERVAL '40 days'),
  (de3, cid, cu3, '伊藤建設 倉庫・事務所新築', 'negotiation',  42000000, 'high',   u_con, CURRENT_DATE + 21,  '価格交渉・仕様確定ミーティング', 8,  NOW() - INTERVAL '80 days'),
  (de4, cid, cu4, '佐藤様 二世帯住宅',   'won',             28500000, 'high',   u_own, CURRENT_DATE - 5,   '契約締結済み',                  0,  NOW() - INTERVAL '25 days'),
  (de5, cid, cu5, '山田様 外構・造園工事', 'first_meeting',   6500000, 'low',    u_hq,  CURRENT_DATE + 60,  '現地調査日程確認',              3,  NOW() - INTERVAL '18 days'),
  (de6, cid, cu6, '渡辺様 屋根外壁塗装',  'materials_sent',  1380000,  'medium', u_con, CURRENT_DATE + 45,  '資料・サンプル提出後フォロー',  7,  NOW() - INTERVAL '8 days')
ON CONFLICT (id) DO NOTHING;

-- 商談アクティビティ
INSERT INTO deal_activities (company_id, deal_id, type, title, description, performed_by, performed_at)
VALUES
  (cid, de1, 'visit',   '現地調査', '敷地測量・地盤調査実施。ほぼ問題なし。', u_con, NOW() - INTERVAL '50 days'),
  (cid, de1, 'meeting', '仕様確定MTG', 'キッチン・浴室メーカー選定完了。間取り最終確認。', u_hq, NOW() - INTERVAL '30 days'),
  (cid, de1, 'call',    '最終金額調整', '工事費2200万で合意。契約書作成中。', u_con, NOW() - INTERVAL '7 days'),
  (cid, de2, 'mail',    '見積書送付', 'メールにてPDF見積書を送付。', u_hq, NOW() - INTERVAL '12 days'),
  (cid, de3, 'visit',   '敷地確認', '伊藤建設様敷地視察。500㎡。搬入路に問題なし。', u_con, NOW() - INTERVAL '70 days'),
  (cid, de3, 'meeting', '設計打合せ', '基本設計プラン提出。倉庫500㎡+事務所80㎡。', u_hq, NOW() - INTERVAL '40 days')
ON CONFLICT DO NOTHING;

-- ToDo
INSERT INTO todos (company_id, customer_id, deal_id, assigned_to, title, status, priority, due_date)
VALUES
  (cid, cu1, de1, u_con, '契約書最終版を法務確認に出す',  'in_progress', 'high',   CURRENT_DATE + 3),
  (cid, cu2, de2, u_hq,  '見積フォローアップ電話',        'pending',     'medium', CURRENT_DATE + 2),
  (cid, cu3, de3, u_con, '価格交渉資料を作成する',         'pending',     'high',   CURRENT_DATE + 5),
  (cid, cu5, de5, u_hq,  '現地調査スケジュール確定',      'pending',     'low',    CURRENT_DATE + 10),
  (cid, NULL, NULL, u_own, '月次売上レポート作成',         'pending',     'medium', CURRENT_DATE + 7)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 3. 職人 (craftsmen)
-- ============================================================
INSERT INTO craftsmen (id, company_id, name, company_name, phone, email, specialty, rank, report_rate, active_projects, total_projects, notes, created_at)
VALUES
  (cr1, cid, '高橋 雄一',  '高橋工務店',       '090-1234-5678', 'takahashi@craftsmen.com', 'carpenter',   'A', 98, 2, 47, '木工事全般。品質・納期ともに信頼性高い。長年の付き合い。', NOW() - INTERVAL '365 days'),
  (cr2, cid, '中村 誠',   '中村電気設備',      '080-2345-6789', 'nakamura@craftsmen.com',  'electrical',  'A', 95, 1, 32, '電気工事・太陽光設置まで対応可。見積レスポンスが早い。', NOW() - INTERVAL '300 days'),
  (cr3, cid, '木村 健司',  '木村内装',         '070-3456-7890', 'kimura@craftsmen.com',    'interior',    'B', 88, 2, 28, 'クロス・フローリング専門。デザイン提案力あり。', NOW() - INTERVAL '240 days'),
  (cr4, cid, '渡辺 浩二',  '渡辺設備工業',     '090-4567-8901', 'watanabe@craftsmen.com',  'plumbing',    'B', 82, 1, 19, '給排水・衛生設備。点検・修理にも対応。', NOW() - INTERVAL '180 days'),
  (cr5, cid, '松本 義雄',  '松本総合建設',     '080-5678-9012', 'matsumoto@craftsmen.com', 'general',     'C', 74, 0, 11, '外構・造園・土工事。汎用性高い。報告書提出が遅れがち。', NOW() - INTERVAL '120 days')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 4. 見積 (estimates)
-- ============================================================
INSERT INTO estimates (id, company_id, customer_id, estimate_no, title, status, subtotal, tax, total, cost_total, gross_profit, gross_profit_rate, validity_date, issued_at, assigned_to, created_at)
VALUES
  (es1, cid, cu1, 'EST-2026-001', '田中様 注文住宅新築工事',     'accepted', 20000000, 2000000, 22000000, 14800000, 7200000, 32.7, CURRENT_DATE + 30, NOW() - INTERVAL '40 days', u_con, NOW() - INTERVAL '45 days'),
  (es2, cid, cu2, 'EST-2026-002', '鈴木様 水回りリフォーム工事', 'sent',      8909091,  890909,  9800000,  6200000,  3600000, 36.7, CURRENT_DATE + 20, NOW() - INTERVAL '12 days', u_hq,  NOW() - INTERVAL '15 days'),
  (es3, cid, cu4, 'EST-2026-003', '佐藤様 二世帯住宅新築工事',   'accepted', 25909091, 2590909, 28500000, 17500000, 11000000,38.6, CURRENT_DATE - 3,  NOW() - INTERVAL '20 days', u_own, NOW() - INTERVAL '22 days')
ON CONFLICT (id) DO NOTHING;

-- 見積カテゴリ
INSERT INTO estimate_categories (id, company_id, estimate_id, name, sort_order)
VALUES
  (ec1, cid, es1, '仮設・基礎工事', 1),
  (ec2, cid, es1, '木工事・内装工事', 2),
  (ec3, cid, es1, '設備・電気工事', 3)
ON CONFLICT (id) DO NOTHING;

-- 見積明細
INSERT INTO estimate_items (company_id, estimate_id, category_id, name, quantity, unit, cost_price, cost_amount, selling_price, selling_amount, gross_profit, gross_profit_rate, sort_order)
VALUES
  (cid, es1, ec1, '仮設工事一式',   1, '式', 500000,  500000,  700000,  700000,  200000, 28.6, 1),
  (cid, es1, ec1, '基礎工事（べた基礎）', 1, '式', 2800000, 2800000, 4000000, 4000000, 1200000, 30.0, 2),
  (cid, es1, ec2, '軸組み・建方工事', 1, '式', 5000000, 5000000, 7000000, 7000000, 2000000, 28.6, 1),
  (cid, es1, ec2, 'クロス・フローリング工事', 1, '式', 1800000, 1800000, 2500000, 2500000, 700000, 28.0, 2),
  (cid, es1, ec3, '電気工事一式',    1, '式', 1200000, 1200000, 1800000, 1800000, 600000, 33.3, 1),
  (cid, es1, ec3, '給排水・衛生工事', 1, '式', 1500000, 1500000, 2000000, 2000000, 500000, 25.0, 2)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 5. 契約 (contracts)
-- ============================================================
INSERT INTO contracts (id, company_id, customer_id, estimate_id, contract_no, title, status, contract_date, start_date, end_date, amount, assigned_to, progress, notes, created_at)
VALUES
  (co1, cid, cu1, es1, 'CON-2026-001', '田中様 注文住宅新築工事請負契約',  'executing',  '2026-01-10', '2026-02-01', '2026-10-31', 22000000, u_con, 35, '地盤改良完了。基礎工事進行中。', NOW() - INTERVAL '50 days'),
  (co2, cid, cu4, es3, 'CON-2026-002', '佐藤様 二世帯住宅新築工事請負契約', 'contracted', '2026-03-01', '2026-04-15', '2026-12-20', 28500000, u_own, 0,  '着工前確認事項整理中。', NOW() - INTERVAL '15 days'),
  (co3, cid, cu3, NULL,'CON-2025-008', '伊藤建設 倉庫・事務所新築工事',    'completed',  '2025-06-01', '2025-07-01', '2026-01-31', 42000000, u_con, 100,'竣工・引渡し完了。', NOW() - INTERVAL '200 days')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 6. 工事 (constructions + tasks)
-- ============================================================
INSERT INTO constructions (id, company_id, contract_id, construction_no, customer_id, title, status, start_date, end_date, order_amount, budget_cost, actual_cost, worker_count, progress, assigned_to, created_at)
VALUES
  (cs1, cid, co1, 'CONS-2026-001', cu1, '田中様邸 注文住宅新築工事',  'in_progress', '2026-02-01', '2026-10-31', 22000000, 14800000, 5200000,  6, 35, u_con, NOW() - INTERVAL '50 days'),
  (cs2, cid, co3, 'CONS-2025-008', cu3, '伊藤建設 倉庫・事務所新築', 'completed',   '2025-07-01', '2026-01-31', 42000000, 30000000, 29800000, 12, 100, u_con, NOW() - INTERVAL '200 days'),
  (cs3, cid, NULL,'CONS-2026-002', cu6, '渡辺様邸 外壁・屋根塗装工事', 'preparing',  '2026-04-10', '2026-05-20', 1380000,  980000,   0,        2, 0,  u_con, NOW() - INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

-- 工程 (construction_tasks)
INSERT INTO construction_tasks (company_id, construction_id, name, start_date, end_date, progress, status, assigned_to, sort_order)
VALUES
  -- 田中様邸
  (cid, cs1, '仮設・解体工事',    '2026-02-01', '2026-02-14', 100, 'completed',   u_emp, 1),
  (cid, cs1, '地盤改良工事',     '2026-02-10', '2026-02-20', 100, 'completed',   u_emp, 2),
  (cid, cs1, '基礎工事',         '2026-02-21', '2026-03-15', 100, 'completed',   u_emp, 3),
  (cid, cs1, '木工事（軸組み）',  '2026-03-16', '2026-05-31', 60,  'in_progress', u_emp, 4),
  (cid, cs1, '屋根工事',         '2026-04-01', '2026-05-15', 30,  'in_progress', u_emp, 5),
  (cid, cs1, '外壁工事',         '2026-05-01', '2026-07-31', 0,   'not_started', u_emp, 6),
  (cid, cs1, '内装工事',         '2026-07-01', '2026-09-30', 0,   'not_started', u_emp, 7),
  (cid, cs1, '設備・電気工事',   '2026-06-01', '2026-09-30', 0,   'not_started', u_emp, 8),
  (cid, cs1, '外構・造園工事',   '2026-09-01', '2026-10-20', 0,   'not_started', u_emp, 9),
  (cid, cs1, '竣工検査・引渡し', '2026-10-21', '2026-10-31', 0,   'not_started', u_con, 10),
  -- 伊藤建設（完了）
  (cid, cs2, '仮設工事',         '2025-07-01', '2025-07-10', 100, 'completed',   u_emp, 1),
  (cid, cs2, '基礎・土工事',     '2025-07-11', '2025-08-20', 100, 'completed',   u_emp, 2),
  (cid, cs2, '鉄骨組立工事',     '2025-08-21', '2025-10-31', 100, 'completed',   u_emp, 3),
  (cid, cs2, '外壁・屋根工事',   '2025-10-01', '2025-11-30', 100, 'completed',   u_emp, 4),
  (cid, cs2, '内装・設備工事',   '2025-11-01', '2026-01-15', 100, 'completed',   u_emp, 5),
  (cid, cs2, '竣工検査・引渡し', '2026-01-20', '2026-01-31', 100, 'completed',   u_con, 6),
  -- 渡辺様邸
  (cid, cs3, '足場設置',         '2026-04-10', '2026-04-12', 0,   'not_started', u_emp, 1),
  (cid, cs3, '高圧洗浄',         '2026-04-13', '2026-04-14', 0,   'not_started', u_emp, 2),
  (cid, cs3, '下地補修',         '2026-04-15', '2026-04-17', 0,   'not_started', u_emp, 3),
  (cid, cs3, '外壁塗装（3回塗）', '2026-04-18', '2026-05-05', 0,   'not_started', u_emp, 4),
  (cid, cs3, '屋根塗装',         '2026-04-25', '2026-05-10', 0,   'not_started', u_emp, 5),
  (cid, cs3, '足場撤去・清掃',   '2026-05-11', '2026-05-14', 0,   'not_started', u_emp, 6),
  (cid, cs3, '竣工検査・引渡し', '2026-05-15', '2026-05-20', 0,   'not_started', u_con, 7)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 7. 請求 (invoices)
-- ============================================================
INSERT INTO invoices (id, company_id, construction_id, customer_id, invoice_no, recipient, invoice_date, due_date, subtotal, tax, total, status, created_by, created_at)
VALUES
  (iv1, cid, cs1, cu1, 'INV-2026-001', '田中 健太郎 様', '2026-02-28', '2026-03-31', 5000000,  500000,  5500000,  'paid',  u_hq, NOW() - INTERVAL '30 days'),
  (iv2, cid, cs1, cu1, 'INV-2026-002', '田中 健太郎 様', '2026-03-31', '2026-04-30', 4000000,  400000,  4400000,  'sent',  u_hq, NOW() - INTERVAL '5 days'),
  (iv3, cid, cs2, cu3, 'INV-2025-015', '伊藤建設株式会社 御中', '2026-01-31', '2026-02-28', 12000000, 1200000, 13200000, 'paid', u_hq, NOW() - INTERVAL '50 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoice_items (company_id, invoice_id, description, quantity, unit_price, amount, sort_order)
VALUES
  (cid, iv1, '第1回 出来形払い（基礎工事完了）', 1, 5000000, 5000000, 1),
  (cid, iv2, '第2回 出来形払い（木工事中間）',   1, 4000000, 4000000, 1),
  (cid, iv3, '最終精算払い（竣工引渡し）',        1, 12000000, 12000000, 1)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 8. 予算 (budgets)
-- ============================================================
INSERT INTO budgets (id, company_id, fiscal_year, branch, target_revenue, status, created_by, created_at)
VALUES
  (bu1, cid, 2026, '本社', 350000000, 'approved', u_own, NOW() - INTERVAL '90 days'),
  (bu2, cid, 2025, '本社', 280000000, 'approved', u_own, NOW() - INTERVAL '450 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO budget_items (company_id, budget_id, category, name, amount, sort_order)
VALUES
  -- 2026年度
  (cid, bu1, 'revenue',       '新築工事売上',       220000000, 1),
  (cid, bu1, 'revenue',       'リフォーム工事売上',  80000000, 2),
  (cid, bu1, 'revenue',       'その他売上',          50000000, 3),
  (cid, bu1, 'direct_cost',   '外注工事費',         175000000, 1),
  (cid, bu1, 'direct_cost',   '材料費',              35000000, 2),
  (cid, bu1, 'indirect_cost', '人件費',              40000000, 1),
  (cid, bu1, 'indirect_cost', '販管費',              20000000, 2),
  (cid, bu1, 'indirect_cost', '減価償却費',           8000000, 3),
  -- 2025年度
  (cid, bu2, 'revenue',       '新築工事売上',       160000000, 1),
  (cid, bu2, 'revenue',       'リフォーム工事売上',  70000000, 2),
  (cid, bu2, 'revenue',       'その他売上',          50000000, 3),
  (cid, bu2, 'direct_cost',   '外注工事費',         140000000, 1),
  (cid, bu2, 'direct_cost',   '材料費',              28000000, 2),
  (cid, bu2, 'indirect_cost', '人件費',              36000000, 1),
  (cid, bu2, 'indirect_cost', '販管費',              18000000, 2)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 9. ワークフロー種別 (workflow_types)
-- ============================================================
INSERT INTO workflow_types (id, company_id, key, name, created_at)
VALUES
  (wt1, cid, 'expense',  '経費申請',  NOW() - INTERVAL '200 days'),
  (wt2, cid, 'leave',    '休暇申請',  NOW() - INTERVAL '200 days'),
  (wt3, cid, 'purchase', '購入申請',  NOW() - INTERVAL '200 days')
ON CONFLICT (id) DO NOTHING;

-- ワークフロー申請 (workflow_requests)
INSERT INTO workflow_requests (id, company_id, type_id, requester_id, title, status, payload, amount, is_urgent, submitted_at, created_at)
VALUES
  (wr1, cid, wt1, u_emp, '現場交通費精算（2026年3月）', 'approved', '{"purpose":"現場往復交通費","date":"2026-03-31"}', 18500, false, NOW() - INTERVAL '20 days', NOW() - INTERVAL '22 days'),
  (wr2, cid, wt2, u_con, '有給休暇申請（2026-04-07〜04-09）', 'submitted', '{"leave_type":"annual","days":3,"reason":"家族旅行"}', NULL, false, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
  (wr3, cid, wt1, u_emp, '現場備品購入費（養生テープ・道具類）', 'submitted', '{"purpose":"現場備品","shop":"コーナン"}', 12800, false, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  (wr4, cid, wt3, u_hq,  '電動工具（インパクトドライバー）購入申請', 'approved', '{"item":"インパクトドライバー HiKOKI WH36DC","quantity":2}', 84000, false, NOW() - INTERVAL '30 days', NOW() - INTERVAL '32 days'),
  (wr5, cid, wt1, u_con, '取引先接待費（3月度）', 'rejected',  '{"purpose":"取引先接待","restaurant":"割烹 橘"}', 45000, false, NOW() - INTERVAL '15 days', NOW() - INTERVAL '16 days')
ON CONFLICT (id) DO NOTHING;

-- ワークフロー承認ステップ
INSERT INTO workflow_steps (company_id, request_id, step_order, approver_id, status, comment, decided_at)
VALUES
  (cid, wr1, 1, u_hq,  'approved', '確認しました。承認します。', NOW() - INTERVAL '18 days'),
  (cid, wr2, 1, u_hq,  'pending',  NULL, NULL),
  (cid, wr3, 1, u_hq,  'pending',  NULL, NULL),
  (cid, wr4, 1, u_hq,  'approved', '2台まとめて購入してください。', NOW() - INTERVAL '28 days'),
  (cid, wr5, 1, u_hq,  'rejected', '接待費は事前申請が必要です。規定をご確認ください。', NOW() - INTERVAL '13 days')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 10. 回覧 (announcements)
-- ============================================================
INSERT INTO announcements (id, company_id, author_id, title, body, pinned, is_urgent, target_type, published_at, created_at)
VALUES
  (an1, cid, u_own, '【重要】2026年度 安全衛生計画について',
   '今年度の安全衛生計画を策定しました。全現場スタッフは必ず内容を確認し、4月末までに確認署名をお願いします。KYシート・ヒヤリハット報告書の運用方法も変更になっています。',
   true, true, 'all', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
  (an2, cid, u_hq, '【連絡】ゴールデンウィーク休業日のお知らせ',
   '2026年のゴールデンウィーク休業は4月29日（水）〜5月6日（水）を予定しています。現場監督の方は担当現場の工程に影響がないかご確認ください。',
   false, false, 'all', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
  (an3, cid, u_hq, '【業務連絡】見積ソフトのバージョンアップについて',
   '見積システムが3月末にv4.2へアップデートされます。単価マスタが自動更新されますが、既存見積書への影響はありません。操作マニュアルを文書管理にアップしましたのでご確認ください。',
   false, false, 'all', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
  (an4, cid, u_own, '【報告】2025年度 表彰者のお知らせ',
   '2025年度の年間優秀スタッフとして、施工店管理者が選出されました。年間を通じて品質・安全・顧客満足度において高い評価を受けました。おめでとうございます。',
   false, false, 'all', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 11. カレンダー (calendar_events)
-- ============================================================
INSERT INTO calendar_events (company_id, title, description, start_at, end_at, all_day, category, location, customer_id, assigned_to, created_by, created_at)
VALUES
  (cid, '田中様邸 現場定例MTG',           '工程進捗確認・施主立会い',
   DATE_TRUNC('day', NOW()) + INTERVAL '2 days 10 hours',
   DATE_TRUNC('day', NOW()) + INTERVAL '2 days 11 hours 30 minutes',
   false, 'construction', '世田谷区用賀2-1-5（現場）', cu1, u_con, u_con, NOW()),
  (cid, '伊藤建設 最終引渡し書類確認',     '竣工図書・保証書の最終確認',
   DATE_TRUNC('day', NOW()) + INTERVAL '4 days 14 hours',
   DATE_TRUNC('day', NOW()) + INTERVAL '4 days 16 hours',
   false, 'construction', '港区赤坂1-2-3（伊藤建設本社）', cu3, u_hq, u_hq, NOW()),
  (cid, '鈴木様 見積説明・ヒアリング',     '提出見積の説明、追加要望ヒアリング',
   DATE_TRUNC('day', NOW()) + INTERVAL '6 days 13 hours',
   DATE_TRUNC('day', NOW()) + INTERVAL '6 days 14 hours 30 minutes',
   false, 'sales', 'BRIDGE テスト事務所', cu2, u_hq, u_hq, NOW()),
  (cid, '社内安全衛生委員会',              '月次KY活動・ヒヤリハット共有',
   DATE_TRUNC('day', NOW()) + INTERVAL '7 days 9 hours',
   DATE_TRUNC('day', NOW()) + INTERVAL '7 days 10 hours',
   false, 'task', 'BRIDGE テスト 会議室A', NULL, u_own, u_own, NOW()),
  (cid, '渡辺様邸 着工前現地確認',         '足場設置前・近隣挨拶',
   DATE_TRUNC('day', NOW()) + INTERVAL '12 days 9 hours',
   DATE_TRUNC('day', NOW()) + INTERVAL '12 days 11 hours',
   false, 'construction', '練馬区石神井町5-1-1（現場）', cu6, u_con, u_con, NOW()),
  (cid, '佐藤様 二世帯住宅 着工前打合せ', '仕様最終確認・工程表説明',
   DATE_TRUNC('day', NOW()) + INTERVAL '14 days 10 hours',
   DATE_TRUNC('day', NOW()) + INTERVAL '14 days 12 hours',
   false, 'sales', 'さいたま市浦和区高砂7-2（佐藤様邸）', cu4, u_own, u_own, NOW()),
  (cid, '2026年度Q1 業績レビュー',         '月次売上・粗利・進捗確認',
   DATE_TRUNC('day', NOW()) + INTERVAL '3 days 15 hours',
   DATE_TRUNC('day', NOW()) + INTERVAL '3 days 17 hours',
   false, 'task', 'BRIDGE テスト 会議室B', NULL, u_own, u_own, NOW()),
  (cid, '高橋工務店 発注打合せ',          '田中様邸 木工事発注内容確認',
   DATE_TRUNC('day', NOW()) + INTERVAL '5 days 11 hours',
   DATE_TRUNC('day', NOW()) + INTERVAL '5 days 12 hours',
   false, 'construction', 'BRIDGE テスト事務所', NULL, u_con, u_con, NOW())
ON CONFLICT DO NOTHING;


RAISE NOTICE '✅ デモデータの投入が完了しました。';
RAISE NOTICE '   顧客: 6件 / 商談: 6件 / 職人: 5件';
RAISE NOTICE '   見積: 3件 / 契約: 3件 / 工事: 3件（工程 30件）';
RAISE NOTICE '   請求: 3件 / 予算: 2年分 / ワークフロー: 5件';
RAISE NOTICE '   回覧: 4件 / カレンダー: 8件';

END $$;
