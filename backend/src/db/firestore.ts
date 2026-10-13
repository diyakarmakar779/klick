// Firestore client. Uses the emulator when FIRESTORE_EMULATOR_HOST is set, Application Default Credentials otherwise.
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";

let db: Firestore | null = null;

export function getDb(): Firestore {
  if (db) return db;
  const app = getApps()[0] ?? initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "demo-event-networking" });
  db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

// Firestore returns Timestamps; our schemas use Date. Convert recursively on read.
export function fromFirestore<T>(data: FirebaseFirestore.DocumentData): T {
  const walk = (v: unknown): unknown => {
    if (v instanceof Timestamp) return v.toDate();
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object" && v.constructor === Object) {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  return walk(data) as T;
}
