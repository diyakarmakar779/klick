// Seeds demo members who all import the same mock Luma events, so matching has a real pool.
// Local:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 npm run seed
// Cloud:  GOOGLE_CLOUD_PROJECT=<id> npm run seed   (uses your gcloud ADC login)
import { upsertMember } from "../src/db/repos/members.js";
import { createSourceConnection, importEvents } from "../src/db/repos/events.js";
import { mockLumaEvents } from "../src/lib/mockLuma.js";

const people: Array<[string, string, string[], string[], Partial<Record<"simpleLanguage" | "prefersTextFirst" | "quietSpaces" | "readAloud", boolean>>]> = [
  ["demo-asha", "Asha Kulkarni", ["accessibility", "android", "tts"], ["Find collaborators for a Marathi screen reader"], { prefersTextFirst: true }],
  ["demo-ravi", "Ravi Patil", ["flood alerts", "sms", "civic tech"], ["Add Hindi TTS to flood-alert SMS"], {}],
  ["demo-meera", "Meera Iyer", ["climate data", "bigquery", "earth engine"], ["Meet NGOs who need geospatial help"], {}],
  ["demo-arjun", "Arjun Rao", ["web", "design systems", "a11y"], ["Mentor first-time speakers"], { quietSpaces: true }],
  ["demo-sana", "Sana Shaikh", ["community", "events", "inclusion"], ["Grow a women-in-cloud meetup in Pune"], {}],
  ["demo-kabir", "Kabir Mehta", ["gemini", "agents", "voice"], ["Find a co-founder for a voice-first app"], {}],
  ["demo-neha", "Neha Joshi", ["agritech", "ml", "vision ai"], ["Pilot crop-disease detection with farmers"], { simpleLanguage: true }],
  ["demo-vikram", "Vikram Singh", ["devrel", "firebase", "flutter"], ["Recruit speakers for DevFest"], {}],
  ["demo-ananya", "Ananya Das", ["sign language", "computer vision"], ["Build an ISL interpreter prototype"], { prefersTextFirst: true }],
  ["demo-rohan", "Rohan Gupta", ["waste reduction", "iot"], ["Find a city partner for smart bins"], {}],
  ["demo-fatima", "Fatima Khan", ["healthcare", "nlp", "multilingual"], ["Translate health advisories into Urdu and Marathi"], { readAloud: true }],
  ["demo-dev", "Dev Nair", ["backend", "cloud run", "pub/sub"], ["Learn about disaster-response tech"], {}],
];

for (const [id, name, interests, goals, accessibility] of people) {
  await upsertMember(id, {
    displayName: name,
    headline: interests.slice(0, 2).join(" · "),
    interests,
    goals,
    accessibility: { simpleLanguage: false, readAloud: false, prefersTextFirst: false, quietSpaces: false, ...accessibility },
    defaultVisibility: id === "demo-dev" ? "hidden" : "confirmed_attendees",
  });
  await createSourceConnection(id, "mock_luma", ["events:read:self"], null);
  await importEvents(id, "mock_luma", mockLumaEvents(id));
  console.log(`seeded ${id}`);
}
console.log(`Done: ${people.length} members`);
process.exit(0);
