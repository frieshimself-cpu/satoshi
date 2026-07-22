import { getBus } from "./bus";
import { getCandidates, getDossiers } from "./data";
import { getReleaseTimes, getReleasedIndexes, getSnapshots, getTranscripts } from "./db";
import type { AppState, PublicDossier } from "./types";

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

  return {
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
