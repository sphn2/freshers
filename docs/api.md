# API Reference — Sphoorthy Events

Base URL: `/api/v1`

## Endpoints Summary

### Public / Events
- `GET /api/v1/events`: List active events
- `GET /api/v1/events/{slug}`: Fetch event by slug
- `GET /api/v1/events/{id}/autofill/{roll_number}`: Directory auto-fill lookup

### Registrations & Payments
- `POST /api/v1/events/{id}/register`: Public student registration. Roll numbers beginning
  with `26` use the event's first-year fee; numbers beginning with `25` use its
  second-year fee. Other prefixes are rejected unless the event has an
  optional other-prefix fee configured by an administrator.
- `POST /api/v1/payments/create-order`: Create a Razorpay order. Public bookings
  must include their `X-Registration-Token` capability header.
- `POST /api/v1/payments/verify`: Server-side signature verification and ticket
  issuance. Public bookings must include their `X-Registration-Token` header.
- `POST /api/v1/webhooks/razorpay`: Razorpay webhook handler

### Tickets & Operations
- `GET /api/v1/tickets/{id}`: Fetch a digital ticket using an authorized staff
  session or its emailed `X-Ticket-Token` / registration capability.
- `POST /api/v1/tickets/{id}/resend`: Resend ticket email
- `POST /api/v1/validation/gate`: Atomic gate entry validation
- `POST /api/v1/validation/food`: Atomic food coupon validation
- `POST /api/v1/offline/registrations`: Offline cash collector entry
- `GET /api/v1/offline/summary`: Collector cash summary

### Admin
- `POST /api/v1/admin/events`: Create event
- `PATCH /api/v1/admin/events/{id}`: Update event settings
  including first-year and second-year fees
- `GET /api/v1/admin/dashboard`: Metrics overview
- `GET /api/v1/admin/reports/registrations/csv`: Download CSV export
- `GET /api/v1/admin/audit-logs`: Audit logs feed
