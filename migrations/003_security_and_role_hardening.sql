-- Apply after the initial schema. Removes unsupported roles and scopes access.

DELETE FROM user_roles
WHERE role_id IN (
    SELECT id FROM roles
    WHERE name NOT IN ('ADMIN', 'EVENT_MANAGER', 'OFFLINE_COLLECTOR', 'GATE_STAFF', 'FOOD_STAFF', 'STUDENT')
);
DELETE FROM roles
WHERE name NOT IN ('ADMIN', 'EVENT_MANAGER', 'OFFLINE_COLLECTOR', 'GATE_STAFF', 'FOOD_STAFF', 'STUDENT');

CREATE TABLE IF NOT EXISTS event_managers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_managers_user_event ON event_managers(user_id, event_id);
