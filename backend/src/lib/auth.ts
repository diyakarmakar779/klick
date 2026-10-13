// Resolves the calling member from a Firebase Auth ID token.
// In local dev (AUTH_MODE=dev) an `x-dev-member` header stands in, so the API can be exercised with curl.
import type { FastifyReply, FastifyRequest } from "fastify";
import { getAuth } from "firebase-admin/auth";
import { getDb } from "../db/firestore.js";

declare module "fastify" {
  interface FastifyRequest {
    memberId: string;
    memberEmail?: string;
  }
}

export async function requireMember(req: FastifyRequest, reply: FastifyReply) {
  if (process.env.AUTH_MODE === "dev") {
    const dev = req.headers["x-dev-member"];
    if (typeof dev === "string" && dev) {
      req.memberId = dev;
      const devEmail = req.headers["x-dev-email"];
      if (typeof devEmail === "string") req.memberEmail = devEmail;
      return;
    }
  }
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return reply.code(401).send({ error: "Missing bearer token" });
  try {
    getDb(); // ensures the Firebase app is initialized
    const decoded = await getAuth().verifyIdToken(token);
    req.memberId = decoded.uid;
    req.memberEmail = decoded.email_verified ? decoded.email : undefined;
  } catch {
    return reply.code(401).send({ error: "Invalid token" });
  }
}
