-- SPHOORTHY EVENTS — Row Level Security (RLS) Policies
-- Target: Supabase PostgreSQL

-- Enable RLS on core sensitive tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user has a specific role
CREATE OR REPLACE FUNCTION auth.user_has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
          AND r.name = required_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES POLICIES
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id OR auth.user_has_role('ADMIN'));

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- REGISTRATIONS POLICIES
CREATE POLICY "Students view their own registrations"
    ON registrations FOR SELECT
    USING (user_id = auth.uid() OR auth.user_has_role('ADMIN') OR auth.user_has_role('EVENT_MANAGER') OR auth.user_has_role('OFFLINE_COLLECTOR'));

CREATE POLICY "Service role & Backend manages registrations"
    ON registrations FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE);

-- TICKETS POLICIES
CREATE POLICY "Students view their own tickets"
    ON tickets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM registrations r
            WHERE r.id = tickets.registration_id
              AND r.user_id = auth.uid()
        )
        OR auth.user_has_role('ADMIN')
        OR auth.user_has_role('EVENT_MANAGER')
        OR auth.user_has_role('GATE_STAFF')
        OR auth.user_has_role('FOOD_STAFF')
    );

-- FOOD ENTITLEMENTS POLICIES
CREATE POLICY "View food entitlements"
    ON food_entitlements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tickets t
            JOIN registrations r ON t.registration_id = r.id
            WHERE t.id = food_entitlements.ticket_id
              AND r.user_id = auth.uid()
        )
        OR auth.user_has_role('ADMIN')
        OR auth.user_has_role('FOOD_STAFF')
    );

-- AUDIT LOGS POLICIES
CREATE POLICY "Only Admins can view audit logs"
    ON audit_logs FOR SELECT
    USING (auth.user_has_role('ADMIN'));
