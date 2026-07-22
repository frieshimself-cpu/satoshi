export interface EvidenceItem {
  claim: string;
  source: string;
}

export interface Candidate {
  id: string;
  name: string;
  status: string;
  summary: string;
  publicEvidence: EvidenceItem[];
}

export interface DossierItem {
  heading: string;
  content: string;
  source: string;
}

export interface Dossier {
  index: number;
  codename: string;
  title: string;
  summary: string;
  items: DossierItem[];
}

/** Dossier as exposed to the public API: sealed ones are redacted. */
export type PublicDossier =
  | (Dossier & { released: true; releasedAt: string })
  | {
      released: false;
      index: number;
      codename: string;
      title: "SEALED";
    };

export type TranscriptKind = "dossier" | "synthesis";
export type TranscriptStatus = "streaming" | "complete" | "error";

export interface Transcript {
  id: number;
  kind: TranscriptKind;
  dossierIndex: number | null;
  content: string;
  status: TranscriptStatus;
  startedAt: string;
  completedAt: string | null;
}

export interface CandidateProbability {
  candidate: string; // candidate id
  name: string;
  pct: number;
  forEvidence: string;
  againstEvidence: string;
}

export interface LeaderboardSnapshot {
  id: number;
  afterKind: TranscriptKind;
  dossierIndex: number | null;
  probabilities: CandidateProbability[];
  mostDecisiveNextEvidence: string;
  createdAt: string;
}

export interface StreamingState {
  active: boolean;
  kind: TranscriptKind | null;
  dossierIndex: number | null;
  text: string;
}

export interface AppState {
  candidates: Candidate[];
  dossiers: PublicDossier[];
  transcripts: Transcript[];
  snapshots: LeaderboardSnapshot[];
  streaming: StreamingState;
  synthesis: { triggered: boolean; content: string | null };
  releasedCount: number;
  totalDossiers: number;
}

export type BusEvent =
  | { type: "token"; kind: TranscriptKind; dossierIndex: number | null; text: string }
  | { type: "dossier_started"; dossierIndex: number }
  | { type: "dossier_complete"; dossierIndex: number }
  | { type: "synthesis_started" }
  | { type: "synthesis_complete" }
  | { type: "leaderboard_update"; snapshot: LeaderboardSnapshot }
  | { type: "analysis_error"; kind: TranscriptKind; dossierIndex: number | null; message: string }
  | { type: "reset" };
