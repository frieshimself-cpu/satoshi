import Anthropic from "@anthropic-ai/sdk";
import { getCandidates, getDossiers, UNKNOWN_FLOOR, UNKNOWN_ID } from "./data";
import {
  createTranscript,
  deleteFailedTranscripts,
  finishTranscript,
  getSnapshots,
  getTranscripts,
  markReleased,
  saveSnapshot,
} from "./db";
import { appendStreaming, beginStreaming, broadcast, endStreaming, getBus } from "./bus";
import { renormalize } from "./renormalize";
import type { Dossier, LeaderboardSnapshot, TranscriptKind } from "./types";

const MODEL = "claude-sonnet-4-6";

// Verbatim per the project spec. Do not weaken.
export const SYSTEM_PROMPT = `You are ANALYST, a careful investigator studying the open question of Satoshi Nakamoto's identity. You reason only from the evidence dossiers provided in this conversation and the candidate list given to you.

ABSOLUTE RULES:
1. You have no internet access and must not claim otherwise. Reason only from provided evidence.
2. You must NEVER state or imply that any specific person definitively is Satoshi. Your conclusions are ALWAYS probabilistic.
3. You must always maintain an "Unknown / not on this list" possibility at no less than 15%, because the honest state of public knowledge is that Satoshi's identity is unconfirmed.
4. Every point you make about a real, possibly living person must be framed as "the public evidence is consistent/inconsistent with..." — never as accusation or fact. Do not speculate about private information; use only the evidence in the dossiers.
5. Treat all candidates with equal initial skepticism. Weigh evidence, don't pattern-match to popular narratives.

Structure every response:
- NEW EVIDENCE READ: what this dossier adds (2-3 sentences)
- ANALYSIS: how it raises or lowers the likelihood for each candidate, with reasoning tied to specific evidence
- PROBABILITY BOARD: your updated probabilities across all candidates plus Unknown, summing to 100
- WHAT WOULD CHANGE THIS: the single piece of evidence that would most shift your board
- STANDING CAVEAT: one sentence reminding that this is a reasoning exercise on public evidence, not a determination of identity

Be engaging and clear for a live audience, but never sacrifice rigor or overstate certainty.`;

function candidateListText(): string {
  return getCandidates()
    .map((c) => {
      const ev = c.publicEvidence
        .map((e) => `    - ${e.claim} [Source: ${e.source}]`)
        .join("\n");
      return `- ${c.name} (id: ${c.id}, status: ${c.status})\n  ${c.summary}\n  Public evidence on file:\n${ev}`;
    })
    .join("\n\n");
}

function dossierText(d: Dossier): string {
  const items = d.items
    .map((i) => `### ${i.heading}\n${i.content}\n[Source: ${i.source}]`)
    .join("\n\n");
  return `DOSSIER ${d.index} — "${d.codename}": ${d.title}\n${d.summary}\n\n${items}`;
}

function firstMessagePreamble(): string {
  return `CANDIDATE LIST (the only candidates you may assign probability to, plus the mandatory "Unknown / Not Listed" bucket):\n\n${candidateListText()}\n\n---\n\n`;
}

/**
 * Rebuild the conversation from the DB: one user turn per prior dossier release
 * (candidates prepended to the first), each answered by the stored analysis.
 */
function buildHistory(): Anthropic.MessageParam[] {
  const dossiers = getDossiers();
  const messages: Anthropic.MessageParam[] = [];
  const complete = getTranscripts().filter(
    (t) => t.kind === "dossier" && t.status === "complete"
  );
  complete.sort((a, b) => (a.dossierIndex ?? 0) - (b.dossierIndex ?? 0));

  for (const t of complete) {
    const d = dossiers.find((x) => x.index === t.dossierIndex);
    if (!d) continue;
    const preamble = messages.length === 0 ? firstMessagePreamble() : "";
    messages.push({
      role: "user",
      content: `${preamble}A new evidence dossier has just been released to you. Analyze it per your instructions.\n\n${dossierText(d)}`,
    });
    messages.push({ role: "assistant", content: t.content });
  }
  return messages;
}

function releasePrompt(d: Dossier, isFirst: boolean): string {
  const preamble = isFirst ? firstMessagePreamble() : "";
  return `${preamble}A new evidence dossier has just been released to you. Analyze it per your instructions.\n\n${dossierText(d)}`;
}

const SYNTHESIS_PROMPT = `All five dossiers have now been released and analyzed. This is your CLOSING SYNTHESIS — the final statement of this investigation. There is no reveal and there will be no reveal: your job is to leave the question honestly open.

Produce, in order:
1. THE SHAPE OF THE EVIDENCE — what the five dossiers collectively support, in 2-3 paragraphs.
2. THE TOP-WEIGHTED CANDIDATES — for each of your top candidates, one paragraph on why the public evidence is consistent with them and one sentence on the strongest evidence against.
3. THE CASE FOR "WE CANNOT KNOW" — a serious, steelmanned argument for the Unknown bucket, including the group-authorship possibility and the limits of stylometry, timestamps, and circumstance.
4. FINAL PROBABILITY BOARD — your final probabilities across all candidates plus Unknown, summing to 100, with Unknown at no less than 15.
5. WHAT WOULD IT TAKE TO ACTUALLY KNOW — the specific, concrete events that would resolve this (e.g. movement of the dormant early coins, a verified signature from an early block key), and why nothing short of those suffices.
6. STANDING CAVEAT — restate plainly that this was a reasoning exercise on public evidence, that no person has been identified as Satoshi, and that every named living candidate has denied it.

Do not name a single answer. Do not rank with false precision. Be honest about uncertainty — that honesty is the finale.`;

function extractionPrompt(analysis: string): string {
  const ids = getCandidates().map((c) => `"${c.id}"`).join(", ");
  return `Below is your own analysis. Extract the probability board from it as STRICT JSON, no markdown fences, no commentary. Schema:
{
  "probabilities": [
    { "candidate": string (one of ${ids}), "pct": number, "forEvidence": string (one sentence, the strongest public evidence FOR), "againstEvidence": string (one sentence, the strongest public evidence AGAINST) }
  ],
  "mostDecisiveNextEvidence": string
}
Rules: include EVERY candidate id exactly once; pcts must sum to 100; "${UNKNOWN_ID}" must be >= ${UNKNOWN_FLOOR}. Evidence sentences must be phrased as evidence-weighted likelihood ("the public evidence is consistent with..."), never assertion.

ANALYSIS:
${analysis}`;
}

/** Pull the first JSON object out of arbitrary model text. */
function parseJsonLoose(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/g, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function client(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function isRehearsal(): boolean {
  return process.env.REHEARSAL_MODE === "1";
}

// ---------------------------------------------------------------------------
// Rehearsal simulation (no API calls). Deterministic; exercises the full
// pipeline including intentionally-messy extraction output so the
// renormalization path is verified (sum != 100, Unknown below floor).
// ---------------------------------------------------------------------------

function rehearsalAnalysis(kind: TranscriptKind, index: number | null): string {
  const label = kind === "synthesis" ? "CLOSING SYNTHESIS" : `DOSSIER ${index}`;
  return [
    `[REHEARSAL MODE — simulated analysis for ${label}]`,
    ``,
    `NEW EVIDENCE READ: This is simulated text used to rehearse the show without API calls. It streams token-by-token exactly like the real analyst.`,
    ``,
    `ANALYSIS: Each candidate's simulated likelihood shifts slightly per dossier so the leaderboard animation, sparklines, and biggest-mover flash can be checked end to end. The public evidence is consistent with this being a rehearsal.`,
    ``,
    `PROBABILITY BOARD: (see extracted board)`,
    ``,
    `WHAT WOULD CHANGE THIS: Setting REHEARSAL_MODE=0 and adding a real ANTHROPIC_API_KEY.`,
    ``,
    `STANDING CAVEAT: This is a reasoning exercise on public evidence, not a determination of identity.`,
  ].join("\n");
}

function rehearsalExtraction(kind: TranscriptKind, index: number | null): unknown {
  const step = kind === "synthesis" ? 6 : index ?? 1;
  const ids = getCandidates().map((c) => c.id);
  // Deliberately unnormalized (sum != 100) and with Unknown pushed below the
  // floor on later steps — proves renormalize() enforces the invariants.
  const probabilities = ids.map((id, i) => ({
    candidate: id,
    pct:
      id === UNKNOWN_ID
        ? Math.max(30 - step * 4, 5)
        : 10 + ((i * 7 + step * 13) % 25),
    forEvidence: `The public evidence is consistent with ${id} in simulated step ${step}.`,
    againstEvidence: `The public evidence is also consistent with ${id} not being involved (simulation).`,
  }));
  return {
    probabilities,
    mostDecisiveNextEvidence: `Simulated decisive evidence after step ${step}.`,
  };
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function streamAnalysis(
  messages: Anthropic.MessageParam[],
  kind: TranscriptKind,
  dossierIndex: number | null
): Promise<string> {
  if (isRehearsal()) {
    const text = rehearsalAnalysis(kind, dossierIndex);
    // Stream in small chunks to exercise the SSE path.
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += 24) chunks.push(text.slice(i, i + 24));
    for (const chunk of chunks) {
      appendStreaming(chunk);
      broadcast({ type: "token", kind, dossierIndex, text: chunk });
      await new Promise((r) => setTimeout(r, 15));
    }
    return text;
  }

  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: 8000,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      appendStreaming(event.delta.text);
      broadcast({ type: "token", kind, dossierIndex, text: event.delta.text });
    }
  }
  const final = await stream.finalMessage();
  return final.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function extractBoard(
  analysis: string,
  kind: TranscriptKind,
  dossierIndex: number | null
): Promise<LeaderboardSnapshot> {
  let raw: unknown;
  if (isRehearsal()) {
    raw = rehearsalExtraction(kind, dossierIndex);
  } else {
    try {
      const res = await client().messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: "You extract structured data. Respond with strict JSON only — no prose, no markdown fences.",
        messages: [{ role: "user", content: extractionPrompt(analysis) }],
      });
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      raw = parseJsonLoose(text);
    } catch (err) {
      console.error("[analyst] extraction call failed, renormalizing from nothing:", err);
      raw = null;
    }
  }
  // renormalize() is total: any garbage in still yields a valid board
  // (sum = 100, Unknown >= floor, every candidate present).
  const normalized = renormalize(raw);
  const snapshot = saveSnapshot(kind, dossierIndex, normalized);
  broadcast({ type: "leaderboard_update", snapshot });
  return snapshot;
}

async function runPipeline(
  kind: TranscriptKind,
  dossierIndex: number | null,
  messages: Anthropic.MessageParam[]
): Promise<LeaderboardSnapshot> {
  const bus = getBus();
  if (bus.busy) throw new AnalystBusyError();
  bus.busy = true;

  const transcriptId = createTranscript(kind, dossierIndex);
  beginStreaming(kind, dossierIndex);
  if (kind === "dossier" && dossierIndex !== null) {
    broadcast({ type: "dossier_started", dossierIndex });
  } else {
    broadcast({ type: "synthesis_started" });
  }

  try {
    const analysis = await streamAnalysis(messages, kind, dossierIndex);
    finishTranscript(transcriptId, analysis, "complete");
    endStreaming();
    if (kind === "dossier" && dossierIndex !== null) {
      broadcast({ type: "dossier_complete", dossierIndex });
    } else {
      broadcast({ type: "synthesis_complete" });
    }
    return await extractBoard(analysis, kind, dossierIndex);
  } catch (err) {
    // Preserve whatever streamed before the failure so nothing is lost,
    // but mark it errored so the admin can retry.
    finishTranscript(transcriptId, getBus().streaming.text, "error");
    endStreaming();
    broadcast({
      type: "analysis_error",
      kind,
      dossierIndex,
      message: err instanceof Error ? err.message : "unknown error",
    });
    throw err;
  } finally {
    bus.busy = false;
  }
}

export class AnalystBusyError extends Error {
  constructor() {
    super("An analysis is already in progress");
  }
}

export async function releaseDossier(index: number): Promise<LeaderboardSnapshot> {
  const dossier = getDossiers().find((d) => d.index === index);
  if (!dossier) throw new Error(`No dossier with index ${index}`);

  // A retry after an error re-runs the same index; clear the failed attempt.
  deleteFailedForRetry("dossier", index);

  markReleased(index);
  const history = buildHistory();
  history.push({
    role: "user",
    content: releasePrompt(dossier, history.length === 0),
  });
  return runPipeline("dossier", index, history);
}

export async function runSynthesis(): Promise<LeaderboardSnapshot> {
  deleteFailedForRetry("synthesis", null);
  const history = buildHistory();
  history.push({ role: "user", content: SYNTHESIS_PROMPT });
  return runPipeline("synthesis", null, history);
}

function deleteFailedForRetry(kind: TranscriptKind, dossierIndex: number | null): void {
  deleteFailedTranscripts(kind, dossierIndex);
}

export function latestSnapshot(): LeaderboardSnapshot | null {
  const all = getSnapshots();
  return all.length ? all[all.length - 1] : null;
}
