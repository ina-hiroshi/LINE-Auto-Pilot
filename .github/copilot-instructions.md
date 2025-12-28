# LINE Auto-Pilot AI Coding Instructions

You are an expert developer working on the "LINE Auto-Pilot" project.
Follow these instructions to ensure consistency and quality.

## 1. Project Context & Tech Stack
- **Language**: Japanese (Conversation & Comments).
- **Frontend**: React 19, Vite 7, React Router 7, Tailwind CSS 4.
  - **UI**: Lucide React (Icons), Framer Motion (Animations).
  - **LIFF**: `@line/liff` for LINE Front-end Framework.
  - **QR/Image**: `jsqr` (Reading), `html2canvas` (Generation).
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime).
  - **Logic**: Supabase Edge Functions (Deno).
- **Infrastructure**: Vercel (Frontend), Supabase (Backend).

## 2. Architecture & Data Flow
- **Auth**: `TopPage.tsx` handles login/signup. `Layout.tsx` protects admin routes.
  - **Public/LIFF**: `/booking`, `/member-card` are public (identified by `store_id`).
- **Data Access**:
  - **Client**: Direct `supabase-js` calls in components/hooks. RLS enforces security (`stores.owner_id = auth.uid()`).
  - **Server**: Edge Functions use `service_role` for privileged ops (LINE Webhook, Rich Menu).
- **Realtime**: Use `supabase.channel` to listen for `postgres_changes` (e.g., new reservations, logs).
- **State**: Local state (`useState`) preferred. Minimal global state.

## 3. Key Features & Implementation Details
- **LINE Integration**:
  - **Webhook**: `supabase/functions/line-webhook` handles events.
  - **Rich Menu**: `apply-rich-menu` function generates and applies menus via LINE API.
- **Booking System**:
  - **Google Calendar Hub**: Google Calendar is the "source of truth".
  - **Sync**: `google-auth` & `google-calendar` functions handle OAuth & bidirectional sync.
- **Membership Card**:
  - **Config**: JSON in `stores` table (`membership_card_settings`).
  - **UI**: `MemberCardLIFF` renders card based on config.

## 4. Development Workflows
- **Frontend**: `cd frontend && npm run dev`.
- **Deploy Function**: `supabase functions deploy [name] --no-verify-jwt`.
- **Lint**: `npm run lint` (ESLint 9).

## 5. Coding Conventions
- **Styling**: Tailwind CSS 4 utility classes. Primary color: `#00c3dc`.
- **Components**: Functional components with hooks.
- **Directory Structure**:
  - `pages/`: Admin screens (Dashboard, etc.) vs Public/LIFF screens.
  - `components/`: Reusable UI (Modals, Toasts).
  - `supabase/functions/`: Backend logic (Deno).

## 6. Verification (REGRESSION_CHECKLIST)
Before finishing a task, verify:
1. **Booking Flow**: Settings -> Slot Selection -> Reservation Creation.
2. **Realtime**: Updates appear without reload (Dashboard/Reservations).
3. **LINE**: Webhook returns 200, Auto-response works.
4. **Member Card**: Design updates reflect in LIFF, QR scanning works.
5. **Google Sync**: Calendar events sync correctly.
