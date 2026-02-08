
-- Drop the conflicting ALL policy and create separate INSERT/UPDATE/DELETE policies
DROP POLICY IF EXISTS "Only admins can manage school settings" ON public.school_settings;

CREATE POLICY "Admins can insert school settings" ON public.school_settings FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update school settings" ON public.school_settings FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete school settings" ON public.school_settings FOR DELETE USING (is_admin());

-- Insert a default row so the app doesn't need to insert one
INSERT INTO public.school_settings (school_name, portal_name, theme_color)
VALUES ('OAUSTECH Portal', 'OAUSTECH Portal', '#ef4444')
ON CONFLICT DO NOTHING;
