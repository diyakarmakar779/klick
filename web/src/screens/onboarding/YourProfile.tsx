import { useState } from "react";
import { Api, type Me } from "../../lib/api";
import Button from "../../ui/Button";
import Flow, { FlowError, useGo } from "./Flow";
import { initials, myPhoto } from "./photo";

function zoneName(): string {
  try {
    const tz = new Intl.DateTimeFormat("en", { timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value;
    return tz ?? "";
  } catch {
    return "";
  }
}

// Step 4, continued: check what was filled in and add what's missing.
export default function YourProfile({ me }: { me: Me }) {
  const { go, busy, error } = useGo();
  const fromLinkedIn = !!me.linkedin && me.displayName === me.linkedin.name;
  const [name, setName] = useState(me.displayName === "New member" ? "" : me.displayName);
  const [role, setRole] = useState(me.role);
  const [company, setCompany] = useState(me.company);
  const [location, setLocation] = useState(me.location ?? "");
  const [bio, setBio] = useState(me.bio ?? "");
  const photo = myPhoto(me);
  const zone = zoneName();

  const save = () =>
    go("questionnaire", () =>
      Api.saveMe({
        displayName: name.trim(),
        role: role.trim(),
        company: company.trim(),
        headline: [role.trim(), company.trim()].filter(Boolean).join(" at "),
        location: location.trim(),
        bio: bio.trim(),
      }),
    );

  return (
    <Flow
      step={4}
      onBack={() => go("identity")}
      title="Your profile"
      sub="Check what we filled in and add anything missing."
      foot={
        <>
          <FlowError>{error}</FlowError>
          <Button variant="primary" size="lg" loading={busy} disabled={!name.trim()} onClick={save}>
            Continue
          </Button>
        </>
      }
    >
      <div className="k-onb__body">
        <div className="k-photo">
          {photo ? <img src={photo.url} alt="" referrerPolicy="no-referrer" /> : <span className="pd-avatar pd-avatar--brand">{initials(name || me.displayName)}</span>}
          <span className="k-caption">{photo ? `Photo from your ${photo.from} account` : "Your initials show until you add a photo through LinkedIn or Google."}</span>
        </div>
        <div className="pd-field">
          <label htmlFor="p-name">
            Full name {fromLinkedIn && <small>From LinkedIn</small>}
          </label>
          <input id="p-name" className="pd-input" value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="pd-field">
          <label htmlFor="p-role">Role</label>
          <input id="p-role" className="pd-input" value={role} maxLength={80} placeholder="Product designer" onChange={(e) => setRole(e.target.value)} />
        </div>
        <div className="pd-field">
          <label htmlFor="p-company">Company</label>
          <input id="p-company" className="pd-input" value={company} maxLength={80} placeholder="Northwind Studio" onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div className="pd-field">
          <label htmlFor="p-loc">Location and time zone</label>
          <input
            id="p-loc"
            className="pd-input"
            value={location}
            maxLength={80}
            placeholder={`Bengaluru, India${zone ? ` (${zone})` : ""}`}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div className="pd-field">
          <label htmlFor="p-bio">Short bio</label>
          <textarea
            id="p-bio"
            className="pd-input k-textarea"
            rows={3}
            value={bio}
            maxLength={300}
            placeholder="One or two lines on what you do and what you're into"
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
      </div>
    </Flow>
  );
}
