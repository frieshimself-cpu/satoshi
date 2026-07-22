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

// ---------- reset ----------

export function resetAll(): void {
  const db = getDb();
  db.exec("DELETE FROM releases; DELETE FROM transcripts; DELETE FROM snapshots;");
}
