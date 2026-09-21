-- 既存メールを変更せず、利用者本人の振り分け状態を保存する。
ALTER TABLE public.email_threads
  ADD COLUMN IF NOT EXISTS is_spam BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_email_threads_spam
  ON public.email_threads(account_id) WHERE is_spam;

-- 他ユーザーのフォルダIDを直接指定しても関連付けられないようにする。
DROP POLICY IF EXISTS email_threads_own_folder ON public.email_threads;
CREATE POLICY email_threads_own_folder ON public.email_threads
  AS RESTRICTIVE FOR ALL
  USING (true)
  WITH CHECK (
    folder_id IS NULL OR EXISTS (
      SELECT 1 FROM public.email_folders f
      WHERE f.id = email_threads.folder_id
        AND f.user_id = auth.uid()
        AND f.company_id = auth_company_id()
    )
  );
