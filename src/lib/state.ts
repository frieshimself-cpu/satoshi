import { getBus } from "./bus";
import { getCandidates, getDossiers } from "./data";
import {
  getCommunityBatches,
  getReleaseTimes,
  getReleasedIndexes,
  getSnapshots,
  getSubmissionsByBatch,
  getTranscripts,
} from "./db";
import type { AppState, CommunityBatch, PublicDossier } from "./types";

export function getAppState(): AppState {
  const releasedTimes = getReleaseTimes();
  const released = new Set(getReleasedIndexes());
  const dossiers = getDossiers();
  const transcripts = getTranscripts();
  const bus = getBus();

  const publicDossiers: PublicDossier[] = dossiers.map((d) =>
    released.has(d.index)
      ? { ...d, released: true as const, releasedAt: releasedTimes[d.index] }
      : { released: false as const, index: d.index, codename: d.codename, title: "SEALED" as const }
  );

  const synthesisTranscript = transcripts.find(
    (t) => t.kind === "synthesis" && t.status === "complete"
  );

  const communityBatches: CommunityBatch[] = getCommunityBatches().map((b) => ({
    id: b.id,
    releasedAt: b.released_at,
    submissions: getSubmissionsByBatch(b.id).map((s) => ({
      claim: s.claim,
      sourceUrl: s.source_url,
      context: s.context,
      fileName: s.file_name,
      screenerSummary: s.screener_summary,
    })),
  }));

  return {
    communityBatches,
    candidates: getCandidates(),
    dossiers: publicDossiers,
    transcripts,
    snapshots: getSnapshots(),
    streaming: { ...bus.streaming },
    synthesis: {
      triggered: !!synthesisTranscript,
      content: synthesisTranscript?.content ?? null,
    },
    releasedCount: released.size,
    totalDossiers: dossiers.length,
  };
}
