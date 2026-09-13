# EduLiz — Unified Study Center Platform (v2: full Parent app integrated)

One app, one shared data model, four role-based experiences: **Administrator**,
**Teacher**, **Operator**, and **Parent**. Everyone signs in by picking their
role (no real backend auth yet — same honest limitation as before).

The Parent role is now the **complete original standalone parent app**
(Onboarding, Registration, PIN lock with a real forgot-PIN flow, Dashboard,
Attendance, Grades, Homework, Payments, Insights, Notifications, Chat,
Settings, Profile, PDF report, Excel export, PWA) — not a simplified rebuild.
It runs on the exact same shared `AppContext` as Admin/Teacher/Operator.

## How the Parent app was integrated (not just copied)

The original parent app's ~50 files live under `src/parent-app/`. Its ~20
screens and components are used unmodified except for import-path fixes.
What actually makes it "connected" rather than just relocated:

1. **One merged `AppContext.jsx`.** Every field the original parent app's
   own context held (registration, PIN, notification prefs, family members,
   bottom-nav customization, etc.) now lives in the SAME context as
   Admin/Teacher/Operator's canonical data (students, groups, attendance
   records, grades records, homework records, message threads). Naming
   collisions were resolved deliberately — e.g. Admin's `addStudent`
   (create a brand-new system-wide student) is a different function from
   Parent's `connectChild` (link an existing student to a family via a real
   code); Admin's login-picker `guardianLoginList` is distinct from Parent's
   own "family members with app access" list (`familyMembers`, exposed as
   `guardians` for the ported screens).

2. **A live data "bridge" (`parent-app/data/liveBridge.js`).** The original
   parent app's data functions (`getAttendance`, `getGrades`, `getHomework`,
   `getPayments`, `getNotifications`) are plain synchronous functions, not
   hooks — they can't call `useApp()` directly. Instead, `AppContext`
   updates a shared mutable object every render (synchronously, not via
   `useEffect`, so no first-render staleness), and those five functions were
   **rewritten** to compute their return value from that live object instead
   of static mock data:
   - `getAttendance(studentId)` scans the student's real group's
     `attendanceRecords` and reshapes each real per-date mark into the rich
     per-day shape the UI expects (subject/teacher come from the real group;
     the specific lesson "topic" has no real-world source yet, so it shows
     the subject name rather than an invented lesson title).
   - `getGrades(studentId)` groups real assessment entries by subject and
     builds the Mar–Sep monthly trend (months with no real assessment carry
     the last known score forward rather than showing a fake dip to zero).
     **The class average shown is computed live from actual classmates in
     the same group** — a real number, not a synthetic benchmark.
   - `getHomework(studentId)` splits the group's real assignments into
     pending/history using each student's real completion mark.
   - `getPayments(studentId)` maps Admin's real paid/pending/overdue flag
     onto the richer shape the screen expects (a fixed monthly-fee amount
     and due-date convention are used, since the unified system doesn't yet
     track a full per-student billing ledger — stated below).
   - `getNotifications(studentId)` is **generated from real events** — a
     real recent grade, a real overdue assignment, a real payment status, a
     real late arrival — with stable IDs so read/delete state persists
     correctly, instead of a fixed mock list.

3. **`connectChild(code)`** replaces the old fake "connect" flow: it looks
   up an actual student by their real `connectionCode` (the one Admin's
   "Manage Students" or Operator's "Registration Requests" generates) and
   links that student's `guardianPhone` to the currently registered parent.

4. **Chat is a real two-way channel.** The Parent's Chat screen and
   Operator's Messages screen read and write the exact same
   `messageThreads[studentId]` array. Switching children reloads the right
   thread; sending a message persists through `sendMessage(...)`, visible
   immediately to Operator (in this same browser — see limitations below).

5. **i18n dictionaries were merged** (`src/i18n/index.js` now spreads both
   the platform's own translations and the ported parent app's much larger
   dictionary), so every ported screen's text resolves correctly.

## What's a known, stated simplification

- **No real per-lesson session data.** Attendance shows the real
  status/time per date, but "subject/teacher" are the group's own values
  (a group teaches one subject with one teacher in this model), and
  "topic" isn't tracked — it currently repeats the subject name.
- **Payments has no real ledger.** A single paid/pending/overdue flag per
  student (set by Admin) drives the screen; there's no per-student fee
  breakdown, real deadline, or payment history yet.
- **Homework completion has no on-time timestamp** — a completed item is
  shown as on-time (a stated approximation), since submission time isn't
  tracked, only a done/not-done flag.
- **Live updates require a remount, not a subscription.** Screens refetch
  when the selected child changes (correct), but if data changes elsewhere
  *while a screen is already open* (e.g. Teacher enters a grade in a
  different browser tab of the same session), that open screen won't
  auto-refresh until it's revisited. A real backend with actual
  subscriptions/polling is the natural fix, not a quick patch here.
- **Still one browser's localStorage.** Everything above makes Admin,
  Teacher, Operator, and Parent genuinely share data **within one browser**.
  Two different devices (a teacher's phone and a parent's phone) still do
  NOT see each other's changes — that requires a real shared backend, which
  remains the single biggest step toward production.
- **No real authentication.** Role and identity selection (including
  Parent's Registration/PIN) is a demo convenience, not security.

## Running it

```bash
npm install
npm run dev      # http://localhost:5174
npm run build    # production build
```
