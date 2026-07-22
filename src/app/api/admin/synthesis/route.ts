import { NextResponse } from "next/server";
import { AnalystBusyError, runSynthesis } from "@/lib/analyst";
import { isAuthed } from "@/lib/auth";
import { getDossiers } from "@/lib/data";
import { getReleasedIndexes, hasCompleteTranscript } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  if (!isAuthed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const total = getDossiers().length;
  const released = getReleasedIndexes();
  if (released.length < total) {
    return NextResponse.json(
      { error: `Synthesis requires all ${total} dossiers released (currently ${released.length})` },
      { status: 409 }
    );
  }
  for (let i = 1; i <= total; i++) {
    if (!hasCompleteTranscript("dossier", i)) {
      return NextResponse.json(
        { error: `Dossier ${i} has no completed analysis — retry it first` },
        { status: 409 }
      );
    }
  }
  if (hasCompleteTranscript("synthesis", null)) {
    return NextResponse.json({ error: "Synthesis already completed" }, { status: 409 });
  }

  try {
    const snapshot = await runSynthesis();
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    if (err instanceof AnalystBusyError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[synthesis] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Synthesis failed", retryable: true },
      { status: 500 }
    );
  }
}
