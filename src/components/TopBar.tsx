"use client";

import DecryptText from "./DecryptText";

export default function TopBar({
  releasedCount,
  totalDossiers,
  isStreaming,
  connected,
  synthesisTriggered,
}: {
  releasedCount: number;
  totalDossiers: number;
  isStreaming: boolean;
  connected: boolean;
  synthesisTriggered: boolean;
}) {
  return (
    <header className="border-b border-charcoal-600 bg-charcoal-950/95 sticky top-0 z-40">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="text-phosphor text-glow text-lg sm:text-xl font-bold tracking-[0.18em]">
          <DecryptText text="WHO IS SATOSHI?" />
        </h1>

        <div className="flex items-center gap-1.5 text-[11px] tracking-widest">
          <span className="text-phosphor-dim mr-1">DOSSIERS</span>
          {Array.from({ length: totalDossiers }, (_, i) => (
            <span
              key={i}
              className={
                "w-5 h-5 grid place-items-center border text-[10px] " +
                (i < releasedCount
                  ? "border-phosphor-dim text-phosphor bg-phosphor-faint/40"
                  : "border-charcoal-600 text-charcoal-600")
              }
            >
              {i + 1}
            </span>
          ))}
          {synthesisTriggered && (
            <a
              href="/synthesis"
              className="ml-2 text-amber-glow text-glow-amber hover:underline"
            >
              [SYNTHESIS]
            </a>
          )}
        </div>

        <div className="flex items-center gap-4 ml-auto text-[11px] tracking-widest">
          {isStreaming ? (
            <span className="text-amber-glow text-glow-amber animate-pulseglow">
              ● ANALYZING
            </span>
          ) : (
            <span className="text-phosphor-dim">○ STANDBY</span>
          )}
          <span className={connected ? "text-phosphor-dim" : "text-alert animate-pulseglow"}>
            {connected ? "LINK OK" : "SIGNAL LOST — resuming..."}
          </span>
        </div>

        <p className="w-full text-[10.5px] leading-snug text-charcoal-600 sm:text-phosphor-dim/70">
          The AI reasons only from the evidence shown. It cannot and will not name a single
          answer — only weigh probabilities. This is a reasoning exercise, not an accusation.
        </p>
      </div>
    </header>
  );
}
