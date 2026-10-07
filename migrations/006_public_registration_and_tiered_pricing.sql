ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS first_year_ticket_price NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
    ADD COLUMN IF NOT EXISTS second_year_ticket_price NUMERIC(10, 2) NOT NULL DEFAULT 600.00,
    ADD COLUMN IF NOT EXISTS other_ticket_price NUMERIC(10, 2);

ALTER TABLE public.registrations
    ADD COLUMN IF NOT EXISTS payment_access_token_hash TEXT;

ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS public_access_token_hash TEXT;

ALTER TABLE public.events
    ADD CONSTRAINT events_first_year_ticket_price_nonnegative
        CHECK (first_year_ticket_price >= 0),
    ADD CONSTRAINT events_second_year_ticket_price_nonnegative
        CHECK (second_year_ticket_price >= 0),
    ADD CONSTRAINT events_other_ticket_price_nonnegative
        CHECK (other_ticket_price IS NULL OR other_ticket_price >= 0);
