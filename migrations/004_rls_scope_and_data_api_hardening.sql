-- Lock down all API-exposed application data. The Flask backend connects with
-- its database role; browser users are limited by these authenticated policies.

CREATE OR REPLACE FUNCTION public.user_has_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name = required_role
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_role(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_role(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.manages_event(target_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_role('ADMIN') OR EXISTS (
    SELECT 1 FROM public.event_managers
    WHERE event_id = target_event_id AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.manages_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manages_event(uuid) TO authenticated;

ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role & Backend manages registrations" ON registrations;
DROP POLICY IF EXISTS "Students view their own registrations" ON registrations;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Students view their own tickets" ON tickets;
DROP POLICY IF EXISTS "View food entitlements" ON food_entitlements;
DROP POLICY IF EXISTS "Only Admins can view audit logs" ON audit_logs;

CREATE POLICY profiles_select_own_or_admin ON profiles FOR SELECT TO authenticated
USING ((select auth.uid()) = id OR public.user_has_role('ADMIN'));
CREATE POLICY profiles_update_own ON profiles FOR UPDATE TO authenticated
USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);

CREATE POLICY events_select_published_anon ON events FOR SELECT TO anon
USING (status IN ('PUBLISHED', 'LIVE'));
CREATE POLICY events_select_scoped_authenticated ON events FOR SELECT TO authenticated
USING (status IN ('PUBLISHED', 'LIVE') OR public.manages_event(id));

CREATE POLICY registrations_select_scoped ON registrations FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  OR public.manages_event(event_id)
  OR EXISTS (SELECT 1 FROM offline_collections oc WHERE oc.registration_id = registrations.id AND oc.collector_id = (select auth.uid()))
);

CREATE POLICY tickets_select_scoped ON tickets FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM registrations r WHERE r.id = tickets.registration_id AND r.user_id = (select auth.uid()))
  OR public.manages_event(event_id)
  OR public.user_has_role('GATE_STAFF')
  OR public.user_has_role('FOOD_STAFF')
);

CREATE POLICY food_entitlements_select_scoped ON food_entitlements FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tickets t JOIN registrations r ON r.id = t.registration_id
    WHERE t.id = food_entitlements.ticket_id AND r.user_id = (select auth.uid())
  )
  OR public.manages_event(event_id)
  OR public.user_has_role('FOOD_STAFF')
);

CREATE POLICY collections_select_scoped ON offline_collections FOR SELECT TO authenticated
USING (collector_id = (select auth.uid()) OR public.manages_event(event_id));

CREATE POLICY payments_select_scoped ON payments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM registrations r WHERE r.id = payments.registration_id AND (r.user_id = (select auth.uid()) OR public.manages_event(r.event_id))));

CREATE POLICY audit_select_admin ON audit_logs FOR SELECT TO authenticated
USING (public.user_has_role('ADMIN'));

-- Direct Data API access is deliberately read-only. Mutations use the Flask
-- service after JWT and business-rule checks.
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
GRANT SELECT ON events, profiles, registrations, tickets, food_entitlements, offline_collections, payments, audit_logs TO anon, authenticated;
