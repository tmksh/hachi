-- メールスレッド／本文は連携した本人のアカウントだけ見える。
-- 会社メンバー全員に見える状態だと、他ユーザーのメールが混在する。

CREATE OR REPLACE FUNCTION auth_owns_email_account(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM email_accounts
    WHERE id = p_account_id
      AND user_id = auth.uid()
      AND company_id = auth_company_id()
  );
$$;

CREATE OR REPLACE FUNCTION auth_owns_email_thread(p_thread_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM email_threads et
    JOIN email_accounts ea ON ea.id = et.account_id
    WHERE et.id = p_thread_id
      AND ea.user_id = auth.uid()
      AND et.company_id = auth_company_id()
      AND ea.company_id = auth_company_id()
  );
$$;

CREATE OR REPLACE FUNCTION auth_owns_email_message(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM email_messages em
    JOIN email_threads et ON et.id = em.thread_id
    JOIN email_accounts ea ON ea.id = et.account_id
    WHERE em.id = p_message_id
      AND ea.user_id = auth.uid()
      AND em.company_id = auth_company_id()
      AND et.company_id = auth_company_id()
      AND ea.company_id = auth_company_id()
  );
$$;

-- email_accounts: 更新・削除も本人のみ
DROP POLICY IF EXISTS "tenant_update_email_accounts" ON email_accounts;
DROP POLICY IF EXISTS "tenant_delete_email_accounts" ON email_accounts;
DROP POLICY IF EXISTS "email_accounts_update" ON email_accounts;
DROP POLICY IF EXISTS "email_accounts_delete" ON email_accounts;

CREATE POLICY "email_accounts_update" ON email_accounts
  FOR UPDATE USING (
    company_id = auth_company_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    company_id = auth_company_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "email_accounts_delete" ON email_accounts
  FOR DELETE USING (
    company_id = auth_company_id()
    AND user_id = auth.uid()
  );

-- email_threads
DROP POLICY IF EXISTS "tenant_select_email_threads" ON email_threads;
DROP POLICY IF EXISTS "tenant_insert_email_threads" ON email_threads;
DROP POLICY IF EXISTS "tenant_update_email_threads" ON email_threads;
DROP POLICY IF EXISTS "tenant_delete_email_threads" ON email_threads;
DROP POLICY IF EXISTS "email_threads_select" ON email_threads;
DROP POLICY IF EXISTS "email_threads_insert" ON email_threads;
DROP POLICY IF EXISTS "email_threads_update" ON email_threads;
DROP POLICY IF EXISTS "email_threads_delete" ON email_threads;

CREATE POLICY "email_threads_select" ON email_threads
  FOR SELECT USING (
    company_id = auth_company_id()
    AND auth_owns_email_account(account_id)
  );

CREATE POLICY "email_threads_insert" ON email_threads
  FOR INSERT WITH CHECK (
    company_id = auth_company_id()
    AND auth_owns_email_account(account_id)
  );

CREATE POLICY "email_threads_update" ON email_threads
  FOR UPDATE USING (
    company_id = auth_company_id()
    AND auth_owns_email_account(account_id)
  )
  WITH CHECK (
    company_id = auth_company_id()
    AND auth_owns_email_account(account_id)
  );

CREATE POLICY "email_threads_delete" ON email_threads
  FOR DELETE USING (
    company_id = auth_company_id()
    AND auth_owns_email_account(account_id)
  );

-- email_messages
DROP POLICY IF EXISTS "tenant_select_email_messages" ON email_messages;
DROP POLICY IF EXISTS "tenant_insert_email_messages" ON email_messages;
DROP POLICY IF EXISTS "tenant_update_email_messages" ON email_messages;
DROP POLICY IF EXISTS "tenant_delete_email_messages" ON email_messages;
DROP POLICY IF EXISTS "email_messages_select" ON email_messages;
DROP POLICY IF EXISTS "email_messages_insert" ON email_messages;
DROP POLICY IF EXISTS "email_messages_update" ON email_messages;
DROP POLICY IF EXISTS "email_messages_delete" ON email_messages;

CREATE POLICY "email_messages_select" ON email_messages
  FOR SELECT USING (
    company_id = auth_company_id()
    AND auth_owns_email_thread(thread_id)
  );

CREATE POLICY "email_messages_insert" ON email_messages
  FOR INSERT WITH CHECK (
    company_id = auth_company_id()
    AND auth_owns_email_thread(thread_id)
  );

CREATE POLICY "email_messages_update" ON email_messages
  FOR UPDATE USING (
    company_id = auth_company_id()
    AND auth_owns_email_thread(thread_id)
  )
  WITH CHECK (
    company_id = auth_company_id()
    AND auth_owns_email_thread(thread_id)
  );

CREATE POLICY "email_messages_delete" ON email_messages
  FOR DELETE USING (
    company_id = auth_company_id()
    AND auth_owns_email_thread(thread_id)
  );

-- email_attachments
DROP POLICY IF EXISTS "tenant_select_email_attachments" ON email_attachments;
DROP POLICY IF EXISTS "tenant_insert_email_attachments" ON email_attachments;
DROP POLICY IF EXISTS "tenant_update_email_attachments" ON email_attachments;
DROP POLICY IF EXISTS "tenant_delete_email_attachments" ON email_attachments;
DROP POLICY IF EXISTS "email_attachments_select" ON email_attachments;
DROP POLICY IF EXISTS "email_attachments_insert" ON email_attachments;
DROP POLICY IF EXISTS "email_attachments_update" ON email_attachments;
DROP POLICY IF EXISTS "email_attachments_delete" ON email_attachments;

CREATE POLICY "email_attachments_select" ON email_attachments
  FOR SELECT USING (
    company_id = auth_company_id()
    AND auth_owns_email_message(message_id)
  );

CREATE POLICY "email_attachments_insert" ON email_attachments
  FOR INSERT WITH CHECK (
    company_id = auth_company_id()
    AND auth_owns_email_message(message_id)
  );

CREATE POLICY "email_attachments_update" ON email_attachments
  FOR UPDATE USING (
    company_id = auth_company_id()
    AND auth_owns_email_message(message_id)
  )
  WITH CHECK (
    company_id = auth_company_id()
    AND auth_owns_email_message(message_id)
  );

CREATE POLICY "email_attachments_delete" ON email_attachments
  FOR DELETE USING (
    company_id = auth_company_id()
    AND auth_owns_email_message(message_id)
  );

CREATE INDEX IF NOT EXISTS idx_email_threads_account ON email_threads(account_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON email_messages(thread_id);
