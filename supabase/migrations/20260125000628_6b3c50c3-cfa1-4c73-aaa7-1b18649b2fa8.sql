-- Fix Super Admin-only policies to avoid querying auth.users (permission denied)
-- Uses JWT email claim instead.

DROP POLICY IF EXISTS "Super admin pode inserir user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin pode deletar user_roles" ON public.user_roles;

CREATE POLICY "Super admin pode inserir user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'email') = 'felipe_aguera@hotmail.com'
);

CREATE POLICY "Super admin pode deletar user_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  (auth.jwt() ->> 'email') = 'felipe_aguera@hotmail.com'
  AND user_id <> auth.uid()
);
