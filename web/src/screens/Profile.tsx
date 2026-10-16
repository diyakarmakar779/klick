import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Link2,
  Lock,
  LogOut,
  Pencil,
  QrCode,
  Shapes,
  Target,
  Users,
  Wrench,
} from "lucide-react";
import { auth } from "../lib/firebase";
import Header from "../layout/Header";
import Button from "../ui/Button";
import ChipPicker from "../ui/ChipPicker";
import KlickCity from "../ui/KlickCity";
import SectionHead from "../ui/SectionHead";
import Sheet from "../ui/Sheet";
import SettingSwitch from "../ui/Switch";
import { EventRow } from "../ui/EventCard";
import { Api, ApiError, type Me } from "../lib/api";
import { useMe } from "../lib/me";
import { useLoad } from "../lib/useLoad";
import { ago, isPast } from "../lib/eventFormat";
import { initials } from "../lib/people";
import { connectCalendar, startRedirect } from "../lib/sources";

// Each event you're part of adds three pieces to your Klick city.
const PIECES_PER_EVENT = 3;

const errorText = (e: unknown) => (e instanceof ApiError ? `${e.message}. Try again.` : e instanceof Error ? e.message : String(e));

function Stat({ icon, value, label }: { icon: ReactNode; value: number | null; label: string }) {
  return (
    <div className="k-stat">
      <span className="k-stat__icon">{icon}</span>
      <b>{value ?? "–"}</b>
      <span>{label}</span>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="k-detail">
      <span className="k-detail__icon">{icon}</span>
      <span className="k-grow">
        <small>{label}</small>
        <b>{value}</b>
      </span>
    </div>
  );
}

function SettingRow({ icon, title, hint, onClick, to, danger }: { icon: ReactNode; title: string; hint?: string; onClick?: () => void; to?: string; danger?: boolean }) {
  const body = (
    <>
      <span className="k-srow__icon">{icon}</span>
      <span className="k-grow">
        <b>{title}</b>
        {hint && <small>{hint}</small>}
      </span>
      {!danger && <ChevronRight className="pd-i k-srow__chev" aria-hidden="true" />}
    </>
  );
  const cls = `k-srow${danger ? " k-srow--danger" : ""}`;
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {body}
    </button>
  );
}

function EditSheet({ me, onClose }: { me: Me; onClose: () => void }) {
  const { setMe } = useMe();
  const [form, setForm] = useState({ displayName: me.displayName, headline: me.headline, role: me.role, company: me.company, interests: me.interests });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setBusy(true);
    setError("");
    try {
      setMe(await Api.saveMe({ ...form, displayName: form.displayName.trim() || me.displayName }));
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Sheet title="Edit profile" description="People you match with see your name, role and company. The rest shows after you Klick." onClose={onClose}>
      <div className="pd-stack">
        <div className="pd-field">
          <label htmlFor="p-name">Name</label>
          <input id="p-name" className="pd-input" value={form.displayName} maxLength={80} onChange={set("displayName")} />
        </div>
        <div className="pd-grid2">
          <div className="pd-field">
            <label htmlFor="p-role">Role</label>
            <input id="p-role" className="pd-input" value={form.role} maxLength={80} placeholder="Product designer" onChange={set("role")} />
          </div>
          <div className="pd-field">
            <label htmlFor="p-company">Company</label>
            <input id="p-company" className="pd-input" value={form.company} maxLength={80} placeholder="Fernwood Labs" onChange={set("company")} />
          </div>
        </div>
        <div className="pd-field">
          <label htmlFor="p-about">About you</label>
          <textarea id="p-about" className="pd-input k-textarea" rows={3} value={form.headline} maxLength={280} onChange={set("headline")} />
        </div>
        <div className="pd-field">
          <label>Interests</label>
          <ChipPicker options={me.interests} value={form.interests} onChange={(interests) => setForm({ ...form, interests })} addLabel="Add an interest" />
        </div>
        {error && <p className="k-error">{error}</p>}
        <Button variant="brand" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </Sheet>
  );
}

function PrivacySheet({ me, onClose }: { me: Me; onClose: () => void }) {
  const { setMe } = useMe();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const findable = me.defaultVisibility === "confirmed_attendees";

  async function toggle(on: boolean) {
    setBusy(true);
    setError("");
    try {
      setMe(await Api.saveMe({ defaultVisibility: on ? "confirmed_attendees" : "hidden" }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Privacy and visibility" description="Klick never shows a guest list. You can change this for any single event on its page." onClose={onClose}>
      <div className="pd-stack">
        <SettingSwitch
          label="Be findable at new events"
          hint="People going to the same event who also chose this can see you as worth meeting. Off means nobody sees you until you switch it on."
          checked={findable}
          disabled={busy}
          onChange={toggle}
        />
        {error && <p className="k-error">{error}</p>}
      </div>
    </Sheet>
  );
}

type Source = { provider: string; syncState: string; lastSyncAt: string | null };

function AccountsSheet({ me, sources, onSynced, onClose }: { me: Me; sources: Source[]; onSynced: () => void; onClose: () => void }) {
  const [busy, setBusy] = useState<"calendar" | "luma" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const has = (p: string) => sources.find((s) => s.provider === p);
  const cal = has("google_calendar");
  const luma = has("luma_mcp") ?? has("luma");

  async function run(which: "calendar" | "luma", fn: () => Promise<string | void>) {
    setBusy(which);
    setError("");
    try {
      const msg = await fn();
      if (msg) setNote(msg);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const status = (s: Source | undefined) => (s ? (s.lastSyncAt ? `Synced ${ago(s.lastSyncAt)}` : "Connected") : "Not connected");

  return (
    <Sheet title="Connected accounts" description="Klick reads only events you're part of, never guest lists." onClose={onClose}>
      <div className="k-accounts">
        <div className="k-account">
          <span className="k-grow">
            <b>LinkedIn</b>
            <small>{me.linkedin ? "Verified, it's really you" : "Not connected"}</small>
          </span>
          {me.linkedin && <BadgeCheck className="pd-i k-account__ok" aria-label="Connected" />}
        </div>
        <div className="k-account">
          <span className="k-grow">
            <b>Google Calendar</b>
            <small>{status(cal)}</small>
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() =>
              run("calendar", async () => {
                const { imported } = await connectCalendar();
                onSynced();
                return `Found ${imported} event${imported === 1 ? "" : "s"} in your calendar.`;
              })
            }
          >
            {busy === "calendar" ? "Syncing…" : cal ? "Sync now" : "Connect"}
          </Button>
        </div>
        <div className="k-account">
          <span className="k-grow">
            <b>Luma</b>
            <small>{status(luma)}</small>
          </span>
          {!luma && (
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => run("luma", () => startRedirect("luma", "/profile"))}>
              Connect
            </Button>
          )}
        </div>
        {note && <p className="k-muted">{note}</p>}
        {error && <p className="k-error">{error}</p>}
      </div>
    </Sheet>
  );
}

export default function Profile() {
  const { me } = useMe();
  const u = auth.currentUser;
  const events = useLoad(() => Api.events());
  const klicks = useLoad(() => Api.connections("accepted"));
  const [sources, setSources] = useState<Source[]>([]);
  const [more, setMore] = useState(false);
  const [sheet, setSheet] = useState<"edit" | "privacy" | "accounts" | null>(null);

  const loadSources = () =>
    Api.sources()
      .then(setSources)
      .catch(() => {});
  useEffect(() => {
    void loadSources();
  }, []);

  if (!me) return null;
  const name = me.displayName || u?.displayName || "You";
  const photo = me.linkedin?.pictureUrl ?? u?.photoURL ?? null;
  const roleLine = [me.role, me.company].filter(Boolean).join(" · ");
  const hereTo = me.questionnaire?.lookingForDetail || me.questionnaire?.lookingFor.join(", ") || me.goals.join(", ");
  const interests = [...new Set([...me.interests, ...(me.questionnaire?.topics ?? [])])];
  const eventCount = events.data?.length ?? null;
  const past = (events.data ?? [])
    .filter((m) => isPast(m.event))
    .sort((a, b) => new Date(b.event.startsAt).getTime() - new Date(a.event.startsAt).getTime());
  const cal = sources.find((s) => s.provider === "google_calendar");
  const connectedNames = [me.linkedin && "LinkedIn", cal && "Google Calendar", sources.some((s) => s.provider.startsWith("luma")) && "Luma"].filter(Boolean);

  return (
    <>
      <Header
        title="Profile"
        action={
          <Link to="/qr" className="pd-btn pd-btn--outline pd-btn--icon" aria-label="Show my QR">
            <QrCode className="pd-i" aria-hidden="true" />
          </Link>
        }
      />
      <div className="pd-page pd-page--narrow k-prof">
        <div className="k-prof__hero">
          <div className="k-prof__avatar">
            <span className="k-prof__photo">{photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : initials(name)}</span>
            <button type="button" className="k-prof__edit" aria-label="Edit profile" onClick={() => setSheet("edit")}>
              <Pencil className="pd-i" aria-hidden="true" />
            </button>
          </div>
          <h2>{name}</h2>
          {roleLine && <p>{roleLine}</p>}
        </div>

        <div className="k-prof__actions">
          <Button variant="brand" onClick={() => setSheet("edit")}>
            <Pencil className="pd-i" aria-hidden="true" />
            Edit profile
          </Button>
          <Link to="/qr" className="pd-btn pd-btn--outline">
            <QrCode className="pd-i" aria-hidden="true" />
            Show my QR
          </Link>
        </div>

        <KlickCity seed={me.id} pieces={(eventCount ?? 0) * PIECES_PER_EVENT} />

        <div className="k-prof__cards">
          <div className="k-stats">
            <Stat icon={<CalendarDays className="pd-i" />} value={eventCount} label="Events" />
            <Stat icon={<Users className="pd-i" />} value={klicks.data?.length ?? null} label="Klicks" />
            <Stat icon={<Shapes className="pd-i" />} value={eventCount === null ? null : eventCount * PIECES_PER_EVENT} label="Pieces" />
          </div>

          <section className="k-pcard">
            <SectionHead
              title="Details"
              action={
                me.linkedin && (
                  <span className="k-prof__verified">
                    <BadgeCheck className="pd-i" aria-hidden="true" />
                    from LinkedIn
                  </span>
                )
              }
            />
            {me.headline ? <p className="k-prof__about">{me.headline}</p> : <p className="k-muted">Add a line about yourself so people know why to say hello.</p>}
            <hr />
            <div className="k-details">
              <Detail icon={<Briefcase className="pd-i" />} label="Role" value={me.role || "Not added"} />
              <Detail icon={<Building2 className="pd-i" />} label="Company" value={me.company || "Not added"} />
            </div>
            {more && (
              <>
                {hereTo && <Detail icon={<Target className="pd-i" />} label="Here to" value={hereTo} />}
                <div className="k-prof__interests">
                  <small>Interests</small>
                  {interests.length ? (
                    <div className="k-tags">
                      {interests.map((t, i) => (
                        <span key={t} className={`k-tag${i === 0 ? " k-tag--on" : ""}`}>
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="k-muted">None yet. Add some with Edit profile.</p>
                  )}
                </div>
              </>
            )}
            <hr />
            <button type="button" className="pd-btn pd-btn--link pd-btn--sm k-self-start" aria-expanded={more} onClick={() => setMore((m) => !m)}>
              {more ? "Show less" : "Show more"}
              <ChevronDown className={`pd-i k-rot${more ? " k-rot--on" : ""}`} aria-hidden="true" />
            </button>
          </section>

          {past.length > 0 && (
            <section className="k-pcard">
              <SectionHead
                title="Past events"
                action={
                  <Link to="/events" className="pd-btn pd-btn--link pd-btn--sm">
                    See all
                  </Link>
                }
              />
              {past.slice(0, 2).map((m) => (
                <EventRow key={m.event.id} item={m} />
              ))}
            </section>
          )}

          <section className="k-pcard k-pcard--list">
            <h3 className="k-pcard__title">Settings</h3>
            <SettingRow
              icon={<Lock className="pd-i" />}
              title="Privacy and visibility"
              hint={me.defaultVisibility === "confirmed_attendees" ? "Findable at new events" : "Hidden at new events"}
              onClick={() => setSheet("privacy")}
            />
            <SettingRow icon={<Link2 className="pd-i" />} title="Connected accounts" hint={connectedNames.join(", ") || "None yet"} onClick={() => setSheet("accounts")} />
            <SettingRow
              icon={<CalendarDays className="pd-i" />}
              title="Calendar sync"
              hint={cal ? (cal.lastSyncAt ? `Synced ${ago(cal.lastSyncAt)}` : "Connected") : "Not connected"}
              onClick={() => setSheet("accounts")}
            />
            <SettingRow icon={<Wrench className="pd-i" />} title="Test panel" hint="Demo tools, for testing only" to="/dev" />
            <SettingRow icon={<LogOut className="pd-i" />} title="Sign out" danger onClick={() => signOut(auth)} />
          </section>
        </div>
      </div>

      {sheet === "edit" && <EditSheet me={me} onClose={() => setSheet(null)} />}
      {sheet === "privacy" && <PrivacySheet me={me} onClose={() => setSheet(null)} />}
      {sheet === "accounts" && <AccountsSheet me={me} sources={sources} onSynced={loadSources} onClose={() => setSheet(null)} />}
    </>
  );
}
