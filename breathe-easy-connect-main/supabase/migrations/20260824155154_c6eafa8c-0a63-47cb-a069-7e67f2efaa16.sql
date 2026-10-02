ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE POLICY "profiles staff update" ON public.profiles
FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "roles staff write" ON public.user_roles
FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;