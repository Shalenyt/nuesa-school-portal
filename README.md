# NUESA Portal

A production student management portal for the NUESA faculty body: dashboards, courses, materials, assignments, quizzes, attendance, results, exam timetables, payments, elections, digital ID, a support centre and a full administrative audit trail.

Live: https://www.nuesa.org

---

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 18, TypeScript, Vite 5 |
| Styling | Tailwind CSS v3, shadcn/ui, semantic design tokens in `src/index.css` |
| Data | Supabase (Postgres, Auth, Storage, Edge Functions) |
| State/data fetching | React hooks, TanStack Query |
| Mobile | Installable PWA (`vite-plugin-pwa`) |
| Email | Resend (transactional) via Supabase SMTP + Edge Functions |
| Payments | Paystack, verified server-side in Edge Functions |

---

## Getting started

```bash
npm install
cp .env.example .env   # fill in your own Supabase project values
npm run dev            # http://localhost:8080
```

Build and preview production output:

```bash
npm run build
npm run preview
```

---

## Environment variables

Only **public** configuration belongs in `.env` — it is bundled into the browser build.

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key (safe for the browser) |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ref |

`.env` is git-ignored; `.env.example` documents the required keys.

**Never** put these in `.env` or any frontend file: the Supabase service-role key, Paystack secret key, Resend API key, SMTP passwords or database credentials. They live only in Supabase Edge Function secrets and are read with `Deno.env.get(...)`.

Currently configured server-side secrets: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `PAYSTACK_SECRET_KEY`, `RESEND_API_KEY`, `LOVABLE_API_KEY`.

If a secret is ever committed or exposed, treat it as compromised: rotate it in the provider dashboard, update the Supabase secret, and redeploy.

---

## Project structure

```
src/
  components/
    Layout/        Dashboard shell (sidebar, header, global search, install button)
    Shared/        Cross-role widgets (SidebarMenu, GlobalSearch, DeadlineBadge, uploads)
    Student/ Teacher/ Admin/   Role-specific widgets
    ui/            shadcn/ui primitives
  hooks/           useAuth, useAutoLogout, useSchoolSettings, notification counts, …
  lib/             audit.ts, support.ts, deadline.ts, gpa.ts, notifications.ts
  pages/
    Auth/          Login, Apply, password recovery/reset, email change
    Student/ Teacher/ Admin/   Route pages
  integrations/supabase/       Generated client and types (do not edit types.ts)
supabase/
  functions/       Edge Functions (payments, email, admin actions, elections)
  config.toml      Edge Function configuration
```

---

## Roles

| Role | Entry point | Scope |
| --- | --- | --- |
| Student | `/student/dashboard` | Own courses, materials, assignments, quizzes, attendance, results, payments, tickets |
| Lecturer | `/teacher/profile` | Assigned courses, grading, quizzes, attendance, analytics, student records |
| Admin | `/admin/dashboard` | Users, structure, courses, payments, elections, support centre, audit logs |

Roles come from `public.profiles.role` and are enforced in the database with the `is_admin()` / `is_teacher()` security-definer functions used by RLS policies, not from client state.

---

## Key modules

- **Student dashboard** — greeting, today's classes, urgent deadlines, GPA snapshot, announcements, quick actions.
- **Deadline urgency** (`src/lib/deadline.ts`) — six levels from comfortable to overdue, always colour *and* text so it is readable without colour vision.
- **Support Centre** (`src/lib/support.ts`) — tickets with number, category, status, priority, assignment, threaded replies and admin-only internal notes.
- **Audit trail** (`src/lib/audit.ts`) — `logAudit({...})` appends an entry with actor, action, record, before/after values. Sensitive keys (passwords, tokens, secrets) are stripped before writing. Admin-only, append-only.
- **Global search** — `Ctrl/Cmd + K` from any dashboard page; queries run with the signed-in user's own permissions so results respect RLS.
- **Payments** — Paystack transactions are always verified server-side in `supabase/functions/paystack-verify`; duplicate references are rejected and students can never mark their own payment as paid.

---

## Database and security

- Every table has Row Level Security enabled with explicit policies.
- Roles are never read from the client for authorisation decisions.
- `audit_logs` allows insert (own actor) and admin select only — no update or delete policy exists.
- Storage: `school-assets` is public; `materials`, `assignments` and `profile-photos` are private and served through signed URLs.
- Schema changes are made through Supabase migrations; `src/integrations/supabase/types.ts` is generated and must not be edited by hand.

---

## Edge Functions

| Function | Purpose |
| --- | --- |
| `paystack-initialize` / `paystack-verify` | Start and server-verify payments |
| `send-notification-email` | Branded transactional email via Resend |
| `notify-password-change` | Security notice on password change |
| `change-email` | Admin-API email change with notifications to the old address |
| `admin-delete-user` | Removes auth user and profile records |
| `close-election` | Tallies votes and publishes results |
| `exam-notifications` | Exam reminders |

---

## PWA

Installable on Android, iOS (Add to Home Screen) and desktop. Static assets are precached; private academic data is always fetched fresh so nothing stale or unauthorised is shown offline.

---

## Conventions

- Say **Lecturer**, never "Teacher", and **Matric NO**, never "Student ID", in the interface.
- Use semantic design tokens; do not hardcode colour utilities.
- Do not remove working functionality — upgrade in place.

---

Built by Shalen.
