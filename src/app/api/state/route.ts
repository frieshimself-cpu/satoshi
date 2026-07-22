import { NextResponse } from "next/server";
import { getAppState } from "@/lib/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getAppState(), {
    // Edge-cache briefly: hundreds of polling viewers collapse into ~one
    // storage read per few seconds per region.
    headers: { "Cache-Control": "public, s-maxage=3, stale-while-revalidate=27" },
  });
}
