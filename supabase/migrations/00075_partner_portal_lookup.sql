-- 外部協力業者ポータル（/partner/[token]）用。ログインなしでトークン照合できるようにする。

ALTER TABLE partner_access_tokens
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.lookup_partner_access_token(p_token text)
RETURNS TABLE (
  token text,
  label text,
  construction_title text,
  start_date date,
  end_date date,
  order_title text,
  amount numeric,
  work_content text,
  craftsman_name text,
  accepted_at timestamptz,
  contractor_order_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.token,
    t.label,
    c.title,
    c.start_date,
    c.end_date,
    o.title,
    o.amount,
    o.work_content,
    cr.name,
    t.accepted_at,
    t.contractor_order_id
  FROM partner_access_tokens t
  LEFT JOIN constructions c ON c.id = t.construction_id
  LEFT JOIN contractor_orders o ON o.id = t.contractor_order_id
  LEFT JOIN craftsmen cr ON cr.id = o.craftsman_id
  WHERE t.token = p_token
    AND (t.expires_at IS NULL OR t.expires_at > now())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.accept_partner_order_by_token(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid uuid;
BEGIN
  SELECT id INTO tid
  FROM partner_access_tokens
  WHERE token = p_token
    AND (expires_at IS NULL OR expires_at > now());
  IF tid IS NULL THEN
    RETURN false;
  END IF;

  UPDATE partner_access_tokens
  SET accepted_at = coalesce(accepted_at, now())
  WHERE id = tid;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_partner_access_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_partner_order_by_token(text) TO anon, authenticated;
