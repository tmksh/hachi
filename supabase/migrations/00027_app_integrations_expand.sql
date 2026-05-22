-- Expand supported app integration providers

ALTER TABLE app_integrations
  DROP CONSTRAINT IF EXISTS app_integrations_provider_check;

ALTER TABLE app_integrations
  ADD CONSTRAINT app_integrations_provider_check
  CHECK (provider IN (
    'chatwork',
    'slack',
    'teams',
    'google_chat',
    'discord',
    'line_notify',
    'line_works',
    'kintone'
  ));
