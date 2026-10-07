ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS registration_open BOOLEAN;

COMMENT ON COLUMN public.events.registration_open IS
    'Manual registration override: NULL follows the configured registration window, TRUE opens early or after the deadline, FALSE closes immediately.';
