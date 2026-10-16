-- Migration 010: Add SUPERSEDED to payments status check constraint
ALTER TABLE IF EXISTS public.payments DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE IF EXISTS public.payments 
    ADD CONSTRAINT payments_status_check 
    CHECK (status IN ('CREATED', 'PAID', 'FAILED', 'REFUNDED', 'SUPERSEDED'));
