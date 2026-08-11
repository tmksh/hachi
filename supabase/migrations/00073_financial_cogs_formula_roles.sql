-- ============================================
-- 決算書: 製造原価の計算ロール（No.90）
--   期首/期末材料棚卸・仕掛品を科目に持たせ、
--   当期製品製造原価 = 総製造費用 + 期首仕掛 − 期末仕掛 を計算する
-- ============================================

ALTER TABLE financial_account_items
  ADD COLUMN IF NOT EXISTS formula_role TEXT
  CHECK (
    formula_role IS NULL
    OR formula_role IN (
      'begin_material',
      'material_purchase',
      'end_material',
      'begin_wip',
      'end_wip'
    )
  );

COMMENT ON COLUMN financial_account_items.formula_role IS
  '製造原価の加減算ロール（No.90）。begin/end_material=材料棚卸、material_purchase=仕入、begin/end_wip=仕掛品。NULLは通常科目';
