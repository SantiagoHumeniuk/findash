-- Downgrade the current user's paid plan after 30 days from payment approval.
-- Apply this script in the Supabase SQL Editor before deploying the client changes.

CREATE OR REPLACE FUNCTION public.expire_subscription_if_due()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_approved_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT role
  INTO v_role
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_role IS NULL OR v_role NOT IN ('plus', 'premium') THEN
    RETURN FALSE;
  END IF;

  SELECT reviewed_at
  INTO v_approved_at
  FROM public.subscription_requests
  WHERE user_id = v_user_id
    AND plan = v_role
    AND status = 'approved'
    AND reviewed_at IS NOT NULL
  ORDER BY reviewed_at DESC
  LIMIT 1;

  IF v_approved_at IS NULL OR v_approved_at + INTERVAL '30 days' > NOW() THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
  SET role = 'basico'
  WHERE id = v_user_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_subscription_if_due() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_subscription_if_due() TO authenticated;
