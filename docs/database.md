# Database Schema Documentation

## Database Overview
The database layer is hosted on Supabase PostgreSQL.

## Entity Relationship Summary

- **`colleges`**: College metadata.
- **`profiles`**: User profiles linked to `auth.users`.
- **`roles` & `user_roles`**: RBAC permissions (`SUPER_ADMIN`, `ADMIN`, `EVENT_MANAGER`, `OFFLINE_COLLECTOR`, `GATE_STAFF`, `FOOD_STAFF`, `STUDENT`).
- **`events`**: Event configuration, capacity, standard fee plus configurable first-year (`26…`) and second-year (`25…`) ticket prices, an optional other-prefix fee, online/offline toggles, auto-fill toggle, status.
- **`student_directory`**: Directory table for controlled auto-fill lookup by roll number.
- **`registrations`**: Public student booking records. Enforces uniqueness per `(event_id, email)` and `(event_id, roll_number)`; stores only a hash of the scoped guest payment capability.
- **`payments`**: Razorpay transaction logs with order ID, payment ID, signature, and idempotency key.
- **`tickets`**: Digital tickets with UUID primary key, signed QR token, scoped public-access-token hash, and unique 6-digit ticket code (`UNIQUE(event_id, ticket_code)`).
- **`food_entitlements`**: Food coupon entitlement records.
- **`offline_collections`**: Audit log of cash collected by authorized offline collectors.
- **`email_logs` & `audit_logs`**: System audit trails.

## Concurrency Guarantee (Gate & Food Validation)
Single-use validation is guaranteed by SQL conditional atomic updates:

```sql
UPDATE tickets
SET status = 'GATE_VALIDATED',
    gate_validated_at = NOW(),
    gate_validated_by = :staff_id,
    gate_location = :gate,
    gate_method = :method
WHERE id = :ticket_id
  AND gate_validated_at IS NULL
RETURNING *;
```
If 0 rows are modified by the update statement, the transaction returns `ALREADY_USED`.
