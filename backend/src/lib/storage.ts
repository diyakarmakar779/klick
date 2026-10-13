// Private media in Cloud Storage. Paths are always members/{ownerId}/..., so ownership is checkable from the path.
import { getStorage } from "firebase-admin/storage";
import { getDb } from "../db/firestore.js";

export function ownsPath(memberId: string, storagePath: string | null | undefined): boolean {
  return !storagePath || storagePath.startsWith(`members/${memberId}/`);
}

export async function deleteObject(storagePath: string): Promise<void> {
  const bucket = process.env.MEDIA_BUCKET;
  if (!bucket) return; // local dev and tests have no bucket
  getDb(); // ensures the Firebase app is initialized
  await getStorage().bucket(bucket).file(storagePath).delete({ ignoreNotFound: true });
}

// Short-lived URL the browser uploads a voice note or photo to directly.
export async function signedUploadUrl(memberId: string, kind: "voice" | "photo", contentType: string) {
  const bucket = process.env.MEDIA_BUCKET;
  if (!bucket) throw new Error("MEDIA_BUCKET not configured");
  getDb();
  const ext = contentType.split("/")[1]?.split(";")[0] ?? "bin";
  const storagePath = `members/${memberId}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const [url] = await getStorage()
    .bucket(bucket)
    .file(storagePath)
    .getSignedUrl({ version: "v4", action: "write", expires: Date.now() + 10 * 60 * 1000, contentType });
  return { storagePath, url };
}
