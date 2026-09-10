# Tasveer Academy Portal

Admissions, enrolment, class scheduling, announcements and fee collection for
Tasveer Academy (Edexcel IGCSE & IAL), Kakrail, Dhaka.

Built to the PRD: Next.js App Router on Vercel, Supabase Postgres with row level
security, an append-only audit trail, and light/dark themes from one token set.

## What is in place (phase 1)

- **Schema** — 30 tables covering the catalogue, admissions, students, class groups,
  enrolment, invoicing, cash payments, announcements and delivery.
- **Row level security** on every table, forced even for the table owner. A teacher
  cannot read a payment, an invoice or a fee rate by any route, including direct API calls.
- **Append-only audit log** — `UPDATE` and `DELETE` on `audit_log` are rejected by rule,
  so history cannot be rewritten even by a database superuser.
- **Money functions** — calendar-day pro-rating, and due/overdue dates driven by settings
  (due on the 10th, overdue from the 11th of the following month).
- **Seeded catalogue** — 9 teachers, 11 O Level and 9 A Level subjects (AS and A2 rows),
  29 teacher-to-subject mappings, and the fee rates.
- **App** — password sign-in, role-aware portal shell, dashboard, catalogue and fee settings.

## Access model

Signing up does not grant access. An `invite` row must exist for the email; a trigger on
`auth.users` reads it, creates the matching `app_user` with its role, and consumes the invite.
An authenticated user with no `app_user` row sees the no-access page.

Roles: `admin` (with an `is_owner` flag for rates, voids and deactivations), `teacher`,
`student`, `guardian`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL and publishable key
npm run dev
```

## Environment

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key |

## Conventions

- Amounts are BDT with lakh grouping (`৳6,84,500`), formatted via `src/lib/format.ts`.
- All dates and times are Asia/Dhaka.
- Colour is only ever a CSS custom property, so dark mode is a second token set
  rather than a second stylesheet.
- Status is never carried by colour alone; every state also has a text label.

## Next phases

Admission form and review queue, then billing and the cash desk, then teacher portal
and scheduling, then announcements, then reports.
