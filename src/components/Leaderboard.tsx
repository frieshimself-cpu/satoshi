"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Candidate, LeaderboardSnapshot } from "@/lib/types";
import Sparkline from "./Sparkline";

function pctHistory(snapshots: LeaderboardSnapshot[], candidateId: string): number[] {
  return snapshots.map(
    (s) => s.probabilities.find((p) => p.candidate === candidateId)?.pct ?? 0
  );
}

export default function Leaderboard({
  snapshots,
  candidates,
}: {
  snapshots: LeaderboardSnapshot[];
  candidates: Candidate[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const latest = snapshots.length ? snapshots[snapshots.length - 1] : null;
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;

  const biggestMover = useMemo(() => {
    if (!latest || !previous) return null;
    let best: { id: string; delta: number } | null = null;
    for (const p of latest.probabilities) {
      const prev = previous.probabilities.find((q) => q.candidate === p.candidate)?.pct ?? 0;
      const delta = Math.abs(p.pct - prev);
      if (!best || delta > best.delta) best = { id: p.candidate, delta };
    }
    return best && best.delta > 0.05 ? best.id : null;
  }, [latest, previous]);

  const maxPct = latest ? Math.max(...latest.probabilities.map((p) => p.pct), 1) : 1;

  return (
    <div className="panel flex flex-col h-full min-h-0">
      <div className="panel-title justify-between">
        <span>▙ PROBABILITY BOARD</span>
        <span className="normal-case tracking-normal text-[10px] text-charcoal-600">
          {latest
            ? latest.afterKind === "synthesis"
              ? "FINAL"
              : latest.afterKind === "community"
                ? `AFTER COMMUNITY DROP #${latest.dossierIndex}`
                : `AFTER DOSSIER ${latest.dossierIndex}`
            : "AWAITING EVIDENCE"}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5">
        {!latest && (
          <div className="py-16 text-center">
            <div className="text-phosphor-dim tracking-[0.3em] text-sm">NO DATA</div>
            <div className="text-charcoal-600 text-xs mt-2">
              The board initializes when the first dossier drops.
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {latest?.probabilities.map((p) => {
            const candidate = candidates.find((c) => c.id === p.candidate);
            const prevPct =
              previous?.probabilities.find((q) => q.candidate === p.candidate)?.pct ?? null;
            const delta = prevPct !== null ? p.pct - prevPct : null;
            const isUnknown = p.candidate === "unknown";
            const isOpen = expanded === p.candidate;
            const barColor = isUnknown ? "bg-amber-glow/70" : "bg-phosphor/70";

            return (
              <motion.div
                key={p.candidate}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ layout: { duration: 0.7, ease: "easeInOut" } }}
                className={
                  "border border-charcoal-700 rounded-sm " +
                  (biggestMover === p.candidate ? "animate-flashmove" : "")
                }
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : p.candidate)}
                  className="w-full text-left px-2.5 py-2 hover:bg-charcoal-800/50"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={isUnknown ? "text-amber-glow" : "text-phosphor"}>
                      {p.name}
                      {candidate && candidate.status !== "living" && !isUnknown && (
                        <span className="text-charcoal-600 ml-1.5 text-[10px]">
                          [{candidate.status}]
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <Sparkline values={pctHistory(snapshots, p.candidate)} />
                      {delta !== null && Math.abs(delta) >= 0.05 && (
                        <span
                          className={
                            "text-[10px] tabular-nums " +
                            (delta > 0 ? "text-phosphor" : "text-amber-glow")
                          }
                        >
                          {delta > 0 ? "▲" : "▼"}
                          {Math.abs(delta).toFixed(1)}
                        </span>
                      )}
                      <span
                        className={
                          "tabular-nums font-bold " +
                          (isUnknown ? "text-amber-glow text-glow-amber" : "text-phosphor text-glow")
                        }
                      >
                        {p.pct.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 bg-charcoal-800 rounded-[1px] overflow-hidden">
                    <motion.div
                      className={`h-full ${barColor}`}
                      initial={false}
                      animate={{ width: `${(p.pct / maxPct) * 100}%` }}
                      transition={{ duration: 0.9, ease: "easeInOut" }}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-charcoal-700 px-2.5 py-2 space-y-2 text-[11.5px] leading-relaxed">
                    {candidate && <p className="text-phosphor-dim italic">{candidate.summary}</p>}
                    <div>
                      <span className="text-phosphor text-[10px] tracking-widest">FOR » </span>
                      <span className="text-[#a8d8b4]">{p.forEvidence}</span>
                    </div>
                    <div>
                      <span className="text-amber-glow text-[10px] tracking-widest">
                        AGAINST »{" "}
                      </span>
                      <span className="text-[#a8d8b4]">{p.againstEvidence}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {latest && (
          <div className="pt-2 text-[11px] leading-relaxed border-t border-charcoal-700 mt-3">
            <span className="text-amber-glow text-[10px] tracking-widest">
              MOST DECISIVE NEXT EVIDENCE »{" "}
            </span>
            <span className="text-phosphor-dim">{latest.mostDecisiveNextEvidence}</span>
          </div>
        )}
      </div>
    </div>
  );
}
