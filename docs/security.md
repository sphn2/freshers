# Security Architecture — Sphoorthy Events

## Security Measures
1. **Authentication**: Supabase Auth with JWT verification on backend REST endpoints.
2. **Authorization**: Server-side RBAC middleware enforcing explicit role permissions.
3. **No Frontend Secrets**: Service role keys and Razorpay secret keys are kept strictly on the backend.
4. **QR Token Security**: QR payloads contain HMAC-SHA256 signed opaque tokens without sensitive student PII.
5. **Payment Integrity**: Signature verification is performed on the server-side with HMAC-SHA256 over order_id and payment_id. Webhooks verify signatures against `RAZORPAY_WEBHOOK_SECRET`.
6. **Payment Idempotency**: Duplicate callback/webhook events safely return existing ticket records without duplicate charges or tickets.
7. **Single-Use Validation**: Concurrency-safe SQL conditional updates prevent double entry even under simultaneous requests.
8. **Audit Logging**: All critical operations (event creation, pricing changes, cash collections, gate scans, food claims) are appended to `audit_logs`.
9. **Guest payment links**: Public registrations receive a random, registration-
   scoped payment capability. Only its SHA-256 hash is stored; requests require
   the capability header to create/verify payment or view the related ticket.
   Ticket email links use a separate high-entropy token hash.

## Required deployment controls

- Generate distinct random values of at least 32 bytes for `SECRET_KEY` and
  `TICKET_SECRET_KEY`; keep them out of source control.
- Production startup requires PostgreSQL, HTTPS application/origin URLs,
  Supabase JWT verification, Razorpay credentials and webhook secret, and SMTP
  credentials. It fails closed rather than falling back to SQLite.
- Demo event/student records are disabled by default. Set `SEED_DEMO_DATA=true`
  only in an isolated, non-production development environment.
- JWTs must have a valid signature, expiration, `authenticated` audience, and
  issuer matching the configured Supabase project (legacy HS256 projects may
  use Supabase's `supabase` issuer). Authorization roles are loaded from the
  backend database, never from user-editable JWT metadata.
- Auto-fill is limited to the signed-in student's own directory record.
- Rate-limit buckets use hashed user/IP identifiers and are bounded in memory.
- Public registration reuses an existing unpaid registration and emails a new
  payment link instead of creating duplicate records. Do not log or share
  registration or ticket capability tokens.

Generate local secrets with Python:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

The test suite uses an isolated in-memory SQLite database and does not connect
to configured production services.
