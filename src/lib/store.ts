import fs from "fs";
import path from "path";
import { put } from "@vercel/blob";

/**
 * Shared JSON-document store.
 *
 * In production (BLOB_READ_WRITE_TOKEN set) the document lives in Vercel Blob,
 * so every serverless instance sees the same state. Locally it falls back to a
 * JSON file on disk. Writers follow read-mutate-write on the whole document;
 * the only concurrent writers are the (single-operator) admin pipeline and
 * rate-limited public submissions, so last-writer-wins is acceptable, and the
 * streaming buffer self-heals because every flush rewrites the full text.
 */

// Immutable-version layout: every write creates a NEW blob under this prefix
// (never overwritten), so CDN caching can never serve a stale overwrite. Reads
// use the authoritative list() API to locate the highest revision.
const DOC_PREFIX = "satoshi/state-v2/";

export interface StateDoc {
  rev: number;
  releases: Record<string, string>; // dossier index -> ISO time
  transcripts: TranscriptRow[];
  snapshots: SnapshotRow[];
  submissions: SubmissionRow[];
  batches: BatchRow[];
  streaming: StreamingSlice;
  nextId: number;
}

export interface TranscriptRow {
  id: number;
  kind: string;
  dossier_index: number | null;
  content: string;
  status: string;
  started_at: string;
  completed_at: string | null;
}

export interface SnapshotRow {
  id: number;
  after_kind: string;
  dossier_index: number | null;
  payload: { probabilities: unknown; mostDecisiveNextEvidence: string };
  created_at: string;
}

export interface SubmissionRow {
  id: number;
  claim: string;
  source_url: string;
  context: string;
  file_url: string | null;
  file_name: string | null;
  file_mime: string | null;
  status: string;
  verdict_reason: string;
  screener_summary: string;
  batch_id: number | null;
  ip_hash: string;
  created_at: string;
}

export interface BatchRow {
  id: number;
  released_at: string;
}

export interface StreamingSlice {
  active: boolean;
  kind: string | null;
  dossierIndex: number | null;
  text: string;
  updatedAt: string | null;
}

export function emptyDoc(): StateDoc {
  return {
    rev: 0,
    releases: {},
    transcripts: [],
    snapshots: [],
    submissions: [],
    batches: [],
    streaming: { active: false, kind: null, dossierIndex: null, text: "", updatedAt: null },
    nextId: 1,
  };
}

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

function localPath(): string {
  const dir = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "state-v1.json");
}

const g = globalThis as unknown as {
  __satoshiDocCache?: { doc: StateDoc; rev: number; at: number };
  __satoshiLastList?: number;
};

// Public-read cache TTL. Combined with the edge cache on /api/state this
// bounds storage "advanced operations" to roughly one list per instance per
// few seconds regardless of audience size.
const READ_CACHE_MS = 4000;

interface VersionRef {
  rev: number;
  pathname: string;
  url: string;
}

function parseRev(pathname: string): number {
  const m = pathname.slice(DOC_PREFIX.length).match(/^(\d+)-/);
  return m ? parseInt(m[1], 10) : -1;
}

async function listVersions(): Promise<VersionRef[]> {
  const { list } = await import("@vercel/blob");
  const res = await list({ prefix: DOC_PREFIX, token: blobToken(), limit: 1000 });
  return res.blobs
    .map((b) => ({ rev: parseRev(b.pathname), pathname: b.pathname, url: b.url }))
    .filter((v) => v.rev >= 0)
    .sort((a, b) => b.rev - a.rev || (a.pathname < b.pathname ? 1 : -1));
}

/**
 * Mirror mode: when STATE_SOURCE_URL is set, this deployment is a read-only
 * mirror of an externally operated show — state is fetched from a public URL
 * (e.g. a raw.githubusercontent file pushed by the operator) and all writes
 * are rejected.
 */
export function isMirror(): boolean {
  return !!process.env.STATE_SOURCE_URL;
}

/**
 * Fetch the mirrored state document. raw.githubusercontent.com caches
 * branch-name URLs for ~5 minutes, which is far too stale for a live show, so
 * for GitHub sources we resolve the branch tip ourselves via the git smart-HTTP
 * ref advertisement (uncached) and fetch the file by immutable commit SHA.
 */
async function fetchMirrorDoc(): Promise<StateDoc> {
  const src = process.env.STATE_SOURCE_URL!;
  const gh = src.match(
    /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/refs\/heads\/([^/]+)\/(.+)$/
  );
  if (gh) {
    const [, owner, repo, branch, filePath] = gh;
    const refs = await fetch(
      `https://github.com/${owner}/${repo}.git/info/refs?service=git-upload-pack`,
      { cache: "no-store" }
    );
    if (refs.ok) {
      const text = await refs.text();
      const m = text.match(new RegExp(`([0-9a-f]{40}) refs/heads/${branch}\\b`));
      if (m) {
        const res = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${m[1]}/${filePath}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`state source ${res.status}`);
        return (await res.json()) as StateDoc;
      }
    }
  }
  // Non-GitHub source (or ref lookup failed): plain fetch with a short
  // time-bucketed cache-buster.
  const bucket = Math.floor(Date.now() / 4000);
  const res = await fetch(`${src}?v=${bucket}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`state source ${res.status}`);
  return (await res.json()) as StateDoc;
}

/** Read the state document. `fresh` bypasses the tiny read cache (writers must use fresh). */
export async function readDoc(fresh = false): Promise<StateDoc> {
  const cacheTtl = fresh ? 0 : READ_CACHE_MS;
  if (cacheTtl && g.__satoshiDocCache && Date.now() - g.__satoshiDocCache.at < cacheTtl) {
    return g.__satoshiDocCache.doc;
  }

  if (isMirror()) {
    try {
      const doc = await fetchMirrorDoc();
      // Never move backwards if a stale CDN node answers.
      if (g.__satoshiDocCache && g.__satoshiDocCache.rev > doc.rev) {
        g.__satoshiDocCache.at = Date.now();
        return g.__satoshiDocCache.doc;
      }
      g.__satoshiDocCache = { doc, rev: doc.rev, at: Date.now() };
      return doc;
    } catch (err) {
      console.error("[store] mirror read failed:", err);
      if (g.__satoshiDocCache) {
        g.__satoshiDocCache.at = Date.now();
        return g.__satoshiDocCache.doc;
      }
      return emptyDoc();
    }
  }

  if (blobToken()) {
    try {
      const versions = await listVersions();
      if (versions.length) {
        const latest = versions[0];
        if (g.__satoshiDocCache && g.__satoshiDocCache.rev === latest.rev) {
          // Already have this exact revision — no fetch needed.
          g.__satoshiDocCache.at = Date.now();
          return g.__satoshiDocCache.doc;
        }
        // Version files are immutable, so a plain fetch can never be stale.
        const res = await fetch(latest.url, { cache: "no-store" });
        if (!res.ok) throw new Error(`version fetch ${res.status}`);
        const doc = (await res.json()) as StateDoc;
        g.__satoshiDocCache = { doc, rev: doc.rev, at: Date.now() };
        return doc;
      }
      // Store is genuinely empty (fresh install / post-reset baseline).
      const empty = emptyDoc();
      g.__satoshiDocCache = { doc: empty, rev: empty.rev, at: Date.now() };
      return empty;
    } catch (err) {
      console.error("[store] blob read failed:", err);
      // Serve the last good doc if we have one; otherwise an UNCACHED empty
      // doc, so recovery happens on the next read instead of sticking.
      if (g.__satoshiDocCache) {
        g.__satoshiDocCache.at = Date.now();
        return g.__satoshiDocCache.doc;
      }
      return emptyDoc();
    }
  }

  let doc: StateDoc | null = null;
  try {
    doc = JSON.parse(fs.readFileSync(localPath(), "utf8")) as StateDoc;
  } catch {
    doc = null;
  }
  const result = doc ?? emptyDoc();
  g.__satoshiDocCache = { doc: result, rev: result.rev, at: Date.now() };
  return result;
}

export async function writeDoc(doc: StateDoc): Promise<void> {
  if (isMirror()) {
    throw new Error("read-only mirror: state is operated externally");
  }
  doc.rev += 1;
  const body = JSON.stringify(doc);
  if (blobToken()) {
    const name = `${DOC_PREFIX}${String(doc.rev).padStart(10, "0")}-${Math.random()
      .toString(36)
      .slice(2, 8)}.json`;
    await put(name, body, {
      access: "public",
      token: blobToken(),
      addRandomSuffix: false,
      contentType: "application/json",
    });
    // Best-effort cleanup of old versions (keep a few for safety). Runs
    // every 10th revision so writes normally cost one simple operation.
    if (doc.rev % 10 === 0) {
      void (async () => {
        try {
          const versions = await listVersions();
          const stale = versions.filter((v) => v.rev < doc.rev - 4);
          if (stale.length) {
            const { del } = await import("@vercel/blob");
            await del(stale.map((v) => v.url), { token: blobToken() });
          }
        } catch {
          /* cleanup only */
        }
      })();
    }
  } else {
    fs.writeFileSync(localPath(), body);
  }
  g.__satoshiDocCache = { doc, rev: doc.rev, at: Date.now() };
}

/** Read-mutate-write helper; returns whatever the mutator returns. */
export async function updateDoc<T>(mutate: (doc: StateDoc) => T): Promise<T> {
  const doc = await readDoc(true);
  const out = mutate(doc);
  await writeDoc(doc);
  return out;
}
