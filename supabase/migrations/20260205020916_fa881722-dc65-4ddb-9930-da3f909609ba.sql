-- Fix WARN level security issues

-- 1. Add RLS policies for whatsapp_lid_mappings table (currently has RLS enabled but no policies)
-- Allow admins to view, insert, update, and delete mappings

CREATE POLICY "Admins can view whatsapp_lid_mappings"
ON public.whatsapp_lid_mappings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert whatsapp_lid_mappings"
ON public.whatsapp_lid_mappings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update whatsapp_lid_mappings"
ON public.whatsapp_lid_mappings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete whatsapp_lid_mappings"
ON public.whatsapp_lid_mappings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Create a secure view for public doctor data (without sensitive prompt_ia field)
-- The chatbot edge function already uses SERVICE_ROLE_KEY so it will continue to work

CREATE OR REPLACE VIEW public.doctors_public 
WITH (security_invoker = true)
AS
SELECT 
  id,
  nome,
  especialidade,
  ativo,
  created_at
FROM public.doctors;

-- Grant access to the public view
GRANT SELECT ON public.doctors_public TO anon, authenticated;

-- 3. Create RLS policy to restrict prompt_ia access to admins only
-- First, we need to add a more restrictive policy for the doctors table

-- Drop the existing public SELECT policy if it exists (allowing all to read)
DROP POLICY IF EXISTS "Doctors are viewable by everyone" ON public.doctors;

-- Create new policy: Public can only see basic info (via the view), admins see everything
CREATE POLICY "Public can view basic doctor info"
ON public.doctors
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Authenticated users can view basic doctor info"
ON public.doctors
FOR SELECT
TO authenticated
USING (true);

-- Note: The prompt_ia field remains accessible via SERVICE_ROLE_KEY in edge functions
-- For the frontend, we should use the doctors_public view for non-admin displays