"use client";

import { useState } from "react";
import DisclaimerFooter from "./DisclaimerFooter";
import DossierFeed from "./DossierFeed";
import Leaderboard from "./Leaderboard";
import ReasoningPane from "./ReasoningPane";
import TopBar from "./TopBar";
import { useInvestigation } from "./useInvestigation";

type Tab = "dossiers" | "reasoning" | "board";

export default function Dashboard() {
  const inv = useInvestigation();
  const [tab, setTab] = useState<Tab>("reasoning");

  if (!inv.state) {
    return (
      <main className="min-h-screen grid place-items-center">
        <div className="text-phosphor-dim tracking-[0.35em] text-sm animate-pulseglow">
          ESTABLISHING LINK...
        </div>
      </main>
    );
  }

  const s = inv.state;

  return (
    <main className="min-h-screen flex flex-col pb-20">
      <TopBar
        releasedCount={s.releasedCount}
        totalDossiers={s.totalDossiers}
        isStreaming={inv.isStreaming}
        connected={inv.connected}
        synthesisTriggered={s.synthesis.triggered}
      />

      {/* Mobile tab switcher */}
      <div className="lg:hidden flex border-b border-charcoal-600 text-[11px] tracking-widest">
        {(
          [
            ["dossiers", "DOSSIERS"],
            ["reasoning", "REASONING"],
            ["board", "BOARD"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              "flex-1 py-2.5 " +
              (tab === key
                ? "text-phosphor text-glow border-b-2 border-phosphor"
                : "text-charcoal-600")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 max-w-[1600px] w-full mx-auto px-3 sm:px-5 py-4">
        {/* Desktop: 3 columns. Center column sized to crop well at 9:16. */}
        <div className="hidden lg:grid grid-cols-[minmax(280px,1fr)_minmax(380px,1.2fr)_minmax(340px,1.1fr)] gap-4 h-[calc(100vh-190px)]">
          <div className="overflow-y-auto pr-1">
            <DossierFeed dossiers={s.dossiers} />
          </div>
          <ReasoningPane
            transcripts={s.transcripts}
            liveText={inv.liveText}
            liveKind={inv.liveKind}
            liveDossierIndex={inv.liveDossierIndex}
            isStreaming={inv.isStreaming}
            lastError={inv.lastError}
          />
          <Leaderboard snapshots={s.snapshots} candidates={s.candidates} />
        </div>

        {/* Mobile: stacked tabs */}
        <div className="lg:hidden h-[calc(100vh-230px)]">
          {tab === "dossiers" && (
            <div className="h-full overflow-y-auto">
              <DossierFeed dossiers={s.dossiers} />
            </div>
          )}
          {tab === "reasoning" && (
            <ReasoningPane
              transcripts={s.transcripts}
              liveText={inv.liveText}
              liveKind={inv.liveKind}
              liveDossierIndex={inv.liveDossierIndex}
              isStreaming={inv.isStreaming}
              lastError={inv.lastError}
            />
          )}
          {tab === "board" && (
            <Leaderboard snapshots={s.snapshots} candidates={s.candidates} />
          )}
        </div>
      </div>

      <DisclaimerFooter />
    </main>
  );
}
