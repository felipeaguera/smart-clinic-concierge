-- Permitir que o Super Admin (felipe_aguera@hotmail.com) insira novas roles
CREATE POLICY "Super admin pode inserir user_roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'felipe_aguera@hotmail.com'
  );

-- Permitir que o Super Admin delete roles (exceto a própria)
CREATE POLICY "Super admin pode deletar user_roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'felipe_aguera@hotmail.com'
    AND user_id != auth.uid()
  );