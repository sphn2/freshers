-- Migration 008: Daily Settlements Table
-- Tracks daily financial settlements for events (online + offline collections)

CREATE TABLE IF NOT EXISTS public.daily_settlements (
    id TEXT PRIMARY KEY,
    event_id TEXT REFERENCES public.events(id) ON DELETE SET NULL,
    settlement_date DATE NOT NULL,
    total_online_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_cash_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_tickets_issued INTEGER NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_settled BOOLEAN NOT NULL DEFAULT FALSE,
    settled_at TIMESTAMPTZ,
    settled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    receiver_name VARCHAR(255),
    bank_name VARCHAR(255),
    account_number VARCHAR(100),
    ifsc_code VARCHAR(20),
    transaction_id VARCHAR(100),
    transaction_date DATE,
    notes TEXT,
    authorized_by_name VARCHAR(255),
    receipt_number VARCHAR(50) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_settlements_date
    ON public.daily_settlements (settlement_date, event_id);

ALTER TABLE public.daily_settlements ENABLE ROW LEVEL SECURITY;

-- Super admins and admins can view settlements
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'daily_settlements' AND policyname = 'Admins can view settlements'
    ) THEN
        CREATE POLICY "Admins can view settlements"
            ON public.daily_settlements
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.user_roles ur
                    JOIN public.roles r ON ur.role_id = r.id
                    WHERE ur.user_id = auth.uid() AND r.name IN ('SUPER_ADMIN', 'ADMIN')
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'daily_settlements' AND policyname = 'Super admins can manage settlements'
    ) THEN
        CREATE POLICY "Super admins can manage settlements"
            ON public.daily_settlements
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.user_roles ur
                    JOIN public.roles r ON ur.role_id = r.id
                    WHERE ur.user_id = auth.uid() AND r.name = 'SUPER_ADMIN'
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.user_roles ur
                    JOIN public.roles r ON ur.role_id = r.id
                    WHERE ur.user_id = auth.uid() AND r.name = 'SUPER_ADMIN'
                )
            );
    END IF;
END $$;

GRANT ALL ON public.daily_settlements TO service_role;
