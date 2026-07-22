import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { broadcast, getBus } from "@/lib/bus";
import { resetAll } from "@/lib/db";
import { clearUploads } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAuthed()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Double-confirm handshake: the client must echo the exact phrase.
  try {
    const body = await req.json();
    if (body?.confirm !== "RESET THE INVESTIGATION") {
      return NextResponse.json(
        { error: 'Confirmation phrase required: {"confirm":"RESET THE INVESTIGATION"}' },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (getBus().busy) {
    return NextResponse.json(
      { error: "Cannot reset while an analysis is streaming" },
      { status: 409 }
    );
  }

  await resetAll();
  await clearUploads();
  broadcast({ type: "reset" });
  return NextResponse.json({ ok: true });
}
