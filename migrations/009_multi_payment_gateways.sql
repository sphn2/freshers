-- Migration 009: Multi-Gateway Payment System
-- Adds support for Razorpay, Cashfree, and PhonePe with per-event and global controls

ALTER TABLE IF EXISTS public.events 
    ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(50) DEFAULT 'DEFAULT';

ALTER TABLE IF EXISTS public.payments 
    ADD COLUMN IF NOT EXISTS gateway VARCHAR(50) DEFAULT 'RAZORPAY',
    ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS gateway_payment_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS gateway_signature VARCHAR(512);

-- Indexes for quick gateway lookups
CREATE INDEX IF NOT EXISTS idx_payments_gateway_order 
    ON public.payments (gateway_order_id) 
    WHERE gateway_order_id IS NOT NULL;

-- Global Gateway Settings
INSERT INTO public.system_settings (key, value, updated_at)
VALUES 
    ('default_payment_gateway', 'RAZORPAY', NOW()::text),
    ('razorpay_enabled', 'true', NOW()::text),
    ('cashfree_enabled', 'true', NOW()::text),
    ('phonepe_enabled', 'true', NOW()::text)
ON CONFLICT (key) DO NOTHING;
