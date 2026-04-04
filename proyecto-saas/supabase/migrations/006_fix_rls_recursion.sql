-- Fix infinite recursion in workspace_members RLS policies
-- The old policies queried workspace_members from within workspace_members → infinite loop

DROP POLICY IF EXISTS "members_workspace_access" ON public.workspace_members;
DROP POLICY IF EXISTS "members_admin_write" ON public.workspace_members;

-- SECURITY DEFINER function breaks the recursion by running as owner (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid();
$$;

-- New non-recursive policies
CREATE POLICY "members_select" ON public.workspace_members
  FOR SELECT USING (
    workspace_id IN (SELECT public.get_my_workspace_ids())
  );

CREATE POLICY "members_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR workspace_id IN (SELECT public.get_my_workspace_ids())
  );

CREATE POLICY "members_admin_update_delete" ON public.workspace_members
  FOR ALL USING (
    workspace_id IN (SELECT public.get_my_workspace_ids())
  );
