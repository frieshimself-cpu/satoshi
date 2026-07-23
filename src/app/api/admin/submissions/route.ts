import { NextResponse } from "next/server";
import { isMirror } from "@/lib/store";
import { isAuthed } from "@/lib/auth";
import { getSubmissions, setSubmissionStatus, type SubmissionRow } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toAdminView(r: SubmissionRow) {
  return {
    id: r.id,
    claim: r.claim,
    sourceUrl: r.source_url,
    context: r.context,
    fileName: r.file_name,
    fileMime: r.file_mime,
    status: r.status,
    verdictReason: r.verdict_reason,
    screenerSummary: r.screener_summary,
    batchId: r.batch_id,
    createdAt: r.created_at,
  };
}

export async function GET() {
  if (!isAuthed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    { submissions: (await getSubmissions()).map(toAdminView) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Operator override: approve or reject a submission that isn't released yet. */
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

  let id: number;
  let action: string;
  try {
    const body = await req.json();
    id = Number(body?.id);
    action = String(body?.action ?? "");
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!Number.isInteger(id) || (action !== "approve" && action !== "reject")) {
    return NextResponse.json(
      { error: 'Expected {id, action: "approve"|"reject"}' },
      { status: 400 }
    );
  }

  const sub = (await getSubmissions()).find((s) => s.id === id);
  if (!sub) return NextResponse.json({ error: "No such submission" }, { status: 404 });
  if (sub.status === "released") {
    return NextResponse.json(
      { error: "Submission already released in a community drop" },
      { status: 409 }
    );
  }

  await setSubmissionStatus(
    id,
    action === "approve" ? "approved" : "rejected",
    `Operator ${action}d this submission.`
  );
  return NextResponse.json({ ok: true });
}
