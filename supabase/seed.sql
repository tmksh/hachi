-- ============================================================
-- BRIDGE テスト用シードデータ
-- Supabase SQL Editor で実行してください。
-- パスワード: Bridge2024!  (全ユーザー共通)
-- ============================================================

DO $$
DECLARE
  company_id  UUID := '00000000-0000-0000-0000-000000000001';
  owner_id    UUID := '00000000-0000-0000-0000-000000000010';
  hq_id       UUID := '00000000-0000-0000-0000-000000000020';
  contr_id    UUID := '00000000-0000-0000-0000-000000000030';
  emp_id      UUID := '00000000-0000-0000-0000-000000000040';
  pass        TEXT := crypt('Bridge2024!', gen_salt('bf'));
  instance_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN

  -- ----------------------------------------------------------
  -- 1. テスト会社
  -- ----------------------------------------------------------
  INSERT INTO companies (id, name, created_at, updated_at)
  VALUES (company_id, 'BRIDGE テスト株式会社', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- ----------------------------------------------------------
  -- 2. auth.users への挿入
  -- ----------------------------------------------------------

  -- オーナー
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    owner_id, instance_id, 'authenticated', 'authenticated',
    'owner@bridge.test', pass,
    NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(), '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  -- 本部管理者
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    hq_id, instance_id, 'authenticated', 'authenticated',
    'hqadmin@bridge.test', pass,
    NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(), '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  -- 施工店管理者
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    contr_id, instance_id, 'authenticated', 'authenticated',
    'contractor@bridge.test', pass,
    NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(), '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  -- 社員
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    emp_id, instance_id, 'authenticated', 'authenticated',
    'employee@bridge.test', pass,
    NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    NOW(), NOW(), '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  -- ----------------------------------------------------------
  -- 3. auth.identities への挿入 (メール認証用)
  -- ----------------------------------------------------------

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES
    (
      owner_id::text, owner_id,
      json_build_object('sub', owner_id::text, 'email', 'owner@bridge.test'),
      'email', owner_id::text,
      NOW(), NOW(), NOW()
    ),
    (
      hq_id::text, hq_id,
      json_build_object('sub', hq_id::text, 'email', 'hqadmin@bridge.test'),
      'email', hq_id::text,
      NOW(), NOW(), NOW()
    ),
    (
      contr_id::text, contr_id,
      json_build_object('sub', contr_id::text, 'email', 'contractor@bridge.test'),
      'email', contr_id::text,
      NOW(), NOW(), NOW()
    ),
    (
      emp_id::text, emp_id,
      json_build_object('sub', emp_id::text, 'email', 'employee@bridge.test'),
      'email', emp_id::text,
      NOW(), NOW(), NOW()
    )
  ON CONFLICT (id) DO NOTHING;

  -- ----------------------------------------------------------
  -- 4. profiles への挿入
  -- ----------------------------------------------------------

  INSERT INTO profiles (
    id, company_id, display_name, email, role, department, position,
    created_at, updated_at
  ) VALUES
    (
      owner_id, company_id,
      'テスト オーナー', 'owner@bridge.test',
      'owner', 'general', '代表取締役',
      NOW(), NOW()
    ),
    (
      hq_id, company_id,
      'テスト 本部管理者', 'hqadmin@bridge.test',
      'hq_admin', 'general', '本部長',
      NOW(), NOW()
    ),
    (
      contr_id, company_id,
      'テスト 施工店管理者', 'contractor@bridge.test',
      'contractor_admin', 'construction', '現場監督',
      NOW(), NOW()
    ),
    (
      emp_id, company_id,
      'テスト 社員', 'employee@bridge.test',
      'employee', 'construction', '作業員',
      NOW(), NOW()
    )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE '✅ シードデータの挿入が完了しました。';
  RAISE NOTICE '   owner@bridge.test       / Bridge2024!  → オーナー';
  RAISE NOTICE '   hqadmin@bridge.test     / Bridge2024!  → 本部管理者';
  RAISE NOTICE '   contractor@bridge.test  / Bridge2024!  → 施工店管理者';
  RAISE NOTICE '   employee@bridge.test    / Bridge2024!  → 社員';

END $$;
