# LINE Auto-Pilot AI Coding Instructions

## Project Overview

LINE Auto-Pilot is a SaaS platform for building LINE auto-responses, reservations, and point systems.

- **Frontend**: React (Vite) + Tailwind CSS + Lucide React
- **Backend**: Supabase (Auth, PostgreSQL, Edge Functions)
- **Integration**: LINE Messaging API, OpenAI API

## Architecture & Data Flow

- **Multi-tenancy**: Data is isolated using Row Level Security (RLS). Most tables have an `owner_id` or `id` linked to `auth.uid()`.
- **Frontend-First**: The frontend interacts directly with Supabase using `supabase-js`.
- **Edge Functions**: Used for LINE Webhooks and OpenAI integrations. Located in `supabase/functions/`.

## Development Workflow

- **Frontend**: `cd frontend && npm run dev`
- **Supabase**: Use Supabase CLI for migrations and edge function deployment.
- **Database**: Schema is managed via migrations in `supabase/migrations/`.
- **Git**: AI agents must **NEVER** push changes to GitHub. Pushing is the user's responsibility.

## Coding Conventions

### Frontend (React)

- **Auth**: Use `supabase.auth.getUser()` to verify the current user.
- **Data Fetching**: Use the `supabase` client from `@/lib/supabase`.
- **Patterns**:
  - When checking for a single record, prefer `.select().eq(...).limit(1)` and checking array length over `.maybeSingle()` to handle potential duplicates gracefully.
  - Use `lucide-react` for all icons.
  - Follow the existing page structure in `frontend/src/pages/`.
  - Navigation is managed in `frontend/src/components/Layout.tsx` via the `navItems` array.
- **Styling**: Use Tailwind CSS utility classes. Avoid custom CSS unless necessary.

### Backend (Supabase / Edge Functions)

- **RLS**: Always enable RLS on new tables. Ensure policies use `auth.uid()` for isolation.
- **Edge Functions**: Use Deno standard library. Handle LINE signature verification (TODO in `line-webhook`).

## Key Files

- `frontend/src/lib/supabase.ts`: Supabase client initialization.
- `frontend/src/App.tsx`: Main entry point with auth and routing logic.
- `supabase/functions/line-webhook/index.ts`: Entry point for LINE events.
- `REQUIREMENTS.md`: Detailed project requirements and schema design.

## Common Tasks

- **Adding a Page**: Create in `frontend/src/pages/`, add route in `App.tsx`, and update `Layout.tsx` if needed.
- **Updating Schema**: Create a new migration in `supabase/migrations/`.
