-- email_accounts に (user_id, provider) のユニーク制約を追加
ALTER TABLE email_accounts
  ADD CONSTRAINT email_accounts_user_id_provider_key UNIQUE (user_id, provider);
