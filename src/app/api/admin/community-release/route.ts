import { NextResponse } from "next/server";
import {
  AnalystBusyError,
  releaseCommunityBatch,
  retryCommunityBatch,
} from "@/lib/analyst";
import { isAuthed } from "@/lib/auth";
import { getSubmissions, getTranscripts, hasCompleteTranscript } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  if (!isAuthed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The synthesis is the finale — the board is final after it.
  if (hasCompleteTranscript("synthesis", null)) {
    return NextResponse.json(
      { error: "The synthesis has run; the board is final. Reset to start a new investigation." },
      { status: 409 }
    );
  }

  try {
    // A failed community analysis takes precedence: retry it before new batches.
    const failed = getTranscripts().find((t) => t.kind === "community" && t.status === "error");
    if (failed && failed.dossierIndex !== null) {
      const snapshot = await retryCommunityBatch(failed.dossierIndex);
      return NextResponse.json({ ok: true, retried: failed.dossierIndex, snapshot });
    }

    const approved = getSubmissions(["approved"]);
    if (!approved.length) {
      return NextResponse.json(
        { error: "No approved submissions waiting for release" },
        { status: 409 }
      );
    }
    const snapshot = await releaseCommunityBatch(approved);
    return NextResponse.json({ ok: true, count: approved.length, snapshot });
  } catch (err) {
    if (err instanceof AnalystBusyError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[community-release] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Community release failed", retryable: true },
      { status: 500 }
    );
  }
}
