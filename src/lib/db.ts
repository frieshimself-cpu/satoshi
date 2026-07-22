import type {
  LeaderboardSnapshot,
  Transcript,
  TranscriptKind,
  TranscriptStatus,
} from "./types";
import { emptyDoc, readDoc, updateDoc, writeDoc, type StateDoc } from "./store";
import type { SubmissionRow } from "./store";

export type { SubmissionRow } from "./store";

// ---------- releases ----------

export async function getReleasedIndexes(): Promise<number[]> {
  const doc = await readDoc();
  return Object.keys(doc.releases)
    .map(Number)
    .sort((a, b) => a - b);
}

export async function getReleaseTimes(): Promise<Record<number, string>> {
  const doc = await readDoc();
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(doc.releases)) out[Number(k)] = v;
  return out;
}

export async function markReleased(index: number): Promise<void> {
  await updateDoc((doc) => {
    if (!doc.releases[String(index)]) doc.releases[String(index)] = new Date().toISOString();
  });
}

// ---------- transcripts ----------

function rowToTranscript(r: StateDoc["transcripts"][number]): Transcript {
  return {
    id: r.id,
    kind: r.kind as TranscriptKind,
    dossierIndex: r.dossier_index,
    content: r.content,
    status: r.status as TranscriptStatus,
    startedAt: r.started_at,
    completedAt: r.completed_at,
  };
}

export async function getTranscripts(): Promise<Transcript[]> {
  const doc = await readDoc();
  return doc.transcripts.map(rowToTranscript);
}

export async function createTranscript(
  kind: TranscriptKind,
  dossierIndex: number | null
): Promise<number> {
  return updateDoc((doc) => {
    const id = doc.nextId++;
    doc.transcripts.push({
      id,
      kind,
      dossier_index: dossierIndex,
      content: "",
      status: "streaming",
      started_at: new Date().toISOString(),
      completed_at: null,
    });
    return id;
  });
}

export async function finishTranscript(
  id: number,
  content: string,
  status: TranscriptStatus
): Promise<void> {
  await updateDoc((doc) => {
    const t = doc.transcripts.find((x) => x.id === id);
    if (t) {
      t.content = content;
      t.status = status;
      t.completed_at = new Date().toISOString();
    }
    // A finished (or failed) analysis always ends the shared streaming buffer.
    doc.streaming = { active: false, kind: null, dossierIndex: null, text: "", updatedAt: null };
  });
}

export async function deleteFailedTranscripts(
  kind: TranscriptKind,
  dossierIndex: number | null
): Promise<void> {
  await updateDoc((doc) => {
    doc.transcripts = doc.transcripts.filter(
      (t) =>
        !(
          t.kind === kind &&
          (dossierIndex === null || t.dossier_index === dossierIndex) &&
          t.status !== "complete"
        )
    );
  });
}

export async function hasCompleteTranscript(
  kind: TranscriptKind,
  dossierIndex: number | null
): Promise<boolean> {
  const doc = await readDoc();
  return doc.transcripts.some(
    (t) =>
      t.kind === kind &&
      t.status === "complete" &&
      (dossierIndex === null || t.dossier_index === dossierIndex)
  );
}

// ---------- shared streaming buffer ----------

export async function flushStreamingBuffer(
  kind: TranscriptKind,
  dossierIndex: number | null,
  text: string
): Promise<void> {
  await updateDoc((doc) => {
    doc.streaming = {
      active: true,
      kind,
      dossierIndex,
      text,
      updatedAt: new Date().toISOString(),
    };
  });
}

export async function getSharedStreaming(): Promise<StateDoc["streaming"]> {
  const doc = await readDoc();
  return doc.streaming;
}

// ---------- snapshots ----------

function rowToSnapshot(r: StateDoc["snapshots"][number]): LeaderboardSnapshot {
  return {
    id: r.id,
    afterKind: r.after_kind as TranscriptKind,
    dossierIndex: r.dossier_index,
    probabilities: r.payload.probabilities as LeaderboardSnapshot["probabilities"],
    mostDecisiveNextEvidence: r.payload.mostDecisiveNextEvidence,
    createdAt: r.created_at,
  };
}

export async function getSnapshots(): Promise<LeaderboardSnapshot[]> {
  const doc = await readDoc();
  return doc.snapshots.map(rowToSnapshot);
}

export async function saveSnapshot(
  afterKind: TranscriptKind,
  dossierIndex: number | null,
  payload: { probabilities: unknown; mostDecisiveNextEvidence: string }
): Promise<LeaderboardSnapshot> {
  return updateDoc((doc) => {
    const row = {
      id: doc.nextId++,
      after_kind: afterKind,
      dossier_index: dossierIndex,
      payload,
      created_at: new Date().toISOString(),
    };
    doc.snapshots.push(row);
    return rowToSnapshot(row);
  });
}

// ---------- submissions ----------

export async function insertSubmission(s: {
  claim: string;
  sourceUrl: string;
  context: string;
  fileUrl: string | null;
  fileName: string | null;
  fileMime: string | null;
  status: string;
  verdictReason: string;
  screenerSummary: string;
  ipHash: string;
}): Promise<number> {
  return updateDoc((doc) => {
    const id = doc.nextId++;
    doc.submissions.push({
      id,
      claim: s.claim,
      source_url: s.sourceUrl,
      context: s.context,
      file_url: s.fileUrl,
      file_name: s.fileName,
      file_mime: s.fileMime,
      status: s.status,
      verdict_reason: s.verdictReason,
      screener_summary: s.screenerSummary,
      batch_id: null,
      ip_hash: s.ipHash,
      created_at: new Date().toISOString(),
    });
    return id;
  });
}

export async function getSubmissions(statuses?: string[]): Promise<SubmissionRow[]> {
  const doc = await readDoc();
  const all = doc.submissions;
  return statuses && statuses.length ? all.filter((s) => statuses.includes(s.status)) : all;
}

export async function getSubmissionsByBatch(batchId: number): Promise<SubmissionRow[]> {
  const doc = await readDoc();
  return doc.submissions.filter((s) => s.batch_id === batchId);
}

export async function setSubmissionStatus(
  id: number,
  status: string,
  verdictReason?: string
): Promise<boolean> {
  return updateDoc((doc) => {
    const s = doc.submissions.find((x) => x.id === id);
    if (!s) return false;
    s.status = status;
    if (verdictReason !== undefined) s.verdict_reason = verdictReason;
    return true;
  });
}

export async function createCommunityBatch(submissionIds: number[]): Promise<number> {
  return updateDoc((doc) => {
    const id = doc.nextId++;
    doc.batches.push({ id, released_at: new Date().toISOString() });
    for (const s of doc.submissions) {
      if (submissionIds.includes(s.id)) {
        s.status = "released";
        s.batch_id = id;
      }
    }
    return id;
  });
}

export async function getCommunityBatches(): Promise<{ id: number; released_at: string }[]> {
  const doc = await readDoc();
  return doc.batches;
}

// ---------- reset ----------

export async function resetAll(): Promise<void> {
  // Continue the revision sequence so the reset outranks every existing
  // version in the immutable store.
  const current = await readDoc(true);
  const doc = emptyDoc();
  doc.rev = current.rev;
  await writeDoc(doc);
}
