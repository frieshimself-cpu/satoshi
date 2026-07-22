import fs from "fs";
import path from "path";
import { createHash, randomBytes } from "crypto";

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB
export const MAX_TEXT_CHARS = 4000;

export const ALLOWED_MIMES: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function uploadsDir(): string {
  const dir = process.env.VERCEL
    ? "/tmp/satoshi-uploads"
    : path.join(process.cwd(), "data", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveUpload(buf: Buffer, mime: string): string {
  const ext = ALLOWED_MIMES[mime] ?? ".bin";
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
  const full = path.join(uploadsDir(), name);
  fs.writeFileSync(full, buf);
  return full;
}

export function clearUploads(): void {
  const dir = uploadsDir();
  for (const f of fs.readdirSync(dir)) {
    try {
      fs.unlinkSync(path.join(dir, f));
    } catch {
      /* ignore */
    }
  }
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`satoshi-ip:${ip}`).digest("hex").slice(0, 16);
}

// ---- simple in-memory rate limiter (per instance) ----

const g = globalThis as unknown as { __satoshiRate?: Map<string, number[]> };
function rateMap(): Map<string, number[]> {
  if (!g.__satoshiRate) g.__satoshiRate = new Map();
  return g.__satoshiRate;
}

/** Allow at most `limit` submissions per `windowMs` per key. */
export function rateLimitOk(key: string, limit = 5, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now();
  const map = rateMap();
  const hits = (map.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    map.set(key, hits);
    return false;
  }
  hits.push(now);
  map.set(key, hits);
  return true;
}
