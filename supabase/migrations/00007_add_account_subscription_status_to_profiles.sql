-- ── New ENUMs ──
CREATE TYPE account_status AS ENUM ('active', 'suspended');
CREATE TYPE subscription_status AS ENUM ('free', 'premium', 'expired');

-- ── Add columns to profiles ──
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status account_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_status subscription_status NOT NULL DEFAULT 'free';

-- ── Helper: is current user an admin? ──
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ── RLS: admins can read ALL profiles ──
DROP POLICY IF EXISTS "admins_read_all_profiles" ON public.profiles;
CREATE POLICY "admins_read_all_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- ── RLS: admins can update any profile (for status management) ──
DROP POLICY IF EXISTS "admins_update_any_profile" ON public.profiles;
CREATE POLICY "admins_update_any_profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Ensure own-profile update is also allowed (non-admin self-update) ──
DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── Secure admin stats RPC: counts via SECURITY DEFINER ──
CREATE OR REPLACE FUNCTION public.get_admin_user_stats()
RETURNS json LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT json_build_object(
    'total',        COUNT(*),
    'active',       COUNT(*) FILTER (WHERE account_status = 'active'),
    'suspended',    COUNT(*) FILTER (WHERE account_status = 'suspended'),
    'free',         COUNT(*) FILTER (WHERE subscription_status = 'free'),
    'premium',      COUNT(*) FILTER (WHERE subscription_status = 'premium'),
    'expired',      COUNT(*) FILTER (WHERE subscription_status = 'expired')
  ) FROM public.profiles;
$$;

-- ── Secure admin user list RPC ──
CREATE OR REPLACE FUNCTION public.get_admin_user_list(
  p_search      text DEFAULT '',
  p_acc_status  text DEFAULT 'all',
  p_sub_status  text DEFAULT 'all',
  p_limit       int  DEFAULT 50,
  p_offset      int  DEFAULT 0
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  result json;
BEGIN
  -- Only admins may call this
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT json_agg(row_to_json(u))
  INTO result
  FROM (
    SELECT
      id, email, display_name, role,
      account_status, subscription_status,
      created_at, deletion_requested_at
    FROM public.profiles
    WHERE
      (p_search = '' OR email ILIKE '%' || p_search || '%')
      AND (p_acc_status = 'all' OR account_status::text = p_acc_status)
      AND (p_sub_status = 'all' OR subscription_status::text = p_sub_status)
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) u;

  RETURN COALESCE(result, '[]'::json);
END;
$$;