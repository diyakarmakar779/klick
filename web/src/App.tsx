import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/useAuth";
import AppShell from "./layout/AppShell";
import SignIn from "./screens/SignIn";
import Home from "./screens/Home";
import Profile from "./screens/Profile";
import Dev from "./screens/Dev";
import Placeholder from "./screens/Placeholder";

export default function App() {
  const user = useAuth();
  if (user === undefined) return <div className="k-spinner">Loading…</div>;
  // Local design review only (npm run dev, then ?preview): see the signed-in layout without an account.
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("preview");
  if (!user && !preview) return <SignIn />;
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="events" element={<Placeholder title="Events" body="Your events from Google Calendar and Luma will appear here." />} />
          <Route path="klicks" element={<Placeholder title="Klicks" body="People you Klick with, and requests waiting for you, will appear here." />} />
          <Route path="qr" element={<Placeholder title="My QR" body="Show your code so someone can request a Klick, or scan theirs." />} />
          <Route path="settings" element={<Placeholder title="Settings" body="Sharing defaults, connected sources and accessibility options." />} />
          <Route path="profile" element={<Profile />} />
          <Route path="dev" element={<Dev />} />
          <Route path="connect/linkedin/callback" element={<Dev />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
