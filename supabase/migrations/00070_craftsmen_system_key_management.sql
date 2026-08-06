-- No.66/106: システム予約に「経営調整費」を追加。表下サマリー廃止後は明細行の発注業者で選ぶ。
ALTER TABLE craftsmen DROP CONSTRAINT IF EXISTS craftsmen_system_key_check;
ALTER TABLE craftsmen
  ADD CONSTRAINT craftsmen_system_key_check
  CHECK (system_key IS NULL OR system_key IN ('unregistered', 'reserve', 'management'));

COMMENT ON COLUMN craftsmen.system_key IS
  'システム予約の識別キー: unregistered=未登録業者 / reserve=予備費 / management=経営調整費。kind=system のときのみ設定';

COMMENT ON COLUMN estimate_items.is_reserve_row IS
  'システム原価行（発注業者=予備費 or 経営調整費）。原価のみ入力可・売価0固定・顧客向けPDF非表示';
