-- =========================================================
-- 職人マスタ（職種区分・資格）の RLS 修正
--   - FOR ALL のみ／owner 残留により INSERT が拒否されるケースを解消
--   - hq_admin / admin が明示的な INSERT/UPDATE/DELETE で管理可能に
--   - CRM マスタも同様に揃える
-- =========================================================

-- ── craftsmen_specialties ──────────────────────────────
DROP POLICY IF EXISTS "admins can manage craftsmen_specialties" ON craftsmen_specialties;
DROP POLICY IF EXISTS "admins insert craftsmen_specialties" ON craftsmen_specialties;
DROP POLICY IF EXISTS "admins update craftsmen_specialties" ON craftsmen_specialties;
DROP POLICY IF EXISTS "admins delete craftsmen_specialties" ON craftsmen_specialties;

CREATE POLICY "admins insert craftsmen_specialties"
  ON craftsmen_specialties FOR INSERT
  WITH CHECK (
    company_id = auth_company_id()
    AND auth_role() IN ('hq_admin', 'admin', 'owner')
  );

CREATE POLICY "admins update craftsmen_specialties"
  ON craftsmen_specialties FOR UPDATE
  USING (
    company_id = auth_company_id()
    AND auth_role() IN ('hq_admin', 'admin', 'owner')
  )
  WITH CHECK (
    company_id = auth_company_id()
    AND auth_role() IN ('hq_admin', 'admin', 'owner')
  );

CREATE POLICY "admins delete craftsmen_specialties"
  ON craftsmen_specialties FOR DELETE
  USING (
    company_id = auth_company_id()
    AND auth_role() IN ('hq_admin', 'admin', 'owner')
  );

-- ── craftsmen_qualifications ───────────────────────────
DROP POLICY IF EXISTS "admins can manage craftsmen_qualifications" ON craftsmen_qualifications;
DROP POLICY IF EXISTS "admins insert craftsmen_qualifications" ON craftsmen_qualifications;
DROP POLICY IF EXISTS "admins update craftsmen_qualifications" ON craftsmen_qualifications;
DROP POLICY IF EXISTS "admins delete craftsmen_qualifications" ON craftsmen_qualifications;

CREATE POLICY "admins insert craftsmen_qualifications"
  ON craftsmen_qualifications FOR INSERT
  WITH CHECK (
    company_id = auth_company_id()
    AND auth_role() IN ('hq_admin', 'admin', 'owner')
  );

CREATE POLICY "admins update craftsmen_qualifications"
  ON craftsmen_qualifications FOR UPDATE
  USING (
    company_id = auth_company_id()
    AND auth_role() IN ('hq_admin', 'admin', 'owner')
  )
  WITH CHECK (
    company_id = auth_company_id()
    AND auth_role() IN ('hq_admin', 'admin', 'owner')
  );

CREATE POLICY "admins delete craftsmen_qualifications"
  ON craftsmen_qualifications FOR DELETE
  USING (
    company_id = auth_company_id()
    AND auth_role() IN ('hq_admin', 'admin', 'owner')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON craftsmen_specialties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON craftsmen_qualifications TO authenticated;

-- ── CRM マスタ（同パターンで追加不可になりやすい） ─────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'deal_stages',
    'lost_reasons',
    'lead_sources',
    'customer_tag_masters'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'admins can manage ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'admins insert ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'admins update ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'admins delete ' || t, t);

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (
         company_id = auth_company_id()
         AND auth_role() IN (''hq_admin'', ''admin'', ''owner'')
       )',
      'admins insert ' || t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE
         USING (company_id = auth_company_id() AND auth_role() IN (''hq_admin'', ''admin'', ''owner''))
         WITH CHECK (company_id = auth_company_id() AND auth_role() IN (''hq_admin'', ''admin'', ''owner''))',
      'admins update ' || t, t
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE
         USING (company_id = auth_company_id() AND auth_role() IN (''hq_admin'', ''admin'', ''owner''))',
      'admins delete ' || t, t
    );
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated',
      t
    );
  END LOOP;
END $$;
