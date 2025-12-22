# LINE Auto-Pilot AI Coding Instructions

## Language Requirement

- **Japanese Only**: All communication, code comments, and documentation must be strictly in Japanese. Do not use English for conversation or explanations.

## Project Overview

LINE Auto-Pilot is a SaaS platform for LINE auto-responses, reservations, and point systems.

- **Stack**: React (Vite), Tailwind CSS, Lucide React, Supabase (Auth, DB, Edge Functions).
- **Integrations**: LINE Messaging API, OpenAI API.

## Architecture & Data Flow

- **Frontend-First**: React app interacts directly with Supabase DB via `supabase-js`.
- **Multi-tenancy**: Strict data isolation via RLS. Tables typically use `owner_id` linked to `auth.uid()`.
- **Edge Functions**: Handle LINE Webhooks (`line-webhook`) and backend logic requiring secrets (OpenAI).
- **Auth**: Managed by Supabase Auth. `App.tsx` handles session state and store existence checks.

## Development Workflow

- **Frontend**: `cd frontend && npm run dev` (Vite).
- **Supabase**: Use Supabase CLI for local dev, migrations, and function deployment.
- **Git**: **NEVER** push to GitHub. User handles version control.

## Coding Conventions

### Frontend (React)

- **Client**: Import `supabase` from `@/lib/supabase`.
- **Auth**: Use `supabase.auth.getUser()` for one-off checks, `onAuthStateChange` for subscriptions.
- **Navigation**: Update `navItems` in `frontend/src/components/Layout.tsx` when adding pages.
- **Icons**: Use `lucide-react` exclusively.
- **Styling**: Tailwind CSS utility classes only.
  - **Theme Color**: Use the `primary` color (Cyan/Turquoise: `#00c3dc`) for main actions and branding. Avoid `indigo` or `blue` for primary actions.
- **Data Fetching**:
  - Prefer `.select().eq(...).limit(1)` over `.maybeSingle()` when uniqueness isn't guaranteed by DB constraints.
  - Handle loading/error states explicitly in UI.

### Backend (Supabase)

- **RLS**: **MANDATORY** for all tables. Policies must check `auth.uid()`.
- **Edge Functions**:
  - Located in `supabase/functions/`.
  - Use Deno runtime.
  - `line-webhook`: Entry point for LINE events. Needs signature verification (TODO).

## Key Files

- `frontend/src/lib/supabase.ts`: Supabase client initialization.
- `frontend/src/App.tsx`: App entry, Auth provider, Routing.
- `frontend/src/components/Layout.tsx`: Main layout & Navigation logic.
- `supabase/functions/line-webhook/index.ts`: LINE Webhook handler.
- `REQUIREMENTS.md`: Project specs & schema design.
