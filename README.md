# Parent App

A parent-facing companion app for a study center: attendance, grades, homework,
payments, insights, notifications, and messaging — all scoped to the parent's
own connected children.

## Running it

This is a real Vite + React project. It was written and syntax-checked in a
sandboxed environment without internet access, so dependencies have **not**
been installed or run here — do that on your own machine:

```bash
npm install
npm run dev
```

Then open the printed local URL. It's responsive — try resizing the browser
or opening dev tools' device toolbar to see it adapt from small phones to
desktop widths.

## Structure

```
src/
├── components/
│   ├── common/       Button, Card, Row, Section, Toggle, Badge,
│   │                 Toast, BottomSheet, ConfirmDialog, EmptyState,
│   │                 LoadingSkeleton, ErrorState
│   ├── layout/        AppShell (responsive container), Header, BottomNav
│   └── charts/        Theme-aware chart wrappers
├── screens/           One file per screen (Dashboard, Attendance, Grades, …)
├── data/               Mock data, keyed by student id
├── services/          Async wrapper functions — swap mock data for real
│                        fetch() calls here later without touching screens
├── hooks/              useAsyncData (shared loading/error/data pattern)
├── utils/               formatters, calculations, validators, Excel export
├── constants/          Theme tokens, month names, app-wide config
├── i18n/                en.js / ru.js / uz.js dictionaries + translate()
├── context/             AppContext — single source of truth for selected
│                        child, theme, language, settings
├── App.jsx              Simple state-based screen router
└── main.jsx              Entry point
```

## Key decisions worth knowing about

- **No fixed phone-frame dimensions.** `AppShell` is fluid on mobile and
  caps at a max width on larger screens — it will not look like a hardcoded
  360×720 mockup on a tablet or desktop.
- **Privacy-safe comparison.** The app never stores or shows another
  student's name or score. `utils/calculations.js`'s `groupComparisonLabel`
  only ever returns a bucketed label ("above group average", "+8%") against
  a single anonymous aggregate.
- **"Connect a Child", not "Add a Child".** `ConnectChild.jsx` requires a
  code that must match an entry in `data/students.js`'s
  `connectableRegistry` — a parent cannot fabricate a new student record.
- **Dynamic insights, not static text.** `utils/insightGenerator.js` is a
  small rule engine that reads real attendance/grade/homework data and
  produces different output for different children. It's structured so a
  real LLM/AI call can replace the rule engine later without changing what
  screens expect back (`{ type, textKey, vars }[]`).
- **No fake success states.** The Pay Now button shows "coming soon" rather
  than simulating a completed payment; sent chat messages are marked
  "queued" rather than "delivered" until a real messaging backend exists.
- **One state source.** `AppContext` holds the selected child; every screen
  reads from the same context, so there's no scenario where two screens
  disagree about which child is currently selected.

## What's intentionally not built yet

- A real backend / authentication — `services/index.js` simulates network
  latency but returns local mock data. Swapping in real `fetch()` calls is
  the main integration point.
- Real push notifications, SMS, and payment gateway integration.
- Biometric login (placeholder only, per spec — not implemented).
- No teacher panel, admin panel, or CRM — intentionally excluded per the
  brief.
