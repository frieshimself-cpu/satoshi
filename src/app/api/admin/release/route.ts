import { NextResponse } from "next/server";
import { isMirror } from "@/lib/store";
import { AnalystBusyError, releaseDossier } from "@/lib/analyst";
import { isAuthed } from "@/lib/auth";
import { getDossiers } from "@/lib/data";
import { getReleasedIndexes, hasCompleteTranscript } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Streaming + extraction can take a couple of minutes.
export const maxDuration = 300;

export async function POST(req: Request) {
  if (isMirror()) {
    return NextResponse.json(
      { error: "Read-only mirror: the investigation is operated externally." },
      { status: 409 }
    );
  }
  if (!isAuthed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let index: number;
  try {
    const body = await req.json();
    index = Number(body?.index);
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const dossiers = getDossiers();
  if (!Number.isInteger(index) || index < 1 || index > dossiers.length) {
    return NextResponse.json({ error: `index must be 1–${dossiers.length}` }, { status: 400 });
  }

  const released = await getReleasedIndexes();
  const isRetry = released.includes(index) && !(await hasCompleteTranscript("dossier", index));
  const nextExpected = released.length + 1;

  // Enforce strict order: only the next unreleased dossier, or a retry of a
  // release whose analysis failed mid-stream.
  if (!isRetry && index !== nextExpected) {
    return NextResponse.json(
      {
        error:
          index <= released.length
            ? `Dossier ${index} is already released and analyzed`
            : `Out of order: next releasable dossier is ${nextExpected}`,
      },
      { status: 409 }
    );
  }

  try {
    const snapshot = await releaseDossier(index);
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    if (err instanceof AnalystBusyError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("[release] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed", retryable: true },
      { status: 500 }
    );
  }
}
