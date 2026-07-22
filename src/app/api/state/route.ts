import { NextResponse } from "next/server";
import { getAppState } from "@/lib/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getAppState(), {
    headers: { "Cache-Control": "no-store" },
  });
}
