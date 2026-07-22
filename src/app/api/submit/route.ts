import { NextResponse } from "next/server";
import { getSubmissions, insertSubmission } from "@/lib/db";
import { screenSubmission } from "@/lib/screener";
import {
  ALLOWED_MIMES,
  MAX_FILE_BYTES,
  MAX_TEXT_CHARS,
  hashIp,
  rateLimitOk,
  saveUpload,
} from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Screening makes one Claude call (with a possible PDF attached).
export const maxDuration = 120;

const MAX_UNRELEASED = 300; // global backstop against queue flooding

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const ipHash = hashIp(ip);

  if (!rateLimitOk(`submit:${ipHash}`)) {
    return NextResponse.json(
      { error: "Rate limit: max 5 submissions per hour. Try again later." },
      { status: 429 }
    );
  }

  const unreleased = (await getSubmissions(["approved", "review", "pending"])).length;
  if (unreleased >= MAX_UNRELEASED) {
    return NextResponse.json(
      { error: "The submission queue is full. Try again after the next evidence drop." },
      { status: 503 }
    );
  }

  let claim = "";
  let sourceUrl = "";
  let context = "";
  let fileUrl: string | null = null;
  let fileName: string | null = null;
  let fileMime: string | null = null;

  try {
    const form = await req.formData();
    claim = String(form.get("claim") ?? "").trim();
    sourceUrl = String(form.get("sourceUrl") ?? "").trim();
    context = String(form.get("context") ?? "").trim();

    const file = form.get("file");
    if (file && file instanceof File && file.size > 0) {
      if (!(file.type in ALLOWED_MIMES)) {
        return NextResponse.json(
          { error: `Unsupported file type. Allowed: ${Object.keys(ALLOWED_MIMES).join(", ")}` },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB)` },
          { status: 400 }
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      fileUrl = await saveUpload(buf, file.type);
      fileName = file.name.slice(0, 120);
      fileMime = file.type;
    }
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (claim.length < 20) {
    return NextResponse.json(
      { error: "Describe the evidence in at least 20 characters." },
      { status: 400 }
    );
  }
  if (
    claim.length > MAX_TEXT_CHARS ||
    context.length > MAX_TEXT_CHARS ||
    sourceUrl.length > 500
  ) {
    return NextResponse.json({ error: "Submission too long." }, { status: 400 });
  }

  // AI vetting: approve / reject / hold for operator review.
  let verdict;
  try {
    verdict = await screenSubmission({ claim, sourceUrl, context, fileUrl, fileMime });
  } catch (err) {
    console.error("[submit] screener failed:", err);
    // Screener unavailable → never auto-publish; hold for the operator.
    verdict = {
      verdict: "review" as const,
      reason: "Automatic screening unavailable; held for operator review.",
      summary: "",
    };
  }

  const id = await insertSubmission({
    claim,
    sourceUrl,
    context,
    fileUrl,
    fileName,
    fileMime,
    status:
      verdict.verdict === "approve"
        ? "approved"
        : verdict.verdict === "reject"
          ? "rejected"
          : "review",
    verdictReason: verdict.reason,
    screenerSummary: verdict.summary,
    ipHash,
  });

  const publicMessage =
    verdict.verdict === "approve"
      ? "ACCEPTED — your evidence passed screening and enters the pool for the next community evidence drop."
      : verdict.verdict === "review"
        ? "HELD FOR REVIEW — the screener could not verify this automatically; a human operator will decide."
        : `REJECTED — ${verdict.reason}`;

  return NextResponse.json({ ok: true, id, verdict: verdict.verdict, message: publicMessage });
}
