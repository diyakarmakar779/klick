import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { CalendarDays, Home, MessageCircle, QrCode, Settings, User, Users } from "lucide-react";
import Block from "../ui/Block";

const ITEMS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/chats", label: "Chat", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
];
// The sidebar has room for Klicks too; on phones it opens from Chats and Profile.
const SIDEBAR = [...ITEMS.slice(0, 3), { to: "/klicks", label: "Klicks", icon: Users, end: false }, ITEMS[3]];

function Sidebar({ rail }: { rail?: boolean }) {
  return (
    <nav className={`pd-sidebar ${rail ? "pd-sidebar--rail" : "pd-sidebar--full"}`} aria-label="App navigation">
      <div className="pd-sidebar__brand">
        <Block />
        <span>Klick</span>
      </div>
      {SIDEBAR.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="pd-sidebar__item" aria-label={rail ? label : undefined}>
          <Icon className="pd-i" aria-hidden="true" />
          <span className="pd-sidebar__label">{label}</span>
        </NavLink>
      ))}
      <div className="pd-sidebar__qr">
        <NavLink to="/scan" className="pd-btn pd-btn--brand" aria-label={rail ? "Scan a code" : undefined}>
          <QrCode className="pd-i" aria-hidden="true" />
          <span className="pd-sidebar__label">Scan</span>
        </NavLink>
      </div>
      <div className="pd-sidebar__foot">
        <NavLink to="/settings" className="pd-sidebar__item" aria-label={rail ? "Settings" : undefined}>
          <Settings className="pd-i" aria-hidden="true" />
          <span className="pd-sidebar__label">Settings</span>
        </NavLink>
      </div>
    </nav>
  );
}

// Phone: bottom nav with the raised QR. Tablet: icon rail. Desktop: full sidebar.
export default function AppShell() {
  const [home, events, chat, profile] = ITEMS;
  // A chat thread is full screen: its composer sits where the bottom nav would be.
  const { pathname } = useLocation();
  const thread = /^\/chats\/(ai|c)\/|^\/events\/[^/]+\/ask$/.test(pathname);
  // Each new screen starts at the top. Braces matter: newer Chrome returns a Promise from scrollTo,
  // and an effect must return nothing or a cleanup function.
  const main = useRef<HTMLDivElement>(null);
  useEffect(() => {
    main.current?.scrollTo(0, 0);
  }, [pathname]);
  const link = ({ to, label, icon: Icon, end }: (typeof ITEMS)[number]) => (
    <NavLink to={to} end={end}>
      <Icon className="pd-i" aria-hidden="true" />
      {label}
    </NavLink>
  );
  return (
    <div className={`k-shell${thread ? " k-shell--thread" : ""}`}>
      <div className="k-sidebar">
        <Sidebar rail />
        <Sidebar />
      </div>
      <div className="k-main" ref={main}>
        <main className="k-scroll">
          <Outlet />
        </main>
      </div>
      <div className="k-bottomnav">
        <nav className="pd-nav pd-nav--app" aria-label="App navigation">
          {link(home)}
          {link(events)}
          <NavLink to="/scan" aria-label="Scan a code">
            <span className="pd-nav__qr">
              <QrCode className="pd-i" aria-hidden="true" />
            </span>
          </NavLink>
          {link(chat)}
          {link(profile)}
        </nav>
      </div>
    </div>
  );
}
