import { getBus } from "./bus";
import { getCandidates, getDossiers } from "./data";
import {
  getCommunityBatches,
  getReleaseTimes,
  getReleasedIndexes,
  getSharedStreaming,
  getSnapshots,
  getSubmissionsByBatch,
  getTranscripts,
} from "./db";
import { readDoc } from "./store";
import type { AppState, CommunityBatch, PublicDossier } from "./types";

export async function getAppState(): Promise<AppState> {
  const releasedTimes = await getReleaseTimes();
  const released = new Set(await getReleasedIndexes());
  const dossiers = getDossiers();
  const transcripts = await getTranscripts();
  const bus = getBus();

  const publicDossiers: PublicDossier[] = dossiers.map((d) =>
    released.has(d.index)
      ? { ...d, released: true as const, releasedAt: releasedTimes[d.index] }
      : { released: false as const, index: d.index, codename: d.codename, title: "SEALED" as const }
  );

  const synthesisTranscript = transcripts.find(
    (t) => t.kind === "synthesis" && t.status === "complete"
  );

  const communityBatches: CommunityBatch[] = [];
  for (const b of await getCommunityBatches()) {
    communityBatches.push({
      id: b.id,
      releasedAt: b.released_at,
      submissions: (await getSubmissionsByBatch(b.id)).map((s) => ({
        claim: s.claim,
        sourceUrl: s.source_url,
        context: s.context,
        fileName: s.file_name,
        screenerSummary: s.screener_summary,
      })),
    });
  }

  // Streaming: the instance running the analysis has the authoritative live
  // buffer in memory; every other instance serves the shared flushed copy.
  let streaming = { ...bus.streaming };
  if (!streaming.active) {
    const shared = await getSharedStreaming();
    // Ignore stale buffers (e.g. instance died mid-flush > 3 min ago).
    if (
      shared.active &&
      shared.updatedAt &&
      Date.now() - new Date(shared.updatedAt).getTime() < 3 * 60 * 1000
    ) {
      streaming = {
        active: true,
        kind: shared.kind as AppState["streaming"]["kind"],
        dossierIndex: shared.dossierIndex,
        text: shared.text,
      };
    }
  }

  return {
    communityBatches,
    candidates: getCandidates(),
    dossiers: publicDossiers,
    transcripts,
    snapshots: await getSnapshots(),
    streaming,
    synthesis: {
      triggered: !!synthesisTranscript,
      content: synthesisTranscript?.content ?? null,
    },
    releasedCount: released.size,
    totalDossiers: dossiers.length,
    // The demo flag lives in the state doc so the operator can mark a whole
    // run as simulated; the UI must surface it wherever analysis is shown.
    demo: !!((await readDoc()) as { demo?: boolean }).demo,
  };
}
