# Sphoorthy Events — System Architecture Documentation

## Overview
SPHOORTHY EVENTS is an enterprise event registration, ticketing, payment, QR validation, and gate operations platform designed specifically for Sphoorthy Engineering College.

## Component Breakdown

```
[ Student / Operator Devices ]
            │
    (HTTPS / REST)
            │
            ▼
┌───────────────────────────┐
│ Next.js Frontend (App)   │  (Port 3000 / Vercel)
│ Mobile-First UX           │
└───────────┬───────────────┘
            │
       (REST API)
            │
            ▼
┌───────────────────────────┐
│ Flask REST API Backend    │  (Port 5000 / Vercel Serverless)
│ Pydantic Validation       │
│ RBAC Middleware           │
└─────┬─────────┬───────────┘
      │         │
      ▼         ▼
┌───────────┐ ┌───────────────────┐
│ Razorpay  │ │ Supabase Postgres │
│ Webhooks  │ │ RLS Policies      │
└───────────┘ └───────────────────┘
```

### Key Modules
1. **Backend (`backend/app/`)**: Modular monolith architecture using Flask, Pydantic, and direct/Supabase PostgreSQL connection handling.
2. **Frontend (`frontend/app/`)**: Next.js 16 / React 19 App Router with Tailwind CSS 4, single-hand handheld optimization, high-contrast gate/food scanners, and responsive admin dashboard.
3. **Database (`migrations/`)**: PostgreSQL schema with foreign key integrity, UNIQUE(event_id, ticket_code) constraints, and atomic update support.
4. **Security (`backend/app/utils/security.py`)**: HMAC-SHA256 signed QR tokens, 6-digit unique ticket code generator, and server-side payment verification.

## Registration Transactions

Online and offline registrations lock the event row in PostgreSQL while checking registration windows, duplicate identities, and capacity. These checks and the associated registration/ticket writes run in one transaction; SQLite uses an immediate write transaction for equivalent serialization. Cash collection records, issued tickets, and audit entries roll back together on failure. Email notifications are sent only after the database transaction commits.
