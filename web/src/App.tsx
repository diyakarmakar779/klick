import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/useAuth";
import { MeProvider, useMe } from "./lib/me";
import AppShell from "./layout/AppShell";
import SignIn from "./screens/SignIn";
import Home from "./screens/Home";
import Profile from "./screens/Profile";
import Dev from "./screens/Dev";
import Placeholder from "./screens/Placeholder";
import Callback from "./screens/Callback";
import Onboarding from "./screens/onboarding/Onboarding";
import Events from "./screens/events/Events";
import EventPage from "./screens/events/EventPage";

function Signedin() {
  const { me, error } = useMe();
  if (error) return <div className="k-spinner">{error}</div>;
  if (!me) return <div className="k-spinner">Loading…</div>;
  const onboarding = me.onboarding.step !== "done";
  return (
    <Routes>
      <Route path="connect/linkedin/callback" element={<Callback provider="linkedin" />} />
      <Route path="connect/luma/callback" element={<Callback provider="luma" />} />
      {onboarding ? (
        <Route path="*" element={<Onboarding me={me} />} />
      ) : (
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:eventId" element={<EventPage />} />
          <Route path="events/:eventId/people" element={<Placeholder title="Who to meet" body="Suggested people for this event, with why each one is worth meeting." />} />
          <Route path="klicks" element={<Placeholder title="Klicks" body="People you Klick with, and requests waiting for you, will appear here." />} />
          <Route path="qr" element={<Placeholder title="My QR" body="Show your code so someone can request a Klick, or scan theirs." />} />
          <Route path="settings" element={<Placeholder title="Settings" body="Sharing defaults, connected sources and accessibility options." />} />
          <Route path="profile" element={<Profile />} />
          <Route path="dev" element={<Dev />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  );
}

export default function App() {
  const user = useAuth();
  if (user === undefined) return <div className="k-spinner">Loading…</div>;
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("preview");
  if (!user && !preview) return <SignIn />;
  return (
    <MeProvider>
      <BrowserRouter>
        <Signedin />
      </BrowserRouter>
    </MeProvider>
  );
}
