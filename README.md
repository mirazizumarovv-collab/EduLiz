# EduLiz — Unified Study Center Platform (v2: full Parent app integrated)

One app, one shared data model, four role-based experiences: **Administrator**,
**Teacher**, **Operator**, and **Parent**. Everyone signs in by picking their
role (no real backend auth yet — same honest limitation as before).

The Parent role is now the **complete original standalone parent app**
(Onboarding, Registration, PIN lock with a working forgot-PIN reset flow
(demo code, not real SMS — see below), Dashboard,
Attendance, Grades, Homework, Payments, Insights, Notifications, Chat,
Settings, Profile, PDF report, Excel export, PWA) — not a simplified rebuild.
It runs on the exact same shared `AppContext` as Admin/Teacher/Operator.

## How the Parent app was integrated (not just copied)

The original parent app's ~50 files live under `src/parent-app/`. Its ~20
screens and components are used unmodified except for import-path fixes.
What actually makes it "connected" rather than just relocated:

1. **One merged `AppContext.jsx`.** Every field the original parent app's
   own context held (registration, PIN, notification prefs,
   bottom-nav customization, etc.) now lives in the SAME context as
   Admin/Teacher/Operator's canonical data (students, groups, attendance
   records, grades records, homework records, message threads, and each
   student's real `guardians` list). Naming collisions were resolved
   deliberately — e.g. Admin's `addStudent` (create a brand-new
   system-wide student) is a different function from Parent's
   `connectChild` (link an existing student to a family via a real code).
   Settings' "Guardian Access" reads and writes the SAME real
   `guardians` array on the selected student that Admin sees — not a
   separate, unrelated list (an earlier version of this integration had
   exactly that mismatch; see the guardian-model note further below).

2. **A live data "bridge" (`parent-app/data/liveBridge.js`).** The original
   parent app's data functions (`getAttendance`, `getGrades`, `getHomework`,
   `getPayments`, `getNotifications`) are plain synchronous functions, not
   hooks — they can't call `useApp()` directly. Instead, `AppContext`
   updates a shared mutable object every render (synchronously, not via
   `useEffect`, so no first-render staleness), and those five functions were
   **rewritten** to compute their return value from that live object instead
   of static mock data:
   - `getAttendance(studentId)` gathers every mark made for the student —
     in whichever group's register, so a move to another group doesn't hide
     what came before — and reshapes each real per-date mark into the rich
     per-day shape the UI expects (subject/teacher are the lesson as it was
     when the register was taken, falling back to the group it was marked in;
     the specific lesson "topic" has no real-world source yet, so it shows
     the subject name rather than an invented lesson title).
   - `getGrades(studentId)` groups real assessment entries by subject and
     builds the monthly trend over the months in view (months with no real assessment carry
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

## Behaviours worth knowing

- **PIN lock** engages when the app is (re)opened or the tab is revisited —
  not when you set or reset the PIN, so you're never locked out of the
  session you just secured.
- **Reporting period** for Grades/Insights/PDF starts at the first month with
  a real assessment, so a child first graded in April isn't shown "since
  March"; with a single month the comparison columns show "—" and a note
  instead of inventing a change.
- **On-time rate** is measured over resolved homework (completed + overdue),
  so a late submission and an overdue item both count against it.
- Phone numbers are formatted as `+998 90 123 45 67` while typing and
  compared by digits, so pasted numbers in any format match.
- **Class average excludes the student themselves** and only counts peers
  who took the *same* assessment (matched by title) — not a blend of every
  past test in the subject. A student alone in their group (or with no
  peer scores yet for that specific assessment) sees "No comparison data"
  instead of a false average equal to their own score.
- **Attendance streak counts consecutive recorded class sessions**, not
  consecutive calendar days — this is a tutoring center with scheduled
  sessions (e.g. Mon/Wed/Fri), so three sessions held on non-adjacent
  calendar dates are correctly a 3-session streak. It also now correctly
  carries across a month boundary instead of resetting to whatever's
  happened since the 1st.
- **A student can't be left with zero guardians**, and both Admin's and
  Parent's "Remove access" now say so plainly if a removal would do that,
  instead of the button silently doing nothing.
- **Connection codes are checked for collisions** before being assigned
  (both Admin's "Add student" and Operator's "Approve request" use the
  same generator), not just drawn from a ~9,000-value range and hoped to
  be unique. This check reads React state at generation time, so two
  approvals landing close enough together that neither has seen the
  other's not-yet-committed code could theoretically still collide — a
  real but very narrow race, and not one a client-side check can fully
  close without a server. A real backend's database unique constraint is
  the actual fix; stated here as a known gap rather than attempted as a
  client-side workaround that wouldn't be a genuine guarantee anyway.
- **Toast notifications now render on the staff side too** — `showToast()`
  existed in context from the start, but the `<Toast>` component itself
  was only ever mounted in the Parent app, so Admin/Teacher/Operator
  actions that called it had no visible effect. Also fixed: two toasts
  fired close together no longer have the first one's timer cut the
  second one short.
- **A class average of exactly 0%** (a real peer genuinely scored zero on
  the same assessment) shows the correct direction ("Above group average")
  without a percentage, instead of the mathematically meaningless
  "(by 0%)" a division-by-zero guard used to produce.
- **"Last 14 sessions", not "last 14 days"** — the underlying count
  (`recentLateCount`) was always counting the last 14 *recorded* class
  days, which for a center meeting a few days a week can span 4-5 calendar
  weeks. The Excel export's wording now says so, rather than implying a
  two-week calendar window the data never matched.
- **Notifications age out after 30 real calendar days.** A late-arrival
  notification is now filtered against the actual date, not just included
  from anywhere in the student's whole attendance history — a late mark
  from June no longer resurfaces forever on a September notifications
  screen.
- **Streak calculations sort their own input.** `longestPresentStreak` and
  `currentPresentStreak` used to trust that the days they were handed were
  already in chronological order (true today, since `getAttendance()`
  sorts before returning) — they now sort defensively themselves, so a
  future data source that hands days in a different order (e.g. database
  insertion order) can't silently produce a wrong streak. Both are still
  scoped to the months in view (the 7-month window ending with the current
  month — see the real-clock note), which is a real boundary to remove when
  a backend arrives: a true "last 14 sessions" needs to look across however
  many months of real history exist, not just the seven shown.
- **Homework no longer claims a time of day.** The data model only ever
  stored a due *date* — the UI used to append a `, undefined` after it
  (reading a `time` field that never existed). It now shows just the date.
- **Grades are stored as assessments with an id** (`src/utils/gradeModel.js`):
  an `Assessment { id, groupId, subject, title, date, maxScore }` is one
  test given to one group on one date, and each student's score is a
  `Grade { assessmentId, studentId, score }` row pointing at it. Nothing
  has to *infer* "which test is this" any more — the class average, the
  history, analytics, notifications and the Excel export all follow the
  id. (It used to be a flat per-student list, with "the same test"
  recognised by matching subject + title + date + group, which left real
  ambiguity: a test saved twice, a retake reusing a title, a classmate who
  had since moved groups.) What that changes in practice:
  - **Class average** = everyone *else* who has a score on that same
    assessment. No group roster is consulted, so a classmate who has moved
    to another group since still counts (they took the test), two groups
    that both gave "Quiz 1" on the same day can never mix, and a student
    alone on their newest test gets "No comparison data", never themself.
  - **Saving the same test again corrects it.** Same group + subject +
    title (ignoring case and spaces) + date means the same assessment: one
    assessment, one score per student, others' scores untouched, the
    title kept as first entered. A *retake* (a later date) is its own
    assessment.
  - **The per-student view the screens read (`gradesRecords`) is derived**
    from the store, never stored or edited directly; the only persisted
    key is `gradeStore`.
  - **Existing data is migrated, not lost.** A browser that still holds
    the old per-student shape converts it once on load (entries agreeing on
    group + subject + title + date + max score become one assessment; an
    entry from before groupId existed takes the student's *current* group —
    the best information left; a duplicate for one student keeps the later
    score) and the old key is removed.
  - Deleting a student removes their scores, and a test nobody has a score
    on any more is dropped. Deleting a *group* leaves its assessments in
    place as history (a student's past grades must not vanish with a class).
  - **The teacher can pick the date a test was given** (a date box,
    defaulting to today, limited to the reporting window — from the first
    day of the first tracked month up to today) so yesterday's test, one
    from last week, a make-up or a correction is dated correctly. Dates
    outside that range are refused with the reason: a future date can't
    have results, and one before the window would silently never appear in
    any monthly view.
  - **The teacher can edit and delete an assessment.** The group's
    assessments are listed newest first, each with its date and how many
    students are graded. *Edit* loads one into the form (title, date, max
    score, every student's score); saving changes that same assessment —
    same id, so nothing else (parents' history, notifications) loses its
    place — and a blank score box removes that student's score. It is
    all-or-nothing and refuses, saying why: a title/name clash with another
    test of this group + subject on that date, a score above the max, or
    clearing every score (delete the test instead). *Delete* asks first,
    naming the test and how many scores go with it. (The list used to be
    read off the *first student's* grades, so it showed nothing if that one
    student hadn't been graded.)
  - A student who has since left the group keeps their score on an old
    test, but is not shown in that group's edit form, so editing never
    touches it.
  Stated limits: the form has no "this is a second test" choice, so two
  genuinely different tests given to the same group, in the same subject,
  with the same title, on the same day would be treated as one (give them
  different titles). A backend should still own id generation and enforce
  uniqueness.
- **The app runs on the real clock — there is no demo date any more.** All
  of "what day / time is it?" comes from one module, `src/utils/clock.js`;
  `CURRENT_DATE_STR`, `CURRENT_TIME_STR`, `CURRENT_MONTH` and the fixed
  `Mar`…`Sep` list are gone from the app (tests pin the page's clock from
  outside instead — see the testing section). Setting the old constants to
  the real date (6 Oct 2026) had left the Parent app on a **blank screen**,
  because every monthly structure was keyed by an abbreviation inside that
  fixed list. What replaced it:
  - **"Today" is the center's day**, in `Asia/Tashkent` — not the device's
    zone and not UTC (19:30 UTC is already 00:30 the next day there). A
    parent abroad, or a phone with the wrong zone, sees the same "today" and
    the same payment deadline the center does.
  - **The months in view are a rolling window**: the last 7 months ending
    with the current one, which can cross New Year (Jul…Jan). Anything filed
    under a month is filed by month **and year** — an absence on 15 Jan 2026
    never lands in January 2027, an assignment due in October 2027 is not
    counted in October 2026. A result from *before* the window still counts
    as the subject's latest known score as the window opens (it is not shown
    as zeros). Month names exist for all 12 months in all three languages.
  - **It keeps up while open.** The app re-reads the clock every 30 seconds
    and when the tab comes back into view, so quiet hours start at 22:00 on
    their own, and after midnight the payment countdown, "due today" and
    overdue homework move to the new day without a reload.
  - **Every "today" is read when the action happens**: a new assessment's or
    attendance record's default date, homework created/submitted, payments
    recorded, chat messages (stamped to the second, not a fixed 14:30). A
    teacher can still pick an earlier date, never a future one.
  - **Calendar math is done on the date text** ("2026-09-08"), never through
    a `Date` object, whose midnight-UTC parsing shows the previous day in
    zones behind UTC. This also fixed `formatDate`, the "10th of the month"
    payment rule across New Year, and the 30-day late-arrival cutoff across a
    month or year end.
  - **Assessments that have aged out of the window stay editable.** The date
    limits (not in the future, not before the window starts) apply to a date
    being *chosen*; correcting the score or title of an 8-month-old test is
    not refused for its unchanged date.
  - **Ids can't collide.** Thirteen places built ids from `Date.now()`; they
    now share one generator (`src/utils/ids.js`) with a counter and a random
    suffix, which also keeps them unique while a test holds the clock still.
- **Forms refuse bad input and say why — they don't quietly "fix" it.**
  - *Scores:* 25 out of 20 or -5 used to be pulled to 20 / 0 and saved while
    the screen said "Grades saved", so the teacher believed one number and the
    system kept another. They are now refused ("Aisha: the score can't be
    higher than 20"), by the form and by the data layer alike.
  - *Attendance:* the date must be a real day, not in the future and not
    before the months in view — a cleared date used to save a record under the
    key `""` that no screen could reach. Minutes late must be a whole number
    from 1 to 240; `0` was stored but shown as `5` (`lateBy || 5`), and a
    cleared box snapped back to 5. The box now keeps exactly what was typed
    and is checked on Save. Marks of students who have since left the group
    are left untouched when an old day is re-saved.
  - *Homework:* a blank title / invalid date now say so, and the same title
    (ignoring case) due the same day for the same group is refused as a
    duplicate — it is almost always a double save. The teacher's list is
    ordered like the Parent's: what is coming up first (soonest on top), then
    what is past (most recent first), instead of "newest created first".
  - *Groups:* name, subject and a schedule are required. The schedule is read
    leniently and **saved in one canonical form** (`src/utils/groupRules.js`):
    `Mon/Wed/Fri 15:00`, with an optional end time (`Mon/Wed/Fri 15:00-16:30`).
    Accepted as input: `Monday 15:00`, `Mon, Wed, Fri 15:00`, `Mon & Wed 9:05`,
    `Mon-Fri 15:00`, `Mon 15:00 - 16:30` (or an en dash), any case, and the Uzbek
    (`Dush/Chor/Juma 15:00`) and Russian (`Пн/Ср/Пт 15:00`) day names — which the
    form's own hints suggest, and which the earlier strict check refused. Refused:
    no days, no time, an hour past 23 / minutes past 59, an end time that isn't
    after the start, an unknown day, a backwards range (`Fri-Mon`). Whatever is
    typed, the days are saved as `Mon/Tue/…` in week order, once each. The class
    **start** time (what attendance stamps and the parent's day detail show) comes
    from the parser, not from "the part after the last space" — which would have
    been `15:00-16:30`. Changing only some fields (say, assigning a teacher)
    checks only those, so an older group is never locked by an unrelated field.
  - *Payments:* the ledger takes a known student, a whole positive amount and
    one of cash/card/transfer — and not a second payment while the student is
    already marked paid. The status is also recorded at once in a ref, so even
    two taps that reach the handler before the screen re-renders write one
    payment. (React normally re-renders between real taps, so this is a
    belt-and-braces guard; the test drives the handler directly to prove it.)
- **A sheet changed in another tab is noticed.** The attendance form used to
  keep a stale draft when another tab or teacher changed the same day, and a
  Save would overwrite their work. Now: with no unsaved edits the form just
  shows the new sheet; with unsaved edits it shows "changed elsewhere", refuses
  Save, and offers **Load latest** (drop mine) or **Keep my changes** (the next
  Save overwrites on purpose).
- **A student's history survives a move to another group — and a day belongs to
  one group.** Grades always did (tied to their own assessment); attendance and
  homework were looked up in the student's *current* group only, so after a move
  the old group's records vanished from the Parent app. A student now carries
  `groupHistory` (`[{ groupId, from, to }]`, `from`/`to` = first/last day, null =
  open), recorded by the one place that moves students (`moveStudentToGroup`) and
  when a group is deleted. Periods **never overlap** (`src/utils/groupHistory.js`):
  - a move takes effect at the **start of the day it is made** — the old period
    ends the day before, the new one begins that day. (Both ends used to be
    inclusive, so the day of a move belonged to both groups and its attendance
    could appear twice.)
  - **Exception: already marked in the old group today.** The student attended
    that group's lesson before the move, so today stays with the old group and the
    new one begins tomorrow — otherwise that real mark would vanish from their
    history. (Registers carry no time of day, so this is how a same-day move is
    told apart.)
  - moved on and straight back the same day, or twice in a day, leaves no empty
    or fragmented stays; "moving" a student into the group they are already in is
    not a move and changes nothing (`moveStudent` returns the student untouched).
  Work counts as theirs if it was created while they were in that group.
  **Attendance follows the same rule as homework**: a mark is shown only if its
  date is inside the student's membership of the group whose register holds it, so
  a sheet back-filled for a day before they joined, or left over from a stay that
  has ended, is not theirs. And there is **one mark per day**: if histories saved
  under the old overlapping rule still have two groups claiming a date, the later
  stay's mark is the one shown (so the Attendance grid never gets two buttons for
  one day — its keys are the day number). One known consequence of the day rule:
  work created in the NEW group on the move day is theirs; work created in the old
  group on that day is theirs only if they were already marked there (above) —
  there is no time of day on homework either. A student who never moved has no
  `groupHistory` and is "in their current group, always" (including for days
  before they were added — there is no join date for students created directly in
  a group). **Deleting a group is deliberately different**: it still
  deletes that group's attendance and homework (an admin removing a class), while
  grades stay — that asymmetry is a decision, not an oversight, and is covered
  by the existing cascade test.
- **Attendance keeps the lesson as it was.** Each mark now stores the subject,
  teacher and start time of the lesson when the register was saved, so changing a
  group's teacher later no longer rewrites September's "Teacher: Malika".
  (Marks saved before this keep falling back to the group's current values.)
- **"Checked in by" is real.** The parent's day detail used to print "Front desk"
  for every present/late day — a placeholder, not data. A mark now also stores
  who took the register (`markedBy: { role: "teacher", name }`, the signed-in
  teacher — a cover teacher is named, not the group's own), and the detail shows
  that name. Marks saved before this have no `markedBy`, so they show the
  check-in time with **no name** rather than an invented one; an absence has no
  check-in at all. (Only teachers take registers today; the `role` field is there
  so an Operator or front desk could be recorded distinctly. The check-in
  *time* is still the lesson's start, plus the minutes late — arrival times aren't
  recorded.)
- **Admin dashboard: expected vs collected.** The card that read "Monthly
  Revenue" was `students × 450,000` — a hope, not money. It is now labelled
  "Expected monthly revenue" (uz/ru/en) and sits next to **"Collected this
  month"**, the sum of the recorded payments dated in the current calendar month
  (in the center's zone, so it rolls over at midnight on the 1st). The flat fee
  is one constant, `src/utils/fees.js`, shared with the payments screens.
- **Grade notifications are a rolling "latest 5".** The Parent's notification
  feed takes the 5 most recent grades (the list is ordered by test date, then
  creation), so a sixth test pushes the oldest grade notice out of the feed — the
  intended meaning of "latest". Its read/deleted marks stay stored under its id and
  are simply no longer shown.
- **"Mark all as read" marks what is on screen.** Notifications held back — by
  quiet hours (everything except attendance) or a category the parent switched off
  — are not in the list and so are not marked: they appear, still unread, when
  quiet hours end or the category is switched back on. This matches the unread
  badge, which already ignores them; marking things the person never saw as read
  would be the surprising behaviour. Covered by `e2e/45`.
- **Dashboard's "Latest result" is the newest assessment.** It took the first
  subject in the list, which is ordered by when each subject was *first* assessed,
  so it could name a result from weeks ago. "Recent activity" used the same pick.
- **Notification ids carry the student.** The overdue-homework reminder was
  `hw-<homework id>`, so siblings given the same assignment shared one id and
  reading (or deleting) Aisha's reminder also marked Umar's. It is now
  `hw-<student id>-<homework id>`. (Reminders a parent had already marked read
  under the old id appear unread once.)
- **Deleting a notification can be undone.** The context had `undoDeleteNotif`
  but nothing called it. Deleting now shows "Notification deleted" with an
  **Undo** button for 5 seconds (the toast can carry an action).
- **Admin's student forms validate the guardian phone properly**: required,
  normalized to `+998 XX XXX XX XX` regardless of what format was typed,
  and blocked from colliding with that same student's other guardian.
  Previously only the "add guardian" flow in Settings checked for
  duplicates — Admin's add/edit student forms accepted an empty or
  malformed phone outright. The phone validator itself is also fixed: it
  now correctly counts the 9 local digits after an optional `998` country
  code, rather than requiring exactly 9 digits *including* the code (which
  would have rejected every correctly-formatted number).
- **"Academic Performance" and "Overall Score" only use subjects with a
  REAL assessment for that specific month.** A subject's carried-forward
  placeholder score (shown before its own first real assessment, purely so
  its chart line doesn't fake a dip to zero — see the grades.js note above)
  used to get blended into every other subject's genuine score when
  computing that month's class-wide average. A student first graded in
  Mathematics in April and in English only in September used to have their
  April academic average diluted by English's fake September-carried-back
  score; it now reflects Mathematics alone, since English has no real data
  that month. This is the single most-visible number in Insights/PDF/Excel
  (feeds the headline score and the whole trend chart), so this was worth
  getting exactly right.
- **Homework due dates work correctly outside the Mar-Sep demo window
  too.** The countdown ("X days left") used to be computed from each
  month's position in the 7-month `MONTHS` list (Mar...Sep) — a homework
  due in October had no entry in that list, so the countdown silently
  became 0 instead of a real number. It's now computed directly from the
  calendar dates, which also incidentally fixed a second issue: the old
  "30 days per month" approximation was never quite accurate even within
  Mar-Sep. The same `MONTHS.indexOf` pitfall was also present (and fixed)
  in Excel's homework sort order and in the "is this homework from the
  current month or earlier" check behind the homework trend numbers — both
  now use real month arithmetic that works for any month, not just the
  seven tracked ones. (The fixed `MONTHS` list this describes no longer
  exists: the months in view now come from the clock — see the real-clock
  note.)
- **A late-but-completed homework item now says so.** Submitting after
  the due date was always tracked correctly internally (`onTime: false`),
  but the Homework screen only ever showed the generic "Completed" label
  for it — a parent had no way to tell a late submission from an on-time
  one by looking at the list. It now shows "Submitted late" (with a
  distinct color) both in the list and in the detail sheet; the Excel
  export's status column does the same.
- **Partial grading is a stated product decision, not a forgotten
  validation.** Attendance requires marking every student before saving;
  grades only require at least one score. This is intentional (a student
  may have been absent for a quiz, or scores may be entered as papers are
  corrected) — documented directly above the check in `EnterGrades.jsx` so
  it doesn't look like Attendance's "mark everyone" rule was meant to
  apply here too and got lost.
- **Admin's "Add student" now requires a grade and a guardian name**, not
  just a name and phone. Previously, leaving the guardian name blank
  silently used the phone number AS the guardian's name (`guardianName ||
  guardianPhone` in `addStudent`) — reachable through completely normal
  use of the form, not just a theoretical edge case.
- **The Academic Performance fix now also covers true gap months.** The
  earlier fix (only averaging subjects with a real assessment *in* a given
  month) still fell back to every subject's score — including a backward
  projected placeholder — when NO subject had a real assessment that
  month at all. It now uses "has this subject had any real assessment by
  this month" (cumulative): a subject's legitimately forward-carried last
  known score still counts in a gap month, but another subject's
  not-yet-real projection from a later month never does.
- **Teacher can't mark attendance for a future date.** The date input is
  capped at "today" (both via the native picker's `max` and a JS-level
  clamp, so a bypassed native control can't sneak a later date through
  either; the data layer refuses a future date too) — otherwise Dashboard's "is my child absent today" check could
  key off a date that hasn't happened yet.
  Dashboard itself also now finds "today" by matching the actual date
  rather than assuming it's whichever record happens to be last in the
  array.
- **Class average survives a student being moved to a different group** —
  now simply because a comparison is "everyone with a score on this
  assessment", wherever they are today (see the grade-model note above).
- **Header's bell badge and Dashboard's notification count can no longer
  disagree.** Both now call the same `getAlertableUnreadCount()` (which
  applies quiet-hours suppression) instead of Dashboard running its own
  parallel filter that didn't check quiet hours at all — during quiet
  hours, the bell could show 0 while the Dashboard stat pill showed a
  different, higher number for the exact same notifications.
- **Homework has a dedicated "Late" filter**, separate from "Completed".
  Previously a late-but-completed item showed its correct "Submitted
  late" label on its own card, but there was no way to filter the list
  down to *just* late submissions — they were only reachable by scrolling
  through everything under "Completed". The two filters are now mutually
  exclusive: "Completed" means on-time, "Late" is its own view.
- **An overdue payment's deadline is now a real past date.** It used to
  always be "next month's 10th" regardless of status, so an overdue
  payment could show "Deadline: October 10" right next to Dashboard's
  "overdue by 29 days" alert — two numbers describing the same payment in
  opposite directions. A pending payment's deadline is also fixed: it's
  now the *nearest* upcoming 10th (which can be later this same month),
  not unconditionally next month's, so "2 days until due" doesn't get
  misreported as "32 days" just because today happens to be before the
  10th.
- **A month's homework total now includes pending items, not just
  completed/overdue ones.** Pending homework never carried a `month`
  field (only completed/overdue history items did), so
  `parentAnalytics.js`'s "which months have homework" check could never
  match a still-pending assignment — a month with real pending homework
  could be entirely invisible to Homework Performance, Monthly
  Comparison, Overall Score, Insights, and the PDF report, or show a
  misleadingly high completion rate because the denominator silently
  excluded everything not yet due. Both shapes now carry `month`/`day`
  consistently.
- **A month with no genuinely new assessment says so in reports, not just
  on the Grades screen.** The earlier backfill fix made a carried-forward
  score correctly exclude a not-yet-real subject from the month-to-month
  average — but a report that pairs that score with a month's name (the
  Monthly Comparison table's "Overall" row, in both Insights and the PDF)
  still displayed it as if it were that month's real result, e.g.
  "September: 80%" when September had no new test at all. A new
  `academicIsNewByMonth` flag (and `overallLastIsNew` for the headline
  month) lets those specific displays say "No assessment this month"
  instead — reusing the exact wording Grades.jsx already shows
  per-subject — while the trend chart still legitimately carries the
  score forward for visual continuity, since a line chart isn't claiming
  "this happened this month" the way a labeled table cell is.
- **`useAsyncData` no longer has a request race condition.** It used to
  only check whether the component was still mounted before applying a
  response — not whether that response belonged to the LATEST request.
  Switching to a different child quickly (before the first child's data
  had come back) could let the older, slower response arrive after the
  newer one and silently overwrite it, showing one child's grades,
  attendance, or payments against a different child's name. A per-request
  id, checked before every `setData`/`setError`/`setLoading` call, now
  ensures only the most recent request's result is ever applied — this
  fixes every screen that uses the hook (Grades, Attendance, Homework,
  Payments, Notifications, Dashboard) in one place.
- **Payment history shows the year**, not just a bare month ("Aug 2026",
  not just "Aug") — the detail line underneath already had the full date,
  but the primary label didn't, which would read as ambiguous once a
  center has more than one year of payment history.
- **Excel's grade sheet lines every score up under its own month.**
  `getGrades()` starts every subject's `monthly` series at the earliest
  month where any subject has a real assessment (a child first graded in
  May is reported "from May", matching the Grades screen and Insights).
  The Excel sheet's header, however, was the fixed Mar-Sep list, so with
  that trimmed series every score sat under the wrong month — May's 80%
  under "Mart", and so on. The month columns are now derived from the
  grades data itself, and each cell is looked up by month *name* rather
  than by position, so a header and the cells beneath it cannot disagree.
  (An earlier version of this note said the series was never shortened;
  that was wrong — it was based on a check that hand-built full-length
  data and so bypassed `getGrades()`'s trimming. The test that now guards
  this, `e2e/33`, drives the real `getGrades()` -> export path.)
  Separately, a month with no genuinely new assessment shows "—" in that
  sheet, not the carried-forward/back-filled score: that value is fine
  for a chart line, but a table cell under a month's name claims "this
  subject scored X% in this month", which isn't true for it.
- **"Download my data" (Excel export) is now in Parent Settings**, next to
  "Print report". It exports the *selected* child's history — attendance,
  grades, homework, payments and a summary — and loads the spreadsheet
  library on demand, so it stays out of the app's initial bundle. The
  export, its translations (`downloadData`, `downloadDataDesc`,
  `dataDownloaded`) and the file-building code already existed; only the
  button was missing. A failure shows a message (`dataDownloadFailed`)
  rather than doing nothing. **Known limit: the workbook's own text
  (sheet names, column headers, the written summary) is Uzbek regardless
  of the app language** — only the button and its messages are translated.
- **A payment reminder notification is tied to its actual billing
  deadline**, not just the student — the id used to be bare
  `payment-{studentId}`, so once a billing period rolled over (status
  reset, deadline moved to a new date), the new period's reminder would
  silently inherit whatever read/deleted state the PREVIOUS period's
  reminder had, under the same id. The id now includes the deadline date,
  so each billing period gets its own, genuinely new notification.
- **`computeParentAnalytics` no longer crashes on a student with zero
  recorded grades.** It unconditionally read `grades[0]` and later
  `reduce()`d over an empty array with no initial value — both throw.
  Insights and PrintableReport already guarded against this before
  calling in, so neither was ever actually affected in the live app, but
  the utility itself wasn't safe for a caller that doesn't check first —
  concretely, `exportChildDataToExcel` (a parent can now trigger it from
  Settings -> Download my data) called in
  with no guard of its own, and had a SECOND, separate crash point even
  past that fix (its own conclusion-text construction read
  `a.attByMonth[0].month` on what would be an empty array). Both are
  fixed: the utility now returns a complete, safely-defaulted empty shape
  (flagged `hasGrades: false`) instead of throwing, and the Excel export
  only builds its grade-narrative summary sheet when there's actually
  grade data to narrate — a student with attendance/homework/payment
  data but no grades yet still gets a complete, correct export for
  everything that isn't grade-dependent.
- **A staff role switch always resets to Dashboard.** The active screen
  key used to persist across role changes — Teacher on Attendance, then
  logging out and signing in as Admin, left `screen` still set to
  `"attendance"`, a key Admin's nav doesn't have. The fallback silently
  rendered Dashboard's component while the sidebar still thought a
  non-existent screen was active (no nav item highlighted, a stray Back
  button shown). Switching roles now resets to Dashboard, keeping what's
  rendered and what the sidebar thinks is active in sync.
- **Attendance shows "No data" for a month with zero records**, instead
  of the literal text "null%". A second, related bug this also fixed: if
  the SELECTED month had no data but the PREVIOUS month did, the
  trend comparison (`rate >= lastMonthRate`) evaluated `null >= 90`
  (false in JS) and showed a false "attendance dropped" message instead
  of recognizing there was nothing to compare.
- **Operator's unread message count reflects genuinely unread
  messages.** It used to count every parent message ever sent in every
  thread, so the badge stayed stuck at the same number even after every
  thread had been opened and replied to. Messages now carry a
  `readByOperator` flag (a parent message starts unread; one the operator
  sends is implicitly already read by them), and opening a thread — including
  whichever one is selected by default when the Messages screen opens —
  marks its parent messages read.
- **Homework is sorted by due date**, not raw insertion order: pending
  shows soonest-due-first, history shows most-recent-first. Dashboard's
  "recent activity" now shows the genuinely most-recent homework item
  too — it used to just reverse the array and take the first entry,
  which only matched date order by coincidence.
- **Profile now shows a real loading skeleton and error state**, matching
  every other Parent screen. It computed `loading`/`error` but never
  actually rendered anything for either — while data was loading (or had
  failed), the summary/overview sections just silently vanished with no
  visual explanation of why, while the Account section (which doesn't
  depend on the fetch) stayed visible throughout.
- **The parent-app dictionaries are self-contained.** The app translates
  through a *merged* dictionary (main staff-side + parent-app, parent
  winning on collision), so a key that exists only in the main dictionary
  still renders correctly on a Parent screen — which is exactly how 8 keys
  (`back`, `guardianAlreadyAdded`, `noGradesYet`, `otpTitle`,
  `overallSingleMonthSentence`, `resendCode`, `singleMonthNote`,
  `trendNeedsMonths`) were used by Parent screens yet missing from
  `src/parent-app/i18n/{uz,ru,en}.js` without anything visibly breaking.
  Users never saw a raw key; the real defect was that the parent-app's
  own dictionaries weren't complete, an invisible dependency on the staff
  dictionary that would break the moment the parent app were extracted or
  reused on its own. They're now defined in all three parent dictionaries
  with the same text as the main ones (so the merged result — and the
  staff screens (`AppShell`, `RoleSelect`) that share some of these keys —
  is unchanged), and `e2e/31` + `e2e/32` keep it that way.

## What's a known, stated simplification

- **No real per-lesson session data.** Attendance shows the real
  status per date; "subject/teacher/time" are the lesson as recorded when
  the register was saved (marks saved before that stamp existed fall back to
  the group's current values), and "topic" isn't tracked — it currently
  repeats the subject name.
- **A student's guardians are now a real, normalized list.** Each student
  has `guardians: [{ id, name, phone, role }]` — a genuine
  `Student → [Guardian, Guardian, ...]` relationship, not a bare array of
  phone numbers with one shared name. `connectChild(code)` adds a real
  guardian record (name + phone, collected at Registration) rather than
  overwriting anyone. Settings' "Guardian Access" now reads and writes this
  SAME real array for the selected child — it's the same data Admin sees
  in "Manage Students", not a separate, unrelated list. Guardians keep the
  role (Mother / Father / Guardian) chosen at registration, phones are
  matched by digits only (so formatting differences can't create
  duplicates), and adding the same phone twice is rejected. Admin can
  remove an additional guardian's access in the student's edit form.
  **Revocation ends the open session:** if the logged-in parent's access is
  removed (or their student is deleted), the app signs them out and shows a
  notice on the login screen. Still simplified: a student can't be left
  with zero guardians, and a revoked parent can reconnect by entering the
  student's connection code again — real revocation needs single-use or
  rotating codes (or a block list), which requires the backend.
- **Payment status now has a full lifecycle, but "which month" still
  isn't tracked.** Admin can mark a student paid (recording a real
  transaction) and reset them back to pending for a new billing month —
  it no longer gets stuck at "paid" forever — but "Start new billing
  month" only flips the status flag; it doesn't record WHICH month the
  new pending status is for. Parent's payment screen always computes the
  deadline as "the 10th of next month" rather than reading a real stored
  due date. A production billing model needs `billingPeriod`, `amountDue`,
  `paidAmount`, and `dueDate` per student — this is a stated prototype
  limitation, not a bug. **Consequence: transactions carry no billing period**,
  so the payment history is ordered by payment date only, and September's fee
  paid on 2 Oct and October's paid on 5 Oct both simply read "October" (the
  dashboard's "Collected this month" likewise counts by the day money was
  recorded, not by the period it paid for). Fixing that means the `billingPeriod`
  field above, chosen when a payment is recorded.
- **Deleting a student now cascades cleanup** across grades, attendance,
  homework submissions, payments, and message threads — no orphaned
  records left behind under an ID that no longer exists.
- **Payments now has a real transaction ledger.** Admin's "Mark as paid"
  records a real `{amount, date, method}` entry in `paymentTransactions`,
  not just a status flip — Parent's Payment History shows these actual
  transactions. There's still no per-student custom fee amount (a flat
  monthly fee is assumed) or a real billing deadline per student.
- **Homework on-time is now genuinely computed.** Marking a submission
  complete records a real `submittedAt` date, compared against the real
  due date — no more blanket "always on-time" assumption.
- **Live updates now work everywhere, including across tabs.** Every
  Parent screen (Attendance, Grades, Homework, Payments, Notifications,
  Insights, Profile, Dashboard) has the canonical store it reads
  (`gradesRecords`, `attendanceRecords`, etc.) in its data-fetch dependency
  array, so it re-fetches the instant that store changes — the same
  pattern Chat already used. On top of that, a `storage` event listener in
  `AppContext` re-applies a canonical store's new value to every OTHER
  open tab of the same browser the moment one tab writes it — so a grade
  Teacher saves in one tab shows up immediately in Parent's Grades screen
  open in another tab, with no reload and no re-navigation. Only per-tab
  state (PIN entry, nav customization, notification preferences) is
  deliberately excluded from that sync.
- **Still one browser's localStorage.** Everything above makes Admin,
  Teacher, Operator, and Parent genuinely share data **within one browser**.
  Two different devices (a teacher's phone and a parent's phone) still do
  NOT see each other's changes — that requires a real shared backend, which
  remains the single biggest step toward production.
- **No real authentication.** Role and identity selection (including
  Parent's Registration/PIN) is a demo convenience, not security.
  Registration now has a **demo OTP step** (phone → 4-digit code → verify,
  with resend and one-step-back), but the code is generated in the browser
  and shown on screen — no SMS is sent, and it protects nothing. It exists
  so the real flow's screens can be tested; a production OTP must generate,
  send and check the code on a server (with expiry and attempt/rate limits
  per phone) and call the SMS provider from there, never from the browser.
  **Forgot-PIN uses the exact same demo-code mechanism** (`Math.random()`
  in the browser, not a sent SMS) — the reset flow itself (confirm phone →
  enter code → set new PIN) is real and working, but the code delivery
  is not.
- **Clock and calendar: what is still simplified.** The app reads the
  device's clock — there is no server time, so a phone with the wrong time
  shows the wrong day (a backend should issue timestamps). The center's time
  zone (`Asia/Tashkent`) is a constant in `src/utils/clock.js`. The monthly
  views show the last 7 months (`WINDOW_MONTHS`, at most 12 because month
  abbreviations repeat beyond that); older history exists but is not shown,
  and going beyond a year needs the monthly structures keyed by year+month
  rather than by abbreviation. The Attendance screen keeps the month index
  you were on, so if the month changes while you are looking at an earlier
  month, the label moves with it. A Teacher form opened before midnight keeps
  the date it started with (the date box's limits do move). Every timestamp
  is still a local browser string.

## How this was checked (and what wasn't)

Beyond static checks (syntax, every import/export, every `t("key")` present
in uz/ru/en with no duplicate keys), the app was bundled and driven in a real
Chromium browser: **229 checks** (itemised per file by `e2e/run-all.mjs`) across Admin, Teacher, Operator and Parent —
including registration with demo OTP, returning-guardian recognition, second
guardian, revoked session, PIN lock and forgot-PIN, delete cascades, empty
states, multi-month analytics, all three languages on every screen, dark
theme, the mobile staff drawer; in `e2e/07-cross-tab-live-updates.mjs` — a
grade/attendance mark/payment made in one browser tab (Teacher/Operator)
showing up immediately in another tab's already-open Parent screen, with no
reload; in `e2e/08-class-average-and-streaks.mjs` — a lone student in a
group shows "no comparison data" instead of a false 100%-of-self average,
a real two-student class average matches only the peer's score on the same
assessment (not blended with older tests), and an attendance streak spanning
a month boundary isn't reset to zero on the 1st; and in
`e2e/09-guardian-toast-code-fixes.mjs` — connection codes never collide
across 12 rapid student creations, and the staff side's toast notifications
(previously invisible — the component was never rendered there) now show;
and in `e2e/10-comparison-edge-cases.mjs` — a class average of exactly 0%
(from a real peer who scored zero) shows "Above group average" with no
percentage, instead of the mathematically meaningless "(by 0%)", and a
late-arrival notification from over 30 days ago no longer lingers forever
in the Notifications screen. A direct unit check also confirms both streak
functions sort their own input chronologically rather than trusting the
caller's array order. In `e2e/11-homework-and-classavg-date.mjs` —
Homework's detail screens never render the literal word "undefined" (the
data model has no time-of-day field, so the UI simply stopped asking for
one), and a class average is per assessment: a student's two same-titled
assessments on different dates are different assessments, so neither is
compared against a classmate's score from the other. In `e2e/12-guardian-phone-validation.mjs` — Admin's add/edit student
forms now require a valid 9-digit phone, normalize whatever format is
typed, and block saving a primary contact that would collide with that
same student's other guardian — all three were previously unchecked. And
`e2e/13-recentlatecount-unit.mjs` is a plain Node check (no browser) that
`recentLateCount` correctly spans a month boundary instead of silently
undercounting a center's "last 14 sessions" right after the 1st.
`e2e/14-academicbymonth-backfill-unit.mjs` is a second plain Node check
confirming the Academic Performance average for a given month only
includes subjects with a REAL assessment that month, not a subject's
carried-forward placeholder score from a later one.
`e2e/15-required-fields-and-future-homework.mjs` confirms Admin can't
create a student with an empty grade or guardian name (no more silent
"name: phone number" fallback), and that homework due in a month outside
a month after the current one (e.g. October, when today is in September) gets a correct day countdown
instead of 0. `e2e/16-late-status-and-group-isolation.mjs` confirms a
late-but-completed homework item shows "Submitted late" instead of a
plain "Completed", and that two different groups grading the same
subject+title+date are separate assessments and never contaminate each
other's class average.
`e2e/17-academicbymonth-gapmonth-unit.mjs` is a second plain Node check:
a true gap month (no subject assessed at all) now correctly carries
forward only subjects already genuinely known by that point, instead of
blending in a different subject's not-yet-real backward-projected score.
`e2e/18-attendance-future-date-and-today.mjs` confirms Teacher's
attendance date input can't be pushed past "today" (even via a direct
value change bypassing the native date picker), and that Dashboard finds
today's record by its actual date, not by assuming it's the last one in
the array. `e2e/19-classavg-survives-group-move.mjs` confirms a student's
class average still uses the classmates who took that test, after the
student is moved to a different group. And
`e2e/20-quiethours-badge-and-late-filter.mjs` confirms the Header bell
and Dashboard's notification count always agree (both respect quiet
hours), and that Homework's "Late" and "Completed" filters are mutually
exclusive instead of late items being invisible inside "Completed".
`e2e/21-homework-pending-month-unit.mjs` is a plain Node check confirming
a month's homework total now includes pending (not-yet-due) items, not
just completed/overdue ones. `e2e/22-payment-deadline-and-pending-homework.mjs`
confirms an overdue payment's deadline is a real past date (matching
Dashboard's "overdue by N days" alert instead of contradicting it with a
future date), that a pending payment's deadline is the nearest upcoming
10th rather than always next month's, and that newly pending homework
doesn't crash or corrupt Insights once counted into the month's stats.
`e2e/23-insights-no-new-assessment-and-payment-year.mjs` confirms
Insights' Monthly Comparison table says "No assessment this month" for
a month that only carries forward an earlier real score — not a fake
percentage implying that month earned it — and that payment history
shows a year ("Aug 2026"), not just a bare month that becomes ambiguous
across multiple years of records. `e2e/24-useasyncdata-race-condition.mjs`
is a standalone check (it builds and serves its own tiny test bundle, so
it needs `npm install` run first for esbuild) that directly exercises
`useAsyncData`'s request-id guard: it starts a slow-resolving request,
switches to a fast one before the first resolves, and confirms the
late-arriving stale response never overwrites the newer data — the exact
race that could otherwise occur when switching children quickly.
`e2e/25-excel-grade-columns-unit.mjs` is a plain Node check of the
cell rule only — a score shows under a month that genuinely had an
assessment, not the back-filled placeholder. It hand-builds full-length
subjects, so it deliberately does NOT cover header/cell alignment; that
is `e2e/33`.
`e2e/26-payment-notification-billing-period.mjs` confirms marking one
billing period's payment reminder as read doesn't silently carry over to
a later period's reminder once the deadline moves — each billing period
now gets a genuinely distinct notification id.
`e2e/27-export-excel-no-grades-unit.mjs` confirms `exportChildDataToExcel`
(and the `computeParentAnalytics` it calls) no longer crashes for a
student with zero recorded grades — it runs in a disposable sandbox with
a minimal `xlsx` stub so it works whether or not `npm install` has been
run, and never touches a real `xlsx` install if one is already present.
`e2e/28-staff-screen-reset-and-operator-unread.mjs` confirms switching
staff roles (e.g. Teacher's Attendance screen, then Admin) always lands
on a correctly-highlighted Dashboard instead of a phantom screen key;
that Attendance shows "No data" instead of "null%" for a month with zero
records, without a false "attendance dropped" message when only the
PREVIOUS month had data; and that Operator's unread message count
reflects genuinely unread messages (including the thread shown by
default on screen-open), drops to 0 once read, and rises again for an
actually-new message.
`e2e/29-homework-date-sorting.mjs` confirms homework is sorted by due
date — soonest-first for pending, most-recent-first for history —
instead of raw insertion order, and that Dashboard's "recent activity"
shows the genuinely most-recent item. `e2e/30-profile-loading-state.mjs`
confirms Profile actually shows a loading skeleton while fetching
(checked at the DOM level, not just the final state), matching every
other Parent screen instead of silently showing a gap.
`e2e/31-parent-i18n-self-contained-unit.mjs` is a plain Node check that
every translation key the Parent app uses — plain `t("key")` calls, keys
held in lookup tables, the navigation table, `role${…}`/`status${…}`
template keys — is defined in the PARENT-APP dictionaries themselves, in
all three languages, with identical key sets and no duplicates. It fails
(rather than silently skipping) if it meets a dynamic key pattern it
doesn't know how to expand, and includes a control proving it can detect
a missing key. `e2e/32-parent-screens-no-raw-keys-all-languages.mjs`
is the browser-level companion: in Uzbek, Russian and English it walks
registration + the OTP step, every Parent screen in its empty state, the
duplicate-guardian error, and the single-graded-month Insights/PDF state,
failing on any raw key-looking text (camelCase/snake_case never appears
in real UI copy) and asserting the formerly-missing keys render real
translated text.
`e2e/33-excel-grade-columns-real-path-unit.mjs` drives the real path —
bridge data -> `getGrades()` (with its trimming) -> `exportChildDataToExcel`
— in a throwaway copy of `src/` with an `xlsx` stub, and checks that the
month headers start at the first real month and every score sits under
its own month. `e2e/34-settings-download-data.mjs` is the browser check
for the new Settings button: the row is there, tapping it downloads a
non-empty `<Child>_hisobot.xlsx` (with and without grade data), it
exports the *selected* child, and a failing export shows the failure
message with no file. Against `npm run dev` it runs with the real `xlsx`.
`e2e/35-grade-model-unit.mjs` is a plain Node check of the assessmentId
model: ids stay unique across 20,000 back-to-back creations; saving a test
twice corrects it (one assessment, one score, the title kept); what counts
as "the same test" (case/space-insensitive title, but a different date,
group or subject is a different one); removing a student; the derived
per-student view; the migration of the old stored shape (round trip loses
nothing, tolerates malformed input); and `getGrades()` finding class-average
peers by assessmentId — including a classmate who has since moved group.
`e2e/36-assessment-model-browser.mjs` is the in-browser side: re-saving a
test leaves one assessment and the Parent sees the corrected score, the
teacher's recent-assessments list works when the group's first student was
never graded, and grades held in the old stored shape are migrated and
still show. Each of these was confirmed to fail when its behaviour is
broken on purpose.
`e2e/37-assessment-edit-delete-unit.mjs` is a plain Node check of the
edit/delete rules: a real calendar date, the date bounds (today, window
start), rename + re-date + re-max keeping the same id, setting/adding/
removing scores, and each refusal (title, date, max, future, too early,
duplicate, score out of range, no scores left), with the input never
mutated. `e2e/38-teacher-assessment-crud.mjs` is the browser workflow:
the date box and its limits, saving a test under an earlier day, each
refusal shown with its message, Edit pre-filling and saving the SAME
assessment, a name clash refused, Cancel, Delete asking first (and
cancelling), delete removing the test and all its scores, deleting the one
being edited, and the Parent seeing only what is left. Each of these was
confirmed to fail when its behaviour is broken on purpose.
Because the app reads the real clock, **every browser test pins the page's
clock** — `launch()` in `e2e/lib.mjs` installs a fixed `Date` before the app
loads (8 Sep 2026, 14:30 Tashkent time by default; `launch(viewport, state,
{ now })` picks another instant and `setNow(page, instant)` moves it forward
mid-test, like time passing). The pinned `Date` comes from
`e2e/fakeClock.mjs`, the same function that plain Node unit tests call.
`e2e/39-clock-unit.mjs` checks the clock module: today/time/timestamp in the
center's zone (including 00:30 vs UTC, and the same answer on devices set to
UTC, Los Angeles, Auckland or Tashkent), the rolling month window across New
Year, year-aware window membership, and date arithmetic across month, year
and leap-day ends. `e2e/40-calendar-data-unit.mjs` runs the data layer under
other "todays": the January-2027 window (a Jan-2026 absence is not mixed in),
results carried in from before the window, homework by month and year,
payment deadlines across New Year, the 30-day cutoff across a year end, and
streaks across it. `e2e/41-real-date-browser.mjs` runs the whole app on a
moving clock: on 6 Oct 2026 (payment countdown, attendance window, homework
days left, chat stamped and "TODAY" turning into "YESTERDAY" live); quiet
hours starting at 23:30 and midnight passing with the app open; a window that
crosses New Year; the Teacher's forms defaulting to — and stopping at —
today; and an aged-out assessment still being editable. Each of these was
confirmed to fail when its behaviour is broken on purpose.
`e2e/42-input-rules-and-group-history-unit.mjs` is a plain Node check of the
rules above (score, attendance sheet and late minutes, payment, homework
duplicate/order, group fields, group history), the latest-result pick, sibling
notification ids, and the data layer for a student who moved between groups
(attendance and homework, reminders, the lesson stamp).
`e2e/43-forms-notifications-and-group-move-browser.mjs` is the in-browser side:
the empty date and late-minutes refusals, a sheet changed in another tab (no
edits → shown; edits → Save refused, Load latest, Keep my changes), duplicate
homework and the list order, the Admin group form, siblings' notification state
and Undo, an Admin move through the UI (old attendance/homework kept, later work
for the old group not), the Dashboard's latest result, and a late second tap on
"Mark as paid". Each of these was confirmed to fail when its behaviour is broken
on purpose.
`e2e/44-schedule-history-and-attendance-marks-unit.mjs` is a plain Node check of
the schedule parser (the three spellings that used to be refused, canonical
form and its stability, ranges, Uzbek/Russian day names, refusals, the start time
not being the end time, and that each language's own form hint and refusal
example is itself valid), of group history (a move ends the old period the day
before; the "already marked today" exception; moved twice or back the same day;
month/year/leap-day boundaries; moving into the same group is a no-op; and a
property check over 300 random sequences of moves that no day is ever in two
groups and no empty period is kept), and of a student's attendance marks (only
their own membership, one per day, a history saved under the old overlapping rule
still giving one mark, "checked in by" named / absent / not invented, the lesson
time being the start).
`e2e/45-history-checkedin-schedule-dashboard-browser.mjs` is the in-browser side:
an Admin move on a day the student was already marked (the day stays with the old
group; the Parent sees it once, as Present, and not a back-filled mark from before
she joined), a move on an unmarked day (the new group's mark counts), a history
saved under the old rule (one day, no duplicate-key warning), a Teacher save
recording who took the register and the lesson START for a `15:00-16:30` group
and the Parent's day detail naming a cover teacher / naming nobody for an older
record / having no check-in for an absence, the Admin dashboard's expected vs
collected revenue (including the calendar-month rollover), and "Mark all as read"
under quiet hours. Twenty-three deliberate breakages of these behaviours were each
caught by 42–45 (one — the membership filter — first slipped past the browser
test because the one-per-day rule happened to hide it; the test was extended and
now catches it).
Run them yourself:

```bash
npm install
npm i --no-save playwright && npx playwright install chromium
npm run dev                       # other terminal
node e2e/run-all.mjs              # BASE_URL=http://localhost:5174/ by default
node e2e/run-all.mjs 17 37       # optional: only files 17–37 (a range not starting at 01 reuses the browser state a previous run left)
```

Not verified: in the sandbox where this was built `lucide-react`,
`recharts` and `xlsx` could not be installed, so they were replaced by
stubs — icon names were not checked against lucide-react 0.383, and the
charts' actual rendering was not seen. Run `npm install && npm run build`
once locally; a wrong icon name would show up as a crash on that screen.
In the last round the package registry was blocked outright, so **Vite itself
was not run either**: the 229 checks above ran against the real source bundled
with esbuild (with those three packages stubbed, and the locally installed React
19 rather than ^18.2 — nothing in the app is 18-specific, and the unchanged
project passed the same 213 checks that way, but the first `npm run dev` /
`npm run build` on your side is the real confirmation). Two tests find their
tools through environment variables when they are not in `node_modules`:
`ESBUILD_BIN` (24) and `TSX_BIN` (27).

## Running it

```bash
npm install
npm run dev      # http://localhost:5174
npm run build    # production build
```
