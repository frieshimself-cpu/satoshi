import { getCandidates, UNKNOWN_FLOOR, UNKNOWN_ID } from "./data";
import type { CandidateProbability } from "./types";

/**
 * Defensive normalization of the model's extracted leaderboard.
 *
 * Guarantees, regardless of what the model returned:
 *  - every candidate from candidates.json appears exactly once
 *  - all pcts are finite, non-negative numbers
 *  - pcts sum to exactly 100 (one decimal place)
 *  - the "Unknown / Not Listed" bucket is >= UNKNOWN_FLOOR (15)
 */
export function renormalize(raw: unknown): {
  probabilities: CandidateProbability[];
  mostDecisiveNextEvidence: string;
} {
  const candidates = getCandidates();
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawList = Array.isArray(obj.probabilities) ? obj.probabilities : [];

  // Index model output by best-effort candidate matching (id or name, case-insensitive).
  const byKey = new Map<string, any>();
  for (const entry of rawList) {
    if (!entry || typeof entry !== "object") continue;
    const key = String((entry as any).candidate ?? "").trim().toLowerCase();
    if (key) byKey.set(key, entry);
  }

  const matchFor = (c: { id: string; name: string }): any | undefined => {
    const idKey = c.id.toLowerCase();
    const nameKey = c.name.toLowerCase();
    if (byKey.has(idKey)) return byKey.get(idKey);
    if (byKey.has(nameKey)) return byKey.get(nameKey);
    // loose contains-match (e.g. "Unknown", "Hal Finney (deceased)")
    for (const [k, v] of Array.from(byKey.entries())) {
      if (k.includes(idKey) || idKey.includes(k) || k.includes(nameKey) || nameKey.includes(k)) {
        return v;
      }
    }
    return undefined;
  };

  const cleanPct = (v: unknown): number => {
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  };
  const cleanText = (v: unknown, fallback: string): string => {
    const s = typeof v === "string" ? v.trim() : "";
    return s || fallback;
  };

  let entries: CandidateProbability[] = candidates.map((c) => {
    const m = matchFor(c);
    return {
      candidate: c.id,
      name: c.name,
      pct: cleanPct(m?.pct),
      forEvidence: cleanText(m?.forEvidence, "No supporting evidence weighed yet."),
      againstEvidence: cleanText(m?.againstEvidence, "No countervailing evidence weighed yet."),
    };
  });

  // If the model returned nothing usable, fall back to a uniform prior with the floor.
  let sum = entries.reduce((a, e) => a + e.pct, 0);
  if (sum <= 0) {
    const others = entries.filter((e) => e.candidate !== UNKNOWN_ID);
    const share = (100 - UNKNOWN_FLOOR) / Math.max(others.length, 1);
    entries = entries.map((e) => ({
      ...e,
      pct: e.candidate === UNKNOWN_ID ? UNKNOWN_FLOOR : share,
    }));
    sum = 100;
  }

  // Scale to 100.
  entries = entries.map((e) => ({ ...e, pct: (e.pct / sum) * 100 }));

  // Enforce the Unknown floor: clamp Unknown to >= floor, rescale the rest into the remainder.
  const unknown = entries.find((e) => e.candidate === UNKNOWN_ID)!;
  if (unknown.pct < UNKNOWN_FLOOR) {
    const othersSum = 100 - unknown.pct;
    const targetOthers = 100 - UNKNOWN_FLOOR;
    entries = entries.map((e) =>
      e.candidate === UNKNOWN_ID
        ? { ...e, pct: UNKNOWN_FLOOR }
        : { ...e, pct: othersSum > 0 ? (e.pct / othersSum) * targetOthers : 0 }
    );
  }

  // Round to one decimal and absorb the rounding drift into the largest entry.
  entries = entries.map((e) => ({ ...e, pct: Math.round(e.pct * 10) / 10 }));
  const drift = Math.round((100 - entries.reduce((a, e) => a + e.pct, 0)) * 10) / 10;
  if (drift !== 0) {
    const largest = entries.reduce((a, b) => (b.pct > a.pct ? b : a));
    largest.pct = Math.round((largest.pct + drift) * 10) / 10;
  }

  entries.sort((a, b) => b.pct - a.pct);

  return {
    probabilities: entries,
    mostDecisiveNextEvidence: cleanText(
      obj.mostDecisiveNextEvidence,
      "A verified signature from one of Satoshi's known early keys."
    ),
  };
}
