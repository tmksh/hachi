-- Remove discontinued / unused app integration providers

DELETE FROM app_integrations
WHERE provider IN ('line_notify', 'teams', 'google_chat', 'discord');

ALTER TABLE app_integrations
  DROP CONSTRAINT IF EXISTS app_integrations_provider_check;

ALTER TABLE app_integrations
  ADD CONSTRAINT app_integrations_provider_check
  CHECK (provider IN (
    'chatwork',
    'slack',
    'line_works',
    'kintone'
  ));
