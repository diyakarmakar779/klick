# Klick web app

React 19 + TypeScript + Vite, deployed to Firebase Hosting. Mobile-first, light theme, built from the Prod :D design system in [`../design/prod-design-system`](../design/prod-design-system).

```bash
cp .env.example .env.local   # Firebase web config and API URL
npm install
npm run dev                  # http://localhost:5173
npm run lint && npm run build
```

Deploy from the repo root after a build: `npx -y firebase-tools deploy --only hosting`.

## Layout

```
src/App.tsx            Routes
src/layout/            App shell, bottom nav and sidebar, page header
src/ui/                Design system components (Button, Sheet, Alert, ShareSheet, ...)
src/screens/entry/     Welcome and sign-in
src/screens/onboarding/ Six onboarding steps
src/screens/events/    Your events, Discover, event page, people worth meeting
src/screens/klicks/    Your Klicks and each person's page (memories, follow-ups, contact)
src/screens/chat/      Chats list, Klick AI chat about an event, direct messages
src/screens/qr/        Scan a code and the QR landing page
src/screens/Profile.tsx Profile, your QR, settings
src/lib/               API client, auth, formatting helpers
src/styles/app.css     App styles on top of the design system
public/privacy.html    Privacy page
```

Add `?preview` to a URL in dev to see screens with a mocked member and no sign-in.
