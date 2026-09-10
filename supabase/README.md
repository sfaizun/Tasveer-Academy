# Database

The schema lives in the Supabase project `tasveer-academy`
(ref `veefdqanxypwauimbxho`, region ap-southeast-1). Migrations were applied
through Supabase's migration history, so pull them into this repo with:

```bash
npx supabase login
npx supabase link --project-ref veefdqanxypwauimbxho
npx supabase db pull        # writes supabase/migrations/*.sql
```

## Migrations applied, in order

| Migration | What it creates |
|---|---|
| `core_enums_and_catalogue` | Enums, `app_setting`, `app_user`, `programme`, `class_level`, `subject`, `teacher`, `teacher_subject`, `fee_rate` |
| `students_classes_and_enrolment` | `application`, `student`, `guardian`, `sibling`, `class_group`, `class_slot`, `class_session`, `enrolment` |
| `billing_invoices_and_payments` | `invoice`, `invoice_line`, `payment`, `payment_allocation`, plus `fn_invoice_dates`, `fn_prorate_days`, `fn_refresh_invoice` |
| `announcements_and_delivery` | `announcement` and targets, attachments, receipts, `notification`, `notification_preference`, `push_subscription` |
| `audit_log_append_only` | `audit_log`, the no-update/no-delete rules, `trg_audit` and its triggers |
| `rls_roles_and_policies` | Identity helpers and row level security policies on every table |
| `seed_catalogue_and_rates` | 9 teachers, 11 O Level and 9 A Level subjects, 29 mappings, fee rates |
| `harden_function_privileges` | Pinned `search_path`, revoked anonymous RPC access |
| `invites_and_auth_linkage` | `invite` table and the `auth.users` trigger that assigns roles |

## Verified behaviour

| Check | Result |
|---|---|
| Pro-rating, 3,000 subject joined 20 Sep | 11/30 days = 1,100 |
| Three such subjects | 3,300 instead of 9,000 |
| Feb 2026 (28 days), joined 20 Feb | 9/28 = 964.29 |
| Dropped 15 Sep | 15/30 = 1,500 |
| Due and overdue dates, September | due 10 Sep, overdue from 11 Oct |
| Teacher reading payments, invoices, lines, fee rates, audit | 0 rows each |
| Teacher reading own students and enrolments | visible, as intended |
| Student reading own payments and invoices | visible; fee rates and audit, 0 rows |
| Superuser `UPDATE`/`DELETE` on `audit_log` | silently rejected, 0 rows changed |

## Known, accepted advisor warning

Supabase's linter flags seven `SECURITY DEFINER` helpers (`my_user_id`, `my_role`,
`is_admin`, `is_owner`, `my_teacher_id`, `my_student_ids`, `my_class_group_ids`) as
callable by signed-in users. That is deliberate: the RLS policies call them, they take
no arguments, and each returns only the caller's own identity. Anonymous access to them
has been revoked.

## Accounts

`invite` rows drive access. To add a teacher:

```sql
insert into invite (email, role, full_name, teacher_id)
values ('teacher@example.com', 'teacher', 'Ashik Hossain',
        (select id from teacher where full_name = 'Ashik Hossain'));
```

They then sign up with that email and the trigger links everything.
