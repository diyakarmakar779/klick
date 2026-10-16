import { useState } from "react";
import { Api, ApiError, type Match, type MyEvent } from "./lib/api";
import LinkedInConnect from "./LinkedInConnect";

// Temporary test panel for trying the live API end to end. The real screens replace it.
export default function TestPanel({ onStatus }: { onStatus: (s: string) => void }) {
  const [interests, setInterests] = useState("");
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [matches, setMatches] = useState<{ eventId: string; ai: boolean; list: Match[] } | null>(null);

  async function run(label: string, fn: () => Promise<string | void>) {
    onStatus(`${label}…`);
    try {
      onStatus((await fn()) ?? `${label}: done.`);
    } catch (e) {
      onStatus(e instanceof ApiError ? `${label} failed (${e.status}): ${e.message}` : String(e));
    }
  }

  const loadEvents = () =>
    run("Loading your events", async () => {
      const list = await Api.events();
      setEvents(list);
      return `You have ${list.length} events.`;
    });

  return (
    <section style={{ marginTop: 24, borderTop: "1px solid #ccc", paddingTop: 16 }}>
      <h2>Test panel</h2>
      <LinkedInConnect onStatus={onStatus} />

      <label>
        Your interests (comma separated)
        <input value={interests} onChange={(e) => setInterests(e.target.value)} style={{ width: "100%" }} />
      </label>
      <button
        onClick={() =>
          run("Saving your profile", async () => {
            const list = interests.split(",").map((s) => s.trim()).filter(Boolean);
            await Api.saveMe({ interests: list });
            return `Saved ${list.length} interests.`;
          })
        }
      >
        Save profile
      </button>

      <p>
        <button
          onClick={() =>
            run("Joining demo events", async () => {
              const { imported } = await Api.joinDemoEvents();
              await loadEvents();
              return `Joined ${imported} demo events.`;
            })
          }
        >
          Join demo events
        </button>{" "}
        <button onClick={loadEvents}>Show my events</button>
      </p>

      <ul style={{ paddingLeft: 16 }}>
        {events.map(({ event, label, state, effectiveVisibility }) => (
          <li key={event.id} style={{ marginBottom: 12 }}>
            <strong>{event.title}</strong> · {label ?? state} · {effectiveVisibility === "confirmed_attendees" ? "findable" : "hidden"}
            <br />
            <button
              onClick={() =>
                run("Making you findable", async () => {
                  await Api.setVisibility(event.id, "confirmed_attendees");
                  await loadEvents();
                  return `Other attendees of ${event.title} can now find you.`;
                })
              }
            >
              Let attendees find me
            </button>{" "}
            <button
              onClick={() =>
                run("Asking Gemini", async () => {
                  const res = await Api.matches(event.id);
                  setMatches({ eventId: event.id, ai: res.ai, list: res.matches });
                  return `${res.matches.length} suggestions (${res.ai ? "from Gemini" : "Gemini unavailable, simple overlap used"}).`;
                })
              }
            >
              Find people to meet
            </button>
            {matches?.eventId === event.id && (
              <ol>
                {matches.list.map((m) => (
                  <li key={m.memberId}>
                    <strong>{m.profile?.displayName ?? m.memberId}</strong> {m.reason}
                    <br />
                    <em>“{m.starter}”</em>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
