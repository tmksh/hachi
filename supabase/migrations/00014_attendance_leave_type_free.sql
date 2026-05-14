-- leave_type の CHECK 制約を削除してフリーテキストに変更
ALTER TABLE attendance_entries
  DROP CONSTRAINT IF EXISTS attendance_entries_leave_type_check;
