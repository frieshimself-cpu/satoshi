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

const UPLOAD_PREFIX = "satoshi/uploads/";

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

function localUploadsDir(): string {
  const dir = process.env.VERCEL
    ? "/tmp/satoshi-uploads"
    : path.join(process.cwd(), "data", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Persist an uploaded file. Returns a reference usable by every server
 * instance: a public blob URL in production, a filesystem path locally.
 */
export async function saveUpload(buf: Buffer, mime: string): Promise<string> {
  const ext = ALLOWED_MIMES[mime] ?? ".bin";
  const name = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
  if (blobToken()) {
    const { put } = await import("@vercel/blob");
    const res = await put(`${UPLOAD_PREFIX}${name}`, buf, {
      access: "public",
      token: blobToken(),
      addRandomSuffix: false,
      contentType: mime,
    });
    return res.url;
  }
  const full = path.join(localUploadsDir(), name);
  fs.writeFileSync(full, buf);
  return full;
}

/** Read back an uploaded file from either a blob URL or a local path. */
export async function readUpload(ref: string): Promise<Buffer> {
  if (ref.startsWith("http")) {
    const res = await fetch(ref, { cache: "no-store" });
    if (!res.ok) throw new Error(`upload fetch failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFileSync(ref);
}

export async function clearUploads(): Promise<void> {
  if (blobToken()) {
    try {
      const { list, del } = await import("@vercel/blob");
      const res = await list({ prefix: UPLOAD_PREFIX, token: blobToken(), limit: 1000 });
      if (res.blobs.length) {
        await del(res.blobs.map((b) => b.url), { token: blobToken() });
      }
    } catch (err) {
      console.error("[uploads] blob cleanup failed:", err);
    }
    return;
  }
  const dir = localUploadsDir();
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
