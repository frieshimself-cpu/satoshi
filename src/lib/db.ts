import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type {
  LeaderboardSnapshot,
  Transcript,
  TranscriptKind,
  TranscriptStatus,
} from "./types";

function resolveDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  if (process.env.VERCEL) return "/tmp/satoshi.db";
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "satoshi.db");
}

function createDb(): Database.Database {
  const db = new Database(resolveDbPath());
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS releases (
      dossier_index INTEGER PRIMARY KEY,
      released_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      dossier_index INTEGER,
      content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      after_kind TEXT NOT NULL,
      dossier_index INTEGER,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim TEXT NOT NULL,
      source_url TEXT NOT NULL DEFAULT '',
      context TEXT NOT NULL DEFAULT '',
      file_path TEXT,
      file_name TEXT,
      file_mime TEXT,
      status TEXT NOT NULL,
      verdict_reason TEXT NOT NULL DEFAULT '',
      screener_summary TEXT NOT NULL DEFAULT '',
      batch_id INTEGER,
      ip_hash TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS community_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      released_at TEXT NOT NULL
    );
  `);
  return db;
}

// Survive Next.js dev-server HMR / route-module isolation.
const g = globalThis as unknown as { __satoshiDb?: Database.Database };
export function getDb(): Database.Database {
  if (!g.__satoshiDb) g.__satoshiDb = createDb();
  return g.__satoshiDb;
}

// ---------- releases ----------

export function getReleasedIndexes(): number[] {
  return getDb()
    .prepare("SELECT dossier_index FROM releases ORDER BY dossier_index")
    .all()
    .map((r: any) => r.dossier_index as number);
}

export function getReleaseTimes(): Record<number, string> {
  const out: Record<number, string> = {};
  for (const r of getDb().prepare("SELECT * FROM releases").all() as any[]) {
    out[r.dossier_index] = r.released_at;
  }
  return out;
}

export function markReleased(index: number): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO releases (dossier_index, released_at) VALUES (?, ?)")
    .run(index, new Date().toISOString());
}

// ---------- transcripts ----------

function rowToTranscript(r: any): Transcript {
  return {
    id: r.id,
    kind: r.kind,
    dossierIndex: r.dossier_index,
    content: r.content,
    status: r.status,
    startedAt: r.started_at,
    completedAt: r.completed_at,
  };
}

export function getTranscripts(): Transcript[] {
  return (getDb().prepare("SELECT * FROM transcripts ORDER BY id").all() as any[]).map(
    rowToTranscript
  );
}

export function createTranscript(kind: TranscriptKind, dossierIndex: number | null): number {
  const res = getDb()
    .prepare(
      "INSERT INTO transcripts (kind, dossier_index, status, started_at) VALUES (?, ?, 'streaming', ?)"
    )
    .run(kind, dossierIndex, new Date().toISOString());
  return Number(res.lastInsertRowid);
}

export function finishTranscript(id: number, content: string, status: TranscriptStatus): void {
  getDb()
    .prepare("UPDATE transcripts SET content = ?, status = ?, completed_at = ? WHERE id = ?")
    .run(content, status, new Date().toISOString(), id);
}

export function deleteFailedTranscripts(kind: TranscriptKind, dossierIndex: number | null): void {
  if (dossierIndex === null) {
    getDb()
      .prepare("DELETE FROM transcripts WHERE kind = ? AND status != 'complete'")
      .run(kind);
  } else {
    getDb()
      .prepare(
        "DELETE FROM transcripts WHERE kind = ? AND dossier_index = ? AND status != 'complete'"
      )
      .run(kind, dossierIndex);
  }
}

export function hasCompleteTranscript(kind: TranscriptKind, dossierIndex: number | null): boolean {
  const row =
    dossierIndex === null
      ? getDb()
          .prepare("SELECT id FROM transcripts WHERE kind = ? AND status = 'complete' LIMIT 1")
          .get(kind)
      : getDb()
          .prepare(
            "SELECT id FROM transcripts WHERE kind = ? AND dossier_index = ? AND status = 'complete' LIMIT 1"
          )
          .get(kind, dossierIndex);
  return !!row;
}

// ---------- snapshots ----------

function rowToSnapshot(r: any): LeaderboardSnapshot {
  const payload = JSON.parse(r.payload);
  return {
    id: r.id,
    afterKind: r.after_kind,
    dossierIndex: r.dossier_index,
    probabilities: payload.probabilities,
    mostDecisiveNextEvidence: payload.mostDecisiveNextEvidence,
    createdAt: r.created_at,
  };
}

export function getSnapshots(): LeaderboardSnapshot[] {
  return (getDb().prepare("SELECT * FROM snapshots ORDER BY id").all() as any[]).map(
    rowToSnapshot
  );
}

export function saveSnapshot(
  afterKind: TranscriptKind,
  dossierIndex: number | null,
  payload: { probabilities: unknown; mostDecisiveNextEvidence: string }
): LeaderboardSnapshot {
  const res = getDb()
    .prepare(
      "INSERT INTO snapshots (after_kind, dossier_index, payload, created_at) VALUES (?, ?, ?, ?)"
    )
    .run(afterKind, dossierIndex, JSON.stringify(payload), new Date().toISOString());
  const row = getDb().prepare("SELECT * FROM snapshots WHERE id = ?").get(res.lastInsertRowid);
  return rowToSnapshot(row);
}

// ---------- submissions ----------

export interface SubmissionRow {
  id: number;
  claim: string;
  source_url: string;
  context: string;
  file_path: string | null;
  file_name: string | null;
  file_mime: string | null;
  status: string;
  verdict_reason: string;
  screener_summary: string;
  batch_id: number | null;
  ip_hash: string;
  created_at: string;
}

export function insertSubmission(s: {
  claim: string;
  sourceUrl: string;
  context: string;
  filePath: string | null;
  fileName: string | null;
  fileMime: string | null;
  status: string;
  verdictReason: string;
  screenerSummary: string;
  ipHash: string;
}): number {
  const res = getDb()
    .prepare(
      `INSERT INTO submissions
        (claim, source_url, context, file_path, file_name, file_mime,
         status, verdict_reason, screener_summary, ip_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      s.claim,
      s.sourceUrl,
      s.context,
      s.filePath,
      s.fileName,
      s.fileMime,
      s.status,
      s.verdictReason,
      s.screenerSummary,
      s.ipHash,
      new Date().toISOString()
    );
  return Number(res.lastInsertRowid);
}

export function getSubmissions(statuses?: string[]): SubmissionRow[] {
  if (statuses && statuses.length) {
    const marks = statuses.map(() => "?").join(",");
    return getDb()
      .prepare(`SELECT * FROM submissions WHERE status IN (${marks}) ORDER BY id`)
      .all(...statuses) as SubmissionRow[];
  }
  return getDb().prepare("SELECT * FROM submissions ORDER BY id").all() as SubmissionRow[];
}

export function getSubmissionsByBatch(batchId: number): SubmissionRow[] {
  return getDb()
    .prepare("SELECT * FROM submissions WHERE batch_id = ? ORDER BY id")
    .all(batchId) as SubmissionRow[];
}

export function setSubmissionStatus(id: number, status: string, verdictReason?: string): boolean {
  const res =
    verdictReason !== undefined
      ? getDb()
          .prepare("UPDATE submissions SET status = ?, verdict_reason = ? WHERE id = ?")
          .run(status, verdictReason, id)
      : getDb().prepare("UPDATE submissions SET status = ? WHERE id = ?").run(status, id);
  return res.changes > 0;
}

export function createCommunityBatch(submissionIds: number[]): number {
  const db = getDb();
  const tx = db.transaction(() => {
    const res = db
      .prepare("INSERT INTO community_batches (released_at) VALUES (?)")
      .run(new Date().toISOString());
    const batchId = Number(res.lastInsertRowid);
    const upd = db.prepare("UPDATE submissions SET status = 'released', batch_id = ? WHERE id = ?");
    for (const id of submissionIds) upd.run(batchId, id);
    return batchId;
  });
  return tx();
}

export function getCommunityBatches(): { id: number; released_at: string }[] {
  return getDb()
    .prepare("SELECT * FROM community_batches ORDER BY id")
    .all() as { id: number; released_at: string }[];
}

// ---------- reset ----------

export function resetAll(): void {
  const db = getDb();
  db.exec(
    "DELETE FROM releases; DELETE FROM transcripts; DELETE FROM snapshots; DELETE FROM submissions; DELETE FROM community_batches;"
  );
}
