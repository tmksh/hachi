-- calendar_events に Google Calendar のイベントIDを保存するカラムを追加
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT DEFAULT 'primary';
