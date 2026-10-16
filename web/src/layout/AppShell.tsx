import { NavLink, Outlet } from "react-router-dom";
import { CalendarDays, Home, QrCode, Settings, User, Users } from "lucide-react";
import Block from "../ui/Block";

const ITEMS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/klicks", label: "Klicks", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
];

function Sidebar({ rail }: { rail?: boolean }) {
  return (
    <nav className={`pd-sidebar ${rail ? "pd-sidebar--rail" : "pd-sidebar--full"}`} aria-label="App navigation">
      <div className="pd-sidebar__brand">
        <Block />
        <span>Klick</span>
      </div>
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="pd-sidebar__item" aria-label={rail ? label : undefined}>
          <Icon className="pd-i" aria-hidden="true" />
          <span className="pd-sidebar__label">{label}</span>
        </NavLink>
      ))}
      <div className="pd-sidebar__qr">
        <NavLink to="/qr" className="pd-btn pd-btn--brand" aria-label={rail ? "My QR" : undefined}>
          <QrCode className="pd-i" aria-hidden="true" />
          <span className="pd-sidebar__label">My QR</span>
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
  const [home, events, klicks, profile] = ITEMS;
  const link = ({ to, label, icon: Icon, end }: (typeof ITEMS)[number]) => (
    <NavLink to={to} end={end}>
      <Icon className="pd-i" aria-hidden="true" />
      {label}
    </NavLink>
  );
  return (
    <div className="k-shell">
      <div className="k-sidebar">
        <Sidebar rail />
        <Sidebar />
      </div>
      <div className="k-main">
        <main className="k-scroll">
          <Outlet />
        </main>
      </div>
      <div className="k-bottomnav">
        <nav className="pd-nav pd-nav--app" aria-label="App navigation">
          {link(home)}
          {link(events)}
          <NavLink to="/qr" aria-label="My QR">
            <span className="pd-nav__qr">
              <QrCode className="pd-i" aria-hidden="true" />
            </span>
          </NavLink>
          {link(klicks)}
          {link(profile)}
        </nav>
      </div>
    </div>
  );
}
