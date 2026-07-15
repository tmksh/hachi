-- 工程タスクに担当業者と依存関係（先行工程）を追加
ALTER TABLE construction_tasks ADD COLUMN IF NOT EXISTS contractor_name TEXT;
ALTER TABLE construction_tasks ADD COLUMN IF NOT EXISTS depends_on_task_id UUID REFERENCES construction_tasks(id) ON DELETE SET NULL;
