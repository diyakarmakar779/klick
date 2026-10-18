import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/useAuth";
import { MeProvider, useMe } from "./lib/me";
import AppShell from "./layout/AppShell";
import Entry from "./screens/entry/Entry";
import Home from "./screens/Home";
import Profile from "./screens/Profile";
import Callback from "./screens/Callback";
import Onboarding from "./screens/onboarding/Onboarding";
import Events from "./screens/events/Events";
import EventPage from "./screens/events/EventPage";
import People from "./screens/events/People";
import DiscoverEvent from "./screens/events/DiscoverEvent";
import Klicks from "./screens/klicks/Klicks";
import Person from "./screens/klicks/Person";
import Scan from "./screens/qr/Scan";
import QrLanding from "./screens/qr/QrLanding";
import Chats from "./screens/chat/Chats";
import AiChat from "./screens/chat/AiChat";
import DirectChat from "./screens/chat/DirectChat";
import NewChat from "./screens/chat/NewChat";

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
          <Route path="events/:eventId/people" element={<People />} />
          <Route path="discover/:eventId" element={<DiscoverEvent />} />
          <Route path="klicks" element={<Klicks />} />
          <Route path="klicks/:connectionId" element={<Person />} />
          <Route path="events/:eventId/ask" element={<AiChat />} />
          <Route path="chats" element={<Chats />} />
          <Route path="chats/new" element={<NewChat />} />
          <Route path="chats/ai/:chatId" element={<AiChat />} />
          <Route path="chats/c/:connectionId" element={<DirectChat />} />
          <Route path="qr" element={<Navigate to="/profile?qr=1" replace />} />
          <Route path="scan" element={<Scan />} />
          <Route path="k/:token" element={<QrLanding />} />
          <Route path="settings" element={<Navigate to="/profile" replace />} />
          <Route path="profile" element={<Profile />} />
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
  if (!user && !preview) return <Entry />;
  return (
    <MeProvider>
      <BrowserRouter>
        <Signedin />
      </BrowserRouter>
    </MeProvider>
  );
}
